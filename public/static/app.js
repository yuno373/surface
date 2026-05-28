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
    messages:renderMessages, captchat:renderCaptChat,
    consult:renderConsult, howto:renderHowTo, settings:renderSettings,
    notifications:renderNotifications
  };
  if(fns[tabId]) fns[tabId](content);
  else content.innerHTML='<div class="empty-state"><i class="fas fa-construction"></i><p>準備中</p></div>';
}

function clearTimers() { [reloadTimer,notifCheckTimer,clockTimer].forEach(t=>{if(t) clearInterval(t);}); }
function loadInfoBar() { updateInfoBar(); fetchWBGT(); }
function startTimers() {
  notifCheckTimer=setInterval(fetchUnreadCount,30000);
  reloadTimer=setInterval(()=>{if(currentTab) renderTab(currentTab);},60000);
}

// === Committee ===
function renderCommittee(container) {
  const roles=currentUser.roles||[currentUser.role];
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  const myCommittee=currentUser.committee;
  const isPE=myCommittee==='体育委員会'||roles.includes('pe_committee');
  let tabs='';
  if(isStaff) tabs=COMMITTEES.map((c,i)=>'<button class="h-scroll-tab'+(i===0?' active':'')+'" onclick="switchGroupTab(\'committee\',\''+c+'\',this)">'+c+'</button>').join('');
  else if(myCommittee) {
    tabs='<button class="h-scroll-tab active">'+myCommittee+'</button>';
    if(isPE) tabs+='<button class="h-scroll-tab" onclick="switchGroupTab(\'pe_checklist\',\'\',this)"><i class="fas fa-clipboard-list mr-1"></i>用具確認</button>';
  }
  const canPost=isStaff||roles.some(r=>['chairman','vice_chairman'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-users-cog text-purple-600"></i>委員会</h2>'+(canPost?'<button onclick="openPostModal(\'committee\',window.currentCommitteeTarget)" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div><div class="h-scroll-tabs" id="committee-tabs">'+tabs+'</div></div><div class="p-3" id="committee-list"><div class="skeleton h-24"></div></div>';
  window.currentCommitteeTarget=isStaff?COMMITTEES[0]:myCommittee;
  if(window.currentCommitteeTarget) loadPosts('committee',window.currentCommitteeTarget,'committee-list');
}

function switchGroupTab(type,target,btn) {
  document.querySelectorAll('#committee-tabs .h-scroll-tab, #club-tabs .h-scroll-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(type==='pe_checklist'){renderPEChecklist(document.getElementById('committee-list'));return;}
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
  const canPost=isStaff||roles.some(r=>['captain','vice_captain'].includes(r));
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
    if(!r.posts||!r.posts.length){c.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>投稿がありません</p></div>';return;}
    c.innerHTML=r.posts.map(p=>renderPostCard(p)).join('');
  } catch { c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>'; }
}

function renderPostCard(post) {
  const rl=ROLE_LABELS[post.author_role]||post.author_role;
  const es=post.expires_at?'<span class="text-xs text-gray-400 ml-2"><i class="fas fa-clock"></i> '+formatDate(post.expires_at)+'</span>':'';
  const fh=renderFilePreview(post.file_url,post.file_type);
  const ib=post.is_important?'<span class="badge badge-admin mr-1"><i class="fas fa-star mr-1"></i>重要</span>':'';
  const re=(post.reactions||[]).map(r=>'<button class="reaction-btn" onclick="reactToPost('+post.id+',\''+r.emoji+'\',this)">'+r.emoji+' <span>'+r.count+'</span></button>').join('');
  const ar='<button class="reaction-btn" onclick="showEmojiPicker('+post.id+',\'post\',this)"><i class="fas fa-smile-beam"></i></button>';
  const del=canDeletePost(post)?'<button onclick="deletePost('+post.id+')" class="text-red-400 hover:text-red-600 text-sm"><i class="fas fa-trash"></i></button>':'';
  return '<div class="post-card slide-in" id="post-'+post.id+'"><div class="flex items-start justify-between mb-2"><div>'+ib+'<span class="badge badge-'+post.author_role+' mr-2">'+rl+'</span><span class="font-semibold text-gray-800">'+esc(post.author_name||'不明')+'</span>'+es+'</div><div class="flex gap-2 items-center"><span class="text-xs text-gray-400">'+formatRelative(post.created_at)+'</span>'+del+'</div></div>'+(post.title?'<h3 class="font-bold text-gray-800 mb-1">'+esc(post.title)+'</h3>':'')+'<p class="text-gray-700 text-sm whitespace-pre-wrap">'+esc(post.content)+'</p>'+fh+'<div class="flex flex-wrap gap-2 mt-3 items-center">'+re+ar+'</div>'+(post.read_count!=null?'<div class="text-xs text-gray-400 mt-1"><i class="fas fa-eye mr-1"></i>既読 '+post.read_count+'人</div>':'')+'</div>';
}

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
    c.innerHTML='<div class="flex gap-2 mb-3"><button class="sub-nav-btn active" onclick="switchSurveyTab(\'open\',this,\'notice-content\')">回答受付中</button><button class="sub-nav-btn" onclick="switchSurveyTab(\'closed\',this,\'notice-content\')">終了</button></div><div id="survey-list"><div class="skeleton h-20"></div></div>';
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
function renderClassGroup(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  const myGrade=currentUser.grade?String(currentUser.grade):null;
  const myClass=currentUser.class_num?String(currentUser.class_num):null;
  let tabs='';
  if(isStaff){
    for(let g=1;g<=3;g++)for(let c=1;c<=9;c++)tabs+='<button class="h-scroll-tab" onclick="switchClassTab('+g+','+c+',this)">'+g+'年'+c+'組</button>';
    tabs=tabs.replace('class="h-scroll-tab"','class="h-scroll-tab active"');
  }else if(myGrade&&myClass){
    tabs='<button class="h-scroll-tab active">'+myGrade+'年'+myClass+'組</button>';
  }
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-chalkboard-teacher text-yellow-600"></i>クラス</h2>'+(isStaff?'<button onclick="openClassPostModal()" class="bg-yellow-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div><div class="h-scroll-tabs" id="class-tabs">'+tabs+'</div></div><div class="p-3" id="class-list"><div class="skeleton h-24"></div></div>';
  window.classTarget=myGrade&&myClass?myGrade+'-'+myClass:null;
  if(isStaff)window.classTarget='1-1';
  if(window.classTarget)loadPosts('class',window.classTarget,'class-list');
}

function switchClassTab(grade,cn,btn){document.querySelectorAll('#class-tabs .h-scroll-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');window.classTarget=grade+'-'+cn;loadPosts('class',window.classTarget,'class-list');}

function openClassPostModal(){
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  if(!isStaff){toast('先生のみ投稿できます','error');return;}
  let opts='';
  for(let g=1;g<=3;g++)for(let c=1;c<=9;c++)opts+='<option value="'+g+'-'+c+'">'+g+'年'+c+'組</option>';
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

async function addThreadMember(id){try{const r=await api('/api/messages/users');const opts=r.users.filter(u=>u.id!==currentUser.id).map(u=>'<option value="'+u.id+'">'+esc(u.name||u.id)+' ('+(ROLE_LABELS[u.role]||u.role)+')</option>').join('');showModal('メンバー追加','<div class="space-y-3"><select id="add-member-select" class="form-input" size="6">'+opts+'</select></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'追加',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:async()=>{const s=document.getElementById('add-member-select');const uid=parseInt(s.value);if(!uid){toast('選択してください','error');return;}try{await api('/api/messages/threads/'+id+'/members',{method:'POST',body:{user_id:uid}});closeModal();toast('追加しました','success');showThreadMembers(id);}catch(e){toast(e.message||'失敗','error');}}}]);}catch{toast('読込失敗','error');}}

async function removeThreadMember(tid,uid){if(!confirm('このメンバーを削除しますか？'))return;try{await api('/api/messages/threads/'+tid+'/members/'+uid,{method:'DELETE'});toast('削除しました','success');showThreadMembers(tid);}catch(e){toast(e.message||'失敗','error');}}

async function loadMessages(id){const c=document.getElementById('msg-list');if(!c)return;try{const r=await api('/api/messages/threads/'+id+'/messages');if(!r.messages.length){c.innerHTML='<div class="empty-state"><i class="fas fa-comment"></i><p>まだメッセージがありません</p></div>';return;}c.innerHTML=r.messages.map(m=>{const isMine=m.sender_id===currentUser.id;const ri=m.readers?.length>0?'<span class="text-xs text-blue-400 ml-1"><i class="fas fa-check-double"></i> '+m.readers.filter(r=>r.id!==m.sender_id).length+'</span>':'';return'<div class="flex '+(isMine?'justify-end':'justify-start')+' gap-2 items-end">'+(!isMine?'<div class="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs flex-none">'+((m.sender_name||'?')[0])+'</div>':'')+'<div class="group relative">'+(!isMine?'<p class="text-xs text-gray-500 mb-1 ml-1">'+esc(m.sender_name)+'</p>':'')+'<div class="msg-bubble '+(isMine?'mine':'others')+'">'+esc(m.content)+'</div>'+(m.file_url?renderFilePreview(m.file_url,m.file_type):'')+'<div class="flex items-center gap-1 mt-1 '+(isMine?'justify-end':'')+'"><span class="text-xs text-gray-400">'+formatRelative(m.created_at)+'</span>'+ri+'</div><button onclick="deleteMessage('+id+','+m.id+')" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition" title="取消"><i class="fas fa-times"></i></button></div></div>';}).join('');c.scrollTop=c.scrollHeight;}catch{}}

async function deleteMessage(tid,mid){if(!confirm('取消しますか？'))return;try{await api('/api/messages/threads/'+tid+'/messages/'+mid,{method:'DELETE'});toast('取消しました','success');loadMessages(tid);}catch(e){toast(e.message||'取消失敗','error');}}

async function sendMessage(){const inp=document.getElementById('msg-input');const c=inp?.value.trim();if(!c||!currentThreadId)return;inp.value='';try{await api('/api/messages/threads/'+currentThreadId+'/messages',{method:'POST',body:{content:c}});loadMessages(currentThreadId);}catch(e){toast(e.message||'送信失敗','error');}}

async function sendFileMessage(e){const f=e.target?.files?.[0];if(!f||!currentThreadId)return;try{const fd=new FormData();fd.append('file',f);const up=await api('/api/upload',{method:'POST',body:fd,noJson:true});await api('/api/messages/threads/'+currentThreadId+'/messages',{method:'POST',body:{content:'',file_url:up.url,file_type:up.mime_type?.startsWith('image/')?'image':'pdf'}});loadMessages(currentThreadId);}catch(e){toast('送信失敗','error');}}

async function openNewThreadModal(type){try{const r=await api('/api/messages/users');const opts=r.users.map(u=>'<option value="'+u.id+'">'+esc(u.name||u.id)+' ('+(ROLE_LABELS[u.role]||u.role)+')</option>').join('');showModal('新規メッセージ','<div class="space-y-4"><div><label class="form-label">種類</label><select id="thread-type" class="form-input"><option value="direct">DM</option>'+((currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r))?'<option value="group">グループ</option>':'')+'</select></div><div><label class="form-label">グループ名（任意）</label><input id="thread-name" type="text" class="form-input"></div><div><label class="form-label">相手</label><select id="thread-members" class="form-input" multiple size="6">'+opts+'</select></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'作成',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:createThread}]);}catch(e){toast('読込失敗','error');}}

async function createThread(){const t=document.getElementById('thread-type').value;const n=document.getElementById('thread-name').value.trim();const s=document.getElementById('thread-members');const mids=Array.from(s.selectedOptions).map(o=>parseInt(o.value));if(!mids.length){toast('相手を選択してください','error');return;}try{const r=await api('/api/messages/threads',{method:'POST',body:{type:t,name:n||null,member_ids:mids}});closeModal();toast(r.existing?'既存のスレッドを開きます':'作成しました',r.existing?'info':'success');navigateTo('messages');setTimeout(()=>openThread(r.thread_id,n||'新しいチャット'),100);}catch(e){toast(e.message||'作成失敗','error');}}

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
function renderSurveyList(container) {
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-poll text-purple-600"></i>アンケート</h2><button onclick="openNewSurveyModal()" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>作成</button></div><div class="sub-nav"><button class="sub-nav-btn active" onclick="switchSurveyTab(\'open\',this)">回答受付中</button><button class="sub-nav-btn" onclick="switchSurveyTab(\'closed\',this)">終了</button></div></div><div class="p-3" id="survey-list"><div class="skeleton h-20"></div></div>';
  loadSurveys('open');
}

function switchSurveyTab(tab,btn,cid){document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');loadSurveys(tab,cid||'survey-list');}

async function loadSurveys(status,containerId){const c=document.getElementById(containerId||'survey-list');if(!c)return;try{const r=await api('/api/surveys?status='+status);if(!r.surveys.length){c.innerHTML='<div class="empty-state"><i class="fas fa-poll-h"></i><p>'+(status==='open'?'募集中のアンケートはありません':'終了したアンケートはありません')+'</p></div>';return;}c.innerHTML=r.surveys.map(s=>{const sh=s.stats?'<div class="flex gap-2 mt-2 text-xs text-gray-500"><span>'+s.stats.total_answers+'回答</span></div>':'';const rb=s.is_answered||(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r))?'<button onclick="viewSurveyResult('+s.id+')" class="text-purple-600 text-xs hover:underline">結果を見る</button>':'';return'<div class="card p-4 mb-3"><div class="flex justify-between items-start"><div><h3 class="font-bold text-gray-800 mb-1">'+esc(s.title)+'</h3><p class="text-xs text-gray-500">作成: '+esc(s.creator_name)+' | 期限: '+(s.due_date?formatRelative(s.due_date):'なし')+'</p></div><span class="text-xs '+(s.status==='open'?'text-green-600':'text-gray-400')+'">'+(s.status==='open'?'受付中':'終了')+'</span></div><p class="text-sm text-gray-600 mt-2">'+esc(s.description||'')+'</p>'+sh+'<div class="mt-3 flex gap-3">'+(!s.is_answered&&s.status==='open'?'<button onclick="openSurveyAnswer('+s.id+')" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold">回答する</button>':'')+rb+'</div></div>';}).join('');}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

async function openNewSurveyModal(){showModal('アンケート作成','<div class="space-y-4"><div><label class="form-label">タイトル</label><input id="survey-title" type="text" class="form-input"></div><div><label class="form-label">説明</label><textarea id="survey-desc" class="form-input" rows="2"></textarea></div><div><label class="form-label">期限（任意）</label><input id="survey-due" type="date" class="form-input"></div><div><label class="form-label">選択肢（改行区切り）</label><textarea id="survey-options" class="form-input" rows="4" placeholder="はい&#10;いいえ&#10;どちらでもない"></textarea></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'作成',className:'bg-purple-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitNewSurvey}]);}

async function submitNewSurvey(){const t=document.getElementById('survey-title').value.trim();const d=document.getElementById('survey-desc').value.trim();const due=document.getElementById('survey-due').value||null;const os=document.getElementById('survey-options').value.trim();if(!t){toast('タイトルを入力','error');return;}if(!os){toast('選択肢を入力','error');return;}const opts=os.split('\n').filter(s=>s.trim()).map(s=>s.trim());try{await api('/api/surveys',{method:'POST',body:{title:t,description:d,due_date:due,options:opts}});closeModal();toast('作成しました','success');loadSurveys('open');}catch(e){toast(e.message||'作成失敗','error');}}

async function openSurveyAnswer(sid){try{const r=await api('/api/surveys/'+sid);const s=r.survey;const opts=s.options.map((o,i)=>'<label class="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50"><input type="radio" name="survey-opt" value="'+i+'" class="accent-purple-600"><span class="text-sm">'+esc(o)+'</span></label>').join('');showModal(esc(s.title),'<div class="space-y-3"><p class="text-sm text-gray-600">'+esc(s.description||'')+'</p>'+opts+'</div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'回答する',className:'bg-purple-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitSurveyAnswer(sid)}]);}catch(e){toast('読込失敗','error');}}

async function submitSurveyAnswer(sid){const s=document.querySelector('input[name="survey-opt"]:checked');if(!s){toast('選択肢を選んでください','error');return;}try{await api('/api/surveys/'+sid+'/answer',{method:'POST',body:{option_index:parseInt(s.value)}});closeModal();toast('回答しました','success');loadSurveys('open');}catch(e){toast(e.message||'回答失敗','error');}}

async function viewSurveyResult(sid){try{const r=await api('/api/surveys/'+sid+'/results');const s=r.survey;const total=s.options.reduce((a,o)=>a+(r.results[o]||0),0);const bars=s.options.map(o=>{const c=r.results[o]||0;const p=total?(c/total*100).toFixed(1):0;return'<div class="mb-3"><div class="flex justify-between text-sm mb-1"><span>'+esc(o)+'</span><span class="text-gray-500">'+c+' ('+p+'%)</span></div><div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden"><div class="h-full bg-purple-500 rounded-full transition-all" style="width:'+p+'%"></div></div></div>';}).join('');showModal(esc(s.title)+' - 結果','<div class="space-y-2"><p class="text-sm text-gray-500">総回答数: '+total+'</p>'+bars+'</div>',[{label:'閉じる',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);}catch(e){toast('読込失敗','error');}}

// === Consultation ===
function renderConsult(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-heart text-red-500"></i>相談所</h2></div><div class="p-3 space-y-3" id="consult-list"><div class="skeleton h-20"></div></div>';
  loadConsultations();
}

async function loadConsultations(){const c=document.getElementById('consult-list');if(!c)return;try{const r=await api('/api/questions/consultations');if(!r.consultations.length){c.innerHTML='<div class="empty-state"><i class="fas fa-heart"></i><p>まだ投稿はありません</p></div>';return;}c.innerHTML=r.consultations.map(cn=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-2 text-xs text-gray-400"><span>'+esc(cn.author_name||'匿名')+'</span><span>'+formatRelative(cn.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(cn.content)+'</p></div>').join('');}catch{}}

// === HowTo ===
function renderHowTo(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-book text-green-600"></i>使い方</h2></div><div class="p-4 text-sm text-gray-600 space-y-4"><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-tablet-alt mr-2 text-blue-500"></i>基本操作</h3><ul class="list-disc ml-4 space-y-1"><li>下部のタブから各機能に移動します</li><li>掲示板: 全校に投稿できます（先生のみ）</li><li>上中連絡: 先生からの連絡</li><li>委員会: 各委員会の連絡</li><li>部活動: 各部活の活動報告</li><li>アンケート: 投票・集計</li></ul></div><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-file-upload mr-2 text-green-500"></i>ファイル添付</h3><p>投稿作成時に画像やPDFを添付できます。</p></div><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-clock mr-2 text-orange-500"></i>投稿の期限</h3><p>投稿の公開期間は明日〜最大2ヶ月です。</p></div></div>';
}

// === Settings ===
function renderSettings(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-cog text-gray-600"></i>設定</h2></div><div class="p-4 space-y-4" id="settings-list"><div class="skeleton h-32"></div></div>';
  loadSettings();
}

async function loadSettings(){const c=document.getElementById('settings-list');if(!c)return;try{const r=await api('/api/auth/profile');let inst='';if(deferredPrompt)inst='<button onclick="installPWA()" class="w-full text-center text-green-600 py-3 font-semibold"><i class="fas fa-download mr-2"></i>アプリをインストール</button>';const roles=currentUser.roles||[currentUser.role];const isStaff=roles.some(rr=>['admin','teacher'].includes(rr));const isAdmin=roles.includes('admin');c.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">アカウント情報</h3><div class="space-y-3"><div class="flex justify-between items-center"><span class="text-sm text-gray-600">名前</span><span class="text-sm font-semibold">'+esc(r.user.name)+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">ログインID</span><span class="text-sm">'+esc(r.user.login_id||'-')+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">学年</span><span class="text-sm">'+esc(r.user.grade||'-')+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">クラス</span><span class="text-sm">'+esc(r.user.class_num||'-')+'</span></div></div><div class="flex gap-2 mt-3"><button onclick="openProfileEdit()" class="text-blue-600 text-sm font-semibold"><i class="fas fa-edit mr-1"></i>プロフィール編集</button><button onclick="openPasswordChange()" class="text-orange-600 text-sm font-semibold"><i class="fas fa-key mr-1"></i>パスワード変更</button></div></div><div class="card p-4"><h3 class="font-bold mb-3">通知設定</h3><div id="notif-settings-content"><div class="skeleton h-12"></div></div></div>'+(isStaff?'<div class="card p-4"><h3 class="font-bold mb-3">管理設定</h3><div id="admin-settings-content"><div class="skeleton h-12"></div></div></div>':'')+inst+'<button onclick="logout()" class="w-full text-center text-red-500 py-3 mt-4 font-semibold"><i class="fas fa-sign-out-alt mr-2"></i>ログアウト</button>'+(isStaff?'<button onclick="renderAdmin(document.getElementById(\'tab-content\'))" class="w-full text-center text-blue-600 py-3 font-semibold"><i class="fas fa-shield-alt mr-2"></i>管理パネル</button>':'')+'<div class="text-center text-xs text-gray-400 py-4">上中黒板 v2.0</div>';loadNotifSettings();if(isStaff)loadAdminSettings();}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

async function loadAdminSettings(){const c=document.getElementById('admin-settings-content');if(!c)return;try{const r=await api('/api/admin/settings');const s=r.settings;const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');c.innerHTML='<div class="space-y-2">'+[['teacher_can_users','先生がユーザー管理を表示'],['teacher_can_posts','先生が投稿管理を表示'],['teacher_can_bulk','先生が一括生成を表示'],['notif_self_default','自分通知を標準で有効']].map(([k,lb])=>{const on=s[k]==='true';const disabled=!isAdmin&&k.startsWith('teacher_');return'<div class="flex items-center justify-between"><span class="text-sm '+(disabled?'text-gray-400':'text-gray-700')+'">'+lb+'</span><div class="toggle'+(on?' on':'')+(disabled?' opacity-50 cursor-not-allowed':'')+'" '+(disabled?'':'onclick="toggleAdminSetting(\''+k+'\',this)"')+'></div></div>';}).join('')+'</div>';if(!isAdmin)c.innerHTML+='<p class="text-xs text-gray-400 mt-2">※先生の権限設定は管理者のみ変更できます</p>';}catch{c.innerHTML='<p class="text-sm text-gray-400">読込失敗</p>';}}

async function toggleAdminSetting(key,el){try{await api('/api/admin/settings',{method:'PUT',body:{settings:{[key]:!el.classList.contains('on')?true:false}}});el.classList.toggle('on');toast('更新しました','success');}catch(e){toast('失敗','error');}}

async function loadNotifSettings(){const c=document.getElementById('notif-settings-content');if(!c)return;try{const ns=await api('/api/auth/notification-settings');c.innerHTML='<div class="space-y-2">'+['push_enabled','disaster_enabled','club_post_enabled','committee_post_enabled','school_notice_enabled','message_enabled'].map(k=>{const lb={'push_enabled':'プッシュ通知','disaster_enabled':'防災情報','club_post_enabled':'部活投稿','committee_post_enabled':'委員会投稿','school_notice_enabled':'上中連絡','message_enabled':'メッセージ'}[k];const on=ns[k]===1||ns[k]===true;return'<div class="flex items-center justify-between"><span class="text-sm text-gray-700">'+lb+'</span><div class="toggle'+(on?' on':'')+'" onclick="toggleNotifSetting(\''+k+'\',this)"></div></div>';}).join('')+'</div>';}catch{c.innerHTML='<p class="text-sm text-gray-400">読込失敗</p>';}}

async function toggleNotifSetting(key,el){try{await api('/api/auth/notification-settings',{method:'PUT',body:{[key]:!el.classList.contains('on')}});el.classList.toggle('on');toast('更新しました','success');}catch(e){toast('失敗','error');}}

function installPWA(){if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt.userChoice.then(()=>{deferredPrompt=null;loadSettings();});}

function openProfileEdit(){const u=currentUser;const isStaff=(u.roles||[u.role]).some(r=>['admin','teacher'].includes(r));const pendingFields=isStaff?'':'(変更には承認が必要です)';showModal('プロフィール編集','<div class="space-y-3"><div><label class="form-label">名前 '+pendingFields+'</label><input id="pe-name" type="text" class="form-input" value="'+esc(u.name)+'"></div><div><label class="form-label">部活動</label><input id="pe-club" type="text" class="form-input" value="'+esc(u.club||'')+'" placeholder="例: サッカー部"></div><div><label class="form-label">委員会</label><input id="pe-committee" type="text" class="form-input" value="'+esc(u.committee||'')+'" placeholder="例: 生徒会"></div><div><label class="form-label">自己紹介</label><textarea id="pe-bio" class="form-input" rows="3" placeholder="自己紹介を入力">'+esc(u.bio||'')+'</textarea></div><div><label class="form-label">プロフィール画像</label><div class="flex items-center gap-3"><div class="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border" id="avatar-preview">'+(u.avatar_url?'<img src="'+esc(u.avatar_url)+'" class="w-full h-full object-cover">':'<i class="fas fa-user text-gray-400 text-2xl"></i>')+'</div><div><label class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm cursor-pointer"><i class="fas fa-camera mr-1"></i>写真を選択<input type="file" accept="image/*" class="hidden" onchange="uploadAvatar(this)"></label></div></div></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'保存',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitProfileEdit}]);}

async function uploadAvatar(input){const file=input.files[0];if(!file)return;if(file.size>5*1024*1024){toast('5MB以下の画像を選択','error');return;}const fd=new FormData();fd.append('file',file);try{const r=await api('/api/upload',{method:'POST',body:fd});const preview=document.getElementById('avatar-preview');if(preview)preview.innerHTML='<img src="'+r.url+'" class="w-full h-full object-cover">';currentUser.avatar_url=r.url;toast('アップロード完了','success');}catch(e){toast(e.message||'アップロード失敗','error');}}

function openPasswordChange(){showModal('パスワード変更','<div class="space-y-3"><div><label class="form-label">現在のパスワード</label><input id="pw-current" type="password" class="form-input"></div><div><label class="form-label">新しいパスワード</label><input id="pw-new" type="password" class="form-input"></div><div><label class="form-label">新しいパスワード（確認）</label><input id="pw-confirm" type="password" class="form-input"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'変更',className:'bg-orange-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitPasswordChange}]);}
async function submitPasswordChange(){const cur=document.getElementById('pw-current').value;const nw=document.getElementById('pw-new').value;const cf=document.getElementById('pw-confirm').value;if(!cur||!nw){toast('すべて入力してください','error');return;}if(nw!==cf){toast('新しいパスワードが一致しません','error');return;}try{await api('/api/auth/password',{method:'POST',body:{current_password:cur,new_password:nw}});closeModal();toast('変更しました','success');}catch(e){toast(e.message||'失敗','error');}}

async function submitProfileEdit(){try{const name=document.getElementById('pe-name').value.trim();if(!name){toast('名前は必須','error');return;}const body={name,club:document.getElementById('pe-club').value.trim()||null,committee:document.getElementById('pe-committee').value.trim()||null,bio:document.getElementById('pe-bio').value.trim()||null,avatar_url:currentUser.avatar_url||null};const r=await api('/api/auth/profile',{method:'PUT',body});closeModal();if(r.pending){toast('変更リクエストを送信しました（承認待ち）','info');}else{toast('保存しました','success');}loadSettings();}catch(e){toast(e.message||'失敗','error');}}

// === PE Checklist ===
function renderPEChecklist(container) {
  container.innerHTML='<div><div class="flex gap-2 mb-4"><button onclick="switchPEChecklistTab(\'check\',this)" class="sub-nav-btn active">点検</button><button onclick="switchPEChecklistTab(\'history\',this)" class="sub-nav-btn">履歴</button><button onclick="switchPEChecklistTab(\'rentals\',this)" class="sub-nav-btn">貸出</button></div><div id="pe-checklist-content"><div class="skeleton h-32"></div></div></div>';
  loadPEChecklist();
}

function switchPEChecklistTab(tab,btn){document.querySelectorAll('#pe-checklist-content .sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(tab==='check')loadPEChecklist();else if(tab==='history')loadPEChecklistHistory();else if(tab==='rentals')loadPERentals();}

async function loadPEChecklist(){const c=document.getElementById('pe-checklist-content');if(!c)return;try{const r=await api('/api/checklist/items');c.innerHTML='<div class="space-y-3">'+r.items.map(i=>'<div class="card p-4"><div class="flex justify-between items-start mb-2"><span class="font-bold text-sm">'+esc(i.name)+'</span><span class="text-xs '+(i.status==='ok'?'text-green-600':i.status==='ng'?'text-red-600':'text-gray-400')+'">'+(i.status==='ok'?'✓ OK':i.status==='ng'?'✗ NG':'未チェック')+'</span></div><p class="text-xs text-gray-500 mb-3">'+esc(i.location||'')+'</p>'+(i.can_check?'<div class="flex gap-2"><button onclick="checkPEItem('+i.id+',\'ok\')" class="bg-green-500 text-white px-4 py-1.5 rounded-full text-xs">OK</button><button onclick="checkPEItem('+i.id+',\'ng\')" class="bg-red-500 text-white px-4 py-1.5 rounded-full text-xs">NG</button></div>':'<p class="text-xs text-gray-400">最終確認: '+(i.last_checker?esc(i.last_checker):'')+(i.last_checked?' / '+formatRelative(i.last_checked):'')+'</p>')+'</div>').join('')+'</div>';}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

async function checkPEItem(id,status){try{await api('/api/checklist/items/'+id+'/check',{method:'POST',body:{status}});toast('記録しました','success');loadPEChecklist();}catch(e){toast(e.message||'失敗','error');}}

async function loadPEChecklistHistory(){const c=document.getElementById('pe-checklist-content');if(!c)return;try{const r=await api('/api/checklist/history');if(!r.history.length){c.innerHTML='<div class="empty-state"><i class="fas fa-history"></i><p>履歴なし</p></div>';return;}c.innerHTML='<div class="space-y-2">'+r.history.map(h=>'<div class="card p-3 flex justify-between items-center"><div><span class="text-sm font-semibold">'+esc(h.item_name)+'</span><span class="text-xs text-gray-500 ml-2">'+esc(h.checker_name)+'</span></div><div class="flex items-center gap-2"><span class="text-xs '+(h.status==='ok'?'text-green-600':'text-red-600')+'">'+h.status.toUpperCase()+'</span><span class="text-xs text-gray-400">'+formatRelative(h.created_at)+'</span></div></div>').join('')+'</div>';}catch{}}

async function loadPERentals(){const c=document.getElementById('pe-checklist-content');if(!c)return;try{const r=await api('/api/checklist/rentals');let h='<div class="mb-3"><button onclick="openRentalModal()" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>貸出登録</button></div>';if(!r.rentals.length){h+='<div class="empty-state"><i class="fas fa-box"></i><p>貸出履歴なし</p></div>';c.innerHTML=h;return;}h+='<div class="space-y-2">'+r.rentals.map(rn=>'<div class="card p-3"><div class="flex justify-between"><span class="font-semibold text-sm">'+esc(rn.item_name)+'</span><span class="text-xs '+(rn.returned_at?'text-green-600':'text-yellow-600')+'">'+(rn.returned_at?'返却済':'貸出中')+'</span></div><p class="text-xs text-gray-500">借: '+esc(rn.borrower_name)+' | '+formatRelative(rn.borrowed_at)+'</p>'+(rn.notes?'<p class="text-xs text-gray-400 mt-1">'+esc(rn.notes)+'</p>':'')+(!rn.returned_at?'<button onclick="returnRental('+rn.id+')" class="text-blue-600 text-xs mt-2 hover:underline">返却</button>':'<p class="text-xs text-gray-400 mt-1">返却: '+formatRelative(rn.returned_at)+'</p>')+'</div>').join('')+'</div>';c.innerHTML=h;}catch{}}

async function openRentalModal(){try{const items=await api('/api/checklist/items');const users=await api('/api/messages/users');const iop=items.items.map(i=>'<option value="'+i.id+'">'+esc(i.name)+'</option>').join('');const uop=users.users.map(u=>'<option value="'+u.id+'">'+esc(u.name)+'</option>').join('');showModal('貸出登録','<div class="space-y-4"><div><label class="form-label">備品</label><select id="rental-item" class="form-input">'+iop+'</select></div><div><label class="form-label">借りる人</label><select id="rental-borrower" class="form-input">'+uop+'</select></div><div><label class="form-label">メモ（任意）</label><input id="rental-notes" type="text" class="form-input"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'登録',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitRental}]);}catch(e){toast('読込失敗','error');}}

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
  try{const sr=await api('/api/admin/settings');const s=sr.settings||{};const showTokens=document.createElement('button');showTokens.className='sub-nav-btn active';showTokens.textContent='招待コード';showTokens.onclick=()=>switchAdminTab('tokens',showTokens);const showStats=document.createElement('button');showStats.className='sub-nav-btn';showStats.textContent='統計';showStats.onclick=()=>switchAdminTab('stats',showStats);const btns=[showTokens,showStats];if(s.teacher_can_users==='true'){const b=document.createElement('button');b.className='sub-nav-btn';b.textContent='ユーザー管理';b.onclick=()=>switchAdminTab('users',b);btns.push(b);}if(s.teacher_can_posts==='true'){const b=document.createElement('button');b.className='sub-nav-btn';b.textContent='投稿管理';b.onclick=()=>switchAdminTab('posts',b);btns.push(b);}if(s.teacher_can_bulk==='true'){const b=document.createElement('button');b.className='sub-nav-btn';b.textContent='一括生成';b.onclick=()=>switchAdminTab('bulk',b);btns.push(b);}container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-shield-alt text-red-600"></i>管理</h2></div><div class="p-4 space-y-4"><div class="flex flex-wrap gap-2">'+btns.map(b=>b.outerHTML).join('')+'</div><div id="admin-content"><div class="skeleton h-32"></div></div></div>';loadAdminTokens();}catch{renderAdminFull(container);}
}

function renderAdminFull(container){
  const roles=currentUser.roles||[currentUser.role];
  const isAdmin=roles.includes('admin');
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  if(!isStaff){container.innerHTML='<div class="empty-state"><i class="fas fa-lock"></i><p>管理者のみアクセス可能</p></div>';return;}
  const tabs=isAdmin?'<button onclick="switchAdminTab(\'users\',this)" class="sub-nav-btn active">ユーザー管理</button><button onclick="switchAdminTab(\'roles\',this)" class="sub-nav-btn">ロール管理</button><button onclick="switchAdminTab(\'profile\',this)" class="sub-nav-btn">承認待ち</button><button onclick="switchAdminTab(\'tokens\',this)" class="sub-nav-btn">招待コード</button><button onclick="switchAdminTab(\'bulk\',this)" class="sub-nav-btn">一括生成</button><button onclick="switchAdminTab(\'posts\',this)" class="sub-nav-btn">投稿管理</button><button onclick="switchAdminTab(\'stats\',this)" class="sub-nav-btn">統計</button><button onclick="switchAdminTab(\'diag\',this)" class="sub-nav-btn">診断</button>':'<button onclick="switchAdminTab(\'tokens\',this)" class="sub-nav-btn active">招待コード</button><button onclick="switchAdminTab(\'stats\',this)" class="sub-nav-btn">統計</button>';
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-shield-alt text-red-600"></i>管理</h2></div><div class="p-4 space-y-4"><div class="flex flex-wrap gap-2">'+tabs+'</div><div id="admin-content"><div class="skeleton h-32"></div></div></div>';
  if(isAdmin)loadAdminUsers();else loadAdminTokens();
}

function switchAdminTab(tab,btn){document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(tab==='users')loadAdminUsers();else if(tab==='roles')loadAdminRoles();else if(tab==='profile')loadAdminProfileChanges();else if(tab==='tokens')loadAdminTokens();else if(tab==='bulk')loadAdminBulkCreate();else if(tab==='posts')loadAdminPosts();else if(tab==='stats')loadAdminStats();else if(tab==='diag')loadAdminDiagnostics();}

async function loadAdminUsers(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/users');c.innerHTML='<div class="mb-3 flex gap-2 flex-wrap"><button onclick="openBulkDeleteModal()" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-user-minus mr-1"></i>一括削除</button><button onclick="openBulkCreateStudentModal()" class="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>生徒一括作成</button></div><div class="space-y-2">'+r.users.map(u=>'<div class="card p-3"><div class="flex justify-between items-center mb-2"><div><span class="font-semibold text-sm">'+esc(u.name)+'</span><span class="text-xs text-gray-500 ml-2">'+esc(u.username||'')+'</span><span class="text-xs '+(u.is_active===false?'text-red-500':'text-green-500')+' ml-2">'+(u.is_active===false?'停止':'有効')+'</span></div><div class="flex gap-1"><button onclick="editUserInline('+u.id+',\''+esc(u.name)+'\',\''+esc(u.club||'')+'\',\''+esc(u.committee||'')+'\','+(u.grade||'')+','+(u.class_num||'')+','+(u.number||'')+')" class="text-blue-600 text-xs hover:underline">編集</button><button onclick="changeUserPassword('+u.id+')" class="text-orange-600 text-xs hover:underline">パスワード</button><button onclick="toggleUserActive('+u.id+')" class="text-xs '+(u.is_active===false?'text-green-600':'text-red-600')+' hover:underline">'+(u.is_active===false?'復活':'停止')+'</button><button onclick="deleteUser('+u.id+')" class="text-xs text-red-600 hover:underline">削除</button></div></div><div class="text-xs text-gray-500">'+(u.grade?u.grade+'-'+u.class_num+' '+u.number:'')+' '+(u.club||'')+(u.club&&u.committee?' / ':'')+(u.committee||'')+'</div></div>').join('')+'</div>';}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

function editUserInline(id,name,club,committee,grade,class_num,number){showModal('ユーザー編集 #'+id,'<div class="space-y-3"><div><label class="form-label">名前</label><input id="eu-name" type="text" class="form-input" value="'+esc(name)+'"></div><div class="grid grid-cols-3 gap-2"><div><label class="form-label">学年</label><input id="eu-grade" type="number" class="form-input" value="'+(grade||'')+'"></div><div><label class="form-label">クラス</label><input id="eu-class" type="number" class="form-input" value="'+(class_num||'')+'"></div><div><label class="form-label">番号</label><input id="eu-number" type="number" class="form-input" value="'+(number||'')+'"></div></div><div><label class="form-label">部活動</label><input id="eu-club" type="text" class="form-input" value="'+esc(club)+'"></div><div><label class="form-label">委員会</label><input id="eu-committee" type="text" class="form-input" value="'+esc(committee)+'"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'保存',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitUserEdit(id)}]);}
async function submitUserEdit(id){const body={name:document.getElementById('eu-name').value.trim()};const g=document.getElementById('eu-grade').value;if(g)body.grade=parseInt(g);const cn=document.getElementById('eu-class').value;if(cn)body.class_num=parseInt(cn);const nu=document.getElementById('eu-number').value;if(nu)body.number=parseInt(nu);body.club=document.getElementById('eu-club').value.trim()||null;body.committee=document.getElementById('eu-committee').value.trim()||null;try{await api('/api/admin/users/'+id,{method:'PUT',body});closeModal();toast('保存しました','success');loadAdminUsers();}catch(e){toast(e.message||'失敗','error');}}

async function changeUserPassword(id){const p=prompt('新しいパスワードを入力:');if(!p)return;try{await api('/api/admin/users/'+id+'/change-password',{method:'POST',body:{password:p}});toast('変更しました','success');}catch(e){toast(e.message||'失敗','error');}}

async function toggleUserActive(id){try{await api('/api/admin/users/'+id+'/toggle',{method:'POST'});toast('更新しました','success');loadAdminUsers();}catch(e){toast('失敗','error');}}
async function deleteUser(id){if(!confirm('本当に削除しますか？'))return;try{await api('/api/admin/users/'+id,{method:'DELETE'});toast('削除しました','success');loadAdminUsers();}catch(e){toast('失敗','error');}}

function openBulkDeleteModal(){showModal('一括削除','<div class="space-y-4"><p class="text-sm text-gray-600">学年とクラスを指定してユーザーを一括削除します。</p><div><label class="form-label">学年</label><input id="bulk-grade" type="number" class="form-input" placeholder="例: 1"></div><div><label class="form-label">クラス（任意、省略で学年全員）</label><input id="bulk-class" type="number" class="form-input" placeholder="例: 2"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'削除',className:'bg-red-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitBulkDelete}]);}

async function submitBulkDelete(){const g=parseInt(document.getElementById('bulk-grade').value);const cn=document.getElementById('bulk-class').value?parseInt(document.getElementById('bulk-class').value):undefined;if(!g){toast('学年を入力','error');return;}if(!confirm('本当に削除しますか？元に戻せません。'))return;try{const r=await api('/api/admin/users/bulk-delete',{method:'POST',body:{grade:g,class_num:cn}});closeModal();toast(r.count+'人削除しました','success');loadAdminUsers();}catch(e){toast(e.message||'失敗','error');}}

function openBulkCreateStudentModal(){showModal('先生一括生成（T001形式）','<div class="space-y-3"><p class="text-sm text-gray-600">例: T001〜T050 の50人を生成します。ログインID = T001、初期パスワード = パスワード、名前 = T001 さんとなります。</p><div><label class="form-label">接頭語（T）</label><input id="bc-prefix" type="text" class="form-input" value="T" placeholder="T"></div><div class="grid grid-cols-2 gap-2"><div><label class="form-label">開始番号</label><input id="bc-start" type="number" class="form-input" value="1" min="1"></div><div><label class="form-label">終了番号</label><input id="bc-end" type="number" class="form-input" value="50" min="1"></div></div><div><label class="form-label">初期パスワード</label><input id="bc-password" type="text" class="form-input" value="password"></div></div>',[{label:'キャンセル',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'作成',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitBulkCreateStudent}]);}

async function submitBulkCreateStudent(){const prefix=document.getElementById('bc-prefix').value.trim()||'T';const start=parseInt(document.getElementById('bc-start').value)||1;const end=parseInt(document.getElementById('bc-end').value)||50;const password=document.getElementById('bc-password').value||'password';if(end<start){toast('終了番号≧開始番号','error');return;}if(end-start>200){toast('200人まで','error');return;}try{const r=await api('/api/admin/users/bulk-create',{method:'POST',body:{prefix,start,end,password}});closeModal();toast(r.count+'人作成しました','success');loadAdminUsers();}catch(e){toast(e.message||'失敗','error');}}

async function loadAdminProfileChanges(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><button onclick="loadAdminProfileChanges()" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-sync mr-1"></i>再読込</button><div id="profile-changes-list"><div class="skeleton h-20"></div></div></div>';try{const r=await api('/api/admin/profile-changes');const l=document.getElementById('profile-changes-list');if(!r.requests.length){l.innerHTML='<div class="empty-state"><i class="fas fa-check-circle"></i><p>承認待ちのリクエストはありません</p></div>';return;}l.innerHTML=r.requests.map(req=>'<div class="card p-4"><div class="flex justify-between items-start mb-2"><div><span class="font-semibold text-sm">'+esc(req.user_name)+'</span><span class="text-xs text-gray-500 ml-2">'+(req.grade||'')+'-'+(req.class_num||'')+' '+(req.number||'')+'</span></div><span class="text-xs text-gray-400">'+formatRelative(req.created_at)+'</span></div><div class="bg-gray-50 rounded-lg p-2 text-sm mb-2"><span class="text-gray-500">'+req.field_name+': </span><span class="line-through text-gray-400">'+esc(req.old_value||'')+'</span><i class="fas fa-arrow-right mx-2 text-gray-400"></i><span class="font-semibold">'+esc(req.new_value)+'</span></div><div class="flex gap-2"><button onclick="approveProfileChange('+req.id+')" class="bg-green-600 text-white px-4 py-1 rounded-full text-xs"><i class="fas fa-check mr-1"></i>承認</button><button onclick="rejectProfileChange('+req.id+')" class="bg-red-500 text-white px-4 py-1 rounded-full text-xs"><i class="fas fa-times mr-1"></i>却下</button></div></div>').join('');}catch{const l=document.getElementById('profile-changes-list');if(l)l.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}
async function approveProfileChange(id){try{await api('/api/admin/profile-changes/'+id+'/approve',{method:'POST'});toast('承認しました','success');loadAdminProfileChanges();}catch(e){toast(e.message||'失敗','error');}}
async function rejectProfileChange(id){try{await api('/api/admin/profile-changes/'+id+'/reject',{method:'POST'});toast('却下しました','success');loadAdminProfileChanges();}catch(e){toast(e.message||'失敗','error');}}

async function loadAdminRoles(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/users');c.innerHTML='<div class="space-y-2">'+r.users.map(u=>'<div class="card p-3"><div class="flex justify-between items-center mb-2"><span class="font-semibold text-sm">'+esc(u.name)+'</span><span class="text-xs text-gray-500">'+esc(u.login_id||'')+'</span></div><div class="flex flex-wrap gap-1 mb-2">'+(u.roles||[]).map(r=>'<span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">'+(ROLE_LABELS[r]||r)+'</span>').join('')+'</div><div class="flex gap-1"><button onclick="addUserRole('+u.id+')" class="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">ロール追加</button><button onclick="removeUserRole('+u.id+')" class="border border-red-300 text-red-600 px-3 py-1 rounded-full text-xs">削除</button></div></div>').join('')+'</div>';}catch{}}

async function addUserRole(id){const r=prompt('追加するロール:');if(!r)return;try{await api('/api/admin/users/'+id+'/roles',{method:'POST',body:{role:r}});toast('追加しました','success');loadAdminRoles();}catch(e){toast(e.message||'失敗','error');}}
async function removeUserRole(id){const r=prompt('削除するロール:');if(!r)return;try{await api('/api/admin/users/'+id+'/roles/'+r,{method:'DELETE'});toast('削除しました','success');loadAdminRoles();}catch(e){toast(e.message||'失敗','error');}}

async function loadAdminStats(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/stats');c.innerHTML='<div class="grid grid-cols-2 gap-3">'+Object.entries(r.stats).map(([k,v])=>'<div class="card p-4 text-center"><p class="text-2xl font-bold text-green-600">'+v+'</p><p class="text-xs text-gray-500">'+k+'</p></div>').join('')+'</div><div class="mt-4"><div class="card p-4"><h4 class="text-sm font-bold mb-2">投稿数推移（過去7日）</h4><canvas id="stats-chart" height="200" class="w-full"></canvas></div></div>';drawStatsChart();}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

function drawStatsChart(){const cv=document.getElementById('stats-chart');if(!cv)return;const ctx=cv.getContext('2d');const w=cv.parentElement.clientWidth||300;cv.width=w;cv.height=200;const barW=Math.max(8,w/14-4);const labels=['日','月','火','水','木','金','土'];const vals=labels.map(()=>Math.floor(Math.random()*20+3));const max=Math.max(...vals,10);ctx.clearRect(0,0,w,200);for(let i=0;i<7;i++){const x=i*(w/7)+(w/7-barW)/2;const h=(vals[i]/max)*160;ctx.fillStyle='#40916c';ctx.beginPath();ctx.roundRect(x,180-h,barW,h,3);ctx.fill();ctx.fillStyle='#666';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(labels[i],x+barW/2,196);ctx.fillStyle='#333';ctx.font='bold 11px sans-serif';ctx.fillText(vals[i],x+barW/2,175-h);}}

async function loadAdminDiagnostics(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/diagnostics');c.innerHTML='<pre class="text-xs bg-gray-900 text-green-400 p-4 rounded-xl overflow-auto max-h-96">'+esc(JSON.stringify(r,null,2))+'</pre>';}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読込失敗</p></div>';}}

async function loadAdminTokens(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="card p-4"><h3 class="font-bold mb-3">招待コード発行</h3><div class="grid grid-cols-3 gap-2 mb-3"><div><label class="form-label">ロール</label><select id="token-role-select" class="form-input"><option value="student">生徒</option><option value="teacher">先生</option></select></div><div><label class="form-label">有効時間(h)</label><input id="token-hours" type="number" value="72" class="form-input"></div><div><label class="form-label">発行数</label><input id="token-count" type="number" value="1" min="1" max="100" class="form-input"></div></div><button onclick="generateTokens()" class="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-key mr-1"></i>発行</button></div><div id="token-results" class="space-y-2"></div></div>';}

async function loadAdminBulkCreate(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="card p-4"><h3 class="font-bold mb-3">生徒一括生成（T001形式）</h3><p class="text-sm text-gray-600 mb-3">例: T001〜T050 の50人を生成。ログインIDと名前が自動設定されます。</p><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">接頭語</label><input id="bc-prefix2" type="text" class="form-input" value="T"></div><div><label class="form-label">パスワード</label><input id="bc-password2" type="text" class="form-input" value="password"></div></div><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">開始番号</label><input id="bc-start2" type="number" class="form-input" value="1"></div><div><label class="form-label">終了番号</label><input id="bc-end2" type="number" class="form-input" value="50"></div></div><button onclick="submitBulkCreateStudent2()" class="bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>一括作成</button></div><div id="bulk-result" class="mt-2"></div></div>';}

async function submitBulkCreateStudent2(){const prefix=document.getElementById('bc-prefix2').value.trim()||'T';const start=parseInt(document.getElementById('bc-start2').value)||1;const end=parseInt(document.getElementById('bc-end2').value)||50;const password=document.getElementById('bc-password2').value||'password';if(end<start){toast('終了番号≧開始番号','error');return;}if(end-start>200){toast('200人まで','error');return;}try{document.getElementById('bulk-result').innerHTML='<div class="skeleton h-12"></div>';const r=await api('/api/admin/users/bulk-create',{method:'POST',body:{prefix,start,end,password}});document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-green-50 text-green-700 text-sm">'+r.count+'人作成しました</div>';toast(r.count+'人作成しました','success');}catch(e){document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-red-50 text-red-600 text-sm">'+(e.message||'失敗')+'</div>';}}

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

async function loadSelfNotifications(){const c=document.getElementById('notif-list');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="card p-4"><h3 class="font-bold text-sm mb-3">新規作成</h3><div><label class="form-label">通知内容</label><textarea id="self-notif-msg" class="form-input" rows="2" placeholder="例: 3限の数学、小テストがあります"></textarea></div><div><label class="form-label">予約日時（省略で今すぐ）</label><input id="self-notif-time" type="datetime-local" class="form-input"></div><button onclick="submitSelfNotification()" class="mt-2 bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>作成</button></div><div id="self-notif-list"><div class="skeleton h-12"></div></div></div>';try{const r=await api('/api/admin/notifications/self');const l=document.getElementById('self-notif-list');if(!r.notifications.length){l.innerHTML='<div class="empty-state"><i class="fas fa-clock"></i><p>自分通知はありません</p></div>';return;}l.innerHTML=r.notifications.map(n=>'<div class="card p-3 flex justify-between items-center"><div><p class="text-sm">'+esc(n.message)+'</p><span class="text-xs text-gray-400">'+(n.scheduled_at?'予定: '+formatRelative(n.scheduled_at):'今すぐ')+'</span></div><button onclick="deleteSelfNotif('+n.id+')" class="text-red-500 text-xs hover:underline">削除</button></div>').join('');}catch{}}

async function submitSelfNotification(){const msg=document.getElementById('self-notif-msg').value.trim();if(!msg){toast('メッセージを入力','error');return;}const scheduled=document.getElementById('self-notif-time').value||null;try{await api('/api/admin/notifications/self',{method:'POST',body:{message:msg,scheduled_at:scheduled?new Date(scheduled).toISOString():null}});document.getElementById('self-notif-msg').value='';document.getElementById('self-notif-time').value='';toast('作成しました','success');loadSelfNotifications();}catch(e){toast(e.message||'失敗','error');}}

async function deleteSelfNotif(id){try{const r=await api('/api/notifications/'+id+'/read',{method:'POST'});loadSelfNotifications();}catch{}}

async function loadNotifications(){const c=document.getElementById('notif-list');if(!c)return;try{const r=await api('/api/notifications');if(!r.notifications.length){c.innerHTML='<div class="empty-state"><i class="fas fa-bell-slash"></i><p>通知はありません</p></div>';return;}c.innerHTML=r.notifications.map(n=>'<div class="card p-4 mb-2 flex items-start gap-3"><div class="w-8 h-8 rounded-full '+(n.is_read?'bg-gray-200':'bg-blue-100')+' flex items-center justify-center text-sm"><i class="fas '+(n.icon||'fa-bell')+' text-blue-600"></i></div><div class="flex-1"><p class="text-sm '+(n.is_read?'text-gray-500':'text-gray-800 font-semibold')+'">'+esc(n.message)+'</p><span class="text-xs text-gray-400">'+formatRelative(n.created_at)+'</span></div>'+(n.is_read?'':'<button onclick="markNotifRead('+n.id+')" class="text-blue-600 text-xs hover:underline">既読</button>')+'</div>').join('');}catch{}}

async function markNotifRead(id){try{await api('/api/notifications/'+id+'/read',{method:'POST'});loadNotifications();}catch{}}

// === Utilities ===
function formatRelative(d){if(!d)return '';const t=new Date(d);const n=new Date();const diff=(n-t)/1000;if(diff<60)return 'たった今';if(diff<3600)return Math.floor(diff/60)+'分前';if(diff<86400)return Math.floor(diff/3600)+'時間前';if(diff<172800)return '昨日';if(diff<2592000)return Math.floor(diff/86400)+'日前';return t.toLocaleDateString('ja-JP',{month:'short',day:'numeric',year:diff>31536000?'numeric':undefined});}

function formatDate(d){if(!d)return '';return new Date(d).toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}

function renderFilePreview(url,type){if(!url)return '';if(type==='image')return '<img src="'+url+'" class="mt-2 max-h-64 rounded-lg object-contain border" onerror="this.style.display=\'none\'">';if(type==='pdf')return '<a href="'+url+'" target="_blank" class="mt-2 flex items-center gap-2 text-blue-600 hover:underline text-sm"><i class="fas fa-file-pdf text-red-500"></i> PDF閲覧</a>';return'';}

function showModal(title,body,actions){const o=document.getElementById('modal-overlay'),c=document.getElementById('modal-box'),t=document.getElementById('modal-title'),b=document.getElementById('modal-body'),a=document.getElementById('modal-footer');if(!o)return;t.textContent=title;b.innerHTML=body;a.innerHTML='';(actions||[]).forEach(ac=>{const btn=document.createElement('button');btn.textContent=ac.label;btn.className=ac.className||'px-4 py-2 rounded-xl font-semibold';btn.onclick=ac.action;a.appendChild(btn);});o.classList.remove('hidden');c.classList.add('modal-enter');}

function closeModal(){const o=document.getElementById('modal-overlay'),c=document.getElementById('modal-box');if(!o)return;c.classList.remove('modal-enter');o.classList.add('hidden');}

function toast(msg,type){const tc=document.getElementById('toast-container');if(!tc)return;const t=document.createElement('div');t.className='toast toast-'+(type||'info');t.textContent=msg;tc.appendChild(t);setTimeout(()=>{t.classList.add('toast-out');setTimeout(()=>t.remove(),300);},3000);}

async function api(path,opts){const cfg=opts||{};const isForm=cfg.body instanceof FormData;const resp=await fetch(path,{method:cfg.method||'GET',headers:isForm?{}:{'Content-Type':'application/json'},body:cfg.body?(isForm?cfg.body:JSON.stringify(cfg.body)):undefined,credentials:'include'});const ct=resp.headers.get('content-type')||'';if(cfg.noJson||ct.includes('text/')||ct.includes('application/octet-stream')){if(!resp.ok){const txt=await resp.text();throw new Error(txt);}return resp;}const data=await resp.json();if(!resp.ok)throw new Error(data.error||data.message||'エラー');return data;}

function logout(){fetch('/api/auth/logout',{method:'POST',credentials:'include'}).then(()=>{window.location.reload();}).catch(()=>{window.location.reload();});}

async function fetchWBGT(){try{const r=await api('/api/wbgt');const el=document.getElementById('info-bar-text');if(el)el.textContent=(r.wbgt?'WBGT: '+r.wbgt+'°C'+(r.level?' ('+r.level+')':'')+(r.alert?' ⚠'+r.alert:'')+' | ':'')+(r.disaster||'情報なし');}catch{const el=document.getElementById('info-bar-text');if(el)el.textContent='気象情報取得失敗';}}

function updateInfoBar() { const el=document.getElementById('info-bar-text'); if(el) el.textContent='気象情報・防災情報を読み込み中...'; }

async function fetchUnreadCount(){try{const r=await api('/api/messages/unread-count');const badge=document.getElementById('msg-badge');if(badge){badge.textContent=r.count>0?(r.count>99?'99+':r.count):'';badge.classList.toggle('hidden',r.count===0);}}catch{}}

