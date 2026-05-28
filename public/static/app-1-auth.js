/* 上中黒板 v2.0 - メインアプリケーション */
let currentUser = null, currentTab = null, currentThreadId = null;
let reloadTimer = null, notifCheckTimer = null, clockTimer = null;
const CLUBS = ['サッカー部','男子バスケ部','女子バスケ部','男子卓球部','女子卓球部','陸上部','野球部','バレーボール部','男子テニス部','女子テニス部','茶道部','美術部','吹奏楽部'];
const COMMITTEES = ['生徒会','整備委員会','生活委員会','保健委員会','図書委員会','給食委員会','放送委員会','体育委員会','合唱委員会','中央委員会','部活動委員会','1学年委員会','2学年委員会','3学年委員会'];
const ROLE_LABELS = {admin:'管理者',teacher:'先生',captain:'部長',chairman:'委員長',vice_captain:'副部長',vice_chairman:'副委員長',student:'生徒',student_council:'生徒会',staff:'職員',club_member:'部員',pe_committee:'体育委員'};
const ALL_ROLES = ['admin','teacher','staff','captain','chairman','vice_captain','vice_chairman','student','student_council','club_member','pe_committee'];
const EMOJIS = ['👍','❤️','😊','🎉','😮','🙏'];

function esc(s) { const d=document.createElement('div'); d.appendChild(document.createTextNode(s||'')); return d.innerHTML; }

let deferredPrompt = null;

document.addEventListener('DOMContentLoaded', () => { checkAuth(); if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{}); });

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

async function checkAuth() {
  try { const r=await api('/api/auth/me'); if(r.user) { currentUser=r.user; if(currentUser.first_login) showSetupModal(); else showApp(); } else showLogin(); }
  catch { showLogin(); }
}

async function doLogin() {
  const username=document.getElementById('login-username').value.trim();
  const password=document.getElementById('login-password').value;
  const errEl=document.getElementById('login-error'); errEl.classList.add('hidden');
  if(!username||!password) { errEl.textContent='入力してください'; errEl.classList.remove('hidden'); return; }
  try { const r=await api('/api/auth/login',{method:'POST',body:{username,password}}); currentUser=r.user; if(currentUser.first_login) showSetupModal(); else showApp(); }
  catch(e) { errEl.textContent=e.message||'ログイン失敗'; errEl.classList.remove('hidden'); }
}

async function doLogout() {
  await api('/api/auth/logout',{method:'POST'}); currentUser=null; clearTimers();
  document.getElementById('app').classList.add('hidden'); showLogin();
}

async function doRegister() {
  const token=document.getElementById('reg-token').value.trim();
  const uname=document.getElementById('reg-username').value.trim();
  const pw=document.getElementById('reg-password').value;
  const errEl=document.getElementById('register-error'); errEl.classList.add('hidden');
  try { await api('/api/auth/register',{method:'POST',body:{token,username:uname,password:pw}}); hideRegisterModal(); toast('登録完了。ログインしてください','success'); }
  catch(e) { errEl.textContent=e.message||'登録失敗'; errEl.classList.remove('hidden'); }
}

function showLogin() { document.getElementById('login-screen').classList.remove('hidden'); }
function hideLogin() { document.getElementById('login-screen').classList.add('hidden'); }
function showRegisterModal() { document.getElementById('register-modal').classList.remove('hidden'); }
function hideRegisterModal() { document.getElementById('register-modal').classList.add('hidden'); }

function showSetupModal() {
  hideLogin();
  const c=document.getElementById('setup-form-container');
  const role=currentUser.role;
  let h='<div class="space-y-4"><div><label class="form-label">名前</label><input id="setup-name" type="text" class="form-input"></div>';
  if(role==='admin'||role==='teacher') {
    h+='<div><label class="form-label">パスワード変更（任意）</label><input id="setup-password" type="password" class="form-input"></div>';
    if(role==='teacher') h+='<div><label class="form-label">教科</label><input id="setup-subject" type="text" class="form-input"></div>';
  } else {
    h+='<div class="grid grid-cols-3 gap-2"><div><label class="form-label">学年</label><input id="setup-grade" type="number" class="form-input" min="1" max="3"></div><div><label class="form-label">クラス</label><input id="setup-class" type="number" class="form-input" min="1" max="9"></div><div><label class="form-label">番号</label><input id="setup-number" type="number" class="form-input" min="1" max="50"></div></div>';
    h+='<div><label class="form-label">パスワード変更（任意）</label><input id="setup-password" type="password" class="form-input"></div>';
  }
  c.innerHTML=h; document.getElementById('setup-modal').classList.remove('hidden');
}

async function submitSetup() {
  const name=document.getElementById('setup-name')?.value.trim();
  if(!name) { toast('名前を入力してください','error'); return; }
  const body={name,password:document.getElementById('setup-password')?.value||undefined};
  const role=currentUser.role;
  if(role==='teacher') { body.subject=document.getElementById('setup-subject')?.value.trim(); }
  else if(!['admin','teacher'].includes(role)) {
    body.grade=parseInt(document.getElementById('setup-grade')?.value)||undefined;
    body.class_num=parseInt(document.getElementById('setup-class')?.value)||undefined;
    body.number=parseInt(document.getElementById('setup-number')?.value)||undefined;
  }
  try { const r=await api('/api/auth/setup',{method:'POST',body}); currentUser=r.user; document.getElementById('setup-modal').classList.add('hidden'); showApp(); toast('設定完了','success'); }
  catch(e) { toast(e.message||'設定失敗','error'); }
}

function showApp() {
  hideLogin(); document.getElementById('setup-modal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateHeader(); buildNav(); loadInfoBar(); startTimers(); startClock();
  navigateTo(getDefaultTab());
  checkPushSetting();
}

function getDefaultTab() { const t=getVisibleTabs(); return t[0]?.id||'bulletin'; }

function updateHeader() {
  document.getElementById('header-name').textContent=currentUser.name||currentUser.username;
  const ae=document.getElementById('header-avatar');
  if(currentUser.avatar_url) ae.innerHTML='<img src="'+currentUser.avatar_url+'" class="w-full h-full rounded-full object-cover">';
  else ae.innerHTML='<span>'+(currentUser.name||currentUser.username||'?')[0]+'</span>';
}

async function checkPushSetting() {
  if(!('Notification' in window)||!('serviceWorker' in navigator))return;
  if(Notification.permission==='denied')return;
  try{
    const r=await api('/api/admin/notifications/settings');
    if(r.settings?.push_enabled)return;
  }catch{}
  setTimeout(showPushPrompt,1500);
}

function showPushPrompt(){
  showModal('プッシュ通知','<div class="text-center space-y-4"><div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100"><i class="fas fa-bell text-blue-600 text-3xl"></i></div><p class="text-gray-700">お知らせやメッセージをリアルタイムで受け取れます。<br><strong class="text-blue-600">通知をオンにすることをおすすめします。</strong></p></div>',[
    {label:'スキップ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},
    {label:'通知をオンにする（推奨）',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:requestPushPermission}
  ]);
}

async function requestPushPermission(){
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){closeModal();toast('通知がオフになりました。設定から変更できます','info');return;}
    const reg=await navigator.serviceWorker.ready;
    let sub;
    try{sub=await reg.pushManager.getSubscription();}catch{}
    if(!sub){
      try{
        const vapidRes=await api('/api/notifications/vapid-key');
        sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidRes.publicKey});
      }catch{
        await api('/api/admin/notifications/settings',{method:'PUT',body:{push_enabled:true}});
        closeModal();toast('通知をオンにしました','success');
        return;
      }
    }
    const subJson=JSON.stringify(sub);
    await api('/api/admin/notifications/settings',{method:'PUT',body:{push_enabled:true,push_subscription:subJson}});
    closeModal();toast('通知をオンにしました','success');
  }catch{
    try{await api('/api/admin/notifications/settings',{method:'PUT',body:{push_enabled:true}});}catch{}
    closeModal();toast('通知をオンにしました','success');
  }
}

function startClock() {
  if(clockTimer) clearInterval(clockTimer);
  function up() { const n=new Date(); document.getElementById('digital-clock').textContent=n.toLocaleTimeString('ja-JP'); }
  up(); clockTimer=setInterval(up,1000);
}

function getVisibleTabs() {
  const roles=currentUser.roles||[currentUser.role];
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  const isCaptain=roles.some(r=>['captain','chairman','vice_captain','vice_chairman','student_council'].includes(r));
  return [
    {id:'bulletin',icon:'fa-bullhorn',label:'掲示板',visible:true},
    {id:'notice',icon:'fa-school',label:'上中連絡',visible:true},
    {id:'committee',icon:'fa-users-cog',label:'委員会',visible:!!(currentUser.committee||isStaff)},
    {id:'club',icon:'fa-running',label:'部活動',visible:!!(currentUser.club||isStaff)},
    {id:'question',icon:'fa-question-circle',label:'質問',visible:true},
    {id:'classgroup',icon:'fa-chalkboard-teacher',label:'クラス',visible:true},
    {id:'messages',icon:'fa-comments',label:'メッセージ',visible:true},
    {id:'captchat',icon:'fa-crown',label:'部長Chat',visible:isCaptain||isStaff},
    {id:'survey',icon:'fa-poll',label:'アンケート',visible:true},
    {id:'consult',icon:'fa-hands-helping',label:'相談所',visible:true},
    {id:'notifications',icon:'fa-bell',label:'通知',visible:true},
    {id:'howto',icon:'fa-book-open',label:'使い方',visible:true},
    {id:'settings',icon:'fa-cog',label:'設定',visible:true}
  ].filter(t=>t.visible);
}

function buildNav() {
  const tabs=getVisibleTabs();
  const nav=document.getElementById('nav-tabs'); nav.innerHTML='';
  tabs.forEach(tab=>{
    const btn=document.createElement('button'); btn.className='nav-btn'; btn.id='nav-'+tab.id;
    let html='<i class="fas '+tab.icon+'"></i><span>'+tab.label+'</span>';
    if(tab.id==='messages')html='<div class="relative inline-flex"><i class="fas '+tab.icon+'"></i><span id="msg-badge" class="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 hidden"></span></div><span>'+tab.label+'</span>';
    btn.innerHTML=html;
    btn.onclick=()=>navigateTo(tab.id); nav.appendChild(btn);
  });
}

function navigateTo(tabId) {
  currentTab=tabId;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('nav-'+tabId); if(btn) btn.classList.add('active');
  renderTab(tabId);
}

function renderTab(tabId) {
  const content=document.getElementById('tab-content'); content.innerHTML='';
  const fns={
    bulletin:renderBulletin, notice:renderNotice, committee:renderCommittee,
    club:renderClub, question:renderQuestion, classgroup:renderClassGroup,
    messages:renderMessages, captchat:renderCaptChat, survey:renderSurveyList,
    consult:renderConsult, howto:renderHowTo, settings:renderSettings,
    notifications:renderNotifications
  };
  if(fns[tabId]) fns[tabId](content);
  else content.innerHTML='<div class="empty-state"><i class="fas fa-construction"></i><p>準備中</p></div>';
}

function clearTimers() { [reloadTimer,notifCheckTimer,clockTimer].forEach(t=>{if(t) clearInterval(t);}); }
function loadInfoBar() { fetchWBGT(); }
function startTimers() {
  notifCheckTimer=setInterval(fetchUnreadCount,30000);
  reloadTimer=setInterval(()=>{if(currentTab) renderTab(currentTab);},60000);
}
