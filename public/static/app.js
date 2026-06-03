/* 上中黒板 v3.0 - メインアプリケーション */
let currentUser = null, currentTab = null, currentThreadId = null;
let reloadTimer = null, notifCheckTimer = null, clockTimer = null;
const CLUBS = ['サッカー部','男子バスケ部','女子バスケ部','卓球部','陸上部','野球部','バレーボール部','男子テニス部','女子テニス部','茶道部','美術部','吹奏楽部'];
const COMMITTEES = ['生徒会','整備委員会','生活委員会','保健委員会','図書委員会','給食委員会','放送委員会','体育委員会','合唱委員会','中央委員会','部活動委員会','1学年委員会','2学年委員会','3学年委員会'];
const ROLE_LABELS = {admin:'管理者',teacher:'先生',captain:'部長',chairman:'委員長',vice_captain:'副部長',vice_chairman:'副委員長',student:'生徒',student_council:'生徒会'};
const ALL_ROLES = ['admin','teacher','captain','chairman','vice_captain','vice_chairman','student','student_council'];
const EMOJIS = ['👍','❤️','😊','🎉','😮','🙏'];

function forceUpdate(){if(!confirm('アプリを最新バージョンに更新しますか？'))return;toast('更新中...','info');if('caches' in window){caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(regs=>{regs.forEach(r=>r.unregister());});}setTimeout(()=>location.reload(true),500);});}else{location.reload(true);}}

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

function showInitForm() { document.getElementById('init-modal').classList.remove('hidden'); }
function hideInitModal() { document.getElementById('init-modal').classList.add('hidden'); }
async function doInit() {
  const username=document.getElementById('init-username').value.trim();
  const password=document.getElementById('init-password').value;
  const errEl=document.getElementById('init-error'); errEl.classList.add('hidden');
  if(!username||!password) { errEl.textContent='入力してください'; errEl.classList.remove('hidden'); return; }
  try { await api('/api/auth/init',{method:'POST',body:{username,password}}); hideInitModal(); toast('管理者作成完了。ログインしてください','success'); }
  catch(e) { errEl.textContent=e.message||'作成失敗'; errEl.classList.remove('hidden'); }
}

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
  pollNotifications();
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
    if(r.settings?.push_enabled&&r.settings?.push_subscription)return;
  }catch{}
  if(Notification.permission==='granted')return;
  if(localStorage.getItem('push_dismissed'))return;
  setTimeout(showPushPrompt,1500);
}

function showPushPrompt(){
  showModal('プッシュ通知','<div class="text-center space-y-4"><div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100"><i class="fas fa-bell text-blue-600 text-3xl"></i></div><p class="text-gray-700">お知らせやメッセージをリアルタイムで受け取れます。<br><strong class="text-blue-600">通知をオンにすることをおすすめします。</strong></p></div>',[
    {label:'スキップ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:function(){localStorage.setItem('push_dismissed','1');closeModal();}},
    {label:'通知をオンにする（推奨）',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:requestPushPermission}
  ]);
}

function urlBase64ToUint8Array(s){const p='='.repeat((4-s.length%4)%4);const b64=(s+p).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b64);const arr=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);return arr;}
function requestPushPermission(){
  if(!('PushManager' in window)){closeModal();showPushUnsupported();return;}
  Notification.requestPermission().then(async function(perm){
    if(perm!=='granted'){closeModal();toast('通知がオフになりました。設定から変更できます','info');return;}
    try{
      var reg=await navigator.serviceWorker.ready;
      var sub;
      try{sub=await reg.pushManager.getSubscription();}catch{}
      if(!sub){
        var vapidRes=await api('/api/notifications/vapid-key');
        if(!vapidRes.publicKey){toast('通知設定が完了していません。管理者に連絡してください','error');closeModal();return;}
        sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidRes.publicKey)});
      }
      var subJson=JSON.stringify(sub);
      await api('/api/admin/notifications/settings',{method:'PUT',body:{push_enabled:true,push_subscription:subJson}});
      closeModal();toast('通知をオンにしました','success');
    }catch(e){
      closeModal();toast('通知の設定に失敗しました: '+(e.message||'エラー'),'error');
    }
  }).catch(function(e){
    closeModal();toast('通知の設定に失敗しました: '+(e.message||'エラー'),'error');
  });
}
function showPushUnsupported(){
  showModal('プッシュ通知','<div class="text-center space-y-4"><div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100"><i class="fas fa-exclamation-triangle text-yellow-600 text-3xl"></i></div><p class="text-gray-700">このブラウザではプッシュ通知を利用できません。<br><strong>iPadの場合は、Safariの共有ボタンから「ホーム画面に追加」してからお試しください。</strong></p></div>',[{label:'閉じる',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);
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
    {id:'consult',icon:'fa-hands-helping',label:'相談所',visible:true},
    {id:'notifications',icon:'fa-bell',label:'通知',visible:true},
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
    if(tab.id==='notifications')html='<div class="relative inline-flex"><i class="fas '+tab.icon+'"></i><span id="notif-badge" class="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 hidden"></span></div><span>'+tab.label+'</span>';
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
    messages:renderMessages, captchat:renderCaptChat,
    consult:renderConsult, settings:renderSettings,
    notifications:renderNotifications
  };
  if(fns[tabId]) fns[tabId](content);
  else content.innerHTML='<div class="empty-state"><i class="fas fa-construction"></i><p>準備中</p></div>';
}

function clearTimers() { [reloadTimer,notifCheckTimer,clockTimer].forEach(t=>{if(t) clearInterval(t);}); }
function loadInfoBar() { fetchWBGT(); fetchDisasterInfo(); }
function updateInfoBar() {}
function startTimers() {
  notifCheckTimer=setInterval(fetchUnreadCount,30000);
  reloadTimer=setInterval(()=>{if(currentTab&&!window._peActive) renderTab(currentTab);},60000);
  setInterval(fetchDisasterInfo,300000);
  setInterval(fetchWBGT,300000);
}

// === Committee ===
function renderCommittee(container) {
  window._peActive=null;
  const roles=currentUser.roles||[currentUser.role];
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  const myCommittee=currentUser.committee;
  const isPE=isStaff||myCommittee==='体育委員会';
  let tabs='';
  if(isStaff) tabs=COMMITTEES.map((c,i)=>'<button class="h-scroll-tab'+(i===0?' active':'')+'" onclick="switchGroupTab(\'committee\',\''+c+'\',this)">'+c+'</button>').join('');
  else if(myCommittee) {
    tabs='<button class="h-scroll-tab active">'+myCommittee+'</button>';
  }
  if(isPE) tabs+='<button class="h-scroll-tab'+(tabs?'':' active')+'" onclick="switchGroupTab(\'pe_checklist\',\'\',this)"><i class="fas fa-clipboard-list mr-1"></i>用具確認</button>';
  const canPost=isStaff||roles.some(r=>['chairman','vice_chairman','student_council'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-users-cog text-purple-600"></i>委員会</h2>'+(canPost?'<button onclick="openPostModal(\'committee\',window.currentCommitteeTarget)" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div><div class="h-scroll-tabs" id="committee-tabs">'+tabs+'</div></div><div class="p-3" id="committee-list"><div class="skeleton h-24"></div></div>';
  window.currentCommitteeTarget=isStaff?COMMITTEES[0]:myCommittee;
  if(window.currentCommitteeTarget) loadPosts('committee',window.currentCommitteeTarget,'committee-list');
}

function switchGroupTab(type,target,btn) {
  document.querySelectorAll('#committee-tabs .h-scroll-tab, #club-tabs .h-scroll-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(type==='pe_checklist'){renderPEChecklist(document.getElementById('committee-list'));return;}
  window._peActive=null;
  if(type==='committee'){window.currentCommitteeTarget=target;loadPosts('committee',target,'committee-list');}
  else if(type==='club'){window.currentClubTarget=target;loadPosts('club',target,'club-list');}
}

// === Club ===
function renderClub(container) {
  const roles=currentUser.roles||[currentUser.role];
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  const myClub=currentUser.club;
  let tabs='';
  if(isStaff) tabs=CLUBS.map((c,i)=>'<button class="h-scroll-tab'+(i===0?' active':'')+'" onclick="switchGroupTab(\'club\',\''+c+'\',this)">'+c+'</button>').join('');
  else if(myClub) tabs='<button class="h-scroll-tab active">'+myClub+'</button>';
  const canPost=isStaff||roles.some(r=>['captain','vice_captain','student_council'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-running text-red-600"></i>部活動</h2>'+(canPost?'<button onclick="openPostModal(\'club\',window.currentClubTarget)" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div><div class="h-scroll-tabs" id="club-tabs">'+tabs+'</div></div><div class="p-3" id="club-list"><div class="skeleton h-24"></div></div>';
  window.currentClubTarget=isStaff?CLUBS[0]:myClub;
  if(window.currentClubTarget) loadPosts('club',window.currentClubTarget,'club-list');
}

// === Posts ===
async function loadPosts(category,target,containerId) {
  const c=document.getElementById(containerId); if(!c) return;
  try {
    let url='/api/posts?category='+category;
    if(target) url+='&target='+encodeURIComponent(target);
    const r=await api(url);
    if(window._peActive) return;
    if(!r.posts||!r.posts.length){c.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>投稿がありません</p></div>';return;}
    c.innerHTML=r.posts.map(p=>renderPostCard(p)).join('');
  } catch { if(window._peActive) return; c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>'; }
}

function renderPostCard(post) {
  const rl=ROLE_LABELS[post.author_role]||post.author_role;
  const es=post.expires_at?'<span class="text-xs text-gray-400 ml-2"><i class="fas fa-clock"></i> '+formatDate(post.expires_at)+'</span>':'';
  const fh=renderFilePreview(post.file_url,post.file_type);
  const ib=post.is_important?'<span class="badge badge-admin mr-1"><i class="fas fa-star mr-1"></i>重要</span>':'';
  const re=(post.reactions||[]).map(r=>'<button class="reaction-btn" onclick="reactToPost('+post.id+',\''+r.emoji+'\',this)">'+r.emoji+' <span>'+r.count+'</span></button>').join('');
  const ar='<button class="reaction-btn" onclick="showEmojiPicker('+post.id+',\'post\',this)"><i class="fas fa-smile-beam"></i></button>';
  const del=canDeletePost(post)?'<button onclick="deletePost('+post.id+')" class="text-red-400 hover:text-red-600 text-sm"><i class="fas fa-trash"></i></button>':'';
  const claimBtn=post.category==='lost_item'?'<button class="claim-btn'+(post.is_claimed?' claimed':'')+'" onclick="claimLostItem('+post.id+',this)"><i class="fas '+(post.is_claimed?'fa-check-circle':'fa-hand-paper')+' mr-1"></i>'+(post.is_claimed?'申請済み':'私のです')+'</button>'+(post.claim_count>0?'<span class="text-xs text-gray-400">'+post.claim_count+'人申請中</span>':'<span class="text-xs text-gray-400">まだ申請なし</span>')+(currentUser&&(currentUser.id===post.author_id||(currentUser.roles||[]).includes('admin'))?'<button onclick="showClaimants('+post.id+')" class="text-xs text-blue-600 hover:underline ml-2">確認</button>':'')+'</div>':'';
  return '<div class="post-card slide-in" id="post-'+post.id+'"><div class="flex items-start justify-between mb-2"><div>'+ib+'<span class="badge badge-'+post.author_role+' mr-2">'+rl+'</span><span class="font-semibold text-gray-800">'+esc(post.author_name||'不明')+'</span>'+es+'</div><div class="flex gap-2 items-center"><span class="text-xs text-gray-400">'+formatRelative(post.created_at)+'</span>'+del+'</div></div>'+(post.title?'<h3 class="font-bold text-gray-800 mb-1">'+esc(post.title)+'</h3>':'')+'<p class="text-gray-700 text-sm whitespace-pre-wrap">'+esc(post.content)+'</p>'+fh+'<div class="flex flex-wrap gap-2 mt-3 items-center">'+re+ar+'</div><div class="flex items-center gap-2 mt-2">'+claimBtn+'</div>'+(post.read_count!=null?'<div class="text-xs text-gray-400 mt-1"><i class="fas fa-eye mr-1"></i>既読 '+post.read_count+'人</div>':'')+'</div>';
}
function claimLostItem(id,btn){api('/api/posts/'+id+'/claim',{method:'POST'}).then(r=>{if(r.action==='claimed'){btn.classList.add('claimed');btn.innerHTML='<i class="fas fa-check-circle mr-1"></i>申請済み';}else{btn.classList.remove('claimed');btn.innerHTML='<i class="fas fa-hand-paper mr-1"></i>私のです';}}).catch(e=>toast(e.message||'エラー','error'));}
function showClaimants(id){api('/api/posts/'+id+'/claims').then(r=>{const h=r.claims.length?r.claims.map(c=>'<div class="flex items-center justify-between py-2 border-b"><div><span class="font-semibold text-sm">'+esc(c.name)+'</span><span class="text-xs text-gray-500 ml-2">'+(c.grade?c.grade+'-'+c.class_num+' '+c.number+'番':'')+'</span></div><span class="text-xs text-gray-400">'+formatRelative(c.created_at)+'</span></div>').join(''):'<p class="text-gray-500 text-sm">申請者はいません</p>';showModal('申請者一覧',h,[{label:'閉じる',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);}).catch(()=>toast('読込失敗','error'));}

function canDeletePost(post) {
  if(!currentUser) return false;
  if((currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r))) return true;
  return post.author_id===currentUser.id;
}

async function deletePost(id) {
  if(!confirm('削除しますか？')) return;
  try{await api('/api/posts/'+id,{method:'DELETE'});const el=document.getElementById('post-'+id);if(el)el.remove();toast('削除しました','success');}catch(e){toast('削除失敗','error');}
}

async function reactToPost(postId,emoji,btn) {
  try{
    const r=await api('/api/posts/'+postId+'/react',{method:'POST',body:{emoji}});
    const s=btn.querySelector('span');const c=parseInt(s?.textContent||'0');
    if(r.action==='added'){btn.classList.add('reacted');if(s)s.textContent=c+1;}
    else{btn.classList.remove('reacted');if(s)s.textContent=Math.max(0,c-1);}
  }catch{}
}

function showEmojiPicker(targetId,type,btn) {
  const ex=document.querySelector('.emoji-picker');if(ex)ex.remove();
  const pk=document.createElement('div');pk.className='emoji-picker fixed z-50 bg-white rounded-xl shadow-2xl border p-2 flex gap-2';
  const rect=btn.getBoundingClientRect();pk.style.top=(rect.bottom+4)+'px';pk.style.left=rect.left+'px';
  EMOJIS.forEach(e=>{const b=document.createElement('button');b.textContent=e;b.className='text-2xl hover:scale-125 transition';b.onclick=()=>{pk.remove();if(type==='post')reactToPost(targetId,e,{querySelector:()=>null,classList:{add:()=>{},remove:()=>{}}});};pk.appendChild(b);});
  document.body.appendChild(pk);setTimeout(()=>document.addEventListener('click',()=>pk.remove(),{once:true}),100);
}

function openPostModal(category,target) {
  const today=new Date().toISOString().split('T')[0];
  const maxDate=new Date(Date.now()+60*24*60*60*1000).toISOString().split('T')[0];
  showModal('投稿作成','<div class="space-y-4"><div><label class="form-label">タイトル（任意）</label><input id="post-title" type="text" class="form-input"></div><div><label class="form-label">内容 *</label><textarea id="post-content" class="form-input" rows="5" placeholder="内容を入力..."></textarea></div><div><label class="form-label">消去日（1日後〜最大2ヶ月）</label><input id="post-expires" type="date" class="form-input" min="'+today+'" max="'+maxDate+'"></div><div><label class="form-label">ファイル添付</label><input type="file" id="post-file-input" class="form-input" accept="image/*,.pdf" onchange="handleFileSelect(event)"><div id="post-file-preview" class="hidden mt-2 p-2 bg-gray-50 rounded-lg flex items-center gap-2"><i class="fas fa-file text-blue-500"></i><span id="post-file-name" class="text-sm flex-1"></span><button onclick="clearFileSelect()" class="text-red-400 text-sm"><i class="fas fa-times"></i></button></div></div></div>',[
    {label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},
    {label:'投稿する',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitPost(category,target)}
  ]);
  window._pendingFile=null;
}

function handleFileSelect(e) {
  const f=e.target.files?.[0];if(!f)return;
  window._pendingFile=f;document.getElementById('post-file-preview').classList.remove('hidden');
  document.getElementById('post-file-name').textContent=f.name;
}

function clearFileSelect(){window._pendingFile=null;document.getElementById('post-file-input').value='';document.getElementById('post-file-preview').classList.add('hidden');}

async function submitPost(category,target) {
  const title=document.getElementById('post-title').value.trim();
  const content=document.getElementById('post-content').value.trim();
  if(!content){toast('内容を入力してください','error');return;}
  let fileUrl,fileType;
  if(window._pendingFile){
    try{const fd=new FormData();fd.append('file',window._pendingFile);const up=await api('/api/upload',{method:'POST',body:fd,noJson:true});fileUrl=up.url;fileType=up.mime_type?.startsWith('image/')?'image':'pdf';}
    catch(e){toast('ファイルアップロード失敗','error');return;}
  }
  const expires=document.getElementById('post-expires').value;
  try{
    await api('/api/posts',{method:'POST',body:{category,target:target||undefined,title:title||undefined,content,file_url:fileUrl,file_type:fileType,expires_at:expires?new Date(expires).toISOString():undefined}});
    closeModal();toast('投稿しました','success');renderTab(currentTab);
  }catch(e){toast(e.message||'投稿失敗','error');}
}

// === Bulletin ===
function renderBulletin(container) {
  const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bullhorn text-red-600"></i>掲示板</h2>'+(isAdmin?'<button onclick="openPostModal(\'bulletin\')" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div></div><div class="p-3" id="bulletin-list"><div class="skeleton h-24"></div></div>';
  loadPosts('bulletin','','bulletin-list');
}

// === Notice (上中連絡 + 忘れ物 + アンケート) ===
function renderNotice(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-school text-orange-600"></i>上中連絡</h2>'+(isStaff?'<button id="notice-add-btn" onclick="openPostModal(\'school_notice\')" class="bg-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div><div class="sub-nav"><button class="sub-nav-btn active" onclick="switchNoticeTab(\'school_notice\',this)"><i class="fas fa-school mr-1"></i>連絡</button><button class="sub-nav-btn" onclick="switchNoticeTab(\'lost_item\',this)"><i class="fas fa-box-open mr-1"></i>忘れ物</button><button class="sub-nav-btn" onclick="switchNoticeTab(\'survey\',this)"><i class="fas fa-poll mr-1"></i>アンケート</button></div></div><div class="p-3" id="notice-content"><div class="skeleton h-24"></div></div>';
  loadPosts('school_notice','','notice-content');
}

function switchNoticeTab(tab,btn) {
  document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  const c=document.getElementById('notice-content');if(!c)return;
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  const addBtn=document.getElementById('notice-add-btn');
  if(tab==='survey') {
    if(addBtn) addBtn.style.display='none';
    c.innerHTML='<div class="flex gap-2 flex-wrap mb-3">'+(isStaff?'<button onclick="openNewSurveyModal()" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>作成</button>':'')+'<button class="sub-nav-btn active" onclick="switchSurveyTab(\'open\',this,\'notice-content\')">回答受付中</button><button class="sub-nav-btn" onclick="switchSurveyTab(\'closed\',this,\'notice-content\')">終了</button></div><div id="survey-list"><div class="skeleton h-20"></div></div>';
    loadSurveys('open','survey-list');
  } else {
    if(addBtn){addBtn.style.display='';addBtn.setAttribute('onclick',"openPostModal('"+tab+"')");}
    c.innerHTML='<div class="skeleton h-24"></div>';
    loadPosts(tab,'','notice-content');
  }
}

// === Question ===
function renderQuestion(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-question-circle text-green-600"></i>質問</h2><button onclick="openAskModal()" class="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>質問する</button></div><div class="sub-nav"><button class="sub-nav-btn active" onclick="switchQuestionTab(\'my\',this)">自分への質問</button><button class="sub-nav-btn" onclick="switchQuestionTab(\'sent\',this)">送った質問</button>'+(isStaff?'<button class="sub-nav-btn" onclick="switchQuestionTab(\'history\',this)">全履歴</button>':'')+'</div></div><div class="p-3" id="question-list"><div class="skeleton h-20"></div></div>';
  loadMyQuestions();
}

function switchQuestionTab(tab,btn){
  document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  if(tab==='my')loadMyQuestions();else if(tab==='sent')loadSentQuestions();else if(tab==='history')loadQuestionHistory();
}

async function loadMyQuestions() {
  const c=document.getElementById('question-list');if(!c)return;
  try{const r=await api('/api/questions/my');if(!r.questions.length){c.innerHTML='<div class="empty-state"><i class="fas fa-question"></i><p>質問がありません</p></div>';return;}
  c.innerHTML=r.questions.map(q=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-2"><span class="font-semibold text-sm text-gray-700">'+esc(q.asker_name)+'</span><span class="text-xs text-gray-400">'+formatRelative(q.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(q.content)+'</p>'+(q.answer?'<div class="mt-3 pt-3 border-t"><p class="text-green-700 text-sm"><i class="fas fa-reply mr-1"></i>'+esc(q.answer)+'</p></div>':'<button onclick="openAnswerModal('+q.id+')" class="mt-2 text-blue-600 text-sm hover:underline"><i class="fas fa-pen mr-1"></i>回答する</button>')+'</div>').join('');}
  catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}
}

async function loadSentQuestions() {
  const c=document.getElementById('question-list');if(!c)return;
  try{const r=await api('/api/questions/sent');if(!r.questions.length){c.innerHTML='<div class="empty-state"><i class="fas fa-paper-plane"></i><p>送った質問はありません</p></div>';return;}
  c.innerHTML=r.questions.map(q=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-2"><span class="font-semibold text-sm text-gray-700">→ '+esc(q.target_name)+'</span><span class="text-xs text-gray-400">'+formatRelative(q.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(q.content)+'</p>'+(q.answer?'<div class="mt-3 pt-3 border-t text-green-700 text-sm"><i class="fas fa-reply mr-1"></i>'+esc(q.answer)+'</div>':'<span class="text-xs text-gray-400">未回答</span>')+'</div>').join('');}catch{}
}

async function loadQuestionHistory() {
  const c=document.getElementById('question-list');if(!c)return;
  try{const r=await api('/api/questions/history');if(!r.questions.length){c.innerHTML='<div class="empty-state"><i class="fas fa-history"></i><p>履歴なし</p></div>';return;}
  c.innerHTML=r.questions.map(q=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-1"><span class="text-xs text-gray-500">'+esc(q.asker_name)+' → '+esc(q.target_name)+'</span><span class="text-xs text-gray-400">'+formatRelative(q.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(q.content)+'</p>'+(q.answer?'<p class="text-green-700 text-sm mt-2"><i class="fas fa-reply mr-1"></i>'+esc(q.answer)+'</p>':'<span class="text-xs text-gray-400">未回答</span>')+'</div>').join('');}catch{}
}

async function openAskModal() {
  try{const r=await api('/api/questions/targets');const opts=r.targets.map(t=>'<option value="'+t.id+'">'+esc(t.name)+' ('+(ROLE_LABELS[t.role]||t.role)+')</option>').join('');
  showModal('質問する','<div class="space-y-4"><div><label class="form-label">質問先</label><select id="ask-target" class="form-input">'+opts+'</select></div><div><label class="form-label">質問内容</label><textarea id="ask-content" class="form-input" rows="4" placeholder="質問を入力..."></textarea></div></div>',[
    {label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},
    {label:'送信',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitAsk}]);}catch(e){toast('読込失敗','error');}
}

async function submitAsk(){const t=parseInt(document.getElementById('ask-target').value);const c=document.getElementById('ask-content').value.trim();if(!c){toast('入力してください','error');return;}try{await api('/api/questions',{method:'POST',body:{target_id:t,content:c}});closeModal();toast('送信しました','success');loadMyQuestions();}catch(e){toast(e.message||'送信失敗','error');}}

function openAnswerModal(qId){showModal('回答','<textarea id="answer-content" class="form-input" rows="4" placeholder="回答を入力..."></textarea>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'回答する',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitAnswer(qId)}]);}

async function submitAnswer(qId){const a=document.getElementById('answer-content').value.trim();if(!a){toast('入力してください','error');return;}try{await api('/api/questions/'+qId+'/answer',{method:'PUT',body:{answer:a}});closeModal();toast('回答しました','success');loadMyQuestions();}catch(e){toast('回答失敗','error');}}

// === Class Group ===
async function renderClassGroup(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  const myGrade=currentUser.grade?String(currentUser.grade):null;
  const myClass=currentUser.class_num?String(currentUser.class_num):null;
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-chalkboard-teacher text-yellow-600"></i>クラス</h2>'+(isStaff?'<button onclick="openClassPostModal()" class="bg-yellow-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div><div class="h-scroll-tabs" id="class-tabs"></div></div><div class="p-3" id="class-list"><div class="skeleton h-24"></div></div>';
  let tabs='';
  if(isStaff){
    try{const r=await api('/api/admin/classes');const classes=r.classes||[];tabs=classes.map((x,i)=>{const g=x.grade,c=x.class_num;return'<button class="h-scroll-tab'+(i===0?' active':'')+'" onclick="switchClassTab('+g+','+c+',this)">'+g+'年'+c+'組</button>';}).join('');if(!tabs)tabs='<button class="h-scroll-tab active" onclick="switchClassTab(1,1,this)">1年1組</button>';}catch{tabs='<button class="h-scroll-tab active" onclick="switchClassTab(1,1,this)">1年1組</button>';}
  }else if(myGrade&&myClass){
    tabs='<button class="h-scroll-tab active">'+myGrade+'年'+myClass+'組</button>';
  }
  const tabsContainer=document.getElementById('class-tabs');if(tabsContainer)tabsContainer.innerHTML=tabs;
  window.classTarget=myGrade&&myClass?myGrade+'-'+myClass:null;
  if(isStaff){const firstTab=document.querySelector('#class-tabs .h-scroll-tab');if(firstTab)window.classTarget=firstTab.textContent.replace('年','-').replace('組','');else window.classTarget='1-1';}
  if(window.classTarget)loadPosts('class',window.classTarget,'class-list');
}

function switchClassTab(grade,cn,btn){document.querySelectorAll('#class-tabs .h-scroll-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');window.classTarget=grade+'-'+cn;loadPosts('class',window.classTarget,'class-list');}

async function openClassPostModal(){
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  if(!isStaff){toast('先生のみ投稿できます','error');return;}
  let opts='';
  try{const r=await api('/api/admin/classes');const classes=r.classes||[];opts=classes.map(x=>'<option value="'+x.grade+'-'+x.class_num+'">'+x.grade+'年'+x.class_num+'組</option>').join('');if(!opts)opts='<option value="1-1">1年1組</option>';}catch{opts='<option value="1-1">1年1組</option>';}
  showModal('クラスに投稿','<div class="space-y-4"><div><label class="form-label">クラス</label><select id="class-post-target" class="form-input">'+opts+'</select></div><div><label class="form-label">内容</label><textarea id="class-post-content" class="form-input" rows="4"></textarea></div></div>',[
    {label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},
    {label:'投稿',className:'bg-yellow-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitClassPost}
  ]);
}

async function submitClassPost(){
  const target=document.getElementById('class-post-target').value;
  const content=document.getElementById('class-post-content').value.trim();
  if(!content){toast('内容を入力','error');return;}
  try{await api('/api/posts',{method:'POST',body:{category:'class',target,content}});closeModal();toast('投稿しました','success');loadPosts('class',target,'class-list');}catch(e){toast(e.message||'失敗','error');}
}

// === Messages ===
function renderMessages(container) {
  container.innerHTML='<div class="flex flex-col h-full"><div class="bg-white border-b px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-comments text-blue-600"></i>メッセージ</h2><button onclick="openNewThreadModal(\'direct\')" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>新規</button></div><div id="thread-list" class="flex-1 overflow-y-auto"></div></div>';
  loadThreads('direct');
}

async function loadThreads(type) {
  const c=document.getElementById('thread-list');if(!c)return;
  try{const r=await api('/api/messages/threads?type='+type);if(!r.threads.length){c.innerHTML='<div class="empty-state"><i class="fas fa-comment-slash"></i><p>メッセージがありません</p></div>';return;}
  c.innerHTML=r.threads.map(t=>{const om=t.members.filter(m=>m.id!==currentUser.id);const n=t.name||om.map(m=>m.name||'?').join('、')||'グループ';const ti=t.type==='group'?'👥':'💬';const pi=t.is_pinned?'<i class="fas fa-thumbtack text-blue-500 text-xs ml-1"></i>':'';return'<div class="thread-item" onclick="openThread('+t.id+',\''+esc(n)+'\')"><div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-none text-xl">'+ti+'</div><div class="flex-1 min-w-0"><div class="flex justify-between items-baseline"><span class="font-semibold text-sm text-gray-800 truncate">'+esc(n)+pi+'</span><span class="text-xs text-gray-400 flex-none ml-2">'+(t.last_message_at?formatRelative(t.last_message_at):'')+'</span></div><p class="text-xs text-gray-500 truncate">'+(t.last_message?esc(t.last_message):'')+'</p></div>'+(t.unread_count>0?'<span class="flex-none bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">'+t.unread_count+'</span>':'')+'</div>';}).join('');}
  catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}
}

function openThread(threadId,threadName) {
  currentThreadId=threadId;
  const content=document.getElementById('tab-content');
  content.innerHTML='<div class="flex flex-col h-full"><div class="bg-white border-b px-4 py-3 flex items-center gap-3"><button onclick="navigateTo(\'messages\')" class="p-1 hover:bg-gray-100 rounded-full text-gray-500"><i class="fas fa-arrow-left"></i></button><span class="font-bold text-gray-800 flex-1">'+esc(threadName)+'</span><button onclick="togglePinThread('+threadId+')" class="p-1.5 hover:bg-gray-100 rounded-full text-gray-500" title="ピン留め"><i class="fas fa-thumbtack"></i></button><button onclick="deleteThread('+threadId+')" class="p-1.5 hover:bg-gray-100 rounded-full text-red-400" title="削除"><i class="fas fa-trash"></i></button><button onclick="showThreadMembers('+threadId+')" class="p-1.5 hover:bg-gray-100 rounded-full text-gray-500" title="参加者"><i class="fas fa-users"></i></button></div><div id="msg-list" class="flex-1 overflow-y-auto p-4 space-y-3"></div><div class="bg-white border-t p-3 flex gap-2"><input id="msg-input" type="text" class="flex-1 form-input" placeholder="メッセージを入力..." onkeydown="if(event.key===\'Enter\')sendMessage()"><label class="p-2 hover:bg-gray-100 rounded-lg cursor-pointer text-gray-500"><i class="fas fa-paperclip"></i><input type="file" class="hidden" accept="image/*,.pdf" onchange="sendFileMessage(event)"></label><button onclick="sendMessage()" class="bg-blue-600 text-white px-4 rounded-xl"><i class="fas fa-paper-plane"></i></button></div></div>';
  loadMessages(threadId);
}

async function togglePinThread(id){try{const r=await api('/api/messages/threads/'+id+'/pin',{method:'POST'});toast(r.is_pinned?'ピン留めしました':'ピン留め解除しました','success');}catch(e){toast('失敗','error');}}
async function deleteThread(id){if(!confirm('このスレッドを削除しますか？'))return;try{await api('/api/messages/threads/'+id,{method:'DELETE'});toast('削除しました','success');navigateTo('messages');}catch(e){toast('削除失敗','error');}}

async function showThreadMembers(id){try{const r=await api('/api/messages/threads/'+id);const t=r.thread;if(!t){toast('スレッド情報取得失敗','error');return;}const isCaptainChat=t.type==='captain_group';const roles=currentUser.roles||[currentUser.role];const canManage=isCaptainChat||roles.includes('admin');const ml=t.members.map(m=>'<div class="flex items-center justify-between gap-2 py-1"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">'+(m.name||'?')[0]+'</div><span class="text-sm">'+esc(m.name)+' ('+(ROLE_LABELS[m.role]||m.role)+')</span></div>'+(canManage&&m.id!==currentUser.id?'<button onclick="removeThreadMember('+id+','+m.id+')" class="text-red-500 text-xs hover:underline">削除</button>':'')+'</div>').join('');showModal('参加者'+(isCaptainChat?'（部長チャット）':''),'<div class="space-y-1">'+(ml||'<p class="text-sm text-gray-500">メンバーなし</p>')+'</div>'+(canManage?'<div class="mt-3 pt-3 border-t"><button onclick="addThreadMember('+id+')" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs"><i class="fas fa-plus mr-1"></i>メンバー追加</button></div>':''),[{label:'閉じる',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);}catch{toast('読込失敗','error');}}

async function addThreadMember(id){try{const r=await api('/api/messages/users');const users=r.users.filter(u=>u.id!==currentUser.id);const cards=users.map(u=>{const info=[];if(u.grade)info.push(u.grade+'-'+u.class_num);if(u.club)info.push(u.club);if(u.committee)info.push(u.committee);const roleLbl=ROLE_LABELS[u.role]||u.role;const initial=esc((u.name||'?')[0]);return'<div onclick="selectAddMember(this,'+u.id+')" data-id="'+u.id+'" data-name="'+esc(u.name)+'" class="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-blue-50 transition"><div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-none">'+initial+'</div><div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">'+esc(u.name)+'</p><p class="text-xs text-gray-500 truncate">'+roleLbl+(info.length?' | '+esc(info.join(' | ')):'')+'</p></div><div class="sel-check w-5 h-5 rounded border-2 border-gray-300"></div></div>';}).join('');window._addMemThreadId=id;window._addMemSelected=null;showModal('メンバー追加','<div class="space-y-3"><input id="addmem-search" type="text" class="form-input" placeholder="名前で検索..." oninput="filterAddMemberList()"><div id="addmem-list" class="max-h-60 overflow-y-auto space-y-1">'+cards+'</div><p id="addmem-selected" class="text-xs text-gray-400">選択なし</p></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'追加',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:async()=>{const uid=window._addMemSelected;if(!uid){toast('選択してください','error');return;}try{await api('/api/messages/threads/'+id+'/members',{method:'POST',body:{user_id:uid}});closeModal();toast('追加しました','success');showThreadMembers(id);}catch(e){toast(e.message||'失敗','error');}}}]);}catch{toast('読込失敗','error');}}

async function removeThreadMember(tid,uid){if(!confirm('このメンバーを削除しますか？'))return;try{await api('/api/messages/threads/'+tid+'/members/'+uid,{method:'DELETE'});toast('削除しました','success');showThreadMembers(tid);}catch(e){toast(e.message||'失敗','error');}}

async function loadMessages(id){const c=document.getElementById('msg-list');if(!c)return;try{const r=await api('/api/messages/threads/'+id+'/messages');if(!r.messages.length){c.innerHTML='<div class="empty-state"><i class="fas fa-comment"></i><p>まだメッセージがありません</p></div>';return;}c.innerHTML=r.messages.map(m=>{const isMine=m.sender_id===currentUser.id;const ri=m.readers?.length>0?'<span class="text-xs text-blue-400 ml-1"><i class="fas fa-check-double"></i> '+m.readers.filter(r=>r.id!==m.sender_id).length+'</span>':'';return'<div class="flex '+(isMine?'justify-end':'justify-start')+' gap-2 items-end">'+(!isMine?'<div class="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs flex-none">'+((m.sender_name||'?')[0])+'</div>':'')+'<div class="group relative">'+(!isMine?'<p class="text-xs text-gray-500 mb-1 ml-1">'+esc(m.sender_name)+'</p>':'')+'<div class="msg-bubble '+(isMine?'mine':'others')+'">'+esc(m.content)+'</div>'+(m.file_url?renderFilePreview(m.file_url,m.file_type):'')+'<div class="flex items-center gap-1 mt-1 '+(isMine?'justify-end':'')+'"><span class="text-xs text-gray-400">'+formatRelative(m.created_at)+'</span>'+ri+'</div><button onclick="deleteMessage('+id+','+m.id+')" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition" title="取消"><i class="fas fa-times"></i></button></div></div>';}).join('');c.scrollTop=c.scrollHeight;}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

async function deleteMessage(tid,mid){if(!confirm('取消しますか？'))return;try{await api('/api/messages/threads/'+tid+'/messages/'+mid,{method:'DELETE'});toast('取消しました','success');loadMessages(tid);}catch(e){toast(e.message||'取消失敗','error');}}

async function sendMessage(){const inp=document.getElementById('msg-input');const c=inp?.value.trim();if(!c||!currentThreadId)return;inp.value='';try{await api('/api/messages/threads/'+currentThreadId+'/messages',{method:'POST',body:{content:c}});loadMessages(currentThreadId);}catch(e){toast(e.message||'送信失敗','error');}}

async function sendFileMessage(e){const f=e.target?.files?.[0];if(!f||!currentThreadId)return;try{const fd=new FormData();fd.append('file',f);const up=await api('/api/upload',{method:'POST',body:fd,noJson:true});await api('/api/messages/threads/'+currentThreadId+'/messages',{method:'POST',body:{content:'',file_url:up.url,file_type:up.mime_type?.startsWith('image/')?'image':'pdf'}});loadMessages(currentThreadId);}catch(e){toast('送信失敗','error');}}
window._selMembers=[];window._addMemSelected=null;window._addMemThreadId=null;
function toggleSelMember(el,id){const arr=window._selMembers;if(window._selMode==='single'){arr.forEach(i=>{const p=document.querySelector('#member-list>[data-id="'+i+'"]');if(p){p.classList.remove('border-blue-500','bg-blue-50');const ck=p.querySelector('.sel-check');if(ck){ck.classList.remove('bg-blue-500','border-blue-500');ck.textContent='';}}});arr.length=0;arr.push(id);el.classList.add('border-blue-500','bg-blue-50');const ck=el.querySelector('.sel-check');if(ck){ck.classList.add('bg-blue-500','border-blue-500');ck.textContent=String.fromCharCode(10003);}}else{const idx=arr.indexOf(id);if(idx>=0){arr.splice(idx,1);el.classList.remove('border-blue-500','bg-blue-50');const ck=el.querySelector('.sel-check');if(ck){ck.classList.remove('bg-blue-500','border-blue-500');ck.textContent='';}}else{arr.push(id);el.classList.add('border-blue-500','bg-blue-50');const ck=el.querySelector('.sel-check');if(ck){ck.classList.add('bg-blue-500','border-blue-500');ck.textContent=String.fromCharCode(10003);}}}const d=document.getElementById('sel-members-display');if(d){const ids=arr.slice();const names=ids.map(i=>{const u=document.querySelector('#member-list>[data-id="'+i+'"]');return u?u.getAttribute('data-name')||'':'';}).filter(Boolean);d.innerHTML=names.length?names.map(n=>'<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">'+esc(n)+'</span>').join('')+' <span class="text-gray-400 text-xs">('+names.length+'人)</span>':'<span class="text-gray-400 text-xs">選択なし</span>';}}
function filterMemberList(){const q=(document.getElementById('member-search')?.value||'').toLowerCase();document.querySelectorAll('#member-list>[data-id]').forEach(el=>{const txt=(el.getAttribute('data-search')||el.textContent||'').toLowerCase();el.style.display=txt.includes(q)?'':'none';});}
function selectAddMember(el,id){if(window._addMemSelected){const prev=document.querySelector('#addmem-list>[data-id="'+window._addMemSelected+'"]');if(prev){prev.classList.remove('border-blue-500','bg-blue-50');const ck=prev.querySelector('.sel-check');if(ck){ck.classList.remove('bg-blue-500');ck.style.borderColor='';}}}window._addMemSelected=id;el.classList.add('border-blue-500','bg-blue-50');const ck=el.querySelector('.sel-check');if(ck){ck.classList.add('bg-blue-500');ck.style.borderColor='rgb(59,130,246)';}const el2=document.getElementById('addmem-selected');if(el2){const name=el.getAttribute('data-name')||el.querySelector('.text-sm.font-semibold')?.textContent||'';el2.innerHTML='<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">選択中: '+esc(name)+'</span>';}}
function filterAddMemberList(){const q=(document.getElementById('addmem-search')?.value||'').toLowerCase();document.querySelectorAll('#addmem-list>[data-id]').forEach(el=>{const txt=(el.textContent||'').toLowerCase();el.style.display=txt.includes(q)?'':'none';});}

async function openNewThreadModal(type){try{const r=await api('/api/messages/users');const isMulti=type==='group';window._selMembers=[];window._selMode=isMulti?'multi':'single';const cards=r.users.map(u=>{const info=[];if(u.grade)info.push(u.grade+'-'+u.class_num);if(u.club)info.push(u.club);if(u.committee)info.push(u.committee);const roleLbl=ROLE_LABELS[u.role]||u.role;const initial=esc((u.name||'?')[0]);return'<div onclick="toggleSelMember(this,'+u.id+')" data-id="'+u.id+'" data-name="'+esc(u.name)+'" data-search="'+esc((u.name+(u.grade||'')+(u.club||'')+(u.committee||'')+(ROLE_LABELS[u.role]||u.role)).toLowerCase())+'" class="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-blue-50 transition"><div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-none">'+initial+'</div><div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">'+esc(u.name)+'</p><p class="text-xs text-gray-500 truncate">'+roleLbl+(info.length?' | '+esc(info.join(' | ')):'')+'</p></div><div class="sel-check w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center text-white text-xs font-bold"></div></div>';}).join('');showModal('新規メッセージ','<div class="space-y-4">'+(type!=='captain'?'<div><label class="form-label">種類</label><select id="thread-type" class="form-input" onchange="var m=this.value===\'group\';window._selMode=m?\'multi\':\'single\';window._selMembers=[];document.querySelectorAll(\'#member-list>[data-id]\').forEach(function(e){e.classList.remove(\'border-blue-500\',\'bg-blue-50\');var c=e.querySelector(\'.sel-check\');if(c){c.classList.remove(\'bg-blue-500\',\'border-blue-500\');c.textContent=\'\';}});var d=document.getElementById(\'sel-members-display\');if(d)d.textContent=\'選択なし\';document.getElementById(\'thread-name-field\').style.display=m?\'block\':\'none\';document.getElementById(\'sel-mode-label\').textContent=m?\'複数選択可（クリックで選択/解除）\':\'1人だけ選択\';"><option value="direct">DM（個人）</option>'+((currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r))?'<option value="group">グループ</option>':'')+'</select></div>':'')+'<div id="thread-name-field" class="'+(isMulti?'':'hidden')+'"><label class="form-label">グループ名（任意）</label><input id="thread-name" type="text" class="form-input"></div><div><label class="form-label"><span id="sel-mode-label">'+(isMulti?'複数選択可（クリックで選択/解除）':'1人だけ選択')+'</span></label><input id="member-search" type="text" class="form-input mb-2" placeholder="名前で検索..." oninput="filterMemberList()"><div id="member-list" class="max-h-60 overflow-y-auto space-y-1 border rounded-lg p-1">'+cards+'</div><div id="sel-members-display" class="mt-1 text-xs text-gray-500 flex flex-wrap gap-1"><span class="text-gray-400">選択なし</span></div></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'作成',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:createThread}]);}catch(e){toast('読込失敗','error');}}

async function createThread(){const t=document.getElementById('thread-type')?.value||'captain_group';const n=document.getElementById('thread-name')?.value.trim();const mids=window._selMembers||[];if(!mids.length){toast('相手を選択してください','error');return;}try{const r=await api('/api/messages/threads',{method:'POST',body:{type:t,name:n||null,member_ids:mids}});closeModal();toast(r.existing?'既存のスレッドを開きます':'作成しました',r.existing?'info':'success');navigateTo('messages');setTimeout(()=>openThread(r.thread_id,n||'新しいチャット'),100);}catch(e){toast(e.message||'作成失敗','error');}}

// === Captain Chat ===
function renderCaptChat(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  container.innerHTML='<div class="bg-white border-b px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-crown text-yellow-600"></i>部長委員長チャット</h2>'+(isStaff?'<button onclick="createCaptChatGroup()" class="bg-yellow-600 text-white px-3 py-1.5 rounded-full text-sm"><i class="fas fa-plus mr-1"></i>グループ作成</button>':'')+'</div><div id="captchat-list" class="p-3"><div class="skeleton h-20"></div></div>';
  loadCaptChatThreads();
}

async function loadCaptChatThreads() {
  const c=document.getElementById('captchat-list');if(!c)return;
  try{const r=await api('/api/messages/captain-threads');if(!r.threads.length){c.innerHTML='<div class="empty-state"><i class="fas fa-crown"></i><p>部長チャットがまだありません</p></div>';return;}
  c.innerHTML=r.threads.map(t=>'<div class="card p-4 mb-3 cursor-pointer hover:shadow-md" onclick="openThread('+t.id+',\''+esc(t.name||'部長チャット')+'\')"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-xl">👑</div><div class="flex-1"><p class="font-bold text-gray-800">'+esc(t.name||'部長委員長チャット')+'</p><p class="text-xs text-gray-500">'+(t.members?.map(m=>esc(m.name||'?')).join('、')||'')+'</p></div>'+(t.unread_count>0?'<span class="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">'+t.unread_count+'</span>':'')+'</div></div>').join('');}catch{}
}

async function createCaptChatGroup(){const n=prompt('グループ名を入力:');if(!n)return;try{await api('/api/messages/threads',{method:'POST',body:{type:'captain_group',name:n,member_ids:[]}});toast('作成しました','success');loadCaptChatThreads();}catch(e){toast(e.message||'作成失敗','error');}}

// === Survey ===
let surveyQuestions=[], editingSurveyQIndex=-1;

function renderSurveyList(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-poll text-purple-600"></i>アンケート</h2>'+(isStaff?'<button onclick="openNewSurveyModal()" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>作成</button>':'')+'</div><div class="sub-nav"><button class="sub-nav-btn active" onclick="switchSurveyTab(\'open\',this)">回答受付中</button><button class="sub-nav-btn" onclick="switchSurveyTab(\'closed\',this)">終了</button></div></div><div class="p-3" id="survey-list"><div class="skeleton h-24"></div></div>';
  loadSurveys('open');
}

function switchSurveyTab(tab,btn,cid){document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');loadSurveys(tab,cid||'survey-list');}

function closeSurvey(sid,btn){if(!confirm('このアンケートを強制終了しますか？'))return;btn.disabled=true;api('/api/surveys/'+sid+'/close',{method:'POST'}).then(function(){toast('受付を終了しました','success');loadSurveys('open');}).catch(function(e){toast(e.message||'失敗','error');btn.disabled=false;});}

async function loadSurveys(status,containerId){const c=document.getElementById(containerId||'survey-list');if(!c)return;try{const r=await api('/api/surveys');const now=new Date();const surveys=(r.surveys||[]).filter(s=>{const expired=s.expires_at&&new Date(s.expires_at)<now;return status==='open'?!expired:expired;});if(!surveys.length){c.innerHTML='<div class="empty-state"><i class="fas fa-poll-h"></i><p>'+(status==='open'?'募集中のアンケートはありません':'終了したアンケートはありません')+'</p></div>';return;}const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));c.innerHTML=surveys.map(s=>{const expired=s.expires_at&&new Date(s.expires_at)<now;const answered=!!s.my_answer_count;return'<div class="card p-4 mb-3"><div class="flex justify-between items-start"><div><h3 class="font-bold text-gray-800 mb-1">'+esc(s.title)+(s.target&&s.target!=='all'?' <span class="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-normal">'+surveyTargetLabel(s)+'</span>':'')+'</h3><p class="text-xs text-gray-500">作成: '+esc(s.creator_name)+' | 期限: '+(s.expires_at?formatRelative(s.expires_at):'なし')+' | 質問'+s.question_count+'問</p></div><span class="text-xs '+(expired?'text-gray-400':'text-green-600')+'">'+(expired?'終了':'受付中')+'</span></div>'+(s.description?'<p class="text-sm text-gray-600 mt-2">'+esc(s.description)+'</p>':'')+'<div class="mt-3 flex gap-3">'+(!answered&&!expired?'<button onclick="openSurveyAnswer('+s.id+')" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold">回答する</button>':'')+(isStaff&&!expired?'<button onclick="closeSurvey('+s.id+',this)" class="text-red-600 text-sm font-semibold hover:underline"><i class="fas fa-stop-circle mr-1"></i>受付終了</button>':'')+(answered||isStaff?'<button onclick="viewSurveyResult('+s.id+')" class="text-purple-600 text-sm font-semibold hover:underline">結果を見る</button>':'')+'</div></div>';}).join('');}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

// --- アンケート作成（ステップ形式） ---
function surveyTargetLabel(s){if(!s.target||s.target==='all')return'全校';if(s.target==='class')return'クラス: '+esc(s.target_value);if(s.target==='club')return'部活: '+esc(s.target_value);if(s.target==='committee')return'委員会: '+esc(s.target_value);return'';}
function toggleSurveyTargetField(){const v=document.getElementById('st1-target');const f=document.getElementById('st1-target-value-field');const l=document.getElementById('st1-target-label');const i=document.getElementById('st1-target-value');if(!v||!f)return;const show=v.value!=='all';f.classList.toggle('hidden',!show);if(show){const labels={class:'クラス (例: 1-1)',club:'部活名 (例: サッカー部)',committee:'委員会名 (例: 体育委員会)'};l.textContent=labels[v.value]||'';i.placeholder=labels[v.value]||'';}}
function openNewSurveyModal(){surveyQuestions=[];renderSurveyStep1();}
function renderSurveyStep1(){const targetVal=surveyQuestions._target||'all';const targetValV=surveyQuestions._targetValue||'';const showTarget=targetVal!=='all';showModal('アンケート作成 ①基本情報','<div class="space-y-4"><div class="bg-purple-50 rounded-lg p-3 text-sm text-purple-800"><i class="fas fa-info-circle mr-1"></i>まずはアンケートの基本情報を入力してください</div><div><label class="form-label">タイトル <span class="text-red-500">*</span></label><input id="st1-title" type="text" class="form-input" placeholder="例: 体育祭の種目について" value="'+(surveyQuestions._title||'')+'"></div><div><label class="form-label">説明（任意）</label><textarea id="st1-desc" class="form-input" rows="2" placeholder="アンケートの目的などを記載">'+(surveyQuestions._desc||'')+'</textarea></div><div><label class="form-label">回答期限（任意）</label><input id="st1-expires" type="date" class="form-input" value="'+(surveyQuestions._expires||'')+'"></div><div><label class="form-label">配信対象</label><select id="st1-target" class="form-input" onchange="toggleSurveyTargetField()"><option value="all"'+(targetVal==='all'?' selected':'')+'>全校</option><option value="class"'+(targetVal==='class'?' selected':'')+'>クラス</option><option value="club"'+(targetVal==='club'?' selected':'')+'>部活</option><option value="committee"'+(targetVal==='committee'?' selected':'')+'>委員会</option></select></div><div id="st1-target-value-field" class="'+(showTarget?'':'hidden')+'"><label class="form-label" id="st1-target-label">'+(targetVal==='class'?'クラス (例: 1-1)':(targetVal==='club'?'部活名 (例: サッカー部)':(targetVal==='committee'?'委員会名 (例: 体育委員会)':'')))+'</label><input id="st1-target-value" type="text" class="form-input" value="'+esc(targetValV)+'"></div><div class="flex gap-2 justify-end"><button onclick="closeModal()" class="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm">キャンセル</button><button onclick="saveSurveyStep1()" class="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-semibold">次へ ②質問作成 <i class="fas fa-arrow-right ml-1"></i></button></div></div>',[]);}
function saveSurveyStep1(){surveyQuestions._title=document.getElementById('st1-title').value.trim();if(!surveyQuestions._title){toast('タイトルを入力してください','error');return;}surveyQuestions._desc=document.getElementById('st1-desc').value.trim();surveyQuestions._expires=document.getElementById('st1-expires').value||null;surveyQuestions._target=document.getElementById('st1-target').value;surveyQuestions._targetValue=surveyQuestions._target!=='all'?document.getElementById('st1-target-value').value.trim():null;renderSurveyStep2();}
function renderSurveyStep2(){const qHtml=surveyQuestions.map((q,i)=>'<div class="flex items-start gap-2 bg-gray-50 rounded-lg p-3"><div class="flex flex-col gap-0.5 pt-0.5"><button onclick="moveSurveyQuestion('+i+',-1)" class="text-gray-400 hover:text-gray-700 text-xs p-0.5" title="上に移動"><i class="fas fa-chevron-up"></i></button><button onclick="moveSurveyQuestion('+i+',1)" class="text-gray-400 hover:text-gray-700 text-xs p-0.5" title="下に移動"><i class="fas fa-chevron-down"></i></button></div><div class="flex-1 min-w-0"><p class="text-sm font-semibold break-words">'+(i+1)+'. '+esc(q.text)+'</p><p class="text-xs text-gray-500">'+{single:'選択式（1つ）',multiple:'選択式（複数）',text:'自由記述'}[q.type]+'</p>'+(q.options&&q.options.length?'<div class="flex flex-wrap gap-1 mt-1">'+q.options.slice(0,5).map(o=>'<span class="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-600">'+esc(o)+'</span>').join('')+(q.options.length>5?' <span class="text-xs text-gray-400">+'+ (q.options.length-5) +'</span>':'')+'</div>':'')+'</div><div class="flex flex-col gap-1 shrink-0"><button onclick="editSurveyQuestion('+i+')" class="text-blue-600 text-xs p-1" title="編集"><i class="fas fa-edit"></i></button><button onclick="duplicateSurveyQuestion('+i+')" class="text-gray-500 text-xs p-1" title="複製"><i class="fas fa-copy"></i></button><button onclick="surveyQuestions.splice('+i+',1);renderSurveyStep2()" class="text-red-500 text-xs p-1" title="削除"><i class="fas fa-trash"></i></button></div></div>').join('');showModal('アンケート作成 ②質問作成','<div class="space-y-4"><div class="bg-purple-50 rounded-lg p-3 text-sm text-purple-800"><i class="fas fa-info-circle mr-1"></i>↑↓で並び替え。質問を追加してください。</div><div id="survey-questions-list" class="space-y-2">'+qHtml+'</div><button onclick="addSurveyQuestion()" class="w-full border-2 border-dashed border-purple-300 text-purple-600 py-3 rounded-xl text-sm font-semibold hover:bg-purple-50 transition"><i class="fas fa-plus mr-1"></i>質問を追加</button><div class="flex gap-2 justify-between"><button onclick="renderSurveyStep1()" class="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm"><i class="fas fa-arrow-left mr-1"></i>戻る</button><button onclick="submitNewSurvey()" class="bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-semibold"><i class="fas fa-check mr-1"></i>アンケートを作成</button></div></div>',[]);}
function moveSurveyQuestion(i,dir){const j=i+dir;if(j<0||j>=surveyQuestions.length)return;const t=surveyQuestions[i];surveyQuestions[i]=surveyQuestions[j];surveyQuestions[j]=t;renderSurveyStep2();}
function duplicateSurveyQuestion(i){surveyQuestions.push({...surveyQuestions[i],options:surveyQuestions[i].options?[...surveyQuestions[i].options]:null});renderSurveyStep2();}
function addSurveyQuestion(){editingSurveyQIndex=-1;renderSurveyQuestionForm(null);}
function editSurveyQuestion(i){editingSurveyQIndex=i;renderSurveyQuestionForm(surveyQuestions[i]);}
function renderSurveyQuestionForm(existing){const t=existing?existing.text:'';const tp=existing?existing.type:'single';const opts=existing&&existing.options?existing.options.join('\n'):'';showModal((editingSurveyQIndex>=0?'質問を編集':'新しい質問'),'<div class="space-y-4"><div class="bg-blue-50 rounded-lg p-3 text-sm text-blue-800"><i class="fas fa-question-circle mr-1"></i>質問の内容と形式を設定してください</div><div><label class="form-label">質問文 <span class="text-red-500">*</span></label><textarea id="sq-text" class="form-input" rows="2" placeholder="例: 希望する種目は？">'+esc(t)+'</textarea></div><div><label class="form-label">回答形式</label><select id="sq-type" class="form-input" onchange="toggleSurveyOptionsField()"><option value="single"'+(tp==='single'?' selected':'')+'>選択式（1つだけ）</option><option value="multiple"'+(tp==='multiple'?' selected':'')+'>選択式（複数可）</option><option value="text"'+(tp==='text'?' selected':'')+'>自由記述</option></select></div><div id="sq-options-field" class="'+(tp==='text'?'hidden':'')+'"><label class="form-label">選択肢（改行で区切って入力）</label><textarea id="sq-options" class="form-input" rows="4" placeholder="例:&#10;玉入れ&#10;綱引き&#10;リレー">'+esc(opts)+'</textarea></div><div class="flex gap-2 justify-end"><button onclick="closeModal()" class="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm">キャンセル</button><button onclick="saveSurveyQuestion()" class="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-semibold">保存</button></div></div>',[]);}
function toggleSurveyOptionsField(){const f=document.getElementById('sq-options-field');if(!f)return;f.classList.toggle('hidden',document.getElementById('sq-type').value==='text');}
function saveSurveyQuestion(){const text=document.getElementById('sq-text').value.trim();if(!text){toast('質問文を入力してください','error');return;}const type=document.getElementById('sq-type').value;let options=null;if(type!=='text'){const raw=document.getElementById('sq-options').value.trim().split('\n').filter(s=>s.trim()).map(s=>s.trim());if(!raw.length){toast('選択肢を入力してください','error');return;}options=raw;}const q={text,type,options};closeModal();if(editingSurveyQIndex>=0)surveyQuestions[editingSurveyQIndex]=q;else surveyQuestions.push(q);renderSurveyStep2();}
async function submitNewSurvey(){if(!surveyQuestions.length){toast('質問を1つ以上追加してください','error');return;}try{await api('/api/surveys',{method:'POST',body:{title:surveyQuestions._title,description:surveyQuestions._desc||null,questions:surveyQuestions.map(q=>({text:q.text,type:q.type,options:q.options})),expires_at:surveyQuestions._expires||null,target:surveyQuestions._target||'all',target_value:surveyQuestions._targetValue||null}});closeModal();toast('アンケートを作成しました！','success');loadSurveys('open');}catch(e){toast(e.message||'作成失敗','error');}}

// --- アンケート回答（複数質問対応） ---
async function openSurveyAnswer(sid){try{const r=await api('/api/surveys/'+sid);const s=r.survey;if(r.myAnswers&&r.myAnswers.length){closeModal();toast('既に回答済みです','error');return;}const qs=r.questions||[];const myAns={};(r.myAnswers||[]).forEach(a=>{try{myAns[a.question_id]=JSON.parse(a.answer);}catch{myAns[a.question_id]=a.answer;}});const qHtml=qs.map((q,i)=>renderSurveyQuestionAnswer(q,i,myAns[q.id])).join('');showModal(esc(s.title),(s.description?'<p class="text-sm text-gray-600 mb-3">'+esc(s.description)+'</p>':'')+'<div class="space-y-4" id="survey-answer-form">'+qHtml+'</div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'回答を送信',className:'bg-purple-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitSurveyAnswer(sid,qs)}]);}catch(e){toast('読込失敗','error');}}
function renderSurveyQuestionAnswer(q,i,prev){if(q.question_type==='text'){return'<div class="card p-3"><p class="text-sm font-semibold mb-1">'+(i+1)+'. '+esc(q.question_text||q.text)+'</p><textarea class="form-input mt-1" rows="3" data-qid="'+q.id+'" placeholder="自由記述">'+esc(prev||'')+'</textarea></div>';}const selected=prev?[].concat(prev):[];const inputType=q.question_type==='multiple'?'checkbox':'radio';const opts=typeof q.options==='string'?JSON.parse(q.options||'[]'):(q.options||[]);return'<div class="card p-3"><p class="text-sm font-semibold mb-2">'+(i+1)+'. '+esc(q.question_text||q.text)+'</p><div class="space-y-1.5">'+opts.map((o,j)=>{const checked=selected.includes(o);return'<label class="flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer hover:bg-purple-50 transition '+(checked?'border-purple-400 bg-purple-50':'')+'"><input type="'+inputType+'" name="sq-'+q.id+'" value="'+esc(o)+'" class="accent-purple-600" '+(checked?'checked':'')+'><span class="text-sm">'+esc(o)+'</span></label>';}).join('')+'</div></div>';}
async function submitSurveyAnswer(sid,qs){const answers=[];let valid=true;document.querySelectorAll('#survey-answer-form .card').forEach((card,i)=>{const q=qs[i];if(!q)return;if(q.question_type==='text'){const val=card.querySelector('textarea').value.trim();if(!val&&q.question_type==='text')valid=false;answers.push({question_id:q.id,answer:val||''});}else if(q.question_type==='multiple'){const vals=Array.from(card.querySelectorAll('input:checked')).map(inp=>inp.value);answers.push({question_id:q.id,answer:vals});}else{const sel=card.querySelector('input:checked');if(!sel)valid=false;else answers.push({question_id:q.id,answer:[sel.value]});}});if(!valid){toast('全ての質問に回答してください','error');return;}try{await api('/api/surveys/'+sid+'/answers',{method:'POST',body:{answers}});closeModal();toast('回答を送信しました！','success');loadSurveys('open');}catch(e){toast(e.message||'送信失敗','error');}}

// --- アンケート結果 ---
async function viewSurveyResult(sid){try{const r=await api('/api/surveys/'+sid+'/results');const s=r.survey;let html='<div class="text-sm text-gray-500 mb-3">総回答者数: <strong>'+r.totalRespondents+'</strong>人</div>';(r.results||[]).forEach((res,i)=>{const q=res.question;html+='<div class="card p-3 mb-3"><p class="text-sm font-bold mb-2">'+(i+1)+'. '+esc(q.question_text||q.text)+'</p>';if(q.question_type==='text'){html+=(res.answers||[]).map(a=>'<div class="bg-gray-50 rounded-lg p-2 mb-1 text-sm"><div class="flex justify-between"><span class="font-semibold text-xs text-purple-700">'+esc(a.user_name||'')+'</span></div><span class="text-gray-600">'+esc(a.answer||'')+'</span></div>').join('')||'<p class="text-xs text-gray-400">回答なし</p>';}else{const total=res.total||1;html+=(res.answers||[]).map(a=>{const cnt=a.cnt;const p=((cnt/total)*100).toFixed(1);const votersHtml=a.voters&&a.voters.length?'<div class="mt-1 flex flex-wrap gap-1">'+a.voters.map(v=>'<span class="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">'+esc(v.user_name)+'</span>').join('')+'</div>':'';return'<div class="mb-2"><div class="flex justify-between text-sm mb-0.5"><span>'+esc(a.answer||'')+'</span><span class="text-gray-500">'+cnt+'人 ('+p+'%)</span></div><div class="w-full h-4 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-purple-500 rounded-full transition-all" style="width:'+p+'%"></div></div>'+votersHtml+'</div>';}).join('')||'<p class="text-xs text-gray-400">回答なし</p>';}html+='</div>';});showModal(esc(s.title)+' - 結果','<div class="max-h-96 overflow-y-auto">'+html+'</div>',[{label:'閉じる',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);}catch(e){toast(e.message||'読込失敗','error');}}

// === Consultation ===
function renderConsult(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-heart text-red-500"></i>相談所</h2><button onclick="openConsultModal()" class="bg-red-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>相談する</button></div><div class="p-3 space-y-3" id="consult-list"><div class="skeleton h-20"></div></div>';
  loadConsultations();
}

async function loadConsultations(){const c=document.getElementById('consult-list');if(!c)return;try{const r=await api('/api/questions/consultations');const isStaff=(currentUser.roles||[currentUser.role]).some(rr=>['admin','teacher'].includes(rr));if(!r.consultations.length){c.innerHTML='<div class="empty-state"><i class="fas fa-heart"></i><p>まだ相談はありません</p></div>';return;}c.innerHTML=r.consultations.map(cn=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-2 text-xs text-gray-400"><span>'+(cn.student_name?esc(cn.student_name):'生徒')+' → '+esc(cn.teacher_name||'先生')+'</span><span>'+formatRelative(cn.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(cn.content)+'</p>'+(cn.reply?'<div class="mt-2 pt-2 border-t border-red-100"><div class="flex items-center gap-2 text-xs text-red-500 mb-1"><i class="fas fa-reply"></i>回答</div><p class="text-sm text-gray-700 bg-red-50 rounded-lg p-3">'+esc(cn.reply)+'</p></div>':'')+(isStaff&&!cn.reply?'<div class="mt-2 pt-2 border-t"><textarea id="reply-'+cn.id+'" class="form-input text-sm" rows="2" placeholder="回答を入力"></textarea><button onclick="replyConsult('+cn.id+')" class="mt-1 bg-red-500 text-white px-3 py-1 rounded-full text-xs"><i class="fas fa-reply mr-1"></i>回答する</button></div>':'')+'</div>').join('');}catch{}}
async function replyConsult(cid){const el=document.getElementById('reply-'+cid);const reply=el?.value.trim();if(!reply){toast('回答を入力してください','error');return;}try{await api('/api/questions/consultations/'+cid+'/reply',{method:'PUT',body:{reply}});toast('回答を送信しました','success');loadConsultations();}catch(e){toast(e.message||'送信失敗','error');}}

async function openConsultModal(){try{const r=await api('/api/messages/users');const teachers=r.users.filter(u=>u.role==='teacher'||(u.role==='admin'));const opts=teachers.map(u=>'<option value="'+u.id+'">'+esc(u.name)+'</option>').join('');showModal('新しい相談','<div class="space-y-4"><div class="bg-red-50 rounded-lg p-3 text-sm text-red-700"><i class="fas fa-info-circle mr-1"></i>相談したい先生を選んで、内容を入力してください。先生からの回答はここに表示されます。</div><div><label class="form-label">相談する先生</label><select id="consult-teacher" class="form-input">'+opts+'</select></div><div><label class="form-label">内容</label><textarea id="consult-content" class="form-input" rows="4" placeholder="例: 進路について相談があります..."></textarea></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'送信',className:'bg-red-500 text-white px-6 py-2 rounded-xl font-semibold',action:submitConsult}]);}catch{toast('読込失敗','error');}}
async function submitConsult(){const teacherId=parseInt(document.getElementById('consult-teacher').value);const content=document.getElementById('consult-content').value.trim();if(!content){toast('内容を入力してください','error');return;}try{await api('/api/questions/consultations',{method:'POST',body:{teacher_id:teacherId,content}});closeModal();toast('相談を送信しました','success');loadConsultations();}catch(e){toast(e.message||'送信失敗','error');}}

// === HowTo ===
function renderHowTo(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-book text-green-600"></i>使い方</h2></div><div class="p-4 text-sm text-gray-600 space-y-4"><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-tablet-alt mr-2 text-blue-500"></i>基本操作</h3><ul class="list-disc ml-4 space-y-1"><li>下部のタブから各機能に移動します</li><li>掲示板: 全校に投稿できます（先生のみ）</li><li>上中連絡: 先生からの連絡</li><li>委員会: 各委員会の連絡</li><li>部活動: 各部活の活動報告</li><li>アンケート: 投票・集計</li></ul></div><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-file-upload mr-2 text-green-500"></i>ファイル添付</h3><p>投稿作成時に画像やPDFを添付できます。</p></div><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-clock mr-2 text-orange-500"></i>投稿の期限</h3><p>投稿の公開期間は明日〜最大2ヶ月です。</p></div></div>';
}

// === Settings ===
function renderSettings(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-cog text-gray-600"></i>設定</h2></div><div class="p-4 space-y-4" id="settings-list"><div class="skeleton h-32"></div></div>';
  loadSettings();
}

async function loadPendingChangesStatus(){const c=document.getElementById('pending-changes-status');if(!c)return;try{const r=await api('/api/auth/profile/changes');const pending=r.requests.filter((x)=>x.status==='pending');const approved=r.requests.filter((x)=>x.status==='approved');if(!pending.length&&!approved.length)return;let h='<div class="text-xs space-y-1 mt-2 p-2 bg-gray-50 rounded-lg">';if(pending.length)h+='<p class="text-orange-600"><i class="fas fa-clock mr-1"></i>承認待ち: '+pending.map((x)=>x.field_name).join('、')+'</p>';const seen=new Set();for(const a of approved){const fl={name:'名前',grade:'学年',class_num:'クラス',number:'番号',club:'部活動',committee:'委員会'}[a.field_name]||a.field_name;if(!seen.has(a.field_name)){seen.add(a.field_name);h+='<p class="text-green-600"><i class="fas fa-check-circle mr-1"></i>'+fl+'の変更が承認されました</p>';}}h+='</div>';c.innerHTML=h;}catch{}}

async function loadSettings(){const c=document.getElementById('settings-list');if(!c)return;try{const r=await api('/api/auth/profile');let inst='';if(deferredPrompt)inst='<button onclick="installPWA()" class="w-full text-center text-green-600 py-3 font-semibold"><i class="fas fa-download mr-2"></i>アプリをインストール</button>';const roles=currentUser.roles||[currentUser.role];const isStaff=roles.some(rr=>['admin','teacher'].includes(rr));const isAdmin=roles.includes('admin');c.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">アカウント情報</h3><div class="space-y-3"><div class="flex justify-between items-center"><span class="text-sm text-gray-600">名前</span><span class="text-sm font-semibold">'+esc(r.user.name)+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">ログインID</span><span class="text-sm">'+esc(r.user.login_id||'-')+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">学年</span><span class="text-sm">'+esc(r.user.grade||'-')+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">クラス</span><span class="text-sm">'+esc(r.user.class_num||'-')+'</span></div></div><div class="flex gap-2 mt-3"><button onclick="openProfileEdit()" class="text-blue-600 text-sm font-semibold"><i class="fas fa-edit mr-1"></i>プロフィール編集</button><button onclick="openPasswordChange()" class="text-orange-600 text-sm font-semibold"><i class="fas fa-key mr-1"></i>パスワード変更</button></div>'+(isStaff?'':'<div id="pending-changes-status" class="mt-2"></div>')+'</div><div class="flex gap-2 mt-3"><button onclick="logout()" class="flex-1 text-center bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 transition"><i class="fas fa-sign-out-alt mr-2"></i>ログアウト</button>'+(isStaff?'<button onclick="renderAdmin(document.getElementById(\'tab-content\'))" class="flex-1 text-center bg-blue-50 text-blue-600 border border-blue-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-100 transition"><i class="fas fa-shield-alt mr-2"></i>管理パネル</button>':'')+'</div></div><div class="card p-4"><h3 class="font-bold mb-3">通知設定</h3><div id="notif-settings-content"><div class="skeleton h-12"></div></div></div><div class="card p-4"><h3 class="font-bold mb-3 text-green-700"><i class="fas fa-book mr-2"></i>使い方</h3><div class="text-sm text-gray-600 space-y-3"><div><h4 class="font-bold text-gray-700 mb-1">基本操作</h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>下部のタブから各機能に移動します</li><li>タブを長押し（または右クリック）でショートカットメニューが開きます</li><li>各画面はプルダウン（引っ張って更新）に対応しています</li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">各機能の説明</h4><ul class="list-disc ml-4 space-y-1 text-xs"><li><b>掲示板</b>: 学校全体に向けた連絡を投稿できます（先生のみ投稿可、全員閲覧可）</li><li><b>上中連絡</b>: 先生から生徒へのお知らせを表示します</li><li><b>クラス</b>: 自分のクラス専用の掲示板です。クラスメイト同士で連絡を取り合えます</li><li><b>委員会</b>: 自分の委員会のメンバー専用の連絡スペースです。委員長・副委員長のみ投稿可</li><li><b>部活動</b>: 各部活の活動報告や連絡用スペースです。部長・副部長のみ投稿可</li><li><b>アンケート</b>: 投票や集計が行えます</li><li><b>忘れ物</b>: 落とし物・忘れ物の情報を共有できます</li><li><b>メッセージ</b>: 個人間やグループでのチャットが行えます</li><li><b>部長チャット</b>: 部長・委員長専用の連絡チャットです</li><li><b>相談所</b>: 匿名で相談を投稿できます</li><li><b>体育点検</b>: 体育委員会メンバー専用の点検ツールです</li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">投稿について</h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>投稿作成時に画像（JPG/PNG）やPDFファイルを添付できます（最大10MB）</li><li>投稿の公開期間は「明日〜最大2ヶ月」から選択できます</li><li>自分の投稿は削除ボタンから削除できます</li><li>不適切な投稿を見つけた場合は先生に報告してください</li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">通知について</h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>設定画面から受け取る通知の種類をオン/オフできます</li><li>プッシュ通知をオンにすると、新しい投稿やメッセージが届いた時にブラウザ通知が表示されます</li><li>自分通知機能を使うと、指定した日時に自分宛ての通知を作成できます（リマインダーとして活用）</li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">プロフィール・アカウント</h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>プロフィール編集で名前・部活動・委員会・自己紹介・アバター写真を変更できます</li><li>生徒の場合、名前・学年・クラス・番号・部活動・委員会の変更は先生の承認が必要です</li><li>パスワードは設定画面から変更できます</li><li>ログインIDは変更できません</li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">PWA（アプリとして使う）</h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>対応ブラウザでは「アプリをインストール」ボタンからホーム画面に追加できます</li><li>インストールするとオフラインでも一部の機能が使えます</li><li>プッシュ通知を受け取るには、ブラウザの許可設定をオンにしてください</li></ul></div></div></div>'+(isStaff?'<div class="card p-4"><h3 class="font-bold mb-3">管理設定</h3><div id="admin-settings-content"><div class="skeleton h-12"></div></div></div>':'')+inst+'<div class="flex items-center justify-center gap-3 py-4"><span class="text-xs text-gray-400">上中黒板 v3.0</span><button onclick="forceUpdate()" class="text-xs text-blue-600 hover:underline"><i class="fas fa-sync-alt mr-1"></i>アップデート</button></div>';loadNotifSettings();if(isStaff)loadAdminSettings();if(!isStaff)loadPendingChangesStatus();}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

async function loadAdminSettings(){const c=document.getElementById('admin-settings-content');if(!c)return;try{const r=await api('/api/admin/settings');const s=r.settings;const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');c.innerHTML='<div class="space-y-2">'+[['teacher_can_users','先生がユーザー管理を表示'],['teacher_can_posts','先生が投稿管理を表示'],['teacher_can_bulk','先生が一括生成を表示'],['notif_self_default','自分通知を標準で有効']].map(([k,lb])=>{const on=s[k]==='true';const disabled=!isAdmin&&k.startsWith('teacher_');return'<div class="flex items-center justify-between"><span class="text-sm '+(disabled?'text-gray-400':'text-gray-700')+'">'+lb+'</span><div class="toggle'+(on?' on':'')+(disabled?' opacity-50 cursor-not-allowed':'')+'" '+(disabled?'':'onclick="toggleAdminSetting(\''+k+'\',this)"')+'></div></div>';}).join('')+'</div>'+(isAdmin?'<div class="mt-3 pt-3 border-t"><label class="form-label">プロフィール変更期限</label><input id="setting-deadline" type="datetime-local" class="form-input mt-1" value="'+(s.allow_changes_until?s.allow_changes_until.slice(0,16):'')+'"><button onclick="saveDeadline()" class="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs"><i class="fas fa-save mr-1"></i>保存</button><p class="text-xs text-gray-400 mt-1">空欄 = 期限なし（常時変更可）</p></div>':'')+'<p class="text-xs text-gray-400 mt-2">※先生の権限設定は管理者のみ変更できます</p>';}catch{c.innerHTML='<p class="text-sm text-gray-400">読込失敗</p>';}}

async function saveDeadline(){const v=document.getElementById('setting-deadline').value;try{await api('/api/admin/settings',{method:'PUT',body:{settings:{allow_changes_until:v?new Date(v).toISOString():''}}});toast('保存しました','success');}catch(e){toast(e.message||'失敗','error');}}

async function toggleAdminSetting(key,el){try{await api('/api/admin/settings',{method:'PUT',body:{settings:{[key]:!el.classList.contains('on')?true:false}}});el.classList.toggle('on');toast('更新しました','success');}catch(e){toast('失敗','error');}}

async function loadNotifSettings(){const c=document.getElementById('notif-settings-content');if(!c)return;try{const ns=await api('/api/auth/notification-settings');c.innerHTML='<div class="space-y-2">'+['push_enabled','disaster_enabled','club_post_enabled','committee_post_enabled','school_notice_enabled','message_enabled'].map(k=>{const lb={'push_enabled':'プッシュ通知','disaster_enabled':'防災情報','club_post_enabled':'部活投稿','committee_post_enabled':'委員会投稿','school_notice_enabled':'上中連絡','message_enabled':'メッセージ'}[k];const on=ns[k]===1||ns[k]===true;return'<div class="flex items-center justify-between"><span class="text-sm text-gray-700">'+lb+'</span><div class="toggle'+(on?' on':'')+'" onclick="toggleNotifSetting(\''+k+'\',this)"></div></div>';}).join('')+'</div>'+(ns.push_enabled?'<button onclick="testPush()" class="mt-2 w-full bg-blue-50 text-blue-600 border border-blue-200 py-2 rounded-xl text-sm font-semibold hover:bg-blue-100"><i class="fas fa-paper-plane mr-1"></i>テスト通知を送信</button>':'');}catch{c.innerHTML='<p class="text-sm text-gray-400">読込失敗</p>';}}

async function toggleNotifSetting(key,el){
  if(key==='push_enabled'){
    var turningOn=!el.classList.contains('on');
    if(turningOn){
      if(!('PushManager' in window)){showPushUnsupported();return;}
      requestPushPermission();
      return;
    }
    try{
      var reg=await navigator.serviceWorker.ready;
      var sub=await reg.pushManager.getSubscription();
      if(sub)await sub.unsubscribe();
    }catch{}
  }
  try{await api('/api/auth/notification-settings',{method:'PUT',body:{[key]:!el.classList.contains('on')}});el.classList.toggle('on');toast('更新しました','success');}catch(e){toast('失敗','error');}
}

function installPWA(){if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt.userChoice.then(()=>{deferredPrompt=null;loadSettings();});}

function openProfileEdit(){const u=currentUser;const isStaff=(u.roles||[u.role]).some(r=>['admin','teacher'].includes(r));const pendingFields=isStaff?'':'(変更には承認が必要です)';const clubVal=normClub(u.club);showModal('プロフィール編集','<div class="space-y-3"><div><label class="form-label">名前 '+pendingFields+'</label><input id="pe-name" type="text" class="form-input" value="'+esc(u.name)+'"></div><div><label class="form-label">部活動</label><select id="pe-club" class="form-input"><option value="">なし</option>'+CLUBS.map(c=>'<option value="'+c+'"'+(clubVal===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div><div><label class="form-label">委員会</label><select id="pe-committee" class="form-input"><option value="">なし</option>'+COMMITTEES.map(c=>'<option value="'+c+'"'+(u.committee===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div><div><label class="form-label">プロフィール画像</label><div class="flex items-center gap-3"><div class="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border" id="avatar-preview">'+(u.avatar_url?'<img src="'+esc(u.avatar_url)+'" class="w-full h-full object-cover">':'<i class="fas fa-user text-gray-400 text-2xl"></i>')+'</div><div><label class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm cursor-pointer"><i class="fas fa-camera mr-1"></i>写真を選択<input type="file" accept="image/*" class="hidden" onchange="uploadAvatar(this)"></label></div></div></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'保存',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitProfileEdit}]);}

async function uploadAvatar(input){const file=input.files[0];if(!file)return;if(file.size>5*1024*1024){toast('5MB以下の画像を選択','error');return;}const fd=new FormData();fd.append('file',file);try{const r=await api('/api/upload',{method:'POST',body:fd});const preview=document.getElementById('avatar-preview');if(preview)preview.innerHTML='<img src="'+r.url+'" class="w-full h-full object-cover">';currentUser.avatar_url=r.url;toast('アップロード完了','success');}catch(e){toast(e.message||'アップロード失敗','error');}}

function openPasswordChange(){showModal('パスワード変更','<div class="space-y-3"><div><label class="form-label">現在のパスワード</label><input id="pw-current" type="password" class="form-input"></div><div><label class="form-label">新しいパスワード</label><input id="pw-new" type="password" class="form-input"></div><div><label class="form-label">新しいパスワード（確認）</label><input id="pw-confirm" type="password" class="form-input"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'変更',className:'bg-orange-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitPasswordChange}]);}
async function submitPasswordChange(){const cur=document.getElementById('pw-current').value;const nw=document.getElementById('pw-new').value;const cf=document.getElementById('pw-confirm').value;if(!cur||!nw){toast('すべて入力してください','error');return;}if(nw!==cf){toast('新しいパスワードが一致しません','error');return;}try{await api('/api/auth/password',{method:'POST',body:{current_password:cur,new_password:nw}});closeModal();toast('変更しました','success');}catch(e){toast(e.message||'失敗','error');}}

async function submitProfileEdit(){try{const name=document.getElementById('pe-name').value.trim();if(!name){toast('名前は必須','error');return;}const body={name,club:document.getElementById('pe-club').value.trim()||null,committee:document.getElementById('pe-committee').value.trim()||null,avatar_url:currentUser.avatar_url||null};const r=await api('/api/auth/profile',{method:'PUT',body});closeModal();if(r.pending){toast('変更リクエストを送信しました（承認待ち）','info');}else{toast('保存しました','success');}loadSettings();}catch(e){toast(e.message||'失敗','error');}}

// === PE Checklist ===
function renderPEChecklist(container) {
  window._peActive='pe_checklist';
  var roles=currentUser.roles||[currentUser.role];
  var isManager=roles.some(function(r){return ['admin','teacher','chairman','vice_chairman'].indexOf(r)>=0});
  var navDiv=document.createElement('div');
  navDiv.style.cssText='display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap';
  navDiv.innerHTML='<button class="sub-nav-btn active" data-pechecktab="check">点検</button><button class="sub-nav-btn" data-pechecktab="history">履歴</button><button class="sub-nav-btn" data-pechecktab="rentals">貸出</button>'+(isManager?'<button class="sub-nav-btn" data-pechecktab="manage" style="margin-left:auto">⚙管理</button>':'');
  navDiv.onclick=function(e){
    var btn=e.target.closest('[data-pechecktab]');
    if(!btn)return;
    [].forEach.call(navDiv.querySelectorAll('.sub-nav-btn'),function(b){b.classList.remove('active')});
    btn.classList.add('active');
    var tab=btn.getAttribute('data-pechecktab');
    if(tab==='check')loadPEChecklist();
    else if(tab==='history')loadPEChecklistHistory();
    else if(tab==='rentals')loadPERentals();
    else if(tab==='manage')loadPEManage();
  };
  container.textContent='';
  container.appendChild(navDiv);
  var contentDiv=document.createElement('div');
  contentDiv.id='pe-checklist-content';
  contentDiv.innerHTML='<div class="skeleton" style="height:128px;border-radius:8px;background:linear-gradient(90deg,#f0f4f8 25%,#e8ecef 50%,#f0f4f8 75%);background-size:200% 100%;animation:skeleton-loading 1.5s infinite"></div>';
  container.appendChild(contentDiv);
  loadPEChecklist();
}

async function loadPEChecklist(){var c=document.getElementById('pe-checklist-content');if(!c)return;try{var r=await api('/api/checklist/items');if(!r.items||!r.items.length){c.innerHTML='<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-inbox" style="font-size:48px;margin-bottom:12px;display:block"></i><p>点検項目がありません。管理タブから追加してください</p></div>';return;}var total=r.items.length,ok=[],ng=[],uncheck=[];for(var i=0;i<total;i++){var st=r.items[i].status;if(st==='ok')ok.push(r.items[i]);else if(st==='ng')ng.push(r.items[i]);else uncheck.push(r.items[i]);}var items=[].concat(uncheck,ng,ok);var done=ok.length+ng.length,pct=total?Math.round(done/total*100):0;var h='<div style="background:white;border-radius:14px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08)"><div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><span style="font-size:12px;padding:3px 10px;border-radius:99px;background:#dcfce7;color:#16a34a;font-weight:600">✔ OK '+ok.length+'</span><span style="font-size:12px;padding:3px 10px;border-radius:99px;background:#fef2f2;color:#dc2626;font-weight:600">✗ NG '+ng.length+'</span><span style="font-size:12px;padding:3px 10px;border-radius:99px;background:#f3f4f6;color:#6b7280;font-weight:600">─ 未 '+uncheck.length+'</span></div><div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:4px"><span>点検進捗</span><span>完了 '+done+'/'+total+' ('+pct+'%)</span></div><div style="background:#e5e7eb;border-radius:99px;height:8px;overflow:hidden"><div style="background:#22c55e;width:'+pct+'%;height:100%;border-radius:99px;transition:width 0.3s"></div></div></div>';h+='<div style="display:flex;flex-direction:column;gap:8px">';for(var i=0;i<items.length;i++){var it=items[i];var s=it.status==='ok'?'✔ OK':it.status==='ng'?'✗ NG':'──';var sc=it.status==='ok'?'#16a34a':it.status==='ng'?'#dc2626':'#d1d5db';var bg=it.status==='ok'?'#f0fdf4':it.status==='ng'?'#fef2f2':'#ffffff';var bc=it.status==='ok'?'#bbf7d0':it.status==='ng'?'#fecaca':'#e5e7eb';var avail=it.total_count-(it.active_rentals||0);var lastInfo=it.last_checked?'<span style="font-size:11px;color:#9ca3af">'+esc(it.last_checker||'')+' | '+formatRelative(it.last_checked)+'</span>':'';h+='<div style="background:'+bg+';border:1px solid '+bc+';border-left:4px solid '+sc+';border-radius:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px"><div><span style="font-weight:bold;font-size:14px;color:#1f2937">'+esc(it.name)+'</span>'+(it.location?'<span style="font-size:11px;color:#9ca3af;margin-left:6px">📍'+esc(it.location)+'</span>':'')+'</div><span style="font-size:11px;padding:2px 10px;border-radius:99px;background:'+sc+';color:white;font-weight:600">'+s+'</span></div><div style="display:flex;gap:12px;font-size:12px;color:#6b7280;margin-bottom:8px;flex-wrap:wrap"><span>📦総数 '+it.total_count+'</span><span>📤貸出中 '+(it.active_rentals||0)+'</span><span>📥残り '+avail+'</span></div>'+lastInfo+'<div style="margin-top:8px;display:flex;gap:6px">'+(it.can_check?'<button onclick="checkPEItem('+it.id+',\'ok\')" style="flex:1;padding:6px 0;border:1px solid #22c55e;border-radius:8px;background:white;color:#16a34a;font-size:12px;font-weight:600;cursor:pointer">✔ OK</button><button onclick="checkPEItem('+it.id+',\'ng\')" style="flex:1;padding:6px 0;border:1px solid #ef4444;border-radius:8px;background:white;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer">✗ NG</button>':'<span style="font-size:11px;color:#9ca3af">点検は体育委員専用</span>')+'</div></div>';}h+='</div>';c.innerHTML=h;}catch{c.innerHTML='<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:12px;display:block"></i><p>読込失敗</p></div>';}}async function checkPEItem(id,status){try{await api('/api/checklist/items/'+id+'/check',{method:'POST',body:{status}});toast('記録しました','success');loadPEChecklist();}catch(e){toast(e.message||'失敗','error');}}

async function loadPEManage(){var c=document.getElementById('pe-checklist-content');if(!c)return;try{var r=await api('/api/checklist/items');var h='<div style="margin-bottom:12px"><button class="pe-add-item-btn" style="background:#2d6a4f;color:white;padding:6px 16px;border:none;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer"><i class="fas fa-plus" style="margin-right:4px"></i>項目を追加</button></div>';if(!r.items||!r.items.length){c.innerHTML=h+'<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-inbox" style="font-size:48px;margin-bottom:12px;display:block"></i><p>項目がありません</p></div>';}else{h+='<div style="display:flex;flex-direction:column;gap:8px">';for(var i=0;i<r.items.length;i++){var it=r.items[i];h+='<div class="pe-manage-row" data-id="'+it.id+'" data-name="'+esc(it.name)+'" data-total="'+it.total_count+'" style="display:flex;align-items:center;justify-content:space-between;background:white;border-radius:14px;padding:12px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><div><span style="font-weight:600;font-size:14px">'+esc(it.name)+'</span><span style="font-size:12px;color:#95a5a6;margin-left:8px">総数: '+it.total_count+'</span></div><div style="display:flex;gap:4px"><button class="pe-edit-item-btn" style="background:#2563eb;color:white;padding:4px 10px;border:none;border-radius:99px;font-size:11px;cursor:pointer">編集</button><button class="pe-del-item-btn" style="background:#ef4444;color:white;padding:4px 10px;border:none;border-radius:99px;font-size:11px;cursor:pointer">削除</button></div></div>';}h+='</div>';c.innerHTML=h;}c.onclick=function(e){var add=e.target.closest('.pe-add-item-btn');if(add){openPEAddItem();return;}var edit=e.target.closest('.pe-edit-item-btn');if(edit){var row=edit.closest('.pe-manage-row');if(row)openPEAddItem(parseInt(row.getAttribute('data-id')),row.getAttribute('data-name'),parseInt(row.getAttribute('data-total')));return;}var del=e.target.closest('.pe-del-item-btn');if(del){var row2=del.closest('.pe-manage-row');if(row2)deletePEItem(parseInt(row2.getAttribute('data-id')));return;}}; }catch{c.innerHTML='<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:12px;display:block"></i><p>読込失敗</p></div>';}}

function openPEAddItem(id,name,total){if(id){showModal('項目編集','<div class="space-y-4"><div><label class="form-label" style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">名前</label><input id="pe-item-name" type="text" class="form-input" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px" value="'+esc(name||'')+'"></div><div><label class="form-label" style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">総数</label><input id="pe-item-total" type="number" class="form-input" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px" value="'+(total||1)+'" min="1"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'保存',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:function(){submitPEItem(id)}}]);}else{showModal('項目追加','<div class="space-y-4"><div><label class="form-label" style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">名前</label><input id="pe-item-name" type="text" class="form-input" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px" placeholder="例: バレーボール"></div><div><label class="form-label" style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">総数</label><input id="pe-item-total" type="number" class="form-input" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px" value="1" min="1"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'追加',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:function(){submitPEItem(null)}}]);}}

async function submitPEItem(id){var nm=document.getElementById('pe-item-name')?.value.trim();var tl=parseInt(document.getElementById('pe-item-total')?.value)||1;if(!nm){toast('名前が必要です','error');return;}try{if(id){await api('/api/checklist/items/'+id,{method:'PUT',body:{name:nm,total_count:tl}});toast('保存しました','success');}else{await api('/api/checklist/items',{method:'POST',body:{name:nm,total_count:tl}});toast('追加しました','success');}closeModal();loadPEManage();}catch(e){toast(e.message||'失敗','error');}}

async function deletePEItem(id){if(!confirm('削除しますか？'))return;try{await api('/api/checklist/items/'+id,{method:'DELETE'});toast('削除しました','success');loadPEManage();}catch(e){toast(e.message||'失敗','error');}}

async function loadPEChecklistHistory(){var c=document.getElementById('pe-checklist-content');if(!c)return;try{var r=await api('/api/checklist/history');if(!r.history||!r.history.length){c.innerHTML='<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-history" style="font-size:48px;margin-bottom:12px;display:block"></i><p>履歴なし</p></div>';return;}c.innerHTML='<div style="display:flex;flex-direction:column;gap:8px">'+r.history.map(function(h){return '<div style="background:white;border-radius:14px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center"><div><span style="font-size:14px;font-weight:600">'+esc(h.item_name)+'</span><span style="font-size:12px;color:#95a5a6;margin-left:8px">'+esc(h.checker_name)+'</span></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;'+(h.status==='ok'?'color:green':'color:red')+'">'+h.status.toUpperCase()+'</span><span style="font-size:12px;color:#95a5a6">'+formatRelative(h.created_at)+'</span></div></div>';}).join('')+'</div>';c.onclick=null;}catch{}}

async function loadPERentals(){var c=document.getElementById('pe-checklist-content');if(!c)return;try{var r=await api('/api/checklist/rentals');var h='<div style="margin-bottom:12px"><button onclick="openRentalModal()" style="background:#2563eb;color:white;padding:6px 16px;border:none;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer"><i class="fas fa-plus" style="margin-right:4px"></i>貸出登録</button></div>';if(!r.rentals||!r.rentals.length){c.innerHTML=h+'<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-box" style="font-size:48px;margin-bottom:12px;display:block"></i><p>貸出履歴なし</p></div>';return;}h+='<div style="display:flex;flex-direction:column;gap:8px">'+r.rentals.map(function(rn){var avail=rn.total_count-rn.active_rentals;return '<div style="background:white;border-radius:14px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><div style="display:flex;justify-content:space-between"><span style="font-weight:600;font-size:14px">'+esc(rn.item_name)+'</span><span style="font-size:12px;'+(rn.returned_at?'color:green':'color:#ca8a04')+'">'+(rn.returned_at?'返却済':'貸出中')+'</span></div><p style="font-size:12px;color:#95a5a6">借: '+esc(rn.borrower_name)+' | '+formatRelative(rn.borrowed_at)+'</p><p style="font-size:11px;color:#6b7280;margin-bottom:4px"><span>総数 '+rn.total_count+'</span> | <span>貸出中 '+rn.active_rentals+'</span> | <span>残り '+avail+'</span></p>'+(rn.notes?'<p style="font-size:12px;color:#95a5a6;margin-top:4px">'+esc(rn.notes)+'</p>':'')+(!rn.returned_at?'<button class="pe-return-btn" data-id="'+rn.id+'" style="color:#2563eb;font-size:12px;margin-top:8px;background:none;border:none;cursor:pointer;text-decoration:underline">返却</button>':'<p style="font-size:12px;color:#95a5a6;margin-top:4px">返却: '+formatRelative(rn.returned_at)+'</p>')+'</div>';}).join('')+'</div>';c.innerHTML=h;c.onclick=function(e){var ret=e.target.closest('.pe-return-btn');if(ret){returnRental(parseInt(ret.getAttribute('data-id')));}};}catch{}}

async function openRentalModal(){try{const items=await api('/api/checklist/items');const users=await api('/api/messages/users');const iop=items.items.map(i=>'<option value="'+i.id+'">'+esc(i.name)+'</option>').join('');const uop=users.users.filter(function(u){return u.role==='student';}).map(u=>'<option value="'+u.id+'">'+esc(u.name)+'</option>').join('');showModal('貸出登録','<div class="space-y-4"><div><label class="form-label">備品</label><select id="rental-item" class="form-input">'+iop+'</select></div><div><label class="form-label">借りる人</label><select id="rental-borrower" class="form-input">'+uop+'</select></div><div><label class="form-label">メモ（任意）</label><input id="rental-notes" type="text" class="form-input"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'登録',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitRental}]);}catch(e){toast('読込失敗','error');}}

async function submitRental(){const i=parseInt(document.getElementById('rental-item').value);const b=parseInt(document.getElementById('rental-borrower').value);const n=document.getElementById('rental-notes').value.trim()||null;try{await api('/api/checklist/rentals',{method:'POST',body:{item_id:i,borrower_id:b,notes:n}});closeModal();toast('登録しました','success');loadPERentals();}catch(e){toast(e.message||'登録失敗','error');}}
async function returnRental(id){if(!confirm('返却しますか？'))return;try{await api('/api/checklist/rentals/'+id+'/return',{method:'POST'});toast('返却しました','success');loadPERentals();}catch(e){toast('返却失敗','error');}}

// === Admin ===
function renderAdmin(container) {
  const roles=currentUser.roles||[currentUser.role];
  const isAdmin=roles.includes('admin');
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  if(!isStaff){container.innerHTML='<div class="empty-state"><i class="fas fa-lock"></i><p>管理者のみアクセス可能</p></div>';return;}
  if(isAdmin){renderAdminFull(container);}else{renderAdminTeacher(container);}
}

async function renderAdminTeacher(container){
  try{const sr=await api('/api/admin/settings');const s=sr.settings||{};let tabs='<button onclick="switchAdminTab(\'roles\',this)" class="sub-nav-btn active">権限管理</button><button onclick="switchAdminTab(\'tokens\',this)" class="sub-nav-btn">招待コード</button><button onclick="switchAdminTab(\'profile\',this)" class="sub-nav-btn">承認待ち</button><button onclick="switchAdminTab(\'stats\',this)" class="sub-nav-btn">統計</button><button onclick="switchAdminTab(\'diag\',this)" class="sub-nav-btn">診断</button>';if(s.teacher_can_users==='true')tabs+='<button onclick="switchAdminTab(\'users\',this)" class="sub-nav-btn">ユーザー管理</button>';if(s.teacher_can_posts==='true')tabs+='<button onclick="switchAdminTab(\'posts\',this)" class="sub-nav-btn">投稿管理</button>';if(s.teacher_can_bulk==='true')tabs+='<button onclick="switchAdminTab(\'bulk\',this)" class="sub-nav-btn">一括生成</button>';tabs+='<button onclick="switchAdminTab(\'tv\',this)" class="sub-nav-btn"><i class="fas fa-tv mr-1"></i>TV表示</button>';container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-shield-alt text-red-600"></i>管理</h2></div><div class="p-4 space-y-4"><div class="flex flex-wrap gap-2">'+tabs+'</div><div id="admin-content"><div class="skeleton h-32"></div></div></div>';loadAdminRoles();}catch{renderAdminFull(container);}
}

function renderAdminFull(container){
  const roles=currentUser.roles||[currentUser.role];
  const isAdmin=roles.includes('admin');
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  if(!isStaff){container.innerHTML='<div class="empty-state"><i class="fas fa-lock"></i><p>管理者のみアクセス可能</p></div>';return;}
  const tabs=isAdmin?'<button onclick="switchAdminTab(\'users\',this)" class="sub-nav-btn active">ユーザー管理</button><button onclick="switchAdminTab(\'roles\',this)" class="sub-nav-btn">権限管理</button><button onclick="switchAdminTab(\'profile\',this)" class="sub-nav-btn">承認待ち</button><button onclick="switchAdminTab(\'tokens\',this)" class="sub-nav-btn">招待コード</button><button onclick="switchAdminTab(\'bulk\',this)" class="sub-nav-btn">一括生成</button><button onclick="switchAdminTab(\'posts\',this)" class="sub-nav-btn">投稿管理</button><button onclick="switchAdminTab(\'broadcast\',this)" class="sub-nav-btn">通知配信</button><button onclick="switchAdminTab(\'stats\',this)" class="sub-nav-btn">統計</button><button onclick="switchAdminTab(\'diag\',this)" class="sub-nav-btn">診断</button><button onclick="switchAdminTab(\'tv\',this)" class="sub-nav-btn"><i class="fas fa-tv mr-1"></i>TV表示</button>':'<button onclick="switchAdminTab(\'roles\',this)" class="sub-nav-btn active">権限管理</button><button onclick="switchAdminTab(\'tokens\',this)" class="sub-nav-btn">招待コード</button><button onclick="switchAdminTab(\'stats\',this)" class="sub-nav-btn">統計</button><button onclick="switchAdminTab(\'tv\',this)" class="sub-nav-btn"><i class="fas fa-tv mr-1"></i>TV表示</button>';
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-shield-alt text-red-600"></i>管理</h2></div><div class="p-4 space-y-4"><div class="flex flex-wrap gap-2">'+tabs+'</div><div id="admin-content"><div class="skeleton h-32"></div></div></div>';
  if(isAdmin)loadAdminUsers();else loadAdminTokens();
}

function switchAdminTab(tab,btn){document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(tab==='users')loadAdminUsers();else if(tab==='roles')loadAdminRoles();else if(tab==='profile')loadAdminProfileChanges();else if(tab==='tokens')loadAdminTokens();else if(tab==='bulk')loadAdminBulkCreate();else if(tab==='posts')loadAdminPosts();else if(tab==='broadcast')loadAdminBroadcast();else if(tab==='stats')loadAdminStats();else if(tab==='diag')loadAdminDiagnostics();else if(tab==='tv')loadAdminTV();}

async function loadAdminBroadcast(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">全体通知配信</h3><div class="space-y-3"><div><label class="form-label">タイトル</label><input id="bc-title" type="text" class="form-input" placeholder="例: お知らせ"></div><div><label class="form-label">内容</label><textarea id="bc-body" class="form-input" rows="3" placeholder="通知内容"></textarea></div><button id="bc-submit-btn" onclick="submitBroadcast()" class="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-bullhorn mr-1"></i>全員に配信</button><p class="text-xs text-gray-400 mt-2">プッシュ通知が有効なユーザーにはブラウザ通知も送信されます</p></div></div>';}
async function submitBroadcast(){const btn=document.getElementById('bc-submit-btn');if(btn&&btn.disabled)return;const title=document.getElementById('bc-title').value.trim();const body=document.getElementById('bc-body').value.trim();if(!title||!body){toast('タイトルと内容を入力','error');return;}if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i>配信中...';btn.classList.add('opacity-60');}try{const r=await api('/api/admin/notifications/broadcast',{method:'POST',body:{title,body,type:'normal'}});if(r.error){toast(r.error,'error');return;}toast('通知を配信しました（'+r.sent+'件）','success');document.getElementById('bc-title').value='';document.getElementById('bc-body').value='';}catch(e){toast('失敗: '+(e.message||'エラー'),'error');}finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-bullhorn mr-1"></i>全員に配信';btn.classList.remove('opacity-60');}}}

async function loadAdminUsers(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/users');const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');const users=r.users.filter(u=>{const ur=(u.all_roles||u.role||'').split(',').map(x=>x.trim());return isAdmin||!ur.includes('admin');});c.innerHTML='<div class="mb-3 flex gap-2 flex-wrap">'+(isAdmin?'<button onclick="openBulkDeleteModal()" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-user-minus mr-1"></i>一括削除</button><button onclick="openBulkCreateStudentModal()" class="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>生徒一括作成</button>':'')+'</div><div class="space-y-2">'+users.map(u=>{const ur=(u.all_roles||u.role||'').split(',').map(x=>x.trim());const isTargetAdmin=ur.includes('admin');return'<div class="card p-3"><div class="flex justify-between items-center mb-2"><div><span class="font-semibold text-sm">'+esc(u.name)+'</span><span class="text-xs text-gray-500 ml-2">'+esc(u.username||'')+'</span><span class="text-xs '+(u.is_active===false?'text-red-500':'text-green-500')+' ml-2">'+(u.is_active===false?'停止':'有効')+'</span></div><div class="flex gap-1">'+(isAdmin||!isTargetAdmin?'<button onclick="editUserInline('+u.id+',\''+esc(u.name)+'\',\''+esc(u.club||'')+'\',\''+esc(u.committee||'')+'\','+(u.grade||'')+','+(u.class_num||'')+','+(u.number||'')+')" class="text-blue-600 text-xs hover:underline">編集</button><button onclick="changeUserPassword('+u.id+')" class="text-orange-600 text-xs hover:underline">パスワード</button><button onclick="toggleUserActive('+u.id+')" class="text-xs '+(u.is_active===false?'text-green-600':'text-red-600')+' hover:underline">'+(u.is_active===false?'復活':'停止')+'</button><button onclick="deleteUser('+u.id+')" class="text-xs text-red-600 hover:underline">削除</button>':'')+'</div></div><div class="text-xs text-gray-500">'+(u.grade?u.grade+'-'+u.class_num+' '+u.number:'')+' '+(u.club||'')+(u.club&&u.committee?' / ':'')+(u.committee||'')+'</div></div>';}).join('')+'</div>';}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

function normClub(v){return(CLUBS.includes(v)?v:{'男子卓球部':'卓球部','女子卓球部':'卓球部'}[v])||v;}
function editUserInline(id,name,club,committee,grade,class_num,number){club=normClub(club);showModal('ユーザー編集 #'+id,'<div class="space-y-3"><div><label class="form-label">名前</label><input id="eu-name" type="text" class="form-input" value="'+esc(name)+'"></div><div class="grid grid-cols-3 gap-2"><div><label class="form-label">学年</label><input id="eu-grade" type="number" class="form-input" value="'+(grade||'')+'"></div><div><label class="form-label">クラス</label><input id="eu-class" type="number" class="form-input" value="'+(class_num||'')+'"></div><div><label class="form-label">番号</label><input id="eu-number" type="number" class="form-input" value="'+(number||'')+'"></div></div><div><label class="form-label">部活動</label><select id="eu-club" class="form-input"><option value="">なし</option>'+CLUBS.map(c=>'<option value="'+c+'"'+(club===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div><div><label class="form-label">委員会</label><select id="eu-committee" class="form-input"><option value="">なし</option>'+COMMITTEES.map(c=>'<option value="'+c+'"'+(committee===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'保存',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitUserEdit(id)}]);}
async function submitUserEdit(id){const body={name:document.getElementById('eu-name').value.trim()};const g=document.getElementById('eu-grade').value;if(g)body.grade=parseInt(g);const cn=document.getElementById('eu-class').value;if(cn)body.class_num=parseInt(cn);const nu=document.getElementById('eu-number').value;if(nu)body.number=parseInt(nu);body.club=document.getElementById('eu-club').value.trim()||null;body.committee=document.getElementById('eu-committee').value.trim()||null;try{await api('/api/admin/users/'+id,{method:'PUT',body});closeModal();toast('保存しました','success');loadAdminUsers();}catch(e){toast(e.message||'失敗','error');}}

async function changeUserPassword(id){const p=prompt('新しいパスワードを入力:');if(!p)return;try{await api('/api/admin/users/'+id+'/change-password',{method:'POST',body:{password:p}});toast('変更しました','success');}catch(e){toast(e.message||'失敗','error');}}

async function toggleUserActive(id){try{await api('/api/admin/users/'+id+'/toggle',{method:'POST'});toast('更新しました','success');loadAdminUsers();}catch(e){toast('失敗','error');}}
async function deleteUser(id){if(!confirm('本当に削除しますか？'))return;try{await api('/api/admin/users/'+id,{method:'DELETE'});toast('削除しました','success');loadAdminUsers();}catch(e){toast('失敗','error');}}

function openBulkDeleteModal(){showModal('一括削除','<div class="space-y-4"><p class="text-sm text-gray-600">学年とクラスを指定してユーザーを一括削除します。</p><div><label class="form-label">学年</label><input id="bulk-grade" type="number" class="form-input" placeholder="例: 1"></div><div><label class="form-label">クラス（任意、省略で学年全員）</label><input id="bulk-class" type="number" class="form-input" placeholder="例: 2"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'削除',className:'bg-red-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitBulkDelete}]);}

async function submitBulkDelete(){const g=parseInt(document.getElementById('bulk-grade').value);const cn=document.getElementById('bulk-class').value?parseInt(document.getElementById('bulk-class').value):undefined;if(!g){toast('学年を入力','error');return;}if(!confirm('本当に削除しますか？元に戻せません。'))return;try{const r=await api('/api/admin/users/bulk-delete',{method:'POST',body:{grade:g,class_num:cn}});closeModal();toast(r.count+'人削除しました','success');loadAdminUsers();}catch(e){toast(e.message||'失敗','error');}}

function openBulkCreateStudentModal(){showModal('一括生成','<div class="space-y-4"><div class="flex gap-2"><button onclick="switchBulkTab(\'student\',this)" class="sub-nav-btn active">生徒</button><button onclick="switchBulkTab(\'teacher\',this)" class="sub-nav-btn">先生</button></div><div id="bulk-form-content"><div class="space-y-3"><p class="text-sm text-gray-600">年度+組+番号でログインID生成（例: 2024年度3組28番 → 24328）</p><div class="grid grid-cols-2 gap-2"><div><label class="form-label">年度</label><input id="bc-year" type="number" class="form-input" value="2024"></div><div><label class="form-label">組</label><input id="bc-class" type="number" class="form-input" value="1"></div></div><div class="grid grid-cols-2 gap-2"><div><label class="form-label">開始番号</label><input id="bc-start" type="number" class="form-input" value="1"></div><div><label class="form-label">人数</label><input id="bc-count" type="number" class="form-input" value="40"></div></div><div><label class="form-label">パスワード</label><input id="bc-password" type="text" class="form-input" value="password"></div></div></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'作成',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitBulkCreateStudent}]);}

let bulkTab='student'
function switchBulkTab(tab,btn){bulkTab=tab;document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=document.getElementById('bulk-form-content');if(tab==='student'){f.innerHTML='<div class="space-y-3"><p class="text-sm text-gray-600">年度+組+番号でログインID生成（例: 2024年度3組28番 → 24328）</p><div class="grid grid-cols-2 gap-2"><div><label class="form-label">年度</label><input id="bc-year" type="number" class="form-input" value="2024"></div><div><label class="form-label">組</label><input id="bc-class" type="number" class="form-input" value="1"></div></div><div class="grid grid-cols-2 gap-2"><div><label class="form-label">開始番号</label><input id="bc-start" type="number" class="form-input" value="1"></div><div><label class="form-label">人数</label><input id="bc-count" type="number" class="form-input" value="40"></div></div><div><label class="form-label">パスワード</label><input id="bc-password" type="text" class="form-input" value="password"></div></div>';}else{f.innerHTML='<div class="space-y-3"><p class="text-sm text-gray-600">T001〜Txxx 形式で先生アカウントを生成</p><div><label class="form-label">人数</label><input id="bc-tcount" type="number" class="form-input" value="5"></div><div><label class="form-label">パスワード</label><input id="bc-tpassword" type="text" class="form-input" value="teacher1234"></div></div>';}}

async function submitBulkCreateStudent(){if(bulkTab==='student'){const year=parseInt(document.getElementById('bc-year').value);const class_num=parseInt(document.getElementById('bc-class').value);const count=parseInt(document.getElementById('bc-count').value);const start_num=parseInt(document.getElementById('bc-start').value)||1;const password=document.getElementById('bc-password').value||'password';if(!year||!class_num||!count){toast('すべて入力','error');return;}if(count>100){toast('100人まで','error');return;}try{const r=await api('/api/admin/bulk-create/students',{method:'POST',body:{year,class_num,count,start_num,password}});closeModal();toast(r.count+'人作成しました','success');loadAdminUsers();}catch(e){toast(e.message||'失敗','error');}}else{const count=parseInt(document.getElementById('bc-tcount').value);const password=document.getElementById('bc-tpassword').value||'teacher1234';if(!count){toast('人数を入力','error');return;}try{const r=await api('/api/admin/bulk-create/teachers',{method:'POST',body:{count,password}});closeModal();toast(r.count+'人作成しました','success');loadAdminUsers();}catch(e){toast(e.message||'失敗','error');}}}

async function loadAdminProfileChanges(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="flex gap-2 flex-wrap"><button onclick="loadAdminProfileChanges()" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-sync mr-1"></i>再読込</button><button onclick="approveAllProfileChanges()" class="bg-green-700 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-check-double mr-1"></i>全件一括承認</button></div><div id="profile-changes-list"><div class="skeleton h-20"></div></div></div>';try{const r=await api('/api/admin/profile-changes');const l=document.getElementById('profile-changes-list');if(!r.requests.length){l.innerHTML='<div class="empty-state"><i class="fas fa-check-circle"></i><p>承認待ちのリクエストはありません</p></div>';return;}const grouped={};for(const req of r.requests){const key=req.user_id;if(!grouped[key])grouped[key]={user_name:req.user_name,user_id:req.user_id,grade:req.grade,class_num:req.class_num,number:req.number,requests:[]};grouped[key].requests.push(req);}l.innerHTML=Object.values(grouped).map(g=>'<div class="card p-4 mb-3"><div class="flex justify-between items-center mb-3"><div><span class="font-semibold">'+esc(g.user_name)+'</span><span class="text-xs text-gray-500 ml-2">'+(g.grade?g.grade+'-'+g.class_num+' '+g.number:'')+'</span></div><div class="flex gap-2"><button onclick="approveUserProfileChanges('+g.user_id+')" class="bg-green-600 text-white px-3 py-1 rounded-full text-xs"><i class="fas fa-check mr-1"></i>全て承認</button><button onclick="rejectUserProfileChanges('+g.user_id+')" class="bg-red-400 text-white px-3 py-1 rounded-full text-xs"><i class="fas fa-times mr-1"></i>全て却下</button></div></div><div class="space-y-2">'+g.requests.map(req=>'<div class="flex items-center justify-between bg-gray-50 rounded-lg p-2"><div class="flex-1 flex items-center gap-2 text-sm"><span class="font-medium text-gray-600 w-16">'+{name:'名前',grade:'学年',class_num:'クラス',number:'番号',club:'部活',committee:'委員会'}[req.field_name]||req.field_name+'</span><span class="line-through text-gray-400">'+esc(req.old_value||'')+'</span><i class="fas fa-arrow-right text-gray-400 text-xs"></i><span class="font-semibold">'+esc(req.new_value)+'</span></div><span class="text-xs text-gray-400">'+formatRelative(req.created_at)+'</span></div>').join('')+'</div></div>').join('');}catch{const l=document.getElementById('profile-changes-list');if(l)l.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}
async function approveProfileChange(id){try{await api('/api/admin/profile-changes/'+id+'/approve',{method:'POST'});toast('承認しました','success');loadAdminProfileChanges();}catch(e){toast(e.message||'失敗','error');}}
async function rejectProfileChange(id){try{await api('/api/admin/profile-changes/'+id+'/reject',{method:'POST'});toast('却下しました','success');loadAdminProfileChanges();}catch(e){toast(e.message||'失敗','error');}}
async function approveAllProfileChanges(){if(!confirm('全ての承認待ちリクエストを一括承認しますか？'))return;try{const r=await api('/api/admin/profile-changes/bulk-approve',{method:'POST'});toast(r.count+'件承認しました','success');loadAdminProfileChanges();}catch(e){toast(e.message||'失敗','error');}}
async function approveUserProfileChanges(userId){if(!confirm('このユーザーの全てのリクエストを承認しますか？'))return;try{const r=await api('/api/admin/profile-changes/bulk-approve',{method:'POST',body:{user_id:userId}});toast(r.count+'件承認しました','success');loadAdminProfileChanges();}catch(e){toast(e.message||'失敗','error');}}
async function rejectUserProfileChanges(userId){if(!confirm('このユーザーの全てのリクエストを却下しますか？'))return;try{const r=await api('/api/admin/profile-changes/bulk-reject',{method:'POST',body:{user_id:userId}});toast(r.count+'件却下しました','success');loadAdminProfileChanges();}catch(e){toast(e.message||'失敗','error');}}

async function loadAdminRoles(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/users');const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');let users=r.users.filter(u=>{const ur=(u.all_roles||u.role||'').split(',').map(x=>x.trim());return isAdmin||!ur.includes('admin');});const sq=document.getElementById('role-search-input');const q=sq?(sq.value||'').toLowerCase():'';if(q){users=users.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.login_id||u.username||'').toLowerCase().includes(q));}c.innerHTML='<div class="mb-3"><input id="role-search-input" class="form-input" placeholder="名前またはIDで検索" oninput="loadAdminRoles()"></div><div class="space-y-2">'+users.map(u=>{const roles=(u.all_roles||'').split(',').filter(Boolean);const isTargetAdmin=roles.includes('admin');return'<div class="card p-3"><div class="flex justify-between items-center mb-2"><div><span class="font-semibold text-sm">'+esc(u.name)+'</span><span class="text-xs text-gray-500 ml-2">'+esc(u.login_id||u.username||'')+'</span></div><span class="text-xs text-gray-400">'+u.role+(u.grade?' '+u.grade+'-'+u.class_num:'')+'</span></div><div class="flex flex-wrap gap-1 mb-2">'+(roles.length?roles.map(r=>'<span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">'+(ROLE_LABELS[r]||r)+(isAdmin||!isTargetAdmin?' <button onclick="removeUserRole('+u.id+',\''+r+'\')" class="text-blue-600 hover:text-red-600 ml-0.5">&times;</button>':'')+'</span>').join(''):'<span class="text-xs text-gray-400">ロールなし</span>')+'</div><div class="flex gap-1 flex-wrap">'+(isAdmin||!isTargetAdmin?ALL_ROLES.filter(r=>!roles.includes(r)&&r!=='admin').map(r=>'<button onclick="addUserRole('+u.id+',\''+r+'\')" class="border border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300 px-2 py-0.5 rounded-full text-xs transition">+'+(ROLE_LABELS[r]||r)+'</button>').join(''):'')+'</div></div>';}).join('')+'</div>';}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}async function addUserRole(id,role){try{await api('/api/admin/users/'+id+'/roles',{method:'POST',body:{role}});toast('追加しました','success');loadAdminRoles();}catch(e){toast(e.message||'失敗','error');}}
async function removeUserRole(id,role){try{await api('/api/admin/users/'+id+'/roles/'+role,{method:'DELETE'});toast('削除しました','success');loadAdminRoles();}catch(e){toast(e.message||'失敗','error');}}

async function loadAdminStats(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/stats');c.innerHTML='<div class="grid grid-cols-2 gap-3"><div class="card p-4 text-center"><p class="text-2xl font-bold text-green-600">'+r.total+'</p><p class="text-xs text-gray-500">総ユーザー数</p></div></div><div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"><div class="card p-4"><h4 class="text-sm font-bold mb-2">学年別</h4><canvas id="stats-grade-chart" height="180" class="w-full"></canvas></div><div class="card p-4"><h4 class="text-sm font-bold mb-2">ロール別</h4><canvas id="stats-role-chart" height="180" class="w-full"></canvas></div><div class="card p-4"><h4 class="text-sm font-bold mb-2">部活動</h4><div id="stats-club-list" class="space-y-1"></div></div><div class="card p-4"><h4 class="text-sm font-bold mb-2">委員会</h4><div id="stats-committee-list" class="space-y-1"></div></div></div>';drawBarChart('stats-grade-chart',r.byGrade.map((x)=>({label:''+x.grade+'年',value:x.cnt})));drawBarChart('stats-role-chart',r.byRole.map((x)=>({label:{admin:'管理者',teacher:'先生',student:'生徒',captain:'部長',chairman:'委員長'}[x.role]||x.role,value:x.cnt})));document.getElementById('stats-club-list').innerHTML=r.byClub.map((x)=>'<div class="flex justify-between text-sm"><span>'+esc(x.club)+'</span><span class="font-bold">'+x.cnt+'</span></div>').join('');document.getElementById('stats-committee-list').innerHTML=r.byCommittee.map((x)=>'<div class="flex justify-between text-sm"><span>'+esc(x.committee)+'</span><span class="font-bold">'+x.cnt+'</span></div>').join('');}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

function drawBarChart(canvasId,data){const cv=document.getElementById(canvasId);if(!cv)return;const ctx=cv.getContext('2d');const w=cv.parentElement.clientWidth||300;cv.width=w;cv.height=180;const barW=Math.max(6,w/data.length/2-2);const max=Math.max(...data.map((d)=>d.value),1);ctx.clearRect(0,0,w,180);data.forEach((d,i)=>{const x=i*(w/data.length)+(w/data.length-barW)/2;const h=(d.value/max)*140;ctx.fillStyle='#40916c';ctx.beginPath();ctx.roundRect(x,165-h,barW,h,3);ctx.fill();ctx.fillStyle='#555';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(d.label,x+barW/2,180);ctx.fillStyle='#222';ctx.font='bold 14px sans-serif';ctx.fillText(d.value,x+barW/2,158-h);});}

async function loadAdminDiagnostics(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="flex gap-2"><button onclick="loadAdminDiagnostics()" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-sync mr-1"></i>再診断</button></div><div id="diag-results"><div class="skeleton h-32"></div></div></div>';try{const r=await api('/api/admin/diagnostics');const l=document.getElementById('diag-results');l.innerHTML='<div class="space-y-2">'+r.checks.map((ch)=>{const icon={ok:'fa-check-circle text-green-500',error:'fa-exclamation-circle text-red-500',info:'fa-info-circle text-blue-500'}[ch.status]||'fa-circle text-gray-400';return'<div class="card p-3 flex items-center gap-3"><i class="fas '+icon+'"></i><div class="flex-1"><p class="text-sm font-semibold">'+esc(ch.name)+'</p><p class="text-xs text-gray-500">'+esc(ch.message)+'</p></div></div>';}).join('')+'</div>';}catch{const l=document.getElementById('diag-results');if(l)l.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>診断失敗</p></div>';}}

async function loadAdminTokens(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="card p-4"><h3 class="font-bold mb-3">招待コード発行</h3><div class="grid grid-cols-3 gap-2 mb-3"><div><label class="form-label">ロール</label><select id="token-role-select" class="form-input"><option value="student">生徒</option><option value="teacher">先生</option></select></div><div><label class="form-label">有効時間(h)</label><input id="token-hours" type="number" value="72" class="form-input"></div><div><label class="form-label">発行数</label><input id="token-count" type="number" value="1" min="1" max="100" class="form-input"></div></div><button onclick="generateTokens()" class="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-key mr-1"></i>発行</button></div><div id="token-results" class="space-y-2"></div></div>';}

async function loadAdminBulkCreate(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="flex gap-2 mb-3"><button onclick="switchBulkTab2(\'student\',this)" class="sub-nav-btn active">生徒</button><button onclick="switchBulkTab2(\'teacher\',this)" class="sub-nav-btn">先生</button></div><div id="bulk-form2"><div class="card p-4"><h3 class="font-bold mb-3">生徒一括生成</h3><p class="text-sm text-gray-600 mb-3">年度+組+番号でログインID生成（例: 2024年度3組28番 → 24328）</p><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">年度</label><input id="bc2-year" type="number" class="form-input" value="2024"></div><div><label class="form-label">組</label><input id="bc2-class" type="number" class="form-input" value="1"></div></div><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">開始番号</label><input id="bc2-start" type="number" class="form-input" value="1"></div><div><label class="form-label">人数</label><input id="bc2-count" type="number" class="form-input" value="40"></div></div><div><label class="form-label">パスワード</label><input id="bc2-password" type="text" class="form-input" value="password"></div><button onclick="submitBulkCreateStudent2()" class="mt-3 bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>一括作成</button><div id="bulk-result" class="mt-2"></div></div></div></div>';}

let bulkTab2='student'
function switchBulkTab2(tab,btn){bulkTab2=tab;document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=document.getElementById('bulk-form2');if(tab==='student'){f.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">生徒一括生成</h3><p class="text-sm text-gray-600 mb-3">年度+組+番号でログインID生成（例: 2024年度3組28番 → 24328）</p><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">年度</label><input id="bc2-year" type="number" class="form-input" value="2024"></div><div><label class="form-label">組</label><input id="bc2-class" type="number" class="form-input" value="1"></div></div><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">開始番号</label><input id="bc2-start" type="number" class="form-input" value="1"></div><div><label class="form-label">人数</label><input id="bc2-count" type="number" class="form-input" value="40"></div></div><div><label class="form-label">パスワード</label><input id="bc2-password" type="text" class="form-input" value="password"></div><button onclick="submitBulkCreateStudent2()" class="mt-3 bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>一括作成</button><div id="bulk-result" class="mt-2"></div></div>';}else{f.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">先生一括生成</h3><p class="text-sm text-gray-600 mb-3">T001〜Txxx 形式で先生アカウントを生成</p><div><label class="form-label">人数</label><input id="bc2-tcount" type="number" class="form-input" value="5"></div><div class="mt-2"><label class="form-label">パスワード</label><input id="bc2-tpassword" type="text" class="form-input" value="teacher1234"></div><button onclick="submitBulkCreateTeacher2()" class="mt-3 bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>一括作成</button><div id="bulk-result" class="mt-2"></div></div>';}}

async function submitBulkCreateStudent2(){if(bulkTab2==='teacher'){submitBulkCreateTeacher2();return;}const year=parseInt(document.getElementById('bc2-year').value);const class_num=parseInt(document.getElementById('bc2-class').value);const count=parseInt(document.getElementById('bc2-count').value);const start_num=parseInt(document.getElementById('bc2-start').value)||1;const password=document.getElementById('bc2-password').value||'password';if(!year||!class_num||!count){toast('すべて入力','error');return;}if(count>100){toast('100人まで','error');return;}try{document.getElementById('bulk-result').innerHTML='<div class="skeleton h-12"></div>';const r=await api('/api/admin/bulk-create/students',{method:'POST',body:{year,class_num,count,start_num,password}});document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-green-50 text-green-700 text-sm">'+r.count+'人作成しました</div>';toast(r.count+'人作成しました','success');}catch(e){document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-red-50 text-red-600 text-sm">'+(e.message||'失敗')+'</div>';}}
async function submitBulkCreateTeacher2(){const count=parseInt(document.getElementById('bc2-tcount').value);const password=document.getElementById('bc2-tpassword').value||'teacher1234';if(!count){toast('人数を入力','error');return;}try{document.getElementById('bulk-result').innerHTML='<div class="skeleton h-12"></div>';const r=await api('/api/admin/bulk-create/teachers',{method:'POST',body:{count,password}});document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-green-50 text-green-700 text-sm">'+r.count+'人作成しました</div>';toast(r.count+'人作成しました','success');}catch(e){document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-red-50 text-red-600 text-sm">'+(e.message||'失敗')+'</div>';}}

async function loadAdminPosts(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="flex gap-2"><button onclick="loadAdminPosts()" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-sync mr-1"></i>再読込</button></div><div id="admin-posts-list"><div class="skeleton h-32"></div></div></div>';try{const r=await api('/api/admin/posts');const l=document.getElementById('admin-posts-list');if(!r.posts.length){l.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>投稿なし</p></div>';return;}l.innerHTML=r.posts.map(p=>'<div class="card p-3 flex items-start gap-3"><div class="flex-1 min-w-0"><div class="flex justify-between items-start"><p class="text-sm font-semibold truncate">'+esc(p.author_name)+'</p><span class="text-xs text-gray-400">'+formatRelative(p.created_at)+'</span></div><p class="text-sm mt-1 line-clamp-2">'+esc(p.content||'')+'</p></div><button onclick="deleteAdminPost('+p.id+')" class="text-red-500 hover:text-red-700 flex-shrink-0"><i class="fas fa-trash"></i></button></div>').join('');}catch{const l=document.getElementById('admin-posts-list');if(l)l.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

async function deleteAdminPost(id){if(!confirm('この投稿を削除しますか？'))return;try{await api('/api/admin/posts/bulk-delete',{method:'POST',body:{ids:[id]}});toast('削除しました','success');loadAdminPosts();}catch(e){toast(e.message||'失敗','error');}}

async function generateTokens(){const c=document.getElementById('token-results');if(!c)return;c.innerHTML='<div class="skeleton h-12"></div>';try{const r=await api('/api/admin/tokens',{method:'POST',body:{role:document.getElementById('token-role-select').value,hours:parseInt(document.getElementById('token-hours').value)||72,count:parseInt(document.getElementById('token-count').value)||1}});c.innerHTML='<div class="card p-4 bg-green-50"><p class="text-sm text-green-700 font-semibold mb-2">発行完了！（期限: '+formatRelative(r.expires_at)+'）</p><div class="space-y-1">'+r.tokens.map(t=>'<div class="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border"><code class="flex-1 text-sm font-mono">'+esc(t)+'</code><button onclick="copyToken(\''+t+'\')" class="text-blue-600 text-xs hover:underline">コピー</button></div>').join('')+'</div></div>';}catch(e){c.innerHTML='<div class="card p-4 bg-red-50 text-red-600 text-sm">発行失敗: '+(e.message||'')+'</div>';}}

function copyToken(t){navigator.clipboard.writeText(t).then(()=>toast('コピーしました','success')).catch(()=>toast('手動でコピーしてください','error'));}

// === Notifications ===
function renderNotifications(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bell text-red-500"></i>通知</h2></div><div class="p-3"><div class="flex gap-2 mb-3"><button onclick="switchNotifTab(\'list\',this)" class="sub-nav-btn active"><i class="fas fa-list mr-1"></i>受信</button><button onclick="switchNotifTab(\'self\',this)" class="sub-nav-btn"><i class="fas fa-clock mr-1"></i>自分通知</button></div><div id="notif-list"><div class="skeleton h-20"></div></div></div>';
  loadNotifications();
}

function switchNotifTab(tab,btn){document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(tab==='list')loadNotifications();else if(tab==='self')loadSelfNotifications();}

async function loadSelfNotifications(){const c=document.getElementById('notif-list');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="card p-4"><h3 class="font-bold text-sm mb-3">新規作成</h3><div><label class="form-label">通知内容</label><textarea id="self-notif-msg" class="form-input" rows="2" placeholder="例: 3限の数学、小テストがあります"></textarea></div><div><label class="form-label">予約日時（省略で今すぐ）</label><input id="self-notif-time" type="datetime-local" class="form-input"></div><button onclick="submitSelfNotification()" class="mt-2 bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>作成</button></div><div id="self-notif-list"><div class="skeleton h-12"></div></div></div>';try{const r=await api('/api/admin/notifications/self');const l=document.getElementById('self-notif-list');if(!r.notifications.length){l.innerHTML='<div class="empty-state"><i class="fas fa-clock"></i><p>自分通知はありません</p></div>';return;}l.innerHTML=r.notifications.map(n=>'<div class="card p-3 flex justify-between items-center"><div><p class="text-sm">'+esc(n.title||n.message||'')+'</p><span class="text-xs text-gray-400">'+(n.scheduled_at?'予定: '+formatRelative(n.scheduled_at):'今すぐ')+'</span></div><button onclick="deleteSelfNotif('+n.id+')" class="text-red-500 text-xs hover:underline">削除</button></div>').join('');}catch{}}

async function submitSelfNotification(){const msg=document.getElementById('self-notif-msg').value.trim();if(!msg){toast('メッセージを入力','error');return;}const scheduled=document.getElementById('self-notif-time').value||null;try{await api('/api/admin/notifications/self',{method:'POST',body:{message:msg,scheduled_at:scheduled?new Date(scheduled).toISOString():null}});document.getElementById('self-notif-msg').value='';document.getElementById('self-notif-time').value='';toast('作成しました','success');loadSelfNotifications();}catch(e){toast(e.message||'失敗','error');}}

async function deleteSelfNotif(id){try{const r=await api('/api/notifications/'+id+'/read',{method:'POST'});loadSelfNotifications();}catch{}}
async function testPush(){try{const r=await api('/api/admin/notifications/test',{method:'POST'});if(r.error){toast(r.error+(r.endpoint?' ['+r.endpoint+']':''),'error');return;}toast(r.message+(r.devices?' ['+r.devices+']':''),'success');}catch(e){toast('失敗: '+(e.message||'エラー'),'error');}}

let _lastNotifId = 0
let _lastNotifInit = false
function getLastReadNotifId() { return parseInt(localStorage.getItem('lastReadNotifId') || '0') }
function setLastReadNotifId(id) { localStorage.setItem('lastReadNotifId', String(id)) }
async function pollNotifications() {
  try {
    const list = await api('/api/auth/notifications')
    if (_lastNotifInit) {
      if (Notification.permission === 'granted') {
        for (const n of list.notifications || []) {
          if (n.id > _lastNotifId && n.title) {
            try { new Notification('上中黒板', { body: n.title, icon: '/icons/icon-192.png' }) } catch {}
          }
        }
      }
    }
    if (list.notifications?.length) _lastNotifId = list.notifications[0].id
    _lastNotifInit = true
    updateNotifBadge()
  } catch {}
  setTimeout(pollNotifications, 30000)
}

async function loadNotifications(){const c=document.getElementById('notif-list');if(!c)return;try{const r=await api('/api/auth/notifications');if(!r.notifications.length){c.innerHTML='<div class="empty-state"><i class="fas fa-bell-slash"></i><p>通知はありません</p></div>';updateNotifBadge();return;}c.innerHTML=r.notifications.map(n=>'<div class="card p-4 mb-2 flex items-start gap-3'+(n.id>getLastReadNotifId()?' cursor-pointer':'')+'"'+(n.id>getLastReadNotifId()?' onclick="markNotifRead('+n.id+')"':'')+' data-nid="'+n.id+'"><div class="w-8 h-8 rounded-full '+(n.id>getLastReadNotifId()?'bg-blue-100':'bg-gray-200')+' flex items-center justify-center text-sm"><i class="fas '+(n.icon||'fa-bell')+' text-blue-600"></i></div><div class="flex-1"><p class="text-sm '+(n.id>getLastReadNotifId()?'text-gray-800 font-semibold':'text-gray-500')+'">'+esc(n.title||n.message||n.body||'')+'</p><span class="text-xs text-gray-400">'+formatRelative(n.created_at)+'</span></div></div>').join('');updateNotifBadge()}catch{}}

async function markNotifRead(id){setLastReadNotifId(id);loadNotifications();updateNotifBadge();try{await api('/api/auth/notifications/'+id+'/read',{method:'POST'})}catch{}setLastReadNotifId(id)}

function esc(str){if(!str)return '';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');}

// === Utilities ===
function formatRelative(d){if(!d)return '';const t=new Date(d);const n=new Date();const diff=(n-t)/1000;if(diff<60)return 'たった今';if(diff<3600)return Math.floor(diff/60)+'分前';if(diff<86400)return Math.floor(diff/3600)+'時間前';if(diff<172800)return '昨日';if(diff<2592000)return Math.floor(diff/86400)+'日前';return t.toLocaleDateString('ja-JP',{month:'short',day:'numeric',year:diff>31536000?'numeric':undefined});}

function formatDate(d){if(!d)return '';return new Date(d).toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}

function renderFilePreview(url,type){if(!url)return '';if(type==='image')return '<img src="'+url+'" class="mt-2 max-h-64 rounded-lg object-contain border" onerror="this.style.display=\'none\'">';if(type==='pdf')return '<a href="'+url+'" target="_blank" class="mt-2 flex items-center gap-2 text-blue-600 hover:underline text-sm"><i class="fas fa-file-pdf text-red-500"></i> PDF閲覧</a>';return'';}

function showModal(title,body,actions){const o=document.getElementById('modal-overlay'),c=document.getElementById('modal-box'),t=document.getElementById('modal-title'),b=document.getElementById('modal-body'),a=document.getElementById('modal-footer');if(!o)return;t.textContent=title;b.innerHTML=body;a.innerHTML='';(actions||[]).forEach(ac=>{const btn=document.createElement('button');btn.textContent=ac.label;btn.className=ac.className||'px-4 py-2 rounded-xl font-semibold';btn.onclick=ac.action;a.appendChild(btn);});o.classList.remove('hidden');c.classList.add('modal-enter');}

function closeModal(){const o=document.getElementById('modal-overlay'),c=document.getElementById('modal-box');if(!o)return;c.classList.remove('modal-enter');o.classList.add('hidden');}

function toast(msg,type){const tc=document.getElementById('toast-container');if(!tc)return;const t=document.createElement('div');t.className='toast toast-'+(type||'info');t.textContent=msg;tc.appendChild(t);setTimeout(()=>{t.classList.add('toast-out');setTimeout(()=>t.remove(),300);},3000);}

async function api(path,opts){const cfg=opts||{};const isForm=cfg.body instanceof FormData;const resp=await fetch(path,{method:cfg.method||'GET',headers:isForm?{}:{'Content-Type':'application/json'},body:cfg.body?(isForm?cfg.body:JSON.stringify(cfg.body)):undefined,credentials:'include'});const ct=resp.headers.get('content-type')||'';if(cfg.noJson||ct.includes('text/')||ct.includes('application/octet-stream')){if(!resp.ok){const txt=await resp.text();throw new Error(txt);}return resp;}const data=await resp.json();if(!resp.ok)throw new Error(data.error||data.message||'エラー');return data;}

function logout(){fetch('/api/auth/logout',{method:'POST',credentials:'include'}).then(()=>{window.location.reload();}).catch(()=>{window.location.reload();});}

async function fetchWBGT(){const el=document.getElementById('wbgt-text');const tm=setTimeout(function(){if(el&&el.textContent==='気象情報を取得中...')el.textContent='気象情報取得失敗';},8000);try{const wm={0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌦',56:'🌧',57:'🌧',61:'🌧',63:'🌧',65:'🌧',66:'🌧',67:'🌧',71:'❄️',73:'❄️',75:'❄️',77:'❄️',80:'🌦',81:'🌦',82:'🌦',85:'❄️',86:'❄️',95:'⛈',96:'⛈',99:'⛈'};const wd={0:'快晴',1:'晴れ',2:'薄曇り',3:'曇り',45:'霧',48:'霧',51:'小雨',53:'適度な雨',55:'強い雨',56:'氷雨(弱)',57:'氷雨(強)',61:'雨(弱)',63:'雨(中)',65:'雨(強)',66:'凍雨(弱)',67:'凍雨(強)',71:'雪(弱)',73:'雪(中)',75:'雪(強)',77:'霰',80:'にわか雨(弱)',81:'にわか雨(中)',82:'にわか雨(強)',85:'にわか雪(弱)',86:'にわか雪(強)',95:'雷雨',96:'雹伴う雷雨',99:'強雹伴う雷雨'};const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.8397&longitude=139.3912&current=temperature_2m,relative_humidity_2m,weather_code',{signal:AbortSignal.timeout(8000)});clearTimeout(tm);if(!r.ok){if(el)el.textContent='気象情報取得失敗';return;}const d=await r.json();const ta=d?.current?.temperature_2m;const rh=d?.current?.relative_humidity_2m;const wc=d?.current?.weather_code;const weather=wc!=null?(wm[wc]||'')+(wd[wc]||''):'';if(el&&ta!=null&&rh!=null){const tw=ta*Math.atan(0.151977*Math.sqrt(rh+8.313659))+Math.atan(ta+rh)-Math.atan(rh-1.676331)+0.00391838*Math.pow(rh,1.5)*Math.atan(0.023101*rh)-4.686035;const wbgt=0.7*tw+0.3*ta;let level='注意';let alert=null;if(wbgt>=31){level='危険';alert='運動は原則中止'}else if(wbgt>=28){level='危険';alert='激しい運動は中止'}else if(wbgt>=25){level='厳重警戒';alert='積極的に休息'}else if(wbgt>=21){level='警戒';alert='こまめに休息'}const lm={'危険':'text-red-300','厳重警戒':'text-yellow-300','警戒':'text-yellow-200','注意':'text-green-200'};el.innerHTML=(weather?weather+' ':'')+'<strong>'+ta+'°C</strong> 湿度'+rh+'% | WBGT: <strong>'+(Math.round(wbgt*10)/10)+'°C</strong> <span class="'+(lm[level]||'')+'">('+level+')</span>'+(alert?' <span class="text-yellow-200">⚠'+alert+'</span>':'');}else if(el){el.textContent='気象情報取得失敗';}}catch{clearTimeout(tm);if(el)el.textContent='気象情報取得失敗';}}
async function fetchDisasterInfo(){try{const r=await api('/api/disaster/current');const el=document.getElementById('disaster-text');const bar=document.getElementById('disaster-bar');if(el&&r.title){const lvLabel=r.level>=2?'[警戒レベル'+r.level+'] ':'['+r.level+'] ';el.innerHTML='<i class="fas fa-shield-alt mr-1"></i>'+lvLabel+esc(r.title);if(bar){bar.classList.remove('hidden','level2','level3','level4','level5');if(r.level>=5)bar.classList.add('level5');else if(r.level>=4)bar.classList.add('level4');else if(r.level>=3)bar.classList.add('level3');else if(r.level>=2)bar.classList.add('level2');bar.style.cursor='pointer';bar.onclick=function(){showWeatherModal();}}}else if(el){el.innerHTML='<i class="fas fa-shield-alt mr-1"></i>防災情報: 現在警報はありません';if(bar){bar.classList.remove('level2','level3','level4','level5');bar.style.cursor='pointer';bar.onclick=function(){showWeatherModal();}}}try{if(el&&r.title&&r.level>=3&&Notification.permission==='granted'&&!sessionStorage.getItem('disaster-notified')){new Notification('上中黒板 - 気象警報',{body:r.title,icon:'/icons/icon-192.png'});sessionStorage.setItem('disaster-notified','1');}}catch{}}catch{const el=document.getElementById('disaster-text');if(el)el.innerHTML='<i class="fas fa-shield-alt mr-1"></i>防災情報: 現在警報はありません';const bar=document.getElementById('disaster-bar');if(bar){bar.classList.remove('level2','level3','level4','level5');bar.style.cursor='pointer';bar.onclick=function(){showWeatherModal();}}}}

async function showWeatherModal(){showModal('天気予報','<div class="skeleton h-48"></div>',[]);try{const r=await api('/api/weather/forecast');const f=r.forecasts?.[0];if(!f){document.getElementById('modal-body').innerHTML='<p class="text-sm text-gray-400 p-4">読込失敗</p>';return;}const pops=f.pops||[];const wd=f.weather||'';const wd2=f.weatherTomorrow||'';const h='<div class="space-y-3 p-2">'+(wd?'<div class="border border-gray-300 rounded-lg p-3"><div class="text-lg font-bold mb-1">今日の天気</div><p class="text-sm leading-relaxed">'+(function(t){if(!t)return'';var parts=t.split(/\u3000/g).filter(Boolean);if(!parts.length)return'';var lines=[],cur='';var timeRe=/^(朝|昼前|昼過ぎ|昼頃|昼|夕方|夜|明け方|未明|主に)/;for(var i=0;i<parts.length;i++){var s=parts[i];if(timeRe.test(s)&&cur){lines.push(cur);cur=s;}else if(cur){cur=cur+' '+s;}else{cur=s;}}if(cur)lines.push(cur);return lines.map(function(s,i){var cls=i===0?'font-semibold text-base':'text-gray-600 text-sm mt-0.5';return'<div class="'+cls+'">'+s+'</div>';}).join('');})(wd)+'</p>'+(f.wind?'<p class="text-xs text-gray-500 mt-1">風: '+esc(f.wind)+'</p>':'')+'</div>':'')+(pops.length?'<div class="border border-gray-300 rounded-lg p-3"><div class="text-sm font-bold mb-2">降水確率</div><div class="grid grid-cols-4 gap-1 text-center">'+['6-12時','12-18時','18-24時','24-6時'].map((t,i)=>'<div><div class="text-xs text-gray-500">'+t+'</div><div class="text-xl font-bold'+(parseInt(pops[i])>=50?' text-blue-600':'')+'">'+(pops[i]||'-')+'%</div></div>').join('')+'</div></div>':'')+(f.temps?'<div class="border border-gray-300 rounded-lg p-3"><div class="text-sm font-bold mb-2">気温</div><div class="grid grid-cols-2 gap-2 text-center">'+(f.temps.today?'<div><div class="text-xs text-gray-500">日中</div><div class="text-xl font-bold">'+f.temps.today+'°C</div></div>':'')+(f.temps.tonight?'<div><div class="text-xs text-gray-500">夜</div><div class="text-xl font-bold">'+f.temps.tonight+'°C</div></div>':'')+'</div></div>':'')+(wd2?'<div class="border border-gray-300 rounded-lg p-3"><div class="text-sm font-bold mb-1">明日の天気</div><p class="text-sm leading-relaxed">'+(function(t){if(!t)return'';var parts=t.split(/\u3000/g).filter(Boolean);if(!parts.length)return'';var lines=[],cur='';var timeRe=/^(朝|昼前|昼過ぎ|昼頃|昼|夕方|夜|明け方|未明|主に)/;for(var i=0;i<parts.length;i++){var s=parts[i];if(timeRe.test(s)&&cur){lines.push(cur);cur=s;}else if(cur){cur=cur+' '+s;}else{cur=s;}}if(cur)lines.push(cur);return lines.map(function(s,i){var cls=i===0?'font-semibold text-base':'text-gray-600 text-sm mt-0.5';return'<div class="'+cls+'">'+s+'</div>';}).join('');})(wd2)+'</p>'+(f.windTomorrow?'<p class="text-xs text-gray-500 mt-1">風: '+esc(f.windTomorrow)+'</p>':'')+'</div>':'')+(f.publishingOffice?'<p class="text-xs text-gray-400 text-center">'+esc(f.publishingOffice)+' | '+(f.reportDatetime||'').slice(0,16).replace('T',' ')+'</p>':'')+'</div>';document.getElementById('modal-body').innerHTML=h;}catch{document.getElementById('modal-body').innerHTML='<p class="text-sm text-gray-400 p-4">読込失敗</p>';}}async function fetchUnreadCount(){try{const r=await api('/api/messages/unread-count');const badge=document.getElementById('msg-badge');if(badge){badge.textContent=r.count>0?(r.count>99?'99+':r.count):'';badge.classList.toggle('hidden',r.count===0);}}catch{}}
async function updateNotifBadge(){try{const r=await api('/api/auth/notifications');const lastRead=getLastReadNotifId();const unread=(r.notifications||[]).filter(n=>n.id>lastRead).length;const badge=document.getElementById('notif-badge');if(badge){if(unread>0){badge.textContent=unread>99?'99+':unread;badge.classList.remove('hidden')}else badge.classList.add('hidden')}}catch{}}
function markAllNotifRead(){const el=document.getElementById('notif-list');if(!el)return;const ids=(el.querySelectorAll('[onclick^=markNotifRead]')||[]).length;const r=document.querySelectorAll('#notif-list .cursor-pointer');r.forEach(n=>{n.classList.remove('cursor-pointer');n.removeAttribute('onclick');});const max=Array.from(document.querySelectorAll('#notif-list .card')).reduce((m,c)=>{const m2=parseInt(c.getAttribute('data-nid')||'0');return m2>m?m2:m;},0);if(max>getLastReadNotifId())setLastReadNotifId(max);updateNotifBadge();}

function loadAdminTV(){var c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3"><i class="fas fa-tv mr-2"></i>TV表示モード</h3><p class="text-sm text-gray-500 mb-3">委員会・部活動の投稿を大きな文字で表示します。iPad等をテレビにミラーリングしてご利用ください。</p><button onclick="showTVDisplay()" class="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold text-lg hover:bg-gray-800 transition"><i class="fas fa-expand mr-2"></i>フルスクリーンで表示</button></div>';}
function showTVDisplay(){var o=document.createElement('div');o.id='tv-display';o.style.cssText='position:fixed;inset:0;z-index:9999;background:#0f172a;color:white;display:flex;flex-direction:column;';o.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 24px;background:#1e293b;border-bottom:2px solid #334155;flex-shrink:0"><h1 style="font-size:20px;font-weight:bold"><i class="fas fa-tv mr-2"></i>上中黒板 - TV表示</h1><div style="display:flex;gap:8px;align-items:center"><span id="tv-clock" style="font-size:16px;font-family:monospace;color:#94a3b8"></span><button onclick="exitTVDisplay()" style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600"><i class="fas fa-times mr-1"></i>閉じる</button></div></div><div id="tv-content" style="flex:1;display:flex;flex-direction:column;overflow:hidden;"></div>';document.body.appendChild(o);updateTVClock();window._tvClockTimer=setInterval(updateTVClock,1000);loadTVPosts();window._tvRefreshTimer=setInterval(loadTVPosts,30000);}
function updateTVClock(){var el=document.getElementById('tv-clock');if(!el)return;var d=new Date();el.textContent=d.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'})+' '+d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});}
function exitTVDisplay(){if(window._tvRefreshTimer)clearInterval(window._tvRefreshTimer);if(window._tvClockTimer)clearInterval(window._tvClockTimer);var el=document.getElementById('tv-display');if(el)el.remove();}
async function loadTVPosts(){var c=document.getElementById('tv-content');if(!c)return;try{var r=await Promise.all([api('/api/posts?category=committee'),api('/api/posts?category=club'),api('/api/disaster/current'),fetch('https://api.open-meteo.com/v1/forecast?latitude=35.8397&longitude=139.3912&current=temperature_2m,relative_humidity_2m,weather_code',{signal:AbortSignal.timeout(5000)}).then(function(r2){return r2.ok?r2.json():null;})]);var cp=r[0].posts||[],cbp=r[1].posts||[],di=r[2],om=r[3];var banner='';if(di&&di.title&&di.level>=2){var lvColor={2:'#eab308',3:'#f97316',4:'#ef4444',5:'#a855f7'}[di.level]||'#ef4444';var lvLabel={2:'注意',3:'警戒',4:'危険',5:'非常事態'}[di.level]||'';banner='<div style="grid-column:1/-1;background:'+lvColor+';color:white;padding:10px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0;animation:pulse-tv 2s infinite"><i class="fas fa-exclamation-triangle" style="font-size:20px"></i><span style="font-size:14px;font-weight:700;background:rgba(0,0,0,0.3);padding:2px 10px;border-radius:4px">レベル'+di.level+lvLabel+'</span><span style="font-size:16px;font-weight:600;flex:1">'+esc(di.title)+'</span><i class="fas fa-broadcast-tower" style="font-size:16px;animation:blink-tv 1s infinite"></i></div>';}var weatherInfo='';if(om&&om.current){var wm={0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌦',56:'🌧',57:'🌧',61:'🌧',63:'🌧',65:'🌧',66:'🌧',67:'🌧',71:'❄️',73:'❄️',75:'❄️',77:'❄️',80:'🌦',81:'🌦',82:'🌦',85:'❄️',86:'❄️',95:'⛈',96:'⛈',99:'⛈'};var wd={0:'快晴',1:'晴れ',2:'薄曇り',3:'曇り',45:'霧',48:'霧',51:'小雨',53:'適度な雨',55:'強い雨',56:'氷雨(弱)',57:'氷雨(強)',61:'雨(弱)',63:'雨(中)',65:'雨(強)',66:'凍雨(弱)',67:'凍雨(強)',71:'雪(弱)',73:'雪(中)',75:'雪(強)',77:'霰',80:'にわか雨(弱)',81:'にわか雨(中)',82:'にわか雨(強)',85:'にわか雪(弱)',86:'にわか雪(強)',95:'雷雨',96:'雹伴う雷雨',99:'強雹伴う雷雨'};var wc=om.current.weather_code,wh=wm[wc]||'',wdesc=wd[wc]||'';var ta=om.current.temperature_2m,rh=om.current.relative_humidity_2m;var tw=ta*Math.atan(0.151977*Math.sqrt(rh+8.313659))+Math.atan(ta+rh)-Math.atan(rh-1.676331)+0.00391838*Math.pow(rh,1.5)*Math.atan(0.023101*rh)-4.686035;var wbgt=0.7*tw+0.3*ta;var wl='注意',wa='',wc2='#27ae60';if(wbgt>=31){wl='危険';wa='運動は原則中止';wc2='#ef4444'}else if(wbgt>=28){wl='危険';wa='激しい運動は中止';wc2='#e67e22'}else if(wbgt>=25){wl='厳重警戒';wa='積極的に休息';wc2='#f39c12'}else if(wbgt>=21){wl='警戒';wa='こまめに休息';wc2='#eab308'}weatherInfo='<div style="grid-column:1/-1;background:#1e293b;padding:6px 20px;display:flex;align-items:center;gap:16px;font-size:14px;flex-shrink:0;border-bottom:1px solid #334155"><span style="color:#94a3b8">'+wh+' '+wdesc+'</span><span style="color:#94a3b8"><i class="fas fa-thermometer-half mr-1"></i>'+ta+'°C</span><span style="color:#94a3b8"><i class="fas fa-tint mr-1"></i>'+rh+'%</span><span style="color:'+wc2+';font-weight:700"><i class="fas fa-sun mr-1"></i>WBGT: '+(Math.round(wbgt*10)/10)+'°C ('+wl+')</span>'+(wa?'<span style="color:#fbbf24;font-size:12px">⚠'+wa+'</span>':'')+'</div>';}var renderCol=function(posts,title,color){var h='<div style="display:flex;flex-direction:column;overflow-y:auto;padding:16px;background:#0f172a;border-right:1px solid #1e293b">';h+='<h2 style="font-size:22px;font-weight:bold;margin-bottom:12px;padding-bottom:8px;border-bottom:3px solid '+color+';color:'+color+';flex-shrink:0"><i class="fas '+(title.indexOf('委員会')>=0?'fa-users':'fa-running')+' mr-2"></i>'+title+'</h2>';if(!posts.length){h+='<p style="color:#64748b;font-size:16px;text-align:center;padding:32px">投稿はありません</p>';}else{h+=posts.map(function(p){return'<div style="background:#1e293b;border-radius:12px;padding:14px;margin-bottom:10px;border-left:4px solid '+color+';font-size:16px;line-height:1.6">'+(p.author_name?'<div style="font-size:13px;color:#94a3b8;margin-bottom:4px"><strong style="color:#cbd5e1">'+esc(p.author_name)+'</strong><span style="margin-left:8px">'+formatRelative(p.created_at)+'</span></div>':'')+(p.title?'<h3 style="font-size:18px;font-weight:bold;margin-bottom:4px;color:#f1f5f9">'+esc(p.title)+'</h3>':'')+'<p style="color:#cbd5e1;font-size:16px">'+esc(p.content)+'</p></div>';}).join('');}h+='</div>';return h;};c.innerHTML=banner+weatherInfo+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;flex:1;overflow:hidden">'+renderCol(cp,'委員会連絡','#a855f7')+renderCol(cbp,'部活動連絡','#ef4444')+'</div>';}catch{c.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:18px;color:#64748b">読み込みに失敗しました</div>';}}
