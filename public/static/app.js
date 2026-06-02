/* 荳贋ｸｭ鮟呈攸 v3.0 - 繝｡繧､繝ｳ繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ */
let currentUser = null, currentTab = null, currentThreadId = null;
let reloadTimer = null, notifCheckTimer = null, clockTimer = null;
const CLUBS = ['繧ｵ繝・き繝ｼ驛ｨ','逕ｷ蟄舌ヰ繧ｹ繧ｱ驛ｨ','螂ｳ蟄舌ヰ繧ｹ繧ｱ驛ｨ','蜊鍋帥驛ｨ','髯ｸ荳企Κ','驥守帥驛ｨ','繝舌Ξ繝ｼ繝懊・繝ｫ驛ｨ','逕ｷ蟄舌ユ繝九せ驛ｨ','螂ｳ蟄舌ユ繝九せ驛ｨ','闌ｶ驕馴Κ','鄒手｡馴Κ','蜷ｹ螂乗･ｽ驛ｨ'];
const COMMITTEES = ['逕溷ｾ剃ｼ・,'謨ｴ蛯吝ｧ泌藤莨・,'逕滓ｴｻ蟋泌藤莨・,'菫晏▼蟋泌藤莨・,'蝗ｳ譖ｸ蟋泌藤莨・,'邨ｦ鬟溷ｧ泌藤莨・,'謾ｾ騾∝ｧ泌藤莨・,'菴楢ご蟋泌藤莨・,'蜷亥罰蟋泌藤莨・,'荳ｭ螟ｮ蟋泌藤莨・,'驛ｨ豢ｻ蜍募ｧ泌藤莨・,'1蟄ｦ蟷ｴ蟋泌藤莨・,'2蟄ｦ蟷ｴ蟋泌藤莨・,'3蟄ｦ蟷ｴ蟋泌藤莨・];
const ROLE_LABELS = {admin:'邂｡逅・・,teacher:'蜈育函',captain:'驛ｨ髟ｷ',chairman:'蟋泌藤髟ｷ',vice_captain:'蜑ｯ驛ｨ髟ｷ',vice_chairman:'蜑ｯ蟋泌藤髟ｷ',student:'逕溷ｾ・,student_council:'逕溷ｾ剃ｼ・};
const ALL_ROLES = ['admin','teacher','captain','chairman','vice_captain','vice_chairman','student','student_council'];
const EMOJIS = ['総','笶､・・,'・','脂','舒','剌'];

function forceUpdate(){if(!confirm('繧｢繝励Μ繧呈怙譁ｰ繝舌・繧ｸ繝ｧ繝ｳ縺ｫ譖ｴ譁ｰ縺励∪縺吶°・・))return;toast('譖ｴ譁ｰ荳ｭ...','info');if('caches' in window){caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(regs=>{regs.forEach(r=>r.unregister());});}setTimeout(()=>location.reload(true),500);});}else{location.reload(true);}}

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
  if(!username||!password) { errEl.textContent='蜈･蜉帙＠縺ｦ縺上□縺輔＞'; errEl.classList.remove('hidden'); return; }
  try { const r=await api('/api/auth/login',{method:'POST',body:{username,password}}); currentUser=r.user; if(currentUser.first_login) showSetupModal(); else showApp(); }
  catch(e) { errEl.textContent=e.message||'繝ｭ繧ｰ繧､繝ｳ螟ｱ謨・; errEl.classList.remove('hidden'); }
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
  try { await api('/api/auth/register',{method:'POST',body:{token,username:uname,password:pw}}); hideRegisterModal(); toast('逋ｻ骭ｲ螳御ｺ・ゅΟ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞','success'); }
  catch(e) { errEl.textContent=e.message||'逋ｻ骭ｲ螟ｱ謨・; errEl.classList.remove('hidden'); }
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
  if(!username||!password) { errEl.textContent='蜈･蜉帙＠縺ｦ縺上□縺輔＞'; errEl.classList.remove('hidden'); return; }
  try { await api('/api/auth/init',{method:'POST',body:{username,password}}); hideInitModal(); toast('邂｡逅・・ｽ懈・螳御ｺ・ゅΟ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞','success'); }
  catch(e) { errEl.textContent=e.message||'菴懈・螟ｱ謨・; errEl.classList.remove('hidden'); }
}

function showSetupModal() {
  hideLogin();
  const c=document.getElementById('setup-form-container');
  const role=currentUser.role;
  let h='<div class="space-y-4"><div><label class="form-label">蜷榊燕</label><input id="setup-name" type="text" class="form-input"></div>';
  if(role==='admin'||role==='teacher') {
    h+='<div><label class="form-label">繝代せ繝ｯ繝ｼ繝牙､画峩・井ｻｻ諢擾ｼ・/label><input id="setup-password" type="password" class="form-input"></div>';
    if(role==='teacher') h+='<div><label class="form-label">謨咏ｧ・/label><input id="setup-subject" type="text" class="form-input"></div>';
  } else {
    h+='<div class="grid grid-cols-3 gap-2"><div><label class="form-label">蟄ｦ蟷ｴ</label><input id="setup-grade" type="number" class="form-input" min="1" max="3"></div><div><label class="form-label">繧ｯ繝ｩ繧ｹ</label><input id="setup-class" type="number" class="form-input" min="1" max="9"></div><div><label class="form-label">逡ｪ蜿ｷ</label><input id="setup-number" type="number" class="form-input" min="1" max="50"></div></div>';
    h+='<div><label class="form-label">繝代せ繝ｯ繝ｼ繝牙､画峩・井ｻｻ諢擾ｼ・/label><input id="setup-password" type="password" class="form-input"></div>';
  }
  c.innerHTML=h; document.getElementById('setup-modal').classList.remove('hidden');
}

async function submitSetup() {
  const name=document.getElementById('setup-name')?.value.trim();
  if(!name) { toast('蜷榊燕繧貞・蜉帙＠縺ｦ縺上□縺輔＞','error'); return; }
  const body={name,password:document.getElementById('setup-password')?.value||undefined};
  const role=currentUser.role;
  if(role==='teacher') { body.subject=document.getElementById('setup-subject')?.value.trim(); }
  else if(!['admin','teacher'].includes(role)) {
    body.grade=parseInt(document.getElementById('setup-grade')?.value)||undefined;
    body.class_num=parseInt(document.getElementById('setup-class')?.value)||undefined;
    body.number=parseInt(document.getElementById('setup-number')?.value)||undefined;
  }
  try { const r=await api('/api/auth/setup',{method:'POST',body}); currentUser=r.user; document.getElementById('setup-modal').classList.add('hidden'); showApp(); toast('險ｭ螳壼ｮ御ｺ・,'success'); }
  catch(e) { toast(e.message||'險ｭ螳壼､ｱ謨・,'error'); }
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
  showModal('繝励ャ繧ｷ繝･騾夂衍','<div class="text-center space-y-4"><div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100"><i class="fas fa-bell text-blue-600 text-3xl"></i></div><p class="text-gray-700">縺顔衍繧峨○繧・Γ繝・そ繝ｼ繧ｸ繧偵Μ繧｢繝ｫ繧ｿ繧､繝縺ｧ蜿励￠蜿悶ｌ縺ｾ縺吶・br><strong class="text-blue-600">騾夂衍繧偵が繝ｳ縺ｫ縺吶ｋ縺薙→繧偵♀縺吶☆繧√＠縺ｾ縺吶・/strong></p></div>',[
    {label:'繧ｹ繧ｭ繝・・',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:function(){localStorage.setItem('push_dismissed','1');closeModal();}},
    {label:'騾夂衍繧偵が繝ｳ縺ｫ縺吶ｋ・域耳螂ｨ・・,className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:requestPushPermission}
  ]);
}

function urlBase64ToUint8Array(s){const p='='.repeat((4-s.length%4)%4);const b64=(s+p).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b64);const arr=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);return arr;}
function requestPushPermission(){
  if(!('PushManager' in window)){closeModal();showPushUnsupported();return;}
  Notification.requestPermission().then(async function(perm){
    if(perm!=='granted'){closeModal();toast('騾夂衍縺後が繝輔↓縺ｪ繧翫∪縺励◆縲りｨｭ螳壹°繧牙､画峩縺ｧ縺阪∪縺・,'info');return;}
    try{
      var reg=await navigator.serviceWorker.ready;
      var sub;
      try{sub=await reg.pushManager.getSubscription();}catch{}
      if(!sub){
        var vapidRes=await api('/api/notifications/vapid-key');
        if(!vapidRes.publicKey){toast('騾夂衍險ｭ螳壹′螳御ｺ・＠縺ｦ縺・∪縺帙ｓ縲らｮ｡逅・・↓騾｣邨｡縺励※縺上□縺輔＞','error');closeModal();return;}
        sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidRes.publicKey)});
      }
      var subJson=JSON.stringify(sub);
      await api('/api/admin/notifications/settings',{method:'PUT',body:{push_enabled:true,push_subscription:subJson}});
      closeModal();toast('騾夂衍繧偵が繝ｳ縺ｫ縺励∪縺励◆','success');
    }catch(e){
      closeModal();toast('騾夂衍縺ｮ險ｭ螳壹↓螟ｱ謨励＠縺ｾ縺励◆: '+(e.message||'繧ｨ繝ｩ繝ｼ'),'error');
    }
  }).catch(function(e){
    closeModal();toast('騾夂衍縺ｮ險ｭ螳壹↓螟ｱ謨励＠縺ｾ縺励◆: '+(e.message||'繧ｨ繝ｩ繝ｼ'),'error');
  });
}
function showPushUnsupported(){
  showModal('繝励ャ繧ｷ繝･騾夂衍','<div class="text-center space-y-4"><div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100"><i class="fas fa-exclamation-triangle text-yellow-600 text-3xl"></i></div><p class="text-gray-700">縺薙・繝悶Λ繧ｦ繧ｶ縺ｧ縺ｯ繝励ャ繧ｷ繝･騾夂衍繧貞茜逕ｨ縺ｧ縺阪∪縺帙ｓ縲・br><strong>iPad縺ｮ蝣ｴ蜷医・縲ヾafari縺ｮ蜈ｱ譛峨・繧ｿ繝ｳ縺九ｉ縲後・繝ｼ繝逕ｻ髱｢縺ｫ霑ｽ蜉縲阪＠縺ｦ縺九ｉ縺願ｩｦ縺励￥縺縺輔＞縲・/strong></p></div>',[{label:'髢峨§繧・,className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);
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
    {id:'bulletin',icon:'fa-bullhorn',label:'謗ｲ遉ｺ譚ｿ',visible:true},
    {id:'notice',icon:'fa-school',label:'荳贋ｸｭ騾｣邨｡',visible:true},
    {id:'committee',icon:'fa-users-cog',label:'蟋泌藤莨・,visible:!!(currentUser.committee||isStaff)},
    {id:'club',icon:'fa-running',label:'驛ｨ豢ｻ蜍・,visible:!!(currentUser.club||isStaff)},
    {id:'question',icon:'fa-question-circle',label:'雉ｪ蝠・,visible:true},
    {id:'classgroup',icon:'fa-chalkboard-teacher',label:'繧ｯ繝ｩ繧ｹ',visible:true},
    {id:'messages',icon:'fa-comments',label:'繝｡繝・そ繝ｼ繧ｸ',visible:true},
    {id:'captchat',icon:'fa-crown',label:'驛ｨ髟ｷChat',visible:isCaptain||isStaff},
    {id:'consult',icon:'fa-hands-helping',label:'逶ｸ隲・園',visible:true},
    {id:'notifications',icon:'fa-bell',label:'騾夂衍',visible:true},
    {id:'settings',icon:'fa-cog',label:'險ｭ螳・,visible:true}
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
  else content.innerHTML='<div class="empty-state"><i class="fas fa-construction"></i><p>貅門ｙ荳ｭ</p></div>';
}

function clearTimers() { [reloadTimer,notifCheckTimer,clockTimer].forEach(t=>{if(t) clearInterval(t);}); }
function loadInfoBar() { fetchWBGT(); }
function updateInfoBar() {}
function startTimers() {
  notifCheckTimer=setInterval(fetchUnreadCount,30000);
  reloadTimer=setInterval(()=>{if(currentTab&&!window._peActive) renderTab(currentTab);},60000);
}

// === Committee ===
function renderCommittee(container) {
  window._peActive=null;
  const roles=currentUser.roles||[currentUser.role];
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  const myCommittee=currentUser.committee;
  const isPE=isStaff||myCommittee==='菴楢ご蟋泌藤莨・;
  let tabs='';
  if(isStaff) tabs=COMMITTEES.map((c,i)=>'<button class="h-scroll-tab'+(i===0?' active':'')+'" onclick="switchGroupTab(\'committee\',\''+c+'\',this)">'+c+'</button>').join('');
  else if(myCommittee) {
    tabs='<button class="h-scroll-tab active">'+myCommittee+'</button>';
  }
  if(isPE) tabs+='<button class="h-scroll-tab'+(tabs?'':' active')+'" onclick="switchGroupTab(\'pe_checklist\',\'\',this)"><i class="fas fa-clipboard-list mr-1"></i>逕ｨ蜈ｷ遒ｺ隱・/button>';
  const canPost=isStaff||roles.some(r=>['chairman','vice_chairman','student_council'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-users-cog text-purple-600"></i>蟋泌藤莨・/h2>'+(canPost?'<button onclick="openPostModal(\'committee\',window.currentCommitteeTarget)" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>謚慕ｨｿ</button>':'')+'</div><div class="h-scroll-tabs" id="committee-tabs">'+tabs+'</div></div><div class="p-3" id="committee-list"><div class="skeleton h-24"></div></div>';
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
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-running text-red-600"></i>驛ｨ豢ｻ蜍・/h2>'+(canPost?'<button onclick="openPostModal(\'club\',window.currentClubTarget)" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>謚慕ｨｿ</button>':'')+'</div><div class="h-scroll-tabs" id="club-tabs">'+tabs+'</div></div><div class="p-3" id="club-list"><div class="skeleton h-24"></div></div>';
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
    if(!r.posts||!r.posts.length){c.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>謚慕ｨｿ縺後≠繧翫∪縺帙ｓ</p></div>';return;}
    c.innerHTML=r.posts.map(p=>renderPostCard(p)).join('');
  } catch { if(window._peActive) return; c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>'; }
}

function renderPostCard(post) {
  const rl=ROLE_LABELS[post.author_role]||post.author_role;
  const es=post.expires_at?'<span class="text-xs text-gray-400 ml-2"><i class="fas fa-clock"></i> '+formatDate(post.expires_at)+'</span>':'';
  const fh=renderFilePreview(post.file_url,post.file_type);
  const ib=post.is_important?'<span class="badge badge-admin mr-1"><i class="fas fa-star mr-1"></i>驥崎ｦ・/span>':'';
  const re=(post.reactions||[]).map(r=>'<button class="reaction-btn" onclick="reactToPost('+post.id+',\''+r.emoji+'\',this)">'+r.emoji+' <span>'+r.count+'</span></button>').join('');
  const ar='<button class="reaction-btn" onclick="showEmojiPicker('+post.id+',\'post\',this)"><i class="fas fa-smile-beam"></i></button>';
  const del=canDeletePost(post)?'<button onclick="deletePost('+post.id+')" class="text-red-400 hover:text-red-600 text-sm"><i class="fas fa-trash"></i></button>':'';
  const claimBtn=post.category==='lost_item'?'<button class="claim-btn'+(post.is_claimed?' claimed':'')+'" onclick="claimLostItem('+post.id+',this)"><i class="fas '+(post.is_claimed?'fa-check-circle':'fa-hand-paper')+' mr-1"></i>'+(post.is_claimed?'逕ｳ隲区ｸ医∩':'遘√・縺ｧ縺・)+'</button>'+(post.claim_count>0?'<span class="text-xs text-gray-400">'+post.claim_count+'莠ｺ逕ｳ隲倶ｸｭ</span>':'<span class="text-xs text-gray-400">縺ｾ縺逕ｳ隲九↑縺・/span>')+(currentUser&&(currentUser.id===post.author_id||(currentUser.roles||[]).includes('admin'))?'<button onclick="showClaimants('+post.id+')" class="text-xs text-blue-600 hover:underline ml-2">遒ｺ隱・/button>':'')+'</div>':'';
  return '<div class="post-card slide-in" id="post-'+post.id+'"><div class="flex items-start justify-between mb-2"><div>'+ib+'<span class="badge badge-'+post.author_role+' mr-2">'+rl+'</span><span class="font-semibold text-gray-800">'+esc(post.author_name||'荳肴・')+'</span>'+es+'</div><div class="flex gap-2 items-center"><span class="text-xs text-gray-400">'+formatRelative(post.created_at)+'</span>'+del+'</div></div>'+(post.title?'<h3 class="font-bold text-gray-800 mb-1">'+esc(post.title)+'</h3>':'')+'<p class="text-gray-700 text-sm whitespace-pre-wrap">'+esc(post.content)+'</p>'+fh+'<div class="flex flex-wrap gap-2 mt-3 items-center">'+re+ar+'</div><div class="flex items-center gap-2 mt-2">'+claimBtn+'</div>'+(post.read_count!=null?'<div class="text-xs text-gray-400 mt-1"><i class="fas fa-eye mr-1"></i>譌｢隱ｭ '+post.read_count+'莠ｺ</div>':'')+'</div>';
}
function claimLostItem(id,btn){api('/api/posts/'+id+'/claim',{method:'POST'}).then(r=>{if(r.action==='claimed'){btn.classList.add('claimed');btn.innerHTML='<i class="fas fa-check-circle mr-1"></i>逕ｳ隲区ｸ医∩';}else{btn.classList.remove('claimed');btn.innerHTML='<i class="fas fa-hand-paper mr-1"></i>遘√・縺ｧ縺・;}}).catch(e=>toast(e.message||'繧ｨ繝ｩ繝ｼ','error'));}
function showClaimants(id){api('/api/posts/'+id+'/claims').then(r=>{const h=r.claims.length?r.claims.map(c=>'<div class="flex items-center justify-between py-2 border-b"><div><span class="font-semibold text-sm">'+esc(c.name)+'</span><span class="text-xs text-gray-500 ml-2">'+(c.grade?c.grade+'-'+c.class_num+' '+c.number+'逡ｪ':'')+'</span></div><span class="text-xs text-gray-400">'+formatRelative(c.created_at)+'</span></div>').join(''):'<p class="text-gray-500 text-sm">逕ｳ隲玖・・縺・∪縺帙ｓ</p>';showModal('逕ｳ隲玖・ｸ隕ｧ',h,[{label:'髢峨§繧・,className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);}).catch(()=>toast('隱ｭ霎ｼ螟ｱ謨・,'error'));}

function canDeletePost(post) {
  if(!currentUser) return false;
  if((currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r))) return true;
  return post.author_id===currentUser.id;
}

async function deletePost(id) {
  if(!confirm('蜑企勁縺励∪縺吶°・・)) return;
  try{await api('/api/posts/'+id,{method:'DELETE'});const el=document.getElementById('post-'+id);if(el)el.remove();toast('蜑企勁縺励∪縺励◆','success');}catch(e){toast('蜑企勁螟ｱ謨・,'error');}
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
  showModal('謚慕ｨｿ菴懈・','<div class="space-y-4"><div><label class="form-label">繧ｿ繧､繝医Ν・井ｻｻ諢擾ｼ・/label><input id="post-title" type="text" class="form-input"></div><div><label class="form-label">蜀・ｮｹ *</label><textarea id="post-content" class="form-input" rows="5" placeholder="蜀・ｮｹ繧貞・蜉・.."></textarea></div><div><label class="form-label">豸亥悉譌･・・譌･蠕後懈怙螟ｧ2繝ｶ譛茨ｼ・/label><input id="post-expires" type="date" class="form-input" min="'+today+'" max="'+maxDate+'"></div><div><label class="form-label">繝輔ぃ繧､繝ｫ豺ｻ莉・/label><input type="file" id="post-file-input" class="form-input" accept="image/*,.pdf" onchange="handleFileSelect(event)"><div id="post-file-preview" class="hidden mt-2 p-2 bg-gray-50 rounded-lg flex items-center gap-2"><i class="fas fa-file text-blue-500"></i><span id="post-file-name" class="text-sm flex-1"></span><button onclick="clearFileSelect()" class="text-red-400 text-sm"><i class="fas fa-times"></i></button></div></div></div>',[
    {label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},
    {label:'謚慕ｨｿ縺吶ｋ',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitPost(category,target)}
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
  if(!content){toast('蜀・ｮｹ繧貞・蜉帙＠縺ｦ縺上□縺輔＞','error');return;}
  let fileUrl,fileType;
  if(window._pendingFile){
    try{const fd=new FormData();fd.append('file',window._pendingFile);const up=await api('/api/upload',{method:'POST',body:fd,noJson:true});fileUrl=up.url;fileType=up.mime_type?.startsWith('image/')?'image':'pdf';}
    catch(e){toast('繝輔ぃ繧､繝ｫ繧｢繝・・繝ｭ繝ｼ繝牙､ｱ謨・,'error');return;}
  }
  const expires=document.getElementById('post-expires').value;
  try{
    await api('/api/posts',{method:'POST',body:{category,target:target||undefined,title:title||undefined,content,file_url:fileUrl,file_type:fileType,expires_at:expires?new Date(expires).toISOString():undefined}});
    closeModal();toast('謚慕ｨｿ縺励∪縺励◆','success');renderTab(currentTab);
  }catch(e){toast(e.message||'謚慕ｨｿ螟ｱ謨・,'error');}
}

// === Bulletin ===
function renderBulletin(container) {
  const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bullhorn text-red-600"></i>謗ｲ遉ｺ譚ｿ</h2>'+(isAdmin?'<button onclick="openPostModal(\'bulletin\')" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>謚慕ｨｿ</button>':'')+'</div></div><div class="p-3" id="bulletin-list"><div class="skeleton h-24"></div></div>';
  loadPosts('bulletin','','bulletin-list');
}

// === Notice (荳贋ｸｭ騾｣邨｡ + 蠢倥ｌ迚ｩ + 繧｢繝ｳ繧ｱ繝ｼ繝・ ===
function renderNotice(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-school text-orange-600"></i>荳贋ｸｭ騾｣邨｡</h2>'+(isStaff?'<button id="notice-add-btn" onclick="openPostModal(\'school_notice\')" class="bg-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>謚慕ｨｿ</button>':'')+'</div><div class="sub-nav"><button class="sub-nav-btn active" onclick="switchNoticeTab(\'school_notice\',this)"><i class="fas fa-school mr-1"></i>騾｣邨｡</button><button class="sub-nav-btn" onclick="switchNoticeTab(\'lost_item\',this)"><i class="fas fa-box-open mr-1"></i>蠢倥ｌ迚ｩ</button><button class="sub-nav-btn" onclick="switchNoticeTab(\'survey\',this)"><i class="fas fa-poll mr-1"></i>繧｢繝ｳ繧ｱ繝ｼ繝・/button></div></div><div class="p-3" id="notice-content"><div class="skeleton h-24"></div></div>';
  loadPosts('school_notice','','notice-content');
}

function switchNoticeTab(tab,btn) {
  document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  const c=document.getElementById('notice-content');if(!c)return;
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  const addBtn=document.getElementById('notice-add-btn');
  if(tab==='survey') {
    if(addBtn) addBtn.style.display='none';
    c.innerHTML='<div class="flex gap-2 flex-wrap mb-3">'+(isStaff?'<button onclick="openNewSurveyModal()" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>菴懈・</button>':'')+'<button class="sub-nav-btn active" onclick="switchSurveyTab(\'open\',this,\'notice-content\')">蝗樒ｭ泌女莉倅ｸｭ</button><button class="sub-nav-btn" onclick="switchSurveyTab(\'closed\',this,\'notice-content\')">邨ゆｺ・/button></div><div id="survey-list"><div class="skeleton h-20"></div></div>';
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
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-question-circle text-green-600"></i>雉ｪ蝠・/h2><button onclick="openAskModal()" class="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>雉ｪ蝠上☆繧・/button></div><div class="sub-nav"><button class="sub-nav-btn active" onclick="switchQuestionTab(\'my\',this)">閾ｪ蛻・∈縺ｮ雉ｪ蝠・/button><button class="sub-nav-btn" onclick="switchQuestionTab(\'sent\',this)">騾√▲縺溯ｳｪ蝠・/button>'+(isStaff?'<button class="sub-nav-btn" onclick="switchQuestionTab(\'history\',this)">蜈ｨ螻･豁ｴ</button>':'')+'</div></div><div class="p-3" id="question-list"><div class="skeleton h-20"></div></div>';
  loadMyQuestions();
}

function switchQuestionTab(tab,btn){
  document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  if(tab==='my')loadMyQuestions();else if(tab==='sent')loadSentQuestions();else if(tab==='history')loadQuestionHistory();
}

async function loadMyQuestions() {
  const c=document.getElementById('question-list');if(!c)return;
  try{const r=await api('/api/questions/my');if(!r.questions.length){c.innerHTML='<div class="empty-state"><i class="fas fa-question"></i><p>雉ｪ蝠上′縺ゅｊ縺ｾ縺帙ｓ</p></div>';return;}
  c.innerHTML=r.questions.map(q=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-2"><span class="font-semibold text-sm text-gray-700">'+esc(q.asker_name)+'</span><span class="text-xs text-gray-400">'+formatRelative(q.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(q.content)+'</p>'+(q.answer?'<div class="mt-3 pt-3 border-t"><p class="text-green-700 text-sm"><i class="fas fa-reply mr-1"></i>'+esc(q.answer)+'</p></div>':'<button onclick="openAnswerModal('+q.id+')" class="mt-2 text-blue-600 text-sm hover:underline"><i class="fas fa-pen mr-1"></i>蝗樒ｭ斐☆繧・/button>')+'</div>').join('');}
  catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}
}

async function loadSentQuestions() {
  const c=document.getElementById('question-list');if(!c)return;
  try{const r=await api('/api/questions/sent');if(!r.questions.length){c.innerHTML='<div class="empty-state"><i class="fas fa-paper-plane"></i><p>騾√▲縺溯ｳｪ蝠上・縺ゅｊ縺ｾ縺帙ｓ</p></div>';return;}
  c.innerHTML=r.questions.map(q=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-2"><span class="font-semibold text-sm text-gray-700">竊・'+esc(q.target_name)+'</span><span class="text-xs text-gray-400">'+formatRelative(q.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(q.content)+'</p>'+(q.answer?'<div class="mt-3 pt-3 border-t text-green-700 text-sm"><i class="fas fa-reply mr-1"></i>'+esc(q.answer)+'</div>':'<span class="text-xs text-gray-400">譛ｪ蝗樒ｭ・/span>')+'</div>').join('');}catch{}
}

async function loadQuestionHistory() {
  const c=document.getElementById('question-list');if(!c)return;
  try{const r=await api('/api/questions/history');if(!r.questions.length){c.innerHTML='<div class="empty-state"><i class="fas fa-history"></i><p>螻･豁ｴ縺ｪ縺・/p></div>';return;}
  c.innerHTML=r.questions.map(q=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-1"><span class="text-xs text-gray-500">'+esc(q.asker_name)+' 竊・'+esc(q.target_name)+'</span><span class="text-xs text-gray-400">'+formatRelative(q.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(q.content)+'</p>'+(q.answer?'<p class="text-green-700 text-sm mt-2"><i class="fas fa-reply mr-1"></i>'+esc(q.answer)+'</p>':'<span class="text-xs text-gray-400">譛ｪ蝗樒ｭ・/span>')+'</div>').join('');}catch{}
}

async function openAskModal() {
  try{const r=await api('/api/questions/targets');const opts=r.targets.map(t=>'<option value="'+t.id+'">'+esc(t.name)+' ('+(ROLE_LABELS[t.role]||t.role)+')</option>').join('');
  showModal('雉ｪ蝠上☆繧・,'<div class="space-y-4"><div><label class="form-label">雉ｪ蝠丞・</label><select id="ask-target" class="form-input">'+opts+'</select></div><div><label class="form-label">雉ｪ蝠丞・螳ｹ</label><textarea id="ask-content" class="form-input" rows="4" placeholder="雉ｪ蝠上ｒ蜈･蜉・.."></textarea></div></div>',[
    {label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},
    {label:'騾∽ｿ｡',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitAsk}]);}catch(e){toast('隱ｭ霎ｼ螟ｱ謨・,'error');}
}

async function submitAsk(){const t=parseInt(document.getElementById('ask-target').value);const c=document.getElementById('ask-content').value.trim();if(!c){toast('蜈･蜉帙＠縺ｦ縺上□縺輔＞','error');return;}try{await api('/api/questions',{method:'POST',body:{target_id:t,content:c}});closeModal();toast('騾∽ｿ｡縺励∪縺励◆','success');loadMyQuestions();}catch(e){toast(e.message||'騾∽ｿ｡螟ｱ謨・,'error');}}

function openAnswerModal(qId){showModal('蝗樒ｭ・,'<textarea id="answer-content" class="form-input" rows="4" placeholder="蝗樒ｭ斐ｒ蜈･蜉・.."></textarea>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'蝗樒ｭ斐☆繧・,className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitAnswer(qId)}]);}

async function submitAnswer(qId){const a=document.getElementById('answer-content').value.trim();if(!a){toast('蜈･蜉帙＠縺ｦ縺上□縺輔＞','error');return;}try{await api('/api/questions/'+qId+'/answer',{method:'PUT',body:{answer:a}});closeModal();toast('蝗樒ｭ斐＠縺ｾ縺励◆','success');loadMyQuestions();}catch(e){toast('蝗樒ｭ泌､ｱ謨・,'error');}}

// === Class Group ===
async function renderClassGroup(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  const myGrade=currentUser.grade?String(currentUser.grade):null;
  const myClass=currentUser.class_num?String(currentUser.class_num):null;
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-chalkboard-teacher text-yellow-600"></i>繧ｯ繝ｩ繧ｹ</h2>'+(isStaff?'<button onclick="openClassPostModal()" class="bg-yellow-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>謚慕ｨｿ</button>':'')+'</div><div class="h-scroll-tabs" id="class-tabs"></div></div><div class="p-3" id="class-list"><div class="skeleton h-24"></div></div>';
  let tabs='';
  if(isStaff){
    try{const r=await api('/api/admin/classes');const classes=r.classes||[];tabs=classes.map((x,i)=>{const g=x.grade,c=x.class_num;return'<button class="h-scroll-tab'+(i===0?' active':'')+'" onclick="switchClassTab('+g+','+c+',this)">'+g+'蟷ｴ'+c+'邨・/button>';}).join('');if(!tabs)tabs='<button class="h-scroll-tab active" onclick="switchClassTab(1,1,this)">1蟷ｴ1邨・/button>';}catch{tabs='<button class="h-scroll-tab active" onclick="switchClassTab(1,1,this)">1蟷ｴ1邨・/button>';}
  }else if(myGrade&&myClass){
    tabs='<button class="h-scroll-tab active">'+myGrade+'蟷ｴ'+myClass+'邨・/button>';
  }
  const tabsContainer=document.getElementById('class-tabs');if(tabsContainer)tabsContainer.innerHTML=tabs;
  window.classTarget=myGrade&&myClass?myGrade+'-'+myClass:null;
  if(isStaff){const firstTab=document.querySelector('#class-tabs .h-scroll-tab');if(firstTab)window.classTarget=firstTab.textContent.replace('蟷ｴ','-').replace('邨・,'');else window.classTarget='1-1';}
  if(window.classTarget)loadPosts('class',window.classTarget,'class-list');
}

function switchClassTab(grade,cn,btn){document.querySelectorAll('#class-tabs .h-scroll-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');window.classTarget=grade+'-'+cn;loadPosts('class',window.classTarget,'class-list');}

async function openClassPostModal(){
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  if(!isStaff){toast('蜈育函縺ｮ縺ｿ謚慕ｨｿ縺ｧ縺阪∪縺・,'error');return;}
  let opts='';
  try{const r=await api('/api/admin/classes');const classes=r.classes||[];opts=classes.map(x=>'<option value="'+x.grade+'-'+x.class_num+'">'+x.grade+'蟷ｴ'+x.class_num+'邨・/option>').join('');if(!opts)opts='<option value="1-1">1蟷ｴ1邨・/option>';}catch{opts='<option value="1-1">1蟷ｴ1邨・/option>';}
  showModal('繧ｯ繝ｩ繧ｹ縺ｫ謚慕ｨｿ','<div class="space-y-4"><div><label class="form-label">繧ｯ繝ｩ繧ｹ</label><select id="class-post-target" class="form-input">'+opts+'</select></div><div><label class="form-label">蜀・ｮｹ</label><textarea id="class-post-content" class="form-input" rows="4"></textarea></div></div>',[
    {label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},
    {label:'謚慕ｨｿ',className:'bg-yellow-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitClassPost}
  ]);
}

async function submitClassPost(){
  const target=document.getElementById('class-post-target').value;
  const content=document.getElementById('class-post-content').value.trim();
  if(!content){toast('蜀・ｮｹ繧貞・蜉・,'error');return;}
  try{await api('/api/posts',{method:'POST',body:{category:'class',target,content}});closeModal();toast('謚慕ｨｿ縺励∪縺励◆','success');loadPosts('class',target,'class-list');}catch(e){toast(e.message||'螟ｱ謨・,'error');}
}

// === Messages ===
function renderMessages(container) {
  container.innerHTML='<div class="flex flex-col h-full"><div class="bg-white border-b px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-comments text-blue-600"></i>繝｡繝・そ繝ｼ繧ｸ</h2><button onclick="openNewThreadModal(\'direct\')" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>譁ｰ隕・/button></div><div id="thread-list" class="flex-1 overflow-y-auto"></div></div>';
  loadThreads('direct');
}

async function loadThreads(type) {
  const c=document.getElementById('thread-list');if(!c)return;
  try{const r=await api('/api/messages/threads?type='+type);if(!r.threads.length){c.innerHTML='<div class="empty-state"><i class="fas fa-comment-slash"></i><p>繝｡繝・そ繝ｼ繧ｸ縺後≠繧翫∪縺帙ｓ</p></div>';return;}
  c.innerHTML=r.threads.map(t=>{const om=t.members.filter(m=>m.id!==currentUser.id);const n=t.name||om.map(m=>m.name||'?').join('縲・)||'繧ｰ繝ｫ繝ｼ繝・;const ti=t.type==='group'?'則':'町';const pi=t.is_pinned?'<i class="fas fa-thumbtack text-blue-500 text-xs ml-1"></i>':'';return'<div class="thread-item" onclick="openThread('+t.id+',\''+esc(n)+'\')"><div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-none text-xl">'+ti+'</div><div class="flex-1 min-w-0"><div class="flex justify-between items-baseline"><span class="font-semibold text-sm text-gray-800 truncate">'+esc(n)+pi+'</span><span class="text-xs text-gray-400 flex-none ml-2">'+(t.last_message_at?formatRelative(t.last_message_at):'')+'</span></div><p class="text-xs text-gray-500 truncate">'+(t.last_message?esc(t.last_message):'')+'</p></div>'+(t.unread_count>0?'<span class="flex-none bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">'+t.unread_count+'</span>':'')+'</div>';}).join('');}
  catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}
}

function openThread(threadId,threadName) {
  currentThreadId=threadId;
  const content=document.getElementById('tab-content');
  content.innerHTML='<div class="flex flex-col h-full"><div class="bg-white border-b px-4 py-3 flex items-center gap-3"><button onclick="navigateTo(\'messages\')" class="p-1 hover:bg-gray-100 rounded-full text-gray-500"><i class="fas fa-arrow-left"></i></button><span class="font-bold text-gray-800 flex-1">'+esc(threadName)+'</span><button onclick="togglePinThread('+threadId+')" class="p-1.5 hover:bg-gray-100 rounded-full text-gray-500" title="繝斐Φ逡吶ａ"><i class="fas fa-thumbtack"></i></button><button onclick="deleteThread('+threadId+')" class="p-1.5 hover:bg-gray-100 rounded-full text-red-400" title="蜑企勁"><i class="fas fa-trash"></i></button><button onclick="showThreadMembers('+threadId+')" class="p-1.5 hover:bg-gray-100 rounded-full text-gray-500" title="蜿ょ刈閠・><i class="fas fa-users"></i></button></div><div id="msg-list" class="flex-1 overflow-y-auto p-4 space-y-3"></div><div class="bg-white border-t p-3 flex gap-2"><input id="msg-input" type="text" class="flex-1 form-input" placeholder="繝｡繝・そ繝ｼ繧ｸ繧貞・蜉・.." onkeydown="if(event.key===\'Enter\')sendMessage()"><label class="p-2 hover:bg-gray-100 rounded-lg cursor-pointer text-gray-500"><i class="fas fa-paperclip"></i><input type="file" class="hidden" accept="image/*,.pdf" onchange="sendFileMessage(event)"></label><button onclick="sendMessage()" class="bg-blue-600 text-white px-4 rounded-xl"><i class="fas fa-paper-plane"></i></button></div></div>';
  loadMessages(threadId);
}

async function togglePinThread(id){try{const r=await api('/api/messages/threads/'+id+'/pin',{method:'POST'});toast(r.is_pinned?'繝斐Φ逡吶ａ縺励∪縺励◆':'繝斐Φ逡吶ａ隗｣髯､縺励∪縺励◆','success');}catch(e){toast('螟ｱ謨・,'error');}}
async function deleteThread(id){if(!confirm('縺薙・繧ｹ繝ｬ繝・ラ繧貞炎髯､縺励∪縺吶°・・))return;try{await api('/api/messages/threads/'+id,{method:'DELETE'});toast('蜑企勁縺励∪縺励◆','success');navigateTo('messages');}catch(e){toast('蜑企勁螟ｱ謨・,'error');}}

async function showThreadMembers(id){try{const r=await api('/api/messages/threads/'+id);const t=r.thread;if(!t){toast('繧ｹ繝ｬ繝・ラ諠・ｱ蜿門ｾ怜､ｱ謨・,'error');return;}const isCaptainChat=t.type==='captain_group';const roles=currentUser.roles||[currentUser.role];const canManage=isCaptainChat||roles.includes('admin');const ml=t.members.map(m=>'<div class="flex items-center justify-between gap-2 py-1"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">'+(m.name||'?')[0]+'</div><span class="text-sm">'+esc(m.name)+' ('+(ROLE_LABELS[m.role]||m.role)+')</span></div>'+(canManage&&m.id!==currentUser.id?'<button onclick="removeThreadMember('+id+','+m.id+')" class="text-red-500 text-xs hover:underline">蜑企勁</button>':'')+'</div>').join('');showModal('蜿ょ刈閠・+(isCaptainChat?'・磯Κ髟ｷ繝√Ε繝・ヨ・・:''),'<div class="space-y-1">'+(ml||'<p class="text-sm text-gray-500">繝｡繝ｳ繝舌・縺ｪ縺・/p>')+'</div>'+(canManage?'<div class="mt-3 pt-3 border-t"><button onclick="addThreadMember('+id+')" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs"><i class="fas fa-plus mr-1"></i>繝｡繝ｳ繝舌・霑ｽ蜉</button></div>':''),[{label:'髢峨§繧・,className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);}catch{toast('隱ｭ霎ｼ螟ｱ謨・,'error');}}

async function addThreadMember(id){try{const r=await api('/api/messages/users');const users=r.users.filter(u=>u.id!==currentUser.id);const cards=users.map(u=>{const info=[];if(u.grade)info.push(u.grade+'-'+u.class_num);if(u.club)info.push(u.club);if(u.committee)info.push(u.committee);const roleLbl=ROLE_LABELS[u.role]||u.role;const initial=esc((u.name||'?')[0]);return'<div onclick="selectAddMember(this,'+u.id+')" data-id="'+u.id+'" data-name="'+esc(u.name)+'" class="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-blue-50 transition"><div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-none">'+initial+'</div><div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">'+esc(u.name)+'</p><p class="text-xs text-gray-500 truncate">'+roleLbl+(info.length?' | '+esc(info.join(' | ')):'')+'</p></div><div class="sel-check w-5 h-5 rounded border-2 border-gray-300"></div></div>';}).join('');window._addMemThreadId=id;window._addMemSelected=null;showModal('繝｡繝ｳ繝舌・霑ｽ蜉','<div class="space-y-3"><input id="addmem-search" type="text" class="form-input" placeholder="蜷榊燕縺ｧ讀懃ｴ｢..." oninput="filterAddMemberList()"><div id="addmem-list" class="max-h-60 overflow-y-auto space-y-1">'+cards+'</div><p id="addmem-selected" class="text-xs text-gray-400">驕ｸ謚槭↑縺・/p></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'霑ｽ蜉',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:async()=>{const uid=window._addMemSelected;if(!uid){toast('驕ｸ謚槭＠縺ｦ縺上□縺輔＞','error');return;}try{await api('/api/messages/threads/'+id+'/members',{method:'POST',body:{user_id:uid}});closeModal();toast('霑ｽ蜉縺励∪縺励◆','success');showThreadMembers(id);}catch(e){toast(e.message||'螟ｱ謨・,'error');}}}]);}catch{toast('隱ｭ霎ｼ螟ｱ謨・,'error');}}

async function removeThreadMember(tid,uid){if(!confirm('縺薙・繝｡繝ｳ繝舌・繧貞炎髯､縺励∪縺吶°・・))return;try{await api('/api/messages/threads/'+tid+'/members/'+uid,{method:'DELETE'});toast('蜑企勁縺励∪縺励◆','success');showThreadMembers(tid);}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function loadMessages(id){const c=document.getElementById('msg-list');if(!c)return;try{const r=await api('/api/messages/threads/'+id+'/messages');if(!r.messages.length){c.innerHTML='<div class="empty-state"><i class="fas fa-comment"></i><p>縺ｾ縺繝｡繝・そ繝ｼ繧ｸ縺後≠繧翫∪縺帙ｓ</p></div>';return;}c.innerHTML=r.messages.map(m=>{const isMine=m.sender_id===currentUser.id;const ri=m.readers?.length>0?'<span class="text-xs text-blue-400 ml-1"><i class="fas fa-check-double"></i> '+m.readers.filter(r=>r.id!==m.sender_id).length+'</span>':'';return'<div class="flex '+(isMine?'justify-end':'justify-start')+' gap-2 items-end">'+(!isMine?'<div class="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs flex-none">'+((m.sender_name||'?')[0])+'</div>':'')+'<div class="group relative">'+(!isMine?'<p class="text-xs text-gray-500 mb-1 ml-1">'+esc(m.sender_name)+'</p>':'')+'<div class="msg-bubble '+(isMine?'mine':'others')+'">'+esc(m.content)+'</div>'+(m.file_url?renderFilePreview(m.file_url,m.file_type):'')+'<div class="flex items-center gap-1 mt-1 '+(isMine?'justify-end':'')+'"><span class="text-xs text-gray-400">'+formatRelative(m.created_at)+'</span>'+ri+'</div><button onclick="deleteMessage('+id+','+m.id+')" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition" title="蜿匁ｶ・><i class="fas fa-times"></i></button></div></div>';}).join('');c.scrollTop=c.scrollHeight;}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}

async function deleteMessage(tid,mid){if(!confirm('蜿匁ｶ医＠縺ｾ縺吶°・・))return;try{await api('/api/messages/threads/'+tid+'/messages/'+mid,{method:'DELETE'});toast('蜿匁ｶ医＠縺ｾ縺励◆','success');loadMessages(tid);}catch(e){toast(e.message||'蜿匁ｶ亥､ｱ謨・,'error');}}

async function sendMessage(){const inp=document.getElementById('msg-input');const c=inp?.value.trim();if(!c||!currentThreadId)return;inp.value='';try{await api('/api/messages/threads/'+currentThreadId+'/messages',{method:'POST',body:{content:c}});loadMessages(currentThreadId);}catch(e){toast(e.message||'騾∽ｿ｡螟ｱ謨・,'error');}}

async function sendFileMessage(e){const f=e.target?.files?.[0];if(!f||!currentThreadId)return;try{const fd=new FormData();fd.append('file',f);const up=await api('/api/upload',{method:'POST',body:fd,noJson:true});await api('/api/messages/threads/'+currentThreadId+'/messages',{method:'POST',body:{content:'',file_url:up.url,file_type:up.mime_type?.startsWith('image/')?'image':'pdf'}});loadMessages(currentThreadId);}catch(e){toast('騾∽ｿ｡螟ｱ謨・,'error');}}
window._selMembers=[];window._addMemSelected=null;window._addMemThreadId=null;
function toggleSelMember(el,id){const arr=window._selMembers;if(window._selMode==='single'){arr.forEach(i=>{const p=document.querySelector('#member-list>[data-id="'+i+'"]');if(p){p.classList.remove('border-blue-500','bg-blue-50');const ck=p.querySelector('.sel-check');if(ck){ck.classList.remove('bg-blue-500','border-blue-500');ck.textContent='';}}});arr.length=0;arr.push(id);el.classList.add('border-blue-500','bg-blue-50');const ck=el.querySelector('.sel-check');if(ck){ck.classList.add('bg-blue-500','border-blue-500');ck.textContent=String.fromCharCode(10003);}}else{const idx=arr.indexOf(id);if(idx>=0){arr.splice(idx,1);el.classList.remove('border-blue-500','bg-blue-50');const ck=el.querySelector('.sel-check');if(ck){ck.classList.remove('bg-blue-500','border-blue-500');ck.textContent='';}}else{arr.push(id);el.classList.add('border-blue-500','bg-blue-50');const ck=el.querySelector('.sel-check');if(ck){ck.classList.add('bg-blue-500','border-blue-500');ck.textContent=String.fromCharCode(10003);}}}const d=document.getElementById('sel-members-display');if(d){const ids=arr.slice();const names=ids.map(i=>{const u=document.querySelector('#member-list>[data-id="'+i+'"]');return u?u.getAttribute('data-name')||'':'';}).filter(Boolean);d.innerHTML=names.length?names.map(n=>'<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">'+esc(n)+'</span>').join('')+' <span class="text-gray-400 text-xs">('+names.length+'莠ｺ)</span>':'<span class="text-gray-400 text-xs">驕ｸ謚槭↑縺・/span>';}}
function filterMemberList(){const q=(document.getElementById('member-search')?.value||'').toLowerCase();document.querySelectorAll('#member-list>[data-id]').forEach(el=>{const txt=(el.getAttribute('data-search')||el.textContent||'').toLowerCase();el.style.display=txt.includes(q)?'':'none';});}
function selectAddMember(el,id){if(window._addMemSelected){const prev=document.querySelector('#addmem-list>[data-id="'+window._addMemSelected+'"]');if(prev){prev.classList.remove('border-blue-500','bg-blue-50');const ck=prev.querySelector('.sel-check');if(ck){ck.classList.remove('bg-blue-500');ck.style.borderColor='';}}}window._addMemSelected=id;el.classList.add('border-blue-500','bg-blue-50');const ck=el.querySelector('.sel-check');if(ck){ck.classList.add('bg-blue-500');ck.style.borderColor='rgb(59,130,246)';}const el2=document.getElementById('addmem-selected');if(el2){const name=el.getAttribute('data-name')||el.querySelector('.text-sm.font-semibold')?.textContent||'';el2.innerHTML='<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">驕ｸ謚樔ｸｭ: '+esc(name)+'</span>';}}
function filterAddMemberList(){const q=(document.getElementById('addmem-search')?.value||'').toLowerCase();document.querySelectorAll('#addmem-list>[data-id]').forEach(el=>{const txt=(el.textContent||'').toLowerCase();el.style.display=txt.includes(q)?'':'none';});}

async function openNewThreadModal(type){try{const r=await api('/api/messages/users');const isMulti=type==='group';window._selMembers=[];window._selMode=isMulti?'multi':'single';const cards=r.users.map(u=>{const info=[];if(u.grade)info.push(u.grade+'-'+u.class_num);if(u.club)info.push(u.club);if(u.committee)info.push(u.committee);const roleLbl=ROLE_LABELS[u.role]||u.role;const initial=esc((u.name||'?')[0]);return'<div onclick="toggleSelMember(this,'+u.id+')" data-id="'+u.id+'" data-name="'+esc(u.name)+'" data-search="'+esc((u.name+(u.grade||'')+(u.club||'')+(u.committee||'')+(ROLE_LABELS[u.role]||u.role)).toLowerCase())+'" class="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-blue-50 transition"><div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-none">'+initial+'</div><div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">'+esc(u.name)+'</p><p class="text-xs text-gray-500 truncate">'+roleLbl+(info.length?' | '+esc(info.join(' | ')):'')+'</p></div><div class="sel-check w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center text-white text-xs font-bold"></div></div>';}).join('');showModal('譁ｰ隕上Γ繝・そ繝ｼ繧ｸ','<div class="space-y-4">'+(type!=='captain'?'<div><label class="form-label">遞ｮ鬘・/label><select id="thread-type" class="form-input" onchange="var m=this.value===\'group\';window._selMode=m?\'multi\':\'single\';window._selMembers=[];document.querySelectorAll(\'#member-list>[data-id]\').forEach(function(e){e.classList.remove(\'border-blue-500\',\'bg-blue-50\');var c=e.querySelector(\'.sel-check\');if(c){c.classList.remove(\'bg-blue-500\',\'border-blue-500\');c.textContent=\'\';}});var d=document.getElementById(\'sel-members-display\');if(d)d.textContent=\'驕ｸ謚槭↑縺予';document.getElementById(\'thread-name-field\').style.display=m?\'block\':\'none\';document.getElementById(\'sel-mode-label\').textContent=m?\'隍・焚驕ｸ謚槫庄・医け繝ｪ繝・け縺ｧ驕ｸ謚・隗｣髯､・噂':\'1莠ｺ縺縺鷹∈謚杤';"><option value="direct">DM・亥倶ｺｺ・・/option>'+((currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r))?'<option value="group">繧ｰ繝ｫ繝ｼ繝・/option>':'')+'</select></div>':'')+'<div id="thread-name-field" class="'+(isMulti?'':'hidden')+'"><label class="form-label">繧ｰ繝ｫ繝ｼ繝怜錐・井ｻｻ諢擾ｼ・/label><input id="thread-name" type="text" class="form-input"></div><div><label class="form-label"><span id="sel-mode-label">'+(isMulti?'隍・焚驕ｸ謚槫庄・医け繝ｪ繝・け縺ｧ驕ｸ謚・隗｣髯､・・:'1莠ｺ縺縺鷹∈謚・)+'</span></label><input id="member-search" type="text" class="form-input mb-2" placeholder="蜷榊燕縺ｧ讀懃ｴ｢..." oninput="filterMemberList()"><div id="member-list" class="max-h-60 overflow-y-auto space-y-1 border rounded-lg p-1">'+cards+'</div><div id="sel-members-display" class="mt-1 text-xs text-gray-500 flex flex-wrap gap-1"><span class="text-gray-400">驕ｸ謚槭↑縺・/span></div></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'菴懈・',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:createThread}]);}catch(e){toast('隱ｭ霎ｼ螟ｱ謨・,'error');}}

async function createThread(){const t=document.getElementById('thread-type')?.value||'captain_group';const n=document.getElementById('thread-name')?.value.trim();const mids=window._selMembers||[];if(!mids.length){toast('逶ｸ謇九ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞','error');return;}try{const r=await api('/api/messages/threads',{method:'POST',body:{type:t,name:n||null,member_ids:mids}});closeModal();toast(r.existing?'譌｢蟄倥・繧ｹ繝ｬ繝・ラ繧帝幕縺阪∪縺・:'菴懈・縺励∪縺励◆',r.existing?'info':'success');navigateTo('messages');setTimeout(()=>openThread(r.thread_id,n||'譁ｰ縺励＞繝√Ε繝・ヨ'),100);}catch(e){toast(e.message||'菴懈・螟ｱ謨・,'error');}}

// === Captain Chat ===
function renderCaptChat(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  container.innerHTML='<div class="bg-white border-b px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-crown text-yellow-600"></i>驛ｨ髟ｷ蟋泌藤髟ｷ繝√Ε繝・ヨ</h2>'+(isStaff?'<button onclick="createCaptChatGroup()" class="bg-yellow-600 text-white px-3 py-1.5 rounded-full text-sm"><i class="fas fa-plus mr-1"></i>繧ｰ繝ｫ繝ｼ繝嶺ｽ懈・</button>':'')+'</div><div id="captchat-list" class="p-3"><div class="skeleton h-20"></div></div>';
  loadCaptChatThreads();
}

async function loadCaptChatThreads() {
  const c=document.getElementById('captchat-list');if(!c)return;
  try{const r=await api('/api/messages/captain-threads');if(!r.threads.length){c.innerHTML='<div class="empty-state"><i class="fas fa-crown"></i><p>驛ｨ髟ｷ繝√Ε繝・ヨ縺後∪縺縺ゅｊ縺ｾ縺帙ｓ</p></div>';return;}
  c.innerHTML=r.threads.map(t=>'<div class="card p-4 mb-3 cursor-pointer hover:shadow-md" onclick="openThread('+t.id+',\''+esc(t.name||'驛ｨ髟ｷ繝√Ε繝・ヨ')+'\')"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-xl">荘</div><div class="flex-1"><p class="font-bold text-gray-800">'+esc(t.name||'驛ｨ髟ｷ蟋泌藤髟ｷ繝√Ε繝・ヨ')+'</p><p class="text-xs text-gray-500">'+(t.members?.map(m=>esc(m.name||'?')).join('縲・)||'')+'</p></div>'+(t.unread_count>0?'<span class="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">'+t.unread_count+'</span>':'')+'</div></div>').join('');}catch{}
}

async function createCaptChatGroup(){const n=prompt('繧ｰ繝ｫ繝ｼ繝怜錐繧貞・蜉・');if(!n)return;try{await api('/api/messages/threads',{method:'POST',body:{type:'captain_group',name:n,member_ids:[]}});toast('菴懈・縺励∪縺励◆','success');loadCaptChatThreads();}catch(e){toast(e.message||'菴懈・螟ｱ謨・,'error');}}

// === Survey ===
let surveyQuestions=[], editingSurveyQIndex=-1;

function renderSurveyList(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-poll text-purple-600"></i>繧｢繝ｳ繧ｱ繝ｼ繝・/h2>'+(isStaff?'<button onclick="openNewSurveyModal()" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>菴懈・</button>':'')+'</div><div class="sub-nav"><button class="sub-nav-btn active" onclick="switchSurveyTab(\'open\',this)">蝗樒ｭ泌女莉倅ｸｭ</button><button class="sub-nav-btn" onclick="switchSurveyTab(\'closed\',this)">邨ゆｺ・/button></div></div><div class="p-3" id="survey-list"><div class="skeleton h-24"></div></div>';
  loadSurveys('open');
}

function switchSurveyTab(tab,btn,cid){document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');loadSurveys(tab,cid||'survey-list');}

async function loadSurveys(status,containerId){const c=document.getElementById(containerId||'survey-list');if(!c)return;try{const r=await api('/api/surveys');const now=new Date();const surveys=(r.surveys||[]).filter(s=>{const expired=s.expires_at&&new Date(s.expires_at)<now;return status==='open'?!expired:expired;});if(!surveys.length){c.innerHTML='<div class="empty-state"><i class="fas fa-poll-h"></i><p>'+(status==='open'?'蜍滄寔荳ｭ縺ｮ繧｢繝ｳ繧ｱ繝ｼ繝医・縺ゅｊ縺ｾ縺帙ｓ':'邨ゆｺ・＠縺溘い繝ｳ繧ｱ繝ｼ繝医・縺ゅｊ縺ｾ縺帙ｓ')+'</p></div>';return;}const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));c.innerHTML=surveys.map(s=>{const expired=s.expires_at&&new Date(s.expires_at)<now;const answered=!!s.my_answer_count;return'<div class="card p-4 mb-3"><div class="flex justify-between items-start"><div><h3 class="font-bold text-gray-800 mb-1">'+esc(s.title)+(s.target&&s.target!=='all'?' <span class="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-normal">'+surveyTargetLabel(s)+'</span>':'')+'</h3><p class="text-xs text-gray-500">菴懈・: '+esc(s.creator_name)+' | 譛滄剞: '+(s.expires_at?formatRelative(s.expires_at):'縺ｪ縺・)+' | 雉ｪ蝠・+s.question_count+'蝠・/p></div><span class="text-xs '+(expired?'text-gray-400':'text-green-600')+'">'+(expired?'邨ゆｺ・:'蜿嶺ｻ倅ｸｭ')+'</span></div>'+(s.description?'<p class="text-sm text-gray-600 mt-2">'+esc(s.description)+'</p>':'')+'<div class="mt-3 flex gap-3">'+(!answered&&!expired?'<button onclick="openSurveyAnswer('+s.id+')" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold">蝗樒ｭ斐☆繧・/button>':'')+(answered||isStaff?'<button onclick="viewSurveyResult('+s.id+')" class="text-purple-600 text-sm font-semibold hover:underline">邨先棡繧定ｦ九ｋ</button>':'')+'</div></div>';}).join('');}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}

// --- 繧｢繝ｳ繧ｱ繝ｼ繝井ｽ懈・・医せ繝・ャ繝怜ｽ｢蠑擾ｼ・---
function surveyTargetLabel(s){if(!s.target||s.target==='all')return'蜈ｨ譬｡';if(s.target==='class')return'繧ｯ繝ｩ繧ｹ: '+esc(s.target_value);if(s.target==='club')return'驛ｨ豢ｻ: '+esc(s.target_value);if(s.target==='committee')return'蟋泌藤莨・ '+esc(s.target_value);return'';}
function toggleSurveyTargetField(){const v=document.getElementById('st1-target');const f=document.getElementById('st1-target-value-field');const l=document.getElementById('st1-target-label');const i=document.getElementById('st1-target-value');if(!v||!f)return;const show=v.value!=='all';f.classList.toggle('hidden',!show);if(show){const labels={class:'繧ｯ繝ｩ繧ｹ (萓・ 1-1)',club:'驛ｨ豢ｻ蜷・(萓・ 繧ｵ繝・き繝ｼ驛ｨ)',committee:'蟋泌藤莨壼錐 (萓・ 菴楢ご蟋泌藤莨・'};l.textContent=labels[v.value]||'';i.placeholder=labels[v.value]||'';}}
function openNewSurveyModal(){surveyQuestions=[];renderSurveyStep1();}
function renderSurveyStep1(){const targetVal=surveyQuestions._target||'all';const targetValV=surveyQuestions._targetValue||'';const showTarget=targetVal!=='all';showModal('繧｢繝ｳ繧ｱ繝ｼ繝井ｽ懈・ 竭蝓ｺ譛ｬ諠・ｱ','<div class="space-y-4"><div class="bg-purple-50 rounded-lg p-3 text-sm text-purple-800"><i class="fas fa-info-circle mr-1"></i>縺ｾ縺壹・繧｢繝ｳ繧ｱ繝ｼ繝医・蝓ｺ譛ｬ諠・ｱ繧貞・蜉帙＠縺ｦ縺上□縺輔＞</div><div><label class="form-label">繧ｿ繧､繝医Ν <span class="text-red-500">*</span></label><input id="st1-title" type="text" class="form-input" placeholder="萓・ 菴楢ご逾ｭ縺ｮ遞ｮ逶ｮ縺ｫ縺､縺・※" value="'+(surveyQuestions._title||'')+'"></div><div><label class="form-label">隱ｬ譏趣ｼ井ｻｻ諢擾ｼ・/label><textarea id="st1-desc" class="form-input" rows="2" placeholder="繧｢繝ｳ繧ｱ繝ｼ繝医・逶ｮ逧・↑縺ｩ繧定ｨ倩ｼ・>'+(surveyQuestions._desc||'')+'</textarea></div><div><label class="form-label">蝗樒ｭ疲悄髯撰ｼ井ｻｻ諢擾ｼ・/label><input id="st1-expires" type="date" class="form-input" value="'+(surveyQuestions._expires||'')+'"></div><div><label class="form-label">驟堺ｿ｡蟇ｾ雎｡</label><select id="st1-target" class="form-input" onchange="toggleSurveyTargetField()"><option value="all"'+(targetVal==='all'?' selected':'')+'>蜈ｨ譬｡</option><option value="class"'+(targetVal==='class'?' selected':'')+'>繧ｯ繝ｩ繧ｹ</option><option value="club"'+(targetVal==='club'?' selected':'')+'>驛ｨ豢ｻ</option><option value="committee"'+(targetVal==='committee'?' selected':'')+'>蟋泌藤莨・/option></select></div><div id="st1-target-value-field" class="'+(showTarget?'':'hidden')+'"><label class="form-label" id="st1-target-label">'+(targetVal==='class'?'繧ｯ繝ｩ繧ｹ (萓・ 1-1)':(targetVal==='club'?'驛ｨ豢ｻ蜷・(萓・ 繧ｵ繝・き繝ｼ驛ｨ)':(targetVal==='committee'?'蟋泌藤莨壼錐 (萓・ 菴楢ご蟋泌藤莨・':'')))+'</label><input id="st1-target-value" type="text" class="form-input" value="'+esc(targetValV)+'"></div><div class="flex gap-2 justify-end"><button onclick="closeModal()" class="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button><button onclick="saveSurveyStep1()" class="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-semibold">谺｡縺ｸ 竭｡雉ｪ蝠丈ｽ懈・ <i class="fas fa-arrow-right ml-1"></i></button></div></div>',[]);}
function saveSurveyStep1(){surveyQuestions._title=document.getElementById('st1-title').value.trim();if(!surveyQuestions._title){toast('繧ｿ繧､繝医Ν繧貞・蜉帙＠縺ｦ縺上□縺輔＞','error');return;}surveyQuestions._desc=document.getElementById('st1-desc').value.trim();surveyQuestions._expires=document.getElementById('st1-expires').value||null;surveyQuestions._target=document.getElementById('st1-target').value;surveyQuestions._targetValue=surveyQuestions._target!=='all'?document.getElementById('st1-target-value').value.trim():null;renderSurveyStep2();}
function renderSurveyStep2(){const qHtml=surveyQuestions.map((q,i)=>'<div class="flex items-start gap-2 bg-gray-50 rounded-lg p-3"><div class="flex flex-col gap-0.5 pt-0.5"><button onclick="moveSurveyQuestion('+i+',-1)" class="text-gray-400 hover:text-gray-700 text-xs p-0.5" title="荳翫↓遘ｻ蜍・><i class="fas fa-chevron-up"></i></button><button onclick="moveSurveyQuestion('+i+',1)" class="text-gray-400 hover:text-gray-700 text-xs p-0.5" title="荳九↓遘ｻ蜍・><i class="fas fa-chevron-down"></i></button></div><div class="flex-1 min-w-0"><p class="text-sm font-semibold break-words">'+(i+1)+'. '+esc(q.text)+'</p><p class="text-xs text-gray-500">'+{single:'驕ｸ謚槫ｼ擾ｼ・縺､・・,multiple:'驕ｸ謚槫ｼ擾ｼ郁､・焚・・,text:'閾ｪ逕ｱ險倩ｿｰ'}[q.type]+'</p>'+(q.options&&q.options.length?'<div class="flex flex-wrap gap-1 mt-1">'+q.options.slice(0,5).map(o=>'<span class="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-600">'+esc(o)+'</span>').join('')+(q.options.length>5?' <span class="text-xs text-gray-400">+'+ (q.options.length-5) +'</span>':'')+'</div>':'')+'</div><div class="flex flex-col gap-1 shrink-0"><button onclick="editSurveyQuestion('+i+')" class="text-blue-600 text-xs p-1" title="邱ｨ髮・><i class="fas fa-edit"></i></button><button onclick="duplicateSurveyQuestion('+i+')" class="text-gray-500 text-xs p-1" title="隍・｣ｽ"><i class="fas fa-copy"></i></button><button onclick="surveyQuestions.splice('+i+',1);renderSurveyStep2()" class="text-red-500 text-xs p-1" title="蜑企勁"><i class="fas fa-trash"></i></button></div></div>').join('');showModal('繧｢繝ｳ繧ｱ繝ｼ繝井ｽ懈・ 竭｡雉ｪ蝠丈ｽ懈・','<div class="space-y-4"><div class="bg-purple-50 rounded-lg p-3 text-sm text-purple-800"><i class="fas fa-info-circle mr-1"></i>竊鯛・縺ｧ荳ｦ縺ｳ譖ｿ縺医りｳｪ蝠上ｒ霑ｽ蜉縺励※縺上□縺輔＞縲・/div><div id="survey-questions-list" class="space-y-2">'+qHtml+'</div><button onclick="addSurveyQuestion()" class="w-full border-2 border-dashed border-purple-300 text-purple-600 py-3 rounded-xl text-sm font-semibold hover:bg-purple-50 transition"><i class="fas fa-plus mr-1"></i>雉ｪ蝠上ｒ霑ｽ蜉</button><div class="flex gap-2 justify-between"><button onclick="renderSurveyStep1()" class="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm"><i class="fas fa-arrow-left mr-1"></i>謌ｻ繧・/button><button onclick="submitNewSurvey()" class="bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-semibold"><i class="fas fa-check mr-1"></i>繧｢繝ｳ繧ｱ繝ｼ繝医ｒ菴懈・</button></div></div>',[]);}
function moveSurveyQuestion(i,dir){const j=i+dir;if(j<0||j>=surveyQuestions.length)return;const t=surveyQuestions[i];surveyQuestions[i]=surveyQuestions[j];surveyQuestions[j]=t;renderSurveyStep2();}
function duplicateSurveyQuestion(i){surveyQuestions.push({...surveyQuestions[i],options:surveyQuestions[i].options?[...surveyQuestions[i].options]:null});renderSurveyStep2();}
function addSurveyQuestion(){editingSurveyQIndex=-1;renderSurveyQuestionForm(null);}
function editSurveyQuestion(i){editingSurveyQIndex=i;renderSurveyQuestionForm(surveyQuestions[i]);}
function renderSurveyQuestionForm(existing){const t=existing?existing.text:'';const tp=existing?existing.type:'single';const opts=existing&&existing.options?existing.options.join('\n'):'';showModal((editingSurveyQIndex>=0?'雉ｪ蝠上ｒ邱ｨ髮・:'譁ｰ縺励＞雉ｪ蝠・),'<div class="space-y-4"><div class="bg-blue-50 rounded-lg p-3 text-sm text-blue-800"><i class="fas fa-question-circle mr-1"></i>雉ｪ蝠上・蜀・ｮｹ縺ｨ蠖｢蠑上ｒ險ｭ螳壹＠縺ｦ縺上□縺輔＞</div><div><label class="form-label">雉ｪ蝠乗枚 <span class="text-red-500">*</span></label><textarea id="sq-text" class="form-input" rows="2" placeholder="萓・ 蟶梧悍縺吶ｋ遞ｮ逶ｮ縺ｯ・・>'+esc(t)+'</textarea></div><div><label class="form-label">蝗樒ｭ泌ｽ｢蠑・/label><select id="sq-type" class="form-input" onchange="toggleSurveyOptionsField()"><option value="single"'+(tp==='single'?' selected':'')+'>驕ｸ謚槫ｼ擾ｼ・縺､縺縺托ｼ・/option><option value="multiple"'+(tp==='multiple'?' selected':'')+'>驕ｸ謚槫ｼ擾ｼ郁､・焚蜿ｯ・・/option><option value="text"'+(tp==='text'?' selected':'')+'>閾ｪ逕ｱ險倩ｿｰ</option></select></div><div id="sq-options-field" class="'+(tp==='text'?'hidden':'')+'"><label class="form-label">驕ｸ謚櫁い・域隼陦後〒蛹ｺ蛻・▲縺ｦ蜈･蜉幢ｼ・/label><textarea id="sq-options" class="form-input" rows="4" placeholder="萓・&#10;邇牙・繧・#10;邯ｱ蠑輔″&#10;繝ｪ繝ｬ繝ｼ">'+esc(opts)+'</textarea></div><div class="flex gap-2 justify-end"><button onclick="closeModal()" class="border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button><button onclick="saveSurveyQuestion()" class="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-semibold">菫晏ｭ・/button></div></div>',[]);}
function toggleSurveyOptionsField(){const f=document.getElementById('sq-options-field');if(!f)return;f.classList.toggle('hidden',document.getElementById('sq-type').value==='text');}
function saveSurveyQuestion(){const text=document.getElementById('sq-text').value.trim();if(!text){toast('雉ｪ蝠乗枚繧貞・蜉帙＠縺ｦ縺上□縺輔＞','error');return;}const type=document.getElementById('sq-type').value;let options=null;if(type!=='text'){const raw=document.getElementById('sq-options').value.trim().split('\n').filter(s=>s.trim()).map(s=>s.trim());if(!raw.length){toast('驕ｸ謚櫁い繧貞・蜉帙＠縺ｦ縺上□縺輔＞','error');return;}options=raw;}const q={text,type,options};closeModal();if(editingSurveyQIndex>=0)surveyQuestions[editingSurveyQIndex]=q;else surveyQuestions.push(q);renderSurveyStep2();}
async function submitNewSurvey(){if(!surveyQuestions.length){toast('雉ｪ蝠上ｒ1縺､莉･荳願ｿｽ蜉縺励※縺上□縺輔＞','error');return;}try{await api('/api/surveys',{method:'POST',body:{title:surveyQuestions._title,description:surveyQuestions._desc||null,questions:surveyQuestions.map(q=>({text:q.text,type:q.type,options:q.options})),expires_at:surveyQuestions._expires||null,target:surveyQuestions._target||'all',target_value:surveyQuestions._targetValue||null}});closeModal();toast('繧｢繝ｳ繧ｱ繝ｼ繝医ｒ菴懈・縺励∪縺励◆・・,'success');loadSurveys('open');}catch(e){toast(e.message||'菴懈・螟ｱ謨・,'error');}}

// --- 繧｢繝ｳ繧ｱ繝ｼ繝亥屓遲費ｼ郁､・焚雉ｪ蝠丞ｯｾ蠢懶ｼ・---
async function openSurveyAnswer(sid){try{const r=await api('/api/surveys/'+sid);const s=r.survey;const qs=r.questions||[];const myAns={};(r.myAnswers||[]).forEach(a=>{try{myAns[a.question_id]=JSON.parse(a.answer);}catch{myAns[a.question_id]=a.answer;}});const qHtml=qs.map((q,i)=>renderSurveyQuestionAnswer(q,i,myAns[q.id])).join('');showModal(esc(s.title),(s.description?'<p class="text-sm text-gray-600 mb-3">'+esc(s.description)+'</p>':'')+'<div class="space-y-4" id="survey-answer-form">'+qHtml+'</div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'蝗樒ｭ斐ｒ騾∽ｿ｡',className:'bg-purple-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitSurveyAnswer(sid,qs)}]);}catch(e){toast('隱ｭ霎ｼ螟ｱ謨・,'error');}}
function renderSurveyQuestionAnswer(q,i,prev){if(q.question_type==='text'){return'<div class="card p-3"><p class="text-sm font-semibold mb-1">'+(i+1)+'. '+esc(q.question_text||q.text)+'</p><textarea class="form-input mt-1" rows="3" data-qid="'+q.id+'" placeholder="閾ｪ逕ｱ險倩ｿｰ">'+esc(prev||'')+'</textarea></div>';}const selected=prev?[].concat(prev):[];const inputType=q.question_type==='multiple'?'checkbox':'radio';const opts=typeof q.options==='string'?JSON.parse(q.options||'[]'):(q.options||[]);return'<div class="card p-3"><p class="text-sm font-semibold mb-2">'+(i+1)+'. '+esc(q.question_text||q.text)+'</p><div class="space-y-1.5">'+opts.map((o,j)=>{const checked=selected.includes(o);return'<label class="flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer hover:bg-purple-50 transition '+(checked?'border-purple-400 bg-purple-50':'')+'"><input type="'+inputType+'" name="sq-'+q.id+'" value="'+esc(o)+'" class="accent-purple-600" '+(checked?'checked':'')+'><span class="text-sm">'+esc(o)+'</span></label>';}).join('')+'</div></div>';}
async function submitSurveyAnswer(sid,qs){const answers=[];let valid=true;document.querySelectorAll('#survey-answer-form .card').forEach((card,i)=>{const q=qs[i];if(!q)return;if(q.question_type==='text'){const val=card.querySelector('textarea').value.trim();if(!val&&q.question_type==='text')valid=false;answers.push({question_id:q.id,answer:val||''});}else if(q.question_type==='multiple'){const vals=Array.from(card.querySelectorAll('input:checked')).map(inp=>inp.value);answers.push({question_id:q.id,answer:vals});}else{const sel=card.querySelector('input:checked');if(!sel)valid=false;else answers.push({question_id:q.id,answer:[sel.value]});}});if(!valid){toast('蜈ｨ縺ｦ縺ｮ雉ｪ蝠上↓蝗樒ｭ斐＠縺ｦ縺上□縺輔＞','error');return;}try{await api('/api/surveys/'+sid+'/answers',{method:'POST',body:{answers}});closeModal();toast('蝗樒ｭ斐ｒ騾∽ｿ｡縺励∪縺励◆・・,'success');loadSurveys('open');}catch(e){toast(e.message||'騾∽ｿ｡螟ｱ謨・,'error');}}

// --- 繧｢繝ｳ繧ｱ繝ｼ繝育ｵ先棡 ---
async function viewSurveyResult(sid){try{const r=await api('/api/surveys/'+sid+'/results');const s=r.survey;let html='<div class="text-sm text-gray-500 mb-3">邱丞屓遲碑・焚: <strong>'+r.totalRespondents+'</strong>莠ｺ</div>';(r.results||[]).forEach((res,i)=>{const q=res.question;html+='<div class="card p-3 mb-3"><p class="text-sm font-bold mb-2">'+(i+1)+'. '+esc(q.question_text||q.text)+'</p>';if(q.question_type==='text'){html+=(res.answers||[]).map(a=>'<div class="bg-gray-50 rounded-lg p-2 mb-1 text-sm"><div class="flex justify-between"><span class="font-semibold text-xs text-purple-700">'+esc(a.user_name||'')+'</span></div><span class="text-gray-600">'+esc(a.answer||'')+'</span></div>').join('')||'<p class="text-xs text-gray-400">蝗樒ｭ斐↑縺・/p>';}else{const total=res.total||1;html+=(res.answers||[]).map(a=>{const cnt=a.cnt;const p=((cnt/total)*100).toFixed(1);const votersHtml=a.voters&&a.voters.length?'<div class="mt-1 flex flex-wrap gap-1">'+a.voters.map(v=>'<span class="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">'+esc(v.user_name)+'</span>').join('')+'</div>':'';return'<div class="mb-2"><div class="flex justify-between text-sm mb-0.5"><span>'+esc(a.answer||'')+'</span><span class="text-gray-500">'+cnt+'莠ｺ ('+p+'%)</span></div><div class="w-full h-4 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-purple-500 rounded-full transition-all" style="width:'+p+'%"></div></div>'+votersHtml+'</div>';}).join('')||'<p class="text-xs text-gray-400">蝗樒ｭ斐↑縺・/p>';}html+='</div>';});showModal(esc(s.title)+' - 邨先棡','<div class="max-h-96 overflow-y-auto">'+html+'</div>',[{label:'髢峨§繧・,className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal}]);}catch(e){toast(e.message||'隱ｭ霎ｼ螟ｱ謨・,'error');}}

// === Consultation ===
function renderConsult(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-heart text-red-500"></i>逶ｸ隲・園</h2><button onclick="openConsultModal()" class="bg-red-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>逶ｸ隲・☆繧・/button></div><div class="p-3 space-y-3" id="consult-list"><div class="skeleton h-20"></div></div>';
  loadConsultations();
}

async function loadConsultations(){const c=document.getElementById('consult-list');if(!c)return;try{const r=await api('/api/questions/consultations');const isStaff=(currentUser.roles||[currentUser.role]).some(rr=>['admin','teacher'].includes(rr));if(!r.consultations.length){c.innerHTML='<div class="empty-state"><i class="fas fa-heart"></i><p>縺ｾ縺逶ｸ隲・・縺ゅｊ縺ｾ縺帙ｓ</p></div>';return;}c.innerHTML=r.consultations.map(cn=>'<div class="card p-4 mb-3"><div class="flex justify-between mb-2 text-xs text-gray-400"><span>'+(cn.student_name?esc(cn.student_name):'逕溷ｾ・)+' 竊・'+esc(cn.teacher_name||'蜈育函')+'</span><span>'+formatRelative(cn.created_at)+'</span></div><p class="text-gray-800 text-sm">'+esc(cn.content)+'</p>'+(cn.reply?'<div class="mt-2 pt-2 border-t border-red-100"><div class="flex items-center gap-2 text-xs text-red-500 mb-1"><i class="fas fa-reply"></i>蝗樒ｭ・/div><p class="text-sm text-gray-700 bg-red-50 rounded-lg p-3">'+esc(cn.reply)+'</p></div>':'')+(isStaff&&!cn.reply?'<div class="mt-2 pt-2 border-t"><textarea id="reply-'+cn.id+'" class="form-input text-sm" rows="2" placeholder="蝗樒ｭ斐ｒ蜈･蜉・></textarea><button onclick="replyConsult('+cn.id+')" class="mt-1 bg-red-500 text-white px-3 py-1 rounded-full text-xs"><i class="fas fa-reply mr-1"></i>蝗樒ｭ斐☆繧・/button></div>':'')+'</div>').join('');}catch{}}
async function replyConsult(cid){const el=document.getElementById('reply-'+cid);const reply=el?.value.trim();if(!reply){toast('蝗樒ｭ斐ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞','error');return;}try{await api('/api/questions/consultations/'+cid+'/reply',{method:'PUT',body:{reply}});toast('蝗樒ｭ斐ｒ騾∽ｿ｡縺励∪縺励◆','success');loadConsultations();}catch(e){toast(e.message||'騾∽ｿ｡螟ｱ謨・,'error');}}

async function openConsultModal(){try{const r=await api('/api/messages/users');const teachers=r.users.filter(u=>u.role==='teacher'||(u.role==='admin'));const opts=teachers.map(u=>'<option value="'+u.id+'">'+esc(u.name)+'</option>').join('');showModal('譁ｰ縺励＞逶ｸ隲・,'<div class="space-y-4"><div class="bg-red-50 rounded-lg p-3 text-sm text-red-700"><i class="fas fa-info-circle mr-1"></i>逶ｸ隲・＠縺溘＞蜈育函繧帝∈繧薙〒縲∝・螳ｹ繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲ょ・逕溘°繧峨・蝗樒ｭ斐・縺薙％縺ｫ陦ｨ遉ｺ縺輔ｌ縺ｾ縺吶・/div><div><label class="form-label">逶ｸ隲・☆繧句・逕・/label><select id="consult-teacher" class="form-input">'+opts+'</select></div><div><label class="form-label">蜀・ｮｹ</label><textarea id="consult-content" class="form-input" rows="4" placeholder="萓・ 騾ｲ霍ｯ縺ｫ縺､縺・※逶ｸ隲・′縺ゅｊ縺ｾ縺・.."></textarea></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'騾∽ｿ｡',className:'bg-red-500 text-white px-6 py-2 rounded-xl font-semibold',action:submitConsult}]);}catch{toast('隱ｭ霎ｼ螟ｱ謨・,'error');}}
async function submitConsult(){const teacherId=parseInt(document.getElementById('consult-teacher').value);const content=document.getElementById('consult-content').value.trim();if(!content){toast('蜀・ｮｹ繧貞・蜉帙＠縺ｦ縺上□縺輔＞','error');return;}try{await api('/api/questions/consultations',{method:'POST',body:{teacher_id:teacherId,content}});closeModal();toast('逶ｸ隲・ｒ騾∽ｿ｡縺励∪縺励◆','success');loadConsultations();}catch(e){toast(e.message||'騾∽ｿ｡螟ｱ謨・,'error');}}

// === HowTo ===
function renderHowTo(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-book text-green-600"></i>菴ｿ縺・婿</h2></div><div class="p-4 text-sm text-gray-600 space-y-4"><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-tablet-alt mr-2 text-blue-500"></i>蝓ｺ譛ｬ謫堺ｽ・/h3><ul class="list-disc ml-4 space-y-1"><li>荳矩Κ縺ｮ繧ｿ繝悶°繧牙推讖溯・縺ｫ遘ｻ蜍輔＠縺ｾ縺・/li><li>謗ｲ遉ｺ譚ｿ: 蜈ｨ譬｡縺ｫ謚慕ｨｿ縺ｧ縺阪∪縺呻ｼ亥・逕溘・縺ｿ・・/li><li>荳贋ｸｭ騾｣邨｡: 蜈育函縺九ｉ縺ｮ騾｣邨｡</li><li>蟋泌藤莨・ 蜷・ｧ泌藤莨壹・騾｣邨｡</li><li>驛ｨ豢ｻ蜍・ 蜷・Κ豢ｻ縺ｮ豢ｻ蜍募ｱ蜻・/li><li>繧｢繝ｳ繧ｱ繝ｼ繝・ 謚慕･ｨ繝ｻ髮・ｨ・/li></ul></div><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-file-upload mr-2 text-green-500"></i>繝輔ぃ繧､繝ｫ豺ｻ莉・/h3><p>謚慕ｨｿ菴懈・譎ゅ↓逕ｻ蜒上ｄPDF繧呈ｷｻ莉倥〒縺阪∪縺吶・/p></div><div class="card p-4"><h3 class="font-bold text-gray-800 mb-2"><i class="fas fa-clock mr-2 text-orange-500"></i>謚慕ｨｿ縺ｮ譛滄剞</h3><p>謚慕ｨｿ縺ｮ蜈ｬ髢区悄髢薙・譏取律縲懈怙螟ｧ2繝ｶ譛医〒縺吶・/p></div></div>';
}

// === Settings ===
function renderSettings(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-cog text-gray-600"></i>險ｭ螳・/h2></div><div class="p-4 space-y-4" id="settings-list"><div class="skeleton h-32"></div></div>';
  loadSettings();
}

async function loadPendingChangesStatus(){const c=document.getElementById('pending-changes-status');if(!c)return;try{const r=await api('/api/auth/profile/changes');const pending=r.requests.filter((x)=>x.status==='pending');const approved=r.requests.filter((x)=>x.status==='approved');if(!pending.length&&!approved.length)return;let h='<div class="text-xs space-y-1 mt-2 p-2 bg-gray-50 rounded-lg">';if(pending.length)h+='<p class="text-orange-600"><i class="fas fa-clock mr-1"></i>謇ｿ隱榊ｾ・■: '+pending.map((x)=>x.field_name).join('縲・)+'</p>';const seen=new Set();for(const a of approved){const fl={name:'蜷榊燕',grade:'蟄ｦ蟷ｴ',class_num:'繧ｯ繝ｩ繧ｹ',number:'逡ｪ蜿ｷ',club:'驛ｨ豢ｻ蜍・,committee:'蟋泌藤莨・}[a.field_name]||a.field_name;if(!seen.has(a.field_name)){seen.add(a.field_name);h+='<p class="text-green-600"><i class="fas fa-check-circle mr-1"></i>'+fl+'縺ｮ螟画峩縺梧価隱阪＆繧後∪縺励◆</p>';}}h+='</div>';c.innerHTML=h;}catch{}}

async function loadSettings(){const c=document.getElementById('settings-list');if(!c)return;try{const r=await api('/api/auth/profile');let inst='';if(deferredPrompt)inst='<button onclick="installPWA()" class="w-full text-center text-green-600 py-3 font-semibold"><i class="fas fa-download mr-2"></i>繧｢繝励Μ繧偵う繝ｳ繧ｹ繝医・繝ｫ</button>';const roles=currentUser.roles||[currentUser.role];const isStaff=roles.some(rr=>['admin','teacher'].includes(rr));const isAdmin=roles.includes('admin');c.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">繧｢繧ｫ繧ｦ繝ｳ繝域ュ蝣ｱ</h3><div class="space-y-3"><div class="flex justify-between items-center"><span class="text-sm text-gray-600">蜷榊燕</span><span class="text-sm font-semibold">'+esc(r.user.name)+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">繝ｭ繧ｰ繧､繝ｳID</span><span class="text-sm">'+esc(r.user.login_id||'-')+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">蟄ｦ蟷ｴ</span><span class="text-sm">'+esc(r.user.grade||'-')+'</span></div><div class="flex justify-between items-center"><span class="text-sm text-gray-600">繧ｯ繝ｩ繧ｹ</span><span class="text-sm">'+esc(r.user.class_num||'-')+'</span></div></div><div class="flex gap-2 mt-3"><button onclick="openProfileEdit()" class="text-blue-600 text-sm font-semibold"><i class="fas fa-edit mr-1"></i>繝励Ο繝輔ぅ繝ｼ繝ｫ邱ｨ髮・/button><button onclick="openPasswordChange()" class="text-orange-600 text-sm font-semibold"><i class="fas fa-key mr-1"></i>繝代せ繝ｯ繝ｼ繝牙､画峩</button></div>'+(isStaff?'':'<div id="pending-changes-status" class="mt-2"></div>')+'</div><div class="flex gap-2 mt-3"><button onclick="logout()" class="flex-1 text-center bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 transition"><i class="fas fa-sign-out-alt mr-2"></i>繝ｭ繧ｰ繧｢繧ｦ繝・/button>'+(isStaff?'<button onclick="renderAdmin(document.getElementById(\'tab-content\'))" class="flex-1 text-center bg-blue-50 text-blue-600 border border-blue-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-100 transition"><i class="fas fa-shield-alt mr-2"></i>邂｡逅・ヱ繝阪Ν</button>':'')+'</div></div><div class="card p-4"><h3 class="font-bold mb-3">騾夂衍險ｭ螳・/h3><div id="notif-settings-content"><div class="skeleton h-12"></div></div></div><div class="card p-4"><h3 class="font-bold mb-3 text-green-700"><i class="fas fa-book mr-2"></i>菴ｿ縺・婿</h3><div class="text-sm text-gray-600 space-y-3"><div><h4 class="font-bold text-gray-700 mb-1">蝓ｺ譛ｬ謫堺ｽ・/h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>荳矩Κ縺ｮ繧ｿ繝悶°繧牙推讖溯・縺ｫ遘ｻ蜍輔＠縺ｾ縺・/li><li>繧ｿ繝悶ｒ髟ｷ謚ｼ縺暦ｼ医∪縺溘・蜿ｳ繧ｯ繝ｪ繝・け・峨〒繧ｷ繝ｧ繝ｼ繝医き繝・ヨ繝｡繝九Η繝ｼ縺碁幕縺阪∪縺・/li><li>蜷・判髱｢縺ｯ繝励Ν繝繧ｦ繝ｳ・亥ｼ輔▲蠑ｵ縺｣縺ｦ譖ｴ譁ｰ・峨↓蟇ｾ蠢懊＠縺ｦ縺・∪縺・/li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">蜷・ｩ溯・縺ｮ隱ｬ譏・/h4><ul class="list-disc ml-4 space-y-1 text-xs"><li><b>謗ｲ遉ｺ譚ｿ</b>: 蟄ｦ譬｡蜈ｨ菴薙↓蜷代￠縺滄｣邨｡繧呈兜遞ｿ縺ｧ縺阪∪縺呻ｼ亥・逕溘・縺ｿ謚慕ｨｿ蜿ｯ縲∝・蜩｡髢ｲ隕ｧ蜿ｯ・・/li><li><b>荳贋ｸｭ騾｣邨｡</b>: 蜈育函縺九ｉ逕溷ｾ偵∈縺ｮ縺顔衍繧峨○繧定｡ｨ遉ｺ縺励∪縺・/li><li><b>繧ｯ繝ｩ繧ｹ</b>: 閾ｪ蛻・・繧ｯ繝ｩ繧ｹ蟆ら畑縺ｮ謗ｲ遉ｺ譚ｿ縺ｧ縺吶ゅけ繝ｩ繧ｹ繝｡繧､繝亥酔螢ｫ縺ｧ騾｣邨｡繧貞叙繧雁粋縺医∪縺・/li><li><b>蟋泌藤莨・/b>: 閾ｪ蛻・・蟋泌藤莨壹・繝｡繝ｳ繝舌・蟆ら畑縺ｮ騾｣邨｡繧ｹ繝壹・繧ｹ縺ｧ縺吶ょｧ泌藤髟ｷ繝ｻ蜑ｯ蟋泌藤髟ｷ縺ｮ縺ｿ謚慕ｨｿ蜿ｯ</li><li><b>驛ｨ豢ｻ蜍・/b>: 蜷・Κ豢ｻ縺ｮ豢ｻ蜍募ｱ蜻翫ｄ騾｣邨｡逕ｨ繧ｹ繝壹・繧ｹ縺ｧ縺吶るΚ髟ｷ繝ｻ蜑ｯ驛ｨ髟ｷ縺ｮ縺ｿ謚慕ｨｿ蜿ｯ</li><li><b>繧｢繝ｳ繧ｱ繝ｼ繝・/b>: 謚慕･ｨ繧・寔險医′陦後∴縺ｾ縺・/li><li><b>蠢倥ｌ迚ｩ</b>: 關ｽ縺ｨ縺礼黄繝ｻ蠢倥ｌ迚ｩ縺ｮ諠・ｱ繧貞・譛峨〒縺阪∪縺・/li><li><b>繝｡繝・そ繝ｼ繧ｸ</b>: 蛟倶ｺｺ髢薙ｄ繧ｰ繝ｫ繝ｼ繝励〒縺ｮ繝√Ε繝・ヨ縺瑚｡後∴縺ｾ縺・/li><li><b>驛ｨ髟ｷ繝√Ε繝・ヨ</b>: 驛ｨ髟ｷ繝ｻ蟋泌藤髟ｷ蟆ら畑縺ｮ騾｣邨｡繝√Ε繝・ヨ縺ｧ縺・/li><li><b>逶ｸ隲・園</b>: 蛹ｿ蜷阪〒逶ｸ隲・ｒ謚慕ｨｿ縺ｧ縺阪∪縺・/li><li><b>菴楢ご轤ｹ讀・/b>: 菴楢ご蟋泌藤莨壹Γ繝ｳ繝舌・蟆ら畑縺ｮ轤ｹ讀懊ヤ繝ｼ繝ｫ縺ｧ縺・/li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">謚慕ｨｿ縺ｫ縺､縺・※</h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>謚慕ｨｿ菴懈・譎ゅ↓逕ｻ蜒擾ｼ・PG/PNG・峨ｄPDF繝輔ぃ繧､繝ｫ繧呈ｷｻ莉倥〒縺阪∪縺呻ｼ域怙螟ｧ10MB・・/li><li>謚慕ｨｿ縺ｮ蜈ｬ髢区悄髢薙・縲梧・譌･縲懈怙螟ｧ2繝ｶ譛医阪°繧蛾∈謚槭〒縺阪∪縺・/li><li>閾ｪ蛻・・謚慕ｨｿ縺ｯ蜑企勁繝懊ち繝ｳ縺九ｉ蜑企勁縺ｧ縺阪∪縺・/li><li>荳埼←蛻・↑謚慕ｨｿ繧定ｦ九▽縺代◆蝣ｴ蜷医・蜈育函縺ｫ蝣ｱ蜻翫＠縺ｦ縺上□縺輔＞</li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">騾夂衍縺ｫ縺､縺・※</h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>險ｭ螳夂判髱｢縺九ｉ蜿励￠蜿悶ｋ騾夂衍縺ｮ遞ｮ鬘槭ｒ繧ｪ繝ｳ/繧ｪ繝輔〒縺阪∪縺・/li><li>繝励ャ繧ｷ繝･騾夂衍繧偵が繝ｳ縺ｫ縺吶ｋ縺ｨ縲∵眠縺励＞謚慕ｨｿ繧・Γ繝・そ繝ｼ繧ｸ縺悟ｱ翫＞縺滓凾縺ｫ繝悶Λ繧ｦ繧ｶ騾夂衍縺瑚｡ｨ遉ｺ縺輔ｌ縺ｾ縺・/li><li>閾ｪ蛻・夂衍讖溯・繧剃ｽｿ縺・→縲∵欠螳壹＠縺滓律譎ゅ↓閾ｪ蛻・ｮ帙※縺ｮ騾夂衍繧剃ｽ懈・縺ｧ縺阪∪縺呻ｼ医Μ繝槭う繝ｳ繝繝ｼ縺ｨ縺励※豢ｻ逕ｨ・・/li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">繝励Ο繝輔ぅ繝ｼ繝ｫ繝ｻ繧｢繧ｫ繧ｦ繝ｳ繝・/h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>繝励Ο繝輔ぅ繝ｼ繝ｫ邱ｨ髮・〒蜷榊燕繝ｻ驛ｨ豢ｻ蜍輔・蟋泌藤莨壹・閾ｪ蟾ｱ邏ｹ莉九・繧｢繝舌ち繝ｼ蜀咏悄繧貞､画峩縺ｧ縺阪∪縺・/li><li>逕溷ｾ偵・蝣ｴ蜷医∝錐蜑阪・蟄ｦ蟷ｴ繝ｻ繧ｯ繝ｩ繧ｹ繝ｻ逡ｪ蜿ｷ繝ｻ驛ｨ豢ｻ蜍輔・蟋泌藤莨壹・螟画峩縺ｯ蜈育函縺ｮ謇ｿ隱阪′蠢・ｦ√〒縺・/li><li>繝代せ繝ｯ繝ｼ繝峨・險ｭ螳夂判髱｢縺九ｉ螟画峩縺ｧ縺阪∪縺・/li><li>繝ｭ繧ｰ繧､繝ｳID縺ｯ螟画峩縺ｧ縺阪∪縺帙ｓ</li></ul></div><div><h4 class="font-bold text-gray-700 mb-1">PWA・医い繝励Μ縺ｨ縺励※菴ｿ縺・ｼ・/h4><ul class="list-disc ml-4 space-y-1 text-xs"><li>蟇ｾ蠢懊ヶ繝ｩ繧ｦ繧ｶ縺ｧ縺ｯ縲後い繝励Μ繧偵う繝ｳ繧ｹ繝医・繝ｫ縲阪・繧ｿ繝ｳ縺九ｉ繝帙・繝逕ｻ髱｢縺ｫ霑ｽ蜉縺ｧ縺阪∪縺・/li><li>繧､繝ｳ繧ｹ繝医・繝ｫ縺吶ｋ縺ｨ繧ｪ繝輔Λ繧､繝ｳ縺ｧ繧ゆｸ驛ｨ縺ｮ讖溯・縺御ｽｿ縺医∪縺・/li><li>繝励ャ繧ｷ繝･騾夂衍繧貞女縺大叙繧九↓縺ｯ縲√ヶ繝ｩ繧ｦ繧ｶ縺ｮ險ｱ蜿ｯ險ｭ螳壹ｒ繧ｪ繝ｳ縺ｫ縺励※縺上□縺輔＞</li></ul></div></div></div>'+(isStaff?'<div class="card p-4"><h3 class="font-bold mb-3">邂｡逅・ｨｭ螳・/h3><div id="admin-settings-content"><div class="skeleton h-12"></div></div></div>':'')+inst+'<div class="flex items-center justify-center gap-3 py-4"><span class="text-xs text-gray-400">荳贋ｸｭ鮟呈攸 v3.0</span><button onclick="forceUpdate()" class="text-xs text-blue-600 hover:underline"><i class="fas fa-sync-alt mr-1"></i>繧｢繝・・繝・・繝・/button></div>';loadNotifSettings();if(isStaff)loadAdminSettings();if(!isStaff)loadPendingChangesStatus();}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}

async function loadAdminSettings(){const c=document.getElementById('admin-settings-content');if(!c)return;try{const r=await api('/api/admin/settings');const s=r.settings;const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');c.innerHTML='<div class="space-y-2">'+[['teacher_can_users','蜈育函縺後Θ繝ｼ繧ｶ繝ｼ邂｡逅・ｒ陦ｨ遉ｺ'],['teacher_can_posts','蜈育函縺梧兜遞ｿ邂｡逅・ｒ陦ｨ遉ｺ'],['teacher_can_bulk','蜈育函縺御ｸ諡ｬ逕滓・繧定｡ｨ遉ｺ'],['notif_self_default','閾ｪ蛻・夂衍繧呈ｨ呎ｺ悶〒譛牙柑']].map(([k,lb])=>{const on=s[k]==='true';const disabled=!isAdmin&&k.startsWith('teacher_');return'<div class="flex items-center justify-between"><span class="text-sm '+(disabled?'text-gray-400':'text-gray-700')+'">'+lb+'</span><div class="toggle'+(on?' on':'')+(disabled?' opacity-50 cursor-not-allowed':'')+'" '+(disabled?'':'onclick="toggleAdminSetting(\''+k+'\',this)"')+'></div></div>';}).join('')+'</div>'+(isAdmin?'<div class="mt-3 pt-3 border-t"><label class="form-label">繝励Ο繝輔ぅ繝ｼ繝ｫ螟画峩譛滄剞</label><input id="setting-deadline" type="datetime-local" class="form-input mt-1" value="'+(s.allow_changes_until?s.allow_changes_until.slice(0,16):'')+'"><button onclick="saveDeadline()" class="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs"><i class="fas fa-save mr-1"></i>菫晏ｭ・/button><p class="text-xs text-gray-400 mt-1">遨ｺ谺・= 譛滄剞縺ｪ縺暦ｼ亥ｸｸ譎ょ､画峩蜿ｯ・・/p></div>':'')+'<p class="text-xs text-gray-400 mt-2">窶ｻ蜈育函縺ｮ讓ｩ髯占ｨｭ螳壹・邂｡逅・・・縺ｿ螟画峩縺ｧ縺阪∪縺・/p>';}catch{c.innerHTML='<p class="text-sm text-gray-400">隱ｭ霎ｼ螟ｱ謨・/p>';}}

async function saveDeadline(){const v=document.getElementById('setting-deadline').value;try{await api('/api/admin/settings',{method:'PUT',body:{settings:{allow_changes_until:v?new Date(v).toISOString():''}}});toast('菫晏ｭ倥＠縺ｾ縺励◆','success');}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function toggleAdminSetting(key,el){try{await api('/api/admin/settings',{method:'PUT',body:{settings:{[key]:!el.classList.contains('on')?true:false}}});el.classList.toggle('on');toast('譖ｴ譁ｰ縺励∪縺励◆','success');}catch(e){toast('螟ｱ謨・,'error');}}

async function loadNotifSettings(){const c=document.getElementById('notif-settings-content');if(!c)return;try{const ns=await api('/api/auth/notification-settings');c.innerHTML='<div class="space-y-2">'+['push_enabled','disaster_enabled','club_post_enabled','committee_post_enabled','school_notice_enabled','message_enabled'].map(k=>{const lb={'push_enabled':'繝励ャ繧ｷ繝･騾夂衍','disaster_enabled':'髦ｲ轣ｽ諠・ｱ','club_post_enabled':'驛ｨ豢ｻ謚慕ｨｿ','committee_post_enabled':'蟋泌藤莨壽兜遞ｿ','school_notice_enabled':'荳贋ｸｭ騾｣邨｡','message_enabled':'繝｡繝・そ繝ｼ繧ｸ'}[k];const on=ns[k]===1||ns[k]===true;return'<div class="flex items-center justify-between"><span class="text-sm text-gray-700">'+lb+'</span><div class="toggle'+(on?' on':'')+'" onclick="toggleNotifSetting(\''+k+'\',this)"></div></div>';}).join('')+'</div>'+(ns.push_enabled?'<button onclick="testPush()" class="mt-2 w-full bg-blue-50 text-blue-600 border border-blue-200 py-2 rounded-xl text-sm font-semibold hover:bg-blue-100"><i class="fas fa-paper-plane mr-1"></i>繝・せ繝磯夂衍繧帝∽ｿ｡</button>':'');}catch{c.innerHTML='<p class="text-sm text-gray-400">隱ｭ霎ｼ螟ｱ謨・/p>';}}

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
  try{await api('/api/auth/notification-settings',{method:'PUT',body:{[key]:!el.classList.contains('on')}});el.classList.toggle('on');toast('譖ｴ譁ｰ縺励∪縺励◆','success');}catch(e){toast('螟ｱ謨・,'error');}
}

function installPWA(){if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt.userChoice.then(()=>{deferredPrompt=null;loadSettings();});}

function openProfileEdit(){const u=currentUser;const isStaff=(u.roles||[u.role]).some(r=>['admin','teacher'].includes(r));const pendingFields=isStaff?'':'(螟画峩縺ｫ縺ｯ謇ｿ隱阪′蠢・ｦ√〒縺・';const clubVal=normClub(u.club);showModal('繝励Ο繝輔ぅ繝ｼ繝ｫ邱ｨ髮・,'<div class="space-y-3"><div><label class="form-label">蜷榊燕 '+pendingFields+'</label><input id="pe-name" type="text" class="form-input" value="'+esc(u.name)+'"></div><div><label class="form-label">驛ｨ豢ｻ蜍・/label><select id="pe-club" class="form-input"><option value="">縺ｪ縺・/option>'+CLUBS.map(c=>'<option value="'+c+'"'+(clubVal===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div><div><label class="form-label">蟋泌藤莨・/label><select id="pe-committee" class="form-input"><option value="">縺ｪ縺・/option>'+COMMITTEES.map(c=>'<option value="'+c+'"'+(u.committee===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div><div><label class="form-label">繝励Ο繝輔ぅ繝ｼ繝ｫ逕ｻ蜒・/label><div class="flex items-center gap-3"><div class="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border" id="avatar-preview">'+(u.avatar_url?'<img src="'+esc(u.avatar_url)+'" class="w-full h-full object-cover">':'<i class="fas fa-user text-gray-400 text-2xl"></i>')+'</div><div><label class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm cursor-pointer"><i class="fas fa-camera mr-1"></i>蜀咏悄繧帝∈謚・input type="file" accept="image/*" class="hidden" onchange="uploadAvatar(this)"></label></div></div></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'菫晏ｭ・,className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitProfileEdit}]);}

async function uploadAvatar(input){const file=input.files[0];if(!file)return;if(file.size>5*1024*1024){toast('5MB莉･荳九・逕ｻ蜒上ｒ驕ｸ謚・,'error');return;}const fd=new FormData();fd.append('file',file);try{const r=await api('/api/upload',{method:'POST',body:fd});const preview=document.getElementById('avatar-preview');if(preview)preview.innerHTML='<img src="'+r.url+'" class="w-full h-full object-cover">';currentUser.avatar_url=r.url;toast('繧｢繝・・繝ｭ繝ｼ繝牙ｮ御ｺ・,'success');}catch(e){toast(e.message||'繧｢繝・・繝ｭ繝ｼ繝牙､ｱ謨・,'error');}}

function openPasswordChange(){showModal('繝代せ繝ｯ繝ｼ繝牙､画峩','<div class="space-y-3"><div><label class="form-label">迴ｾ蝨ｨ縺ｮ繝代せ繝ｯ繝ｼ繝・/label><input id="pw-current" type="password" class="form-input"></div><div><label class="form-label">譁ｰ縺励＞繝代せ繝ｯ繝ｼ繝・/label><input id="pw-new" type="password" class="form-input"></div><div><label class="form-label">譁ｰ縺励＞繝代せ繝ｯ繝ｼ繝会ｼ育｢ｺ隱搾ｼ・/label><input id="pw-confirm" type="password" class="form-input"></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'螟画峩',className:'bg-orange-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitPasswordChange}]);}
async function submitPasswordChange(){const cur=document.getElementById('pw-current').value;const nw=document.getElementById('pw-new').value;const cf=document.getElementById('pw-confirm').value;if(!cur||!nw){toast('縺吶∋縺ｦ蜈･蜉帙＠縺ｦ縺上□縺輔＞','error');return;}if(nw!==cf){toast('譁ｰ縺励＞繝代せ繝ｯ繝ｼ繝峨′荳閾ｴ縺励∪縺帙ｓ','error');return;}try{await api('/api/auth/password',{method:'POST',body:{current_password:cur,new_password:nw}});closeModal();toast('螟画峩縺励∪縺励◆','success');}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function submitProfileEdit(){try{const name=document.getElementById('pe-name').value.trim();if(!name){toast('蜷榊燕縺ｯ蠢・・,'error');return;}const body={name,club:document.getElementById('pe-club').value.trim()||null,committee:document.getElementById('pe-committee').value.trim()||null,avatar_url:currentUser.avatar_url||null};const r=await api('/api/auth/profile',{method:'PUT',body});closeModal();if(r.pending){toast('螟画峩繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ騾∽ｿ｡縺励∪縺励◆・域価隱榊ｾ・■・・,'info');}else{toast('菫晏ｭ倥＠縺ｾ縺励◆','success');}loadSettings();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

// === PE Checklist ===
function renderPEChecklist(container) {
  window._peActive='pe_checklist';
  var roles=currentUser.roles||[currentUser.role];
  var isManager=roles.some(function(r){return ['admin','teacher','chairman','vice_chairman'].indexOf(r)>=0});
  var navDiv=document.createElement('div');
  navDiv.style.cssText='display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap';
  navDiv.innerHTML='<button class="sub-nav-btn active" data-pechecktab="check">轤ｹ讀・/button><button class="sub-nav-btn" data-pechecktab="history">螻･豁ｴ</button><button class="sub-nav-btn" data-pechecktab="rentals">雋ｸ蜃ｺ</button>'+(isManager?'<button class="sub-nav-btn" data-pechecktab="manage" style="margin-left:auto">笞咏ｮ｡逅・/button>':'');
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

async function loadPEChecklist(){var c=document.getElementById('pe-checklist-content');if(!c)return;try{var r=await api('/api/checklist/items');if(!r.items||!r.items.length){c.innerHTML='<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-inbox" style="font-size:48px;margin-bottom:12px;display:block"></i><p>点検項目がありません。管理タブから追加してください</p></div>';return;}var total=r.items.length,ok=[],ng=[],uncheck=[];for(var i=0;i<total;i++){var st=r.items[i].status;if(st==='ok')ok.push(r.items[i]);else if(st==='ng')ng.push(r.items[i]);else uncheck.push(r.items[i]);}var items=[].concat(uncheck,ng,ok);var done=ok.length+ng.length,pct=total?Math.round(done/total*100):0;var h='<div style="background:white;border-radius:14px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08)"><div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><span style="font-size:12px;padding:3px 10px;border-radius:99px;background:#dcfce7;color:#16a34a;font-weight:600">✔ OK '+ok.length+'</span><span style="font-size:12px;padding:3px 10px;border-radius:99px;background:#fef2f2;color:#dc2626;font-weight:600">✗ NG '+ng.length+'</span><span style="font-size:12px;padding:3px 10px;border-radius:99px;background:#f3f4f6;color:#6b7280;font-weight:600">─ 未 '+uncheck.length+'</span></div><div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:4px"><span>点検進捗</span><span>完了 '+done+'/'+total+' ('+pct+'%)</span></div><div style="background:#e5e7eb;border-radius:99px;height:8px;overflow:hidden"><div style="background:#22c55e;width:'+pct+'%;height:100%;border-radius:99px;transition:width 0.3s"></div></div></div>';h+='<div style="display:flex;flex-direction:column;gap:8px">';for(var i=0;i<items.length;i++){var it=items[i];var s=it.status==='ok'?'✔ OK':it.status==='ng'?'✗ NG':'──';var sc=it.status==='ok'?'#16a34a':it.status==='ng'?'#dc2626':'#d1d5db';var bg=it.status==='ok'?'#f0fdf4':it.status==='ng'?'#fef2f2':'#ffffff';var bc=it.status==='ok'?'#bbf7d0':it.status==='ng'?'#fecaca':'#e5e7eb';var avail=it.total_count-(it.active_rentals||0);var lastInfo=it.last_checked?'<span style="font-size:11px;color:#9ca3af">'+esc(it.last_checker||'')+' | '+formatRelative(it.last_checked)+'</span>':'';h+='<div style="background:'+bg+';border:1px solid '+bc+';border-left:4px solid '+sc+';border-radius:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px"><div><span style="font-weight:bold;font-size:14px;color:#1f2937">'+esc(it.name)+'</span>'+(it.location?'<span style="font-size:11px;color:#9ca3af;margin-left:6px">📍'+esc(it.location)+'</span>':'')+'</div><span style="font-size:11px;padding:2px 10px;border-radius:99px;background:'+sc+';color:white;font-weight:600">'+s+'</span></div><div style="display:flex;gap:12px;font-size:12px;color:#6b7280;margin-bottom:8px;flex-wrap:wrap"><span>📦総数 '+it.total_count+'</span><span>📤貸出中 '+(it.active_rentals||0)+'</span><span>📥残り '+avail+'</span></div>'+lastInfo+'<div style="margin-top:8px;display:flex;gap:6px">'+(it.can_check?'<button onclick="checkPEItem('+it.id+',\'ok\')" style="flex:1;padding:6px 0;border:1px solid #22c55e;border-radius:8px;background:white;color:#16a34a;font-size:12px;font-weight:600;cursor:pointer">✔ OK</button><button onclick="checkPEItem('+it.id+',\'ng\')" style="flex:1;padding:6px 0;border:1px solid #ef4444;border-radius:8px;background:white;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer">✗ NG</button>':'<span style="font-size:11px;color:#9ca3af">点検は体育委員専用</span>')+'</div></div>';}h+='</div>';c.innerHTML=h;}catch{c.innerHTML='<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:12px;display:block"></i><p>読込失敗</p></div>';}}

async function checkPEItem(id,status){try{await api('/api/checklist/items/'+id+'/check',{method:'POST',body:{status}});toast('險倬鹸縺励∪縺励◆','success');loadPEChecklist();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function loadPEManage(){var c=document.getElementById('pe-checklist-content');if(!c)return;try{var r=await api('/api/checklist/items');var h='<div style="margin-bottom:12px"><button class="pe-add-item-btn" style="background:#2d6a4f;color:white;padding:6px 16px;border:none;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer"><i class="fas fa-plus" style="margin-right:4px"></i>鬆・岼繧定ｿｽ蜉</button></div>';if(!r.items||!r.items.length){c.innerHTML=h+'<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-inbox" style="font-size:48px;margin-bottom:12px;display:block"></i><p>鬆・岼縺後≠繧翫∪縺帙ｓ</p></div>';}else{h+='<div style="display:flex;flex-direction:column;gap:8px">';for(var i=0;i<r.items.length;i++){var it=r.items[i];h+='<div class="pe-manage-row" data-id="'+it.id+'" data-name="'+esc(it.name)+'" data-total="'+it.total_count+'" style="display:flex;align-items:center;justify-content:space-between;background:white;border-radius:14px;padding:12px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><div><span style="font-weight:600;font-size:14px">'+esc(it.name)+'</span><span style="font-size:12px;color:#95a5a6;margin-left:8px">邱乗焚: '+it.total_count+'</span></div><div style="display:flex;gap:4px"><button class="pe-edit-item-btn" style="background:#2563eb;color:white;padding:4px 10px;border:none;border-radius:99px;font-size:11px;cursor:pointer">邱ｨ髮・/button><button class="pe-del-item-btn" style="background:#ef4444;color:white;padding:4px 10px;border:none;border-radius:99px;font-size:11px;cursor:pointer">蜑企勁</button></div></div>';}h+='</div>';c.innerHTML=h;}c.onclick=function(e){var add=e.target.closest('.pe-add-item-btn');if(add){openPEAddItem();return;}var edit=e.target.closest('.pe-edit-item-btn');if(edit){var row=edit.closest('.pe-manage-row');if(row)openPEAddItem(parseInt(row.getAttribute('data-id')),row.getAttribute('data-name'),parseInt(row.getAttribute('data-total')));return;}var del=e.target.closest('.pe-del-item-btn');if(del){var row2=del.closest('.pe-manage-row');if(row2)deletePEItem(parseInt(row2.getAttribute('data-id')));return;}}; }catch{c.innerHTML='<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:12px;display:block"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}

function openPEAddItem(id,name,total){if(id){showModal('鬆・岼邱ｨ髮・,'<div class="space-y-4"><div><label class="form-label" style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">蜷榊燕</label><input id="pe-item-name" type="text" class="form-input" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px" value="'+esc(name||'')+'"></div><div><label class="form-label" style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">邱乗焚</label><input id="pe-item-total" type="number" class="form-input" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px" value="'+(total||1)+'" min="1"></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'菫晏ｭ・,className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:function(){submitPEItem(id)}}]);}else{showModal('鬆・岼霑ｽ蜉','<div class="space-y-4"><div><label class="form-label" style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">蜷榊燕</label><input id="pe-item-name" type="text" class="form-input" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px" placeholder="萓・ 繝舌Ξ繝ｼ繝懊・繝ｫ"></div><div><label class="form-label" style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px">邱乗焚</label><input id="pe-item-total" type="number" class="form-input" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px" value="1" min="1"></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'霑ｽ蜉',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:function(){submitPEItem(null)}}]);}}

async function submitPEItem(id){var nm=document.getElementById('pe-item-name')?.value.trim();var tl=parseInt(document.getElementById('pe-item-total')?.value)||1;if(!nm){toast('蜷榊燕縺悟ｿ・ｦ√〒縺・,'error');return;}try{if(id){await api('/api/checklist/items/'+id,{method:'PUT',body:{name:nm,total_count:tl}});toast('菫晏ｭ倥＠縺ｾ縺励◆','success');}else{await api('/api/checklist/items',{method:'POST',body:{name:nm,total_count:tl}});toast('霑ｽ蜉縺励∪縺励◆','success');}closeModal();loadPEManage();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function deletePEItem(id){if(!confirm('蜑企勁縺励∪縺吶°・・))return;try{await api('/api/checklist/items/'+id,{method:'DELETE'});toast('蜑企勁縺励∪縺励◆','success');loadPEManage();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function loadPEChecklistHistory(){var c=document.getElementById('pe-checklist-content');if(!c)return;try{var r=await api('/api/checklist/history');if(!r.history||!r.history.length){c.innerHTML='<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-history" style="font-size:48px;margin-bottom:12px;display:block"></i><p>螻･豁ｴ縺ｪ縺・/p></div>';return;}c.innerHTML='<div style="display:flex;flex-direction:column;gap:8px">'+r.history.map(function(h){return '<div style="background:white;border-radius:14px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center"><div><span style="font-size:14px;font-weight:600">'+esc(h.item_name)+'</span><span style="font-size:12px;color:#95a5a6;margin-left:8px">'+esc(h.checker_name)+'</span></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;'+(h.status==='ok'?'color:green':'color:red')+'">'+h.status.toUpperCase()+'</span><span style="font-size:12px;color:#95a5a6">'+formatRelative(h.created_at)+'</span></div></div>';}).join('')+'</div>';c.onclick=null;}catch{}}

async function loadPERentals(){var c=document.getElementById('pe-checklist-content');if(!c)return;try{var r=await api('/api/checklist/rentals');var h='<div style="margin-bottom:12px"><button onclick="openRentalModal()" style="background:#2563eb;color:white;padding:6px 16px;border:none;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer"><i class="fas fa-plus" style="margin-right:4px"></i>雋ｸ蜃ｺ逋ｻ骭ｲ</button></div>';if(!r.rentals||!r.rentals.length){c.innerHTML=h+'<div class="empty-state" style="text-align:center;padding:48px 24px;color:#95a5a6"><i class="fas fa-box" style="font-size:48px;margin-bottom:12px;display:block"></i><p>雋ｸ蜃ｺ螻･豁ｴ縺ｪ縺・/p></div>';return;}h+='<div style="display:flex;flex-direction:column;gap:8px">'+r.rentals.map(function(rn){var avail=rn.total_count-rn.active_rentals;return '<div style="background:white;border-radius:14px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><div style="display:flex;justify-content:space-between"><span style="font-weight:600;font-size:14px">'+esc(rn.item_name)+'</span><span style="font-size:12px;'+(rn.returned_at?'color:green':'color:#ca8a04')+'">'+(rn.returned_at?'霑泌唆貂・:'雋ｸ蜃ｺ荳ｭ')+'</span></div><p style="font-size:12px;color:#95a5a6">蛟・ '+esc(rn.borrower_name)+' | '+formatRelative(rn.borrowed_at)+'</p><p style="font-size:11px;color:#6b7280;margin-bottom:4px"><span>邱乗焚 '+rn.total_count+'</span> | <span>雋ｸ蜃ｺ荳ｭ '+rn.active_rentals+'</span> | <span>谿九ｊ '+avail+'</span></p>'+(rn.notes?'<p style="font-size:12px;color:#95a5a6;margin-top:4px">'+esc(rn.notes)+'</p>':'')+(!rn.returned_at?'<button class="pe-return-btn" data-id="'+rn.id+'" style="color:#2563eb;font-size:12px;margin-top:8px;background:none;border:none;cursor:pointer;text-decoration:underline">霑泌唆</button>':'<p style="font-size:12px;color:#95a5a6;margin-top:4px">霑泌唆: '+formatRelative(rn.returned_at)+'</p>')+'</div>';}).join('')+'</div>';c.innerHTML=h;c.onclick=function(e){var ret=e.target.closest('.pe-return-btn');if(ret){returnRental(parseInt(ret.getAttribute('data-id')));}};}catch{}}

async function openRentalModal(){try{const items=await api('/api/checklist/items');const users=await api('/api/messages/users');const iop=items.items.map(i=>'<option value="'+i.id+'">'+esc(i.name)+'</option>').join('');const uop=users.users.filter(function(u){return u.role==='student';}).map(u=>'<option value="'+u.id+'">'+esc(u.name)+'</option>').join('');showModal('雋ｸ蜃ｺ逋ｻ骭ｲ','<div class="space-y-4"><div><label class="form-label">蛯吝刀</label><select id="rental-item" class="form-input">'+iop+'</select></div><div><label class="form-label">蛟溘ｊ繧倶ｺｺ</label><select id="rental-borrower" class="form-input">'+uop+'</select></div><div><label class="form-label">繝｡繝｢・井ｻｻ諢擾ｼ・/label><input id="rental-notes" type="text" class="form-input"></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'逋ｻ骭ｲ',className:'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitRental}]);}catch(e){toast('隱ｭ霎ｼ螟ｱ謨・,'error');}}

async function submitRental(){const i=parseInt(document.getElementById('rental-item').value);const b=parseInt(document.getElementById('rental-borrower').value);const n=document.getElementById('rental-notes').value.trim()||null;try{await api('/api/checklist/rentals',{method:'POST',body:{item_id:i,borrower_id:b,notes:n}});closeModal();toast('逋ｻ骭ｲ縺励∪縺励◆','success');loadPERentals();}catch(e){toast(e.message||'逋ｻ骭ｲ螟ｱ謨・,'error');}}
async function returnRental(id){if(!confirm('霑泌唆縺励∪縺吶°・・))return;try{await api('/api/checklist/rentals/'+id+'/return',{method:'POST'});toast('霑泌唆縺励∪縺励◆','success');loadPERentals();}catch(e){toast('霑泌唆螟ｱ謨・,'error');}}

// === Admin ===
function renderAdmin(container) {
  const roles=currentUser.roles||[currentUser.role];
  const isAdmin=roles.includes('admin');
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  if(!isStaff){container.innerHTML='<div class="empty-state"><i class="fas fa-lock"></i><p>邂｡逅・・・縺ｿ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ</p></div>';return;}
  if(isAdmin){renderAdminFull(container);}else{renderAdminTeacher(container);}
}

async function renderAdminTeacher(container){
  try{const sr=await api('/api/admin/settings');const s=sr.settings||{};let tabs='<button onclick="switchAdminTab(\'roles\',this)" class="sub-nav-btn active">讓ｩ髯千ｮ｡逅・/button><button onclick="switchAdminTab(\'tokens\',this)" class="sub-nav-btn">諡帛ｾ・さ繝ｼ繝・/button><button onclick="switchAdminTab(\'profile\',this)" class="sub-nav-btn">謇ｿ隱榊ｾ・■</button><button onclick="switchAdminTab(\'stats\',this)" class="sub-nav-btn">邨ｱ險・/button><button onclick="switchAdminTab(\'diag\',this)" class="sub-nav-btn">險ｺ譁ｭ</button>';if(s.teacher_can_users==='true')tabs+='<button onclick="switchAdminTab(\'users\',this)" class="sub-nav-btn">繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・/button>';if(s.teacher_can_posts==='true')tabs+='<button onclick="switchAdminTab(\'posts\',this)" class="sub-nav-btn">謚慕ｨｿ邂｡逅・/button>';if(s.teacher_can_bulk==='true')tabs+='<button onclick="switchAdminTab(\'bulk\',this)" class="sub-nav-btn">荳諡ｬ逕滓・</button>';container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-shield-alt text-red-600"></i>邂｡逅・/h2></div><div class="p-4 space-y-4"><div class="flex flex-wrap gap-2">'+tabs+'</div><div id="admin-content"><div class="skeleton h-32"></div></div></div>';loadAdminRoles();}catch{renderAdminFull(container);}
}

function renderAdminFull(container){
  const roles=currentUser.roles||[currentUser.role];
  const isAdmin=roles.includes('admin');
  const isStaff=roles.some(r=>['admin','teacher'].includes(r));
  if(!isStaff){container.innerHTML='<div class="empty-state"><i class="fas fa-lock"></i><p>邂｡逅・・・縺ｿ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ</p></div>';return;}
  const tabs=isAdmin?'<button onclick="switchAdminTab(\'users\',this)" class="sub-nav-btn active">繝ｦ繝ｼ繧ｶ繝ｼ邂｡逅・/button><button onclick="switchAdminTab(\'roles\',this)" class="sub-nav-btn">讓ｩ髯千ｮ｡逅・/button><button onclick="switchAdminTab(\'profile\',this)" class="sub-nav-btn">謇ｿ隱榊ｾ・■</button><button onclick="switchAdminTab(\'tokens\',this)" class="sub-nav-btn">諡帛ｾ・さ繝ｼ繝・/button><button onclick="switchAdminTab(\'bulk\',this)" class="sub-nav-btn">荳諡ｬ逕滓・</button><button onclick="switchAdminTab(\'posts\',this)" class="sub-nav-btn">謚慕ｨｿ邂｡逅・/button><button onclick="switchAdminTab(\'broadcast\',this)" class="sub-nav-btn">騾夂衍驟堺ｿ｡</button><button onclick="switchAdminTab(\'stats\',this)" class="sub-nav-btn">邨ｱ險・/button><button onclick="switchAdminTab(\'diag\',this)" class="sub-nav-btn">險ｺ譁ｭ</button>':'<button onclick="switchAdminTab(\'roles\',this)" class="sub-nav-btn active">讓ｩ髯千ｮ｡逅・/button><button onclick="switchAdminTab(\'tokens\',this)" class="sub-nav-btn">諡帛ｾ・さ繝ｼ繝・/button><button onclick="switchAdminTab(\'stats\',this)" class="sub-nav-btn">邨ｱ險・/button>';
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-shield-alt text-red-600"></i>邂｡逅・/h2></div><div class="p-4 space-y-4"><div class="flex flex-wrap gap-2">'+tabs+'</div><div id="admin-content"><div class="skeleton h-32"></div></div></div>';
  if(isAdmin)loadAdminUsers();else loadAdminTokens();
}

function switchAdminTab(tab,btn){document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(tab==='users')loadAdminUsers();else if(tab==='roles')loadAdminRoles();else if(tab==='profile')loadAdminProfileChanges();else if(tab==='tokens')loadAdminTokens();else if(tab==='bulk')loadAdminBulkCreate();else if(tab==='posts')loadAdminPosts();else if(tab==='broadcast')loadAdminBroadcast();else if(tab==='stats')loadAdminStats();else if(tab==='diag')loadAdminDiagnostics();}

async function loadAdminBroadcast(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">蜈ｨ菴馴夂衍驟堺ｿ｡</h3><div class="space-y-3"><div><label class="form-label">繧ｿ繧､繝医Ν</label><input id="bc-title" type="text" class="form-input" placeholder="萓・ 縺顔衍繧峨○"></div><div><label class="form-label">蜀・ｮｹ</label><textarea id="bc-body" class="form-input" rows="3" placeholder="騾夂衍蜀・ｮｹ"></textarea></div><button id="bc-submit-btn" onclick="submitBroadcast()" class="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-bullhorn mr-1"></i>蜈ｨ蜩｡縺ｫ驟堺ｿ｡</button><p class="text-xs text-gray-400 mt-2">繝励ャ繧ｷ繝･騾夂衍縺梧怏蜉ｹ縺ｪ繝ｦ繝ｼ繧ｶ繝ｼ縺ｫ縺ｯ繝悶Λ繧ｦ繧ｶ騾夂衍繧る∽ｿ｡縺輔ｌ縺ｾ縺・/p></div></div>';}
async function submitBroadcast(){const btn=document.getElementById('bc-submit-btn');if(btn&&btn.disabled)return;const title=document.getElementById('bc-title').value.trim();const body=document.getElementById('bc-body').value.trim();if(!title||!body){toast('繧ｿ繧､繝医Ν縺ｨ蜀・ｮｹ繧貞・蜉・,'error');return;}if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i>驟堺ｿ｡荳ｭ...';btn.classList.add('opacity-60');}try{const r=await api('/api/admin/notifications/broadcast',{method:'POST',body:{title,body,type:'normal'}});if(r.error){toast(r.error,'error');return;}toast('騾夂衍繧帝・菫｡縺励∪縺励◆・・+r.sent+'莉ｶ・・,'success');document.getElementById('bc-title').value='';document.getElementById('bc-body').value='';}catch(e){toast('螟ｱ謨・ '+(e.message||'繧ｨ繝ｩ繝ｼ'),'error');}finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-bullhorn mr-1"></i>蜈ｨ蜩｡縺ｫ驟堺ｿ｡';btn.classList.remove('opacity-60');}}}

async function loadAdminUsers(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/users');const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');const users=r.users.filter(u=>{const ur=(u.all_roles||u.role||'').split(',').map(x=>x.trim());return isAdmin||!ur.includes('admin');});c.innerHTML='<div class="mb-3 flex gap-2 flex-wrap">'+(isAdmin?'<button onclick="openBulkDeleteModal()" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-user-minus mr-1"></i>荳諡ｬ蜑企勁</button><button onclick="openBulkCreateStudentModal()" class="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>逕溷ｾ剃ｸ諡ｬ菴懈・</button>':'')+'</div><div class="space-y-2">'+users.map(u=>{const ur=(u.all_roles||u.role||'').split(',').map(x=>x.trim());const isTargetAdmin=ur.includes('admin');return'<div class="card p-3"><div class="flex justify-between items-center mb-2"><div><span class="font-semibold text-sm">'+esc(u.name)+'</span><span class="text-xs text-gray-500 ml-2">'+esc(u.username||'')+'</span><span class="text-xs '+(u.is_active===false?'text-red-500':'text-green-500')+' ml-2">'+(u.is_active===false?'蛛懈ｭ｢':'譛牙柑')+'</span></div><div class="flex gap-1">'+(isAdmin||!isTargetAdmin?'<button onclick="editUserInline('+u.id+',\''+esc(u.name)+'\',\''+esc(u.club||'')+'\',\''+esc(u.committee||'')+'\','+(u.grade||'')+','+(u.class_num||'')+','+(u.number||'')+')" class="text-blue-600 text-xs hover:underline">邱ｨ髮・/button><button onclick="changeUserPassword('+u.id+')" class="text-orange-600 text-xs hover:underline">繝代せ繝ｯ繝ｼ繝・/button><button onclick="toggleUserActive('+u.id+')" class="text-xs '+(u.is_active===false?'text-green-600':'text-red-600')+' hover:underline">'+(u.is_active===false?'蠕ｩ豢ｻ':'蛛懈ｭ｢')+'</button><button onclick="deleteUser('+u.id+')" class="text-xs text-red-600 hover:underline">蜑企勁</button>':'')+'</div></div><div class="text-xs text-gray-500">'+(u.grade?u.grade+'-'+u.class_num+' '+u.number:'')+' '+(u.club||'')+(u.club&&u.committee?' / ':'')+(u.committee||'')+'</div></div>';}).join('')+'</div>';}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}

function normClub(v){return(CLUBS.includes(v)?v:{'逕ｷ蟄仙酷逅・Κ':'蜊鍋帥驛ｨ','螂ｳ蟄仙酷逅・Κ':'蜊鍋帥驛ｨ'}[v])||v;}
function editUserInline(id,name,club,committee,grade,class_num,number){club=normClub(club);showModal('繝ｦ繝ｼ繧ｶ繝ｼ邱ｨ髮・#'+id,'<div class="space-y-3"><div><label class="form-label">蜷榊燕</label><input id="eu-name" type="text" class="form-input" value="'+esc(name)+'"></div><div class="grid grid-cols-3 gap-2"><div><label class="form-label">蟄ｦ蟷ｴ</label><input id="eu-grade" type="number" class="form-input" value="'+(grade||'')+'"></div><div><label class="form-label">繧ｯ繝ｩ繧ｹ</label><input id="eu-class" type="number" class="form-input" value="'+(class_num||'')+'"></div><div><label class="form-label">逡ｪ蜿ｷ</label><input id="eu-number" type="number" class="form-input" value="'+(number||'')+'"></div></div><div><label class="form-label">驛ｨ豢ｻ蜍・/label><select id="eu-club" class="form-input"><option value="">縺ｪ縺・/option>'+CLUBS.map(c=>'<option value="'+c+'"'+(club===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div><div><label class="form-label">蟋泌藤莨・/label><select id="eu-committee" class="form-input"><option value="">縺ｪ縺・/option>'+COMMITTEES.map(c=>'<option value="'+c+'"'+(committee===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'菫晏ｭ・,className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:()=>submitUserEdit(id)}]);}
async function submitUserEdit(id){const body={name:document.getElementById('eu-name').value.trim()};const g=document.getElementById('eu-grade').value;if(g)body.grade=parseInt(g);const cn=document.getElementById('eu-class').value;if(cn)body.class_num=parseInt(cn);const nu=document.getElementById('eu-number').value;if(nu)body.number=parseInt(nu);body.club=document.getElementById('eu-club').value.trim()||null;body.committee=document.getElementById('eu-committee').value.trim()||null;try{await api('/api/admin/users/'+id,{method:'PUT',body});closeModal();toast('菫晏ｭ倥＠縺ｾ縺励◆','success');loadAdminUsers();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function changeUserPassword(id){const p=prompt('譁ｰ縺励＞繝代せ繝ｯ繝ｼ繝峨ｒ蜈･蜉・');if(!p)return;try{await api('/api/admin/users/'+id+'/change-password',{method:'POST',body:{password:p}});toast('螟画峩縺励∪縺励◆','success');}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function toggleUserActive(id){try{await api('/api/admin/users/'+id+'/toggle',{method:'POST'});toast('譖ｴ譁ｰ縺励∪縺励◆','success');loadAdminUsers();}catch(e){toast('螟ｱ謨・,'error');}}
async function deleteUser(id){if(!confirm('譛ｬ蠖薙↓蜑企勁縺励∪縺吶°・・))return;try{await api('/api/admin/users/'+id,{method:'DELETE'});toast('蜑企勁縺励∪縺励◆','success');loadAdminUsers();}catch(e){toast('螟ｱ謨・,'error');}}

function openBulkDeleteModal(){showModal('荳諡ｬ蜑企勁','<div class="space-y-4"><p class="text-sm text-gray-600">蟄ｦ蟷ｴ縺ｨ繧ｯ繝ｩ繧ｹ繧呈欠螳壹＠縺ｦ繝ｦ繝ｼ繧ｶ繝ｼ繧剃ｸ諡ｬ蜑企勁縺励∪縺吶・/p><div><label class="form-label">蟄ｦ蟷ｴ</label><input id="bulk-grade" type="number" class="form-input" placeholder="萓・ 1"></div><div><label class="form-label">繧ｯ繝ｩ繧ｹ・井ｻｻ諢上∫怐逡･縺ｧ蟄ｦ蟷ｴ蜈ｨ蜩｡・・/label><input id="bulk-class" type="number" class="form-input" placeholder="萓・ 2"></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'蜑企勁',className:'bg-red-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitBulkDelete}]);}

async function submitBulkDelete(){const g=parseInt(document.getElementById('bulk-grade').value);const cn=document.getElementById('bulk-class').value?parseInt(document.getElementById('bulk-class').value):undefined;if(!g){toast('蟄ｦ蟷ｴ繧貞・蜉・,'error');return;}if(!confirm('譛ｬ蠖薙↓蜑企勁縺励∪縺吶°・溷・縺ｫ謌ｻ縺帙∪縺帙ｓ縲・))return;try{const r=await api('/api/admin/users/bulk-delete',{method:'POST',body:{grade:g,class_num:cn}});closeModal();toast(r.count+'莠ｺ蜑企勁縺励∪縺励◆','success');loadAdminUsers();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

function openBulkCreateStudentModal(){showModal('荳諡ｬ逕滓・','<div class="space-y-4"><div class="flex gap-2"><button onclick="switchBulkTab(\'student\',this)" class="sub-nav-btn active">逕溷ｾ・/button><button onclick="switchBulkTab(\'teacher\',this)" class="sub-nav-btn">蜈育函</button></div><div id="bulk-form-content"><div class="space-y-3"><p class="text-sm text-gray-600">蟷ｴ蠎ｦ+邨・逡ｪ蜿ｷ縺ｧ繝ｭ繧ｰ繧､繝ｳID逕滓・・井ｾ・ 2024蟷ｴ蠎ｦ3邨・8逡ｪ 竊・24328・・/p><div class="grid grid-cols-2 gap-2"><div><label class="form-label">蟷ｴ蠎ｦ</label><input id="bc-year" type="number" class="form-input" value="2024"></div><div><label class="form-label">邨・/label><input id="bc-class" type="number" class="form-input" value="1"></div></div><div class="grid grid-cols-2 gap-2"><div><label class="form-label">髢句ｧ狗分蜿ｷ</label><input id="bc-start" type="number" class="form-input" value="1"></div><div><label class="form-label">莠ｺ謨ｰ</label><input id="bc-count" type="number" class="form-input" value="40"></div></div><div><label class="form-label">繝代せ繝ｯ繝ｼ繝・/label><input id="bc-password" type="text" class="form-input" value="password"></div></div></div></div>',[{label:'繧ｭ繝｣繝ｳ繧ｻ繝ｫ',className:'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl',action:closeModal},{label:'菴懈・',className:'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold',action:submitBulkCreateStudent}]);}

let bulkTab='student'
function switchBulkTab(tab,btn){bulkTab=tab;document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=document.getElementById('bulk-form-content');if(tab==='student'){f.innerHTML='<div class="space-y-3"><p class="text-sm text-gray-600">蟷ｴ蠎ｦ+邨・逡ｪ蜿ｷ縺ｧ繝ｭ繧ｰ繧､繝ｳID逕滓・・井ｾ・ 2024蟷ｴ蠎ｦ3邨・8逡ｪ 竊・24328・・/p><div class="grid grid-cols-2 gap-2"><div><label class="form-label">蟷ｴ蠎ｦ</label><input id="bc-year" type="number" class="form-input" value="2024"></div><div><label class="form-label">邨・/label><input id="bc-class" type="number" class="form-input" value="1"></div></div><div class="grid grid-cols-2 gap-2"><div><label class="form-label">髢句ｧ狗分蜿ｷ</label><input id="bc-start" type="number" class="form-input" value="1"></div><div><label class="form-label">莠ｺ謨ｰ</label><input id="bc-count" type="number" class="form-input" value="40"></div></div><div><label class="form-label">繝代せ繝ｯ繝ｼ繝・/label><input id="bc-password" type="text" class="form-input" value="password"></div></div>';}else{f.innerHTML='<div class="space-y-3"><p class="text-sm text-gray-600">T001縲弋xxx 蠖｢蠑上〒蜈育函繧｢繧ｫ繧ｦ繝ｳ繝医ｒ逕滓・</p><div><label class="form-label">莠ｺ謨ｰ</label><input id="bc-tcount" type="number" class="form-input" value="5"></div><div><label class="form-label">繝代せ繝ｯ繝ｼ繝・/label><input id="bc-tpassword" type="text" class="form-input" value="teacher1234"></div></div>';}}

async function submitBulkCreateStudent(){if(bulkTab==='student'){const year=parseInt(document.getElementById('bc-year').value);const class_num=parseInt(document.getElementById('bc-class').value);const count=parseInt(document.getElementById('bc-count').value);const start_num=parseInt(document.getElementById('bc-start').value)||1;const password=document.getElementById('bc-password').value||'password';if(!year||!class_num||!count){toast('縺吶∋縺ｦ蜈･蜉・,'error');return;}if(count>100){toast('100莠ｺ縺ｾ縺ｧ','error');return;}try{const r=await api('/api/admin/bulk-create/students',{method:'POST',body:{year,class_num,count,start_num,password}});closeModal();toast(r.count+'莠ｺ菴懈・縺励∪縺励◆','success');loadAdminUsers();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}else{const count=parseInt(document.getElementById('bc-tcount').value);const password=document.getElementById('bc-tpassword').value||'teacher1234';if(!count){toast('莠ｺ謨ｰ繧貞・蜉・,'error');return;}try{const r=await api('/api/admin/bulk-create/teachers',{method:'POST',body:{count,password}});closeModal();toast(r.count+'莠ｺ菴懈・縺励∪縺励◆','success');loadAdminUsers();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}}

async function loadAdminProfileChanges(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="flex gap-2 flex-wrap"><button onclick="loadAdminProfileChanges()" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-sync mr-1"></i>蜀崎ｪｭ霎ｼ</button><button onclick="approveAllProfileChanges()" class="bg-green-700 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-check-double mr-1"></i>蜈ｨ莉ｶ荳諡ｬ謇ｿ隱・/button></div><div id="profile-changes-list"><div class="skeleton h-20"></div></div></div>';try{const r=await api('/api/admin/profile-changes');const l=document.getElementById('profile-changes-list');if(!r.requests.length){l.innerHTML='<div class="empty-state"><i class="fas fa-check-circle"></i><p>謇ｿ隱榊ｾ・■縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝医・縺ゅｊ縺ｾ縺帙ｓ</p></div>';return;}const grouped={};for(const req of r.requests){const key=req.user_id;if(!grouped[key])grouped[key]={user_name:req.user_name,user_id:req.user_id,grade:req.grade,class_num:req.class_num,number:req.number,requests:[]};grouped[key].requests.push(req);}l.innerHTML=Object.values(grouped).map(g=>'<div class="card p-4 mb-3"><div class="flex justify-between items-center mb-3"><div><span class="font-semibold">'+esc(g.user_name)+'</span><span class="text-xs text-gray-500 ml-2">'+(g.grade?g.grade+'-'+g.class_num+' '+g.number:'')+'</span></div><div class="flex gap-2"><button onclick="approveUserProfileChanges('+g.user_id+')" class="bg-green-600 text-white px-3 py-1 rounded-full text-xs"><i class="fas fa-check mr-1"></i>蜈ｨ縺ｦ謇ｿ隱・/button><button onclick="rejectUserProfileChanges('+g.user_id+')" class="bg-red-400 text-white px-3 py-1 rounded-full text-xs"><i class="fas fa-times mr-1"></i>蜈ｨ縺ｦ蜊ｴ荳・/button></div></div><div class="space-y-2">'+g.requests.map(req=>'<div class="flex items-center justify-between bg-gray-50 rounded-lg p-2"><div class="flex-1 flex items-center gap-2 text-sm"><span class="font-medium text-gray-600 w-16">'+{name:'蜷榊燕',grade:'蟄ｦ蟷ｴ',class_num:'繧ｯ繝ｩ繧ｹ',number:'逡ｪ蜿ｷ',club:'驛ｨ豢ｻ',committee:'蟋泌藤莨・}[req.field_name]||req.field_name+'</span><span class="line-through text-gray-400">'+esc(req.old_value||'')+'</span><i class="fas fa-arrow-right text-gray-400 text-xs"></i><span class="font-semibold">'+esc(req.new_value)+'</span></div><span class="text-xs text-gray-400">'+formatRelative(req.created_at)+'</span></div>').join('')+'</div></div>').join('');}catch{const l=document.getElementById('profile-changes-list');if(l)l.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}
async function approveProfileChange(id){try{await api('/api/admin/profile-changes/'+id+'/approve',{method:'POST'});toast('謇ｿ隱阪＠縺ｾ縺励◆','success');loadAdminProfileChanges();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}
async function rejectProfileChange(id){try{await api('/api/admin/profile-changes/'+id+'/reject',{method:'POST'});toast('蜊ｴ荳九＠縺ｾ縺励◆','success');loadAdminProfileChanges();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}
async function approveAllProfileChanges(){if(!confirm('蜈ｨ縺ｦ縺ｮ謇ｿ隱榊ｾ・■繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ荳諡ｬ謇ｿ隱阪＠縺ｾ縺吶°・・))return;try{const r=await api('/api/admin/profile-changes/bulk-approve',{method:'POST'});toast(r.count+'莉ｶ謇ｿ隱阪＠縺ｾ縺励◆','success');loadAdminProfileChanges();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}
async function approveUserProfileChanges(userId){if(!confirm('縺薙・繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ蜈ｨ縺ｦ縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ謇ｿ隱阪＠縺ｾ縺吶°・・))return;try{const r=await api('/api/admin/profile-changes/bulk-approve',{method:'POST',body:{user_id:userId}});toast(r.count+'莉ｶ謇ｿ隱阪＠縺ｾ縺励◆','success');loadAdminProfileChanges();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}
async function rejectUserProfileChanges(userId){if(!confirm('縺薙・繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ蜈ｨ縺ｦ縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ蜊ｴ荳九＠縺ｾ縺吶°・・))return;try{const r=await api('/api/admin/profile-changes/bulk-reject',{method:'POST',body:{user_id:userId}});toast(r.count+'莉ｶ蜊ｴ荳九＠縺ｾ縺励◆','success');loadAdminProfileChanges();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function loadAdminRoles(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/users');const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');const users=r.users.filter(u=>{const ur=(u.all_roles||u.role||'').split(',').map(x=>x.trim());return isAdmin||!ur.includes('admin');});c.innerHTML='<div class="space-y-2">'+users.map(u=>{const roles=(u.all_roles||'').split(',').filter(Boolean);const isTargetAdmin=roles.includes('admin');return'<div class="card p-3"><div class="flex justify-between items-center mb-2"><div><span class="font-semibold text-sm">'+esc(u.name)+'</span><span class="text-xs text-gray-500 ml-2">'+esc(u.login_id||u.username||'')+'</span></div><span class="text-xs text-gray-400">'+u.role+(u.grade?' '+u.grade+'-'+u.class_num:'')+'</span></div><div class="flex flex-wrap gap-1 mb-2">'+(roles.length?roles.map(r=>'<span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">'+(ROLE_LABELS[r]||r)+(isAdmin||!isTargetAdmin?' <button onclick="removeUserRole('+u.id+',\''+r+'\')" class="text-blue-600 hover:text-red-600 ml-0.5">&times;</button>':'')+'</span>').join(''):'<span class="text-xs text-gray-400">繝ｭ繝ｼ繝ｫ縺ｪ縺・/span>')+'</div><div class="flex gap-1 flex-wrap">'+(isAdmin||!isTargetAdmin?ALL_ROLES.filter(r=>!roles.includes(r)&&r!=='admin').map(r=>'<button onclick="addUserRole('+u.id+',\''+r+'\')" class="border border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300 px-2 py-0.5 rounded-full text-xs transition">+'+(ROLE_LABELS[r]||r)+'</button>').join(''):'')+'</div></div>';}).join('')+'</div>';}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}

async function addUserRole(id,role){try{await api('/api/admin/users/'+id+'/roles',{method:'POST',body:{role}});toast('霑ｽ蜉縺励∪縺励◆','success');loadAdminRoles();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}
async function removeUserRole(id,role){try{await api('/api/admin/users/'+id+'/roles/'+role,{method:'DELETE'});toast('蜑企勁縺励∪縺励◆','success');loadAdminRoles();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function loadAdminStats(){const c=document.getElementById('admin-content');if(!c)return;try{const r=await api('/api/admin/stats');c.innerHTML='<div class="grid grid-cols-2 gap-3"><div class="card p-4 text-center"><p class="text-2xl font-bold text-green-600">'+r.total+'</p><p class="text-xs text-gray-500">邱上Θ繝ｼ繧ｶ繝ｼ謨ｰ</p></div></div><div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"><div class="card p-4"><h4 class="text-sm font-bold mb-2">蟄ｦ蟷ｴ蛻･</h4><canvas id="stats-grade-chart" height="180" class="w-full"></canvas></div><div class="card p-4"><h4 class="text-sm font-bold mb-2">繝ｭ繝ｼ繝ｫ蛻･</h4><canvas id="stats-role-chart" height="180" class="w-full"></canvas></div><div class="card p-4"><h4 class="text-sm font-bold mb-2">驛ｨ豢ｻ蜍・/h4><div id="stats-club-list" class="space-y-1"></div></div><div class="card p-4"><h4 class="text-sm font-bold mb-2">蟋泌藤莨・/h4><div id="stats-committee-list" class="space-y-1"></div></div></div>';drawBarChart('stats-grade-chart',r.byGrade.map((x)=>({label:''+x.grade+'蟷ｴ',value:x.cnt})));drawBarChart('stats-role-chart',r.byRole.map((x)=>({label:{admin:'邂｡逅・・,teacher:'蜈育函',student:'逕溷ｾ・,captain:'驛ｨ髟ｷ',chairman:'蟋泌藤髟ｷ'}[x.role]||x.role,value:x.cnt})));document.getElementById('stats-club-list').innerHTML=r.byClub.map((x)=>'<div class="flex justify-between text-sm"><span>'+esc(x.club)+'</span><span class="font-bold">'+x.cnt+'</span></div>').join('');document.getElementById('stats-committee-list').innerHTML=r.byCommittee.map((x)=>'<div class="flex justify-between text-sm"><span>'+esc(x.committee)+'</span><span class="font-bold">'+x.cnt+'</span></div>').join('');}catch{c.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}

function drawBarChart(canvasId,data){const cv=document.getElementById(canvasId);if(!cv)return;const ctx=cv.getContext('2d');const w=cv.parentElement.clientWidth||300;cv.width=w;cv.height=180;const barW=Math.max(6,w/data.length/2-2);const max=Math.max(...data.map((d)=>d.value),1);ctx.clearRect(0,0,w,180);data.forEach((d,i)=>{const x=i*(w/data.length)+(w/data.length-barW)/2;const h=(d.value/max)*140;ctx.fillStyle='#40916c';ctx.beginPath();ctx.roundRect(x,165-h,barW,h,3);ctx.fill();ctx.fillStyle='#555';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(d.label,x+barW/2,180);ctx.fillStyle='#222';ctx.font='bold 14px sans-serif';ctx.fillText(d.value,x+barW/2,158-h);});}

async function loadAdminDiagnostics(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="flex gap-2"><button onclick="loadAdminDiagnostics()" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-sync mr-1"></i>蜀崎ｨｺ譁ｭ</button></div><div id="diag-results"><div class="skeleton h-32"></div></div></div>';try{const r=await api('/api/admin/diagnostics');const l=document.getElementById('diag-results');l.innerHTML='<div class="space-y-2">'+r.checks.map((ch)=>{const icon={ok:'fa-check-circle text-green-500',error:'fa-exclamation-circle text-red-500',info:'fa-info-circle text-blue-500'}[ch.status]||'fa-circle text-gray-400';return'<div class="card p-3 flex items-center gap-3"><i class="fas '+icon+'"></i><div class="flex-1"><p class="text-sm font-semibold">'+esc(ch.name)+'</p><p class="text-xs text-gray-500">'+esc(ch.message)+'</p></div></div>';}).join('')+'</div>';}catch{const l=document.getElementById('diag-results');if(l)l.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>險ｺ譁ｭ螟ｱ謨・/p></div>';}}

async function loadAdminTokens(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="card p-4"><h3 class="font-bold mb-3">諡帛ｾ・さ繝ｼ繝臥匱陦・/h3><div class="grid grid-cols-3 gap-2 mb-3"><div><label class="form-label">繝ｭ繝ｼ繝ｫ</label><select id="token-role-select" class="form-input"><option value="student">逕溷ｾ・/option><option value="teacher">蜈育函</option></select></div><div><label class="form-label">譛牙柑譎る俣(h)</label><input id="token-hours" type="number" value="72" class="form-input"></div><div><label class="form-label">逋ｺ陦梧焚</label><input id="token-count" type="number" value="1" min="1" max="100" class="form-input"></div></div><button onclick="generateTokens()" class="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-key mr-1"></i>逋ｺ陦・/button></div><div id="token-results" class="space-y-2"></div></div>';}

async function loadAdminBulkCreate(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="flex gap-2 mb-3"><button onclick="switchBulkTab2(\'student\',this)" class="sub-nav-btn active">逕溷ｾ・/button><button onclick="switchBulkTab2(\'teacher\',this)" class="sub-nav-btn">蜈育函</button></div><div id="bulk-form2"><div class="card p-4"><h3 class="font-bold mb-3">逕溷ｾ剃ｸ諡ｬ逕滓・</h3><p class="text-sm text-gray-600 mb-3">蟷ｴ蠎ｦ+邨・逡ｪ蜿ｷ縺ｧ繝ｭ繧ｰ繧､繝ｳID逕滓・・井ｾ・ 2024蟷ｴ蠎ｦ3邨・8逡ｪ 竊・24328・・/p><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">蟷ｴ蠎ｦ</label><input id="bc2-year" type="number" class="form-input" value="2024"></div><div><label class="form-label">邨・/label><input id="bc2-class" type="number" class="form-input" value="1"></div></div><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">髢句ｧ狗分蜿ｷ</label><input id="bc2-start" type="number" class="form-input" value="1"></div><div><label class="form-label">莠ｺ謨ｰ</label><input id="bc2-count" type="number" class="form-input" value="40"></div></div><div><label class="form-label">繝代せ繝ｯ繝ｼ繝・/label><input id="bc2-password" type="text" class="form-input" value="password"></div><button onclick="submitBulkCreateStudent2()" class="mt-3 bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>荳諡ｬ菴懈・</button><div id="bulk-result" class="mt-2"></div></div></div></div>';}

let bulkTab2='student'
function switchBulkTab2(tab,btn){bulkTab2=tab;document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=document.getElementById('bulk-form2');if(tab==='student'){f.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">逕溷ｾ剃ｸ諡ｬ逕滓・</h3><p class="text-sm text-gray-600 mb-3">蟷ｴ蠎ｦ+邨・逡ｪ蜿ｷ縺ｧ繝ｭ繧ｰ繧､繝ｳID逕滓・・井ｾ・ 2024蟷ｴ蠎ｦ3邨・8逡ｪ 竊・24328・・/p><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">蟷ｴ蠎ｦ</label><input id="bc2-year" type="number" class="form-input" value="2024"></div><div><label class="form-label">邨・/label><input id="bc2-class" type="number" class="form-input" value="1"></div></div><div class="grid grid-cols-2 gap-3 mb-3"><div><label class="form-label">髢句ｧ狗分蜿ｷ</label><input id="bc2-start" type="number" class="form-input" value="1"></div><div><label class="form-label">莠ｺ謨ｰ</label><input id="bc2-count" type="number" class="form-input" value="40"></div></div><div><label class="form-label">繝代せ繝ｯ繝ｼ繝・/label><input id="bc2-password" type="text" class="form-input" value="password"></div><button onclick="submitBulkCreateStudent2()" class="mt-3 bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>荳諡ｬ菴懈・</button><div id="bulk-result" class="mt-2"></div></div>';}else{f.innerHTML='<div class="card p-4"><h3 class="font-bold mb-3">蜈育函荳諡ｬ逕滓・</h3><p class="text-sm text-gray-600 mb-3">T001縲弋xxx 蠖｢蠑上〒蜈育函繧｢繧ｫ繧ｦ繝ｳ繝医ｒ逕滓・</p><div><label class="form-label">莠ｺ謨ｰ</label><input id="bc2-tcount" type="number" class="form-input" value="5"></div><div class="mt-2"><label class="form-label">繝代せ繝ｯ繝ｼ繝・/label><input id="bc2-tpassword" type="text" class="form-input" value="teacher1234"></div><button onclick="submitBulkCreateTeacher2()" class="mt-3 bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>荳諡ｬ菴懈・</button><div id="bulk-result" class="mt-2"></div></div>';}}

async function submitBulkCreateStudent2(){if(bulkTab2==='teacher'){submitBulkCreateTeacher2();return;}const year=parseInt(document.getElementById('bc2-year').value);const class_num=parseInt(document.getElementById('bc2-class').value);const count=parseInt(document.getElementById('bc2-count').value);const start_num=parseInt(document.getElementById('bc2-start').value)||1;const password=document.getElementById('bc2-password').value||'password';if(!year||!class_num||!count){toast('縺吶∋縺ｦ蜈･蜉・,'error');return;}if(count>100){toast('100莠ｺ縺ｾ縺ｧ','error');return;}try{document.getElementById('bulk-result').innerHTML='<div class="skeleton h-12"></div>';const r=await api('/api/admin/bulk-create/students',{method:'POST',body:{year,class_num,count,start_num,password}});document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-green-50 text-green-700 text-sm">'+r.count+'莠ｺ菴懈・縺励∪縺励◆</div>';toast(r.count+'莠ｺ菴懈・縺励∪縺励◆','success');}catch(e){document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-red-50 text-red-600 text-sm">'+(e.message||'螟ｱ謨・)+'</div>';}}
async function submitBulkCreateTeacher2(){const count=parseInt(document.getElementById('bc2-tcount').value);const password=document.getElementById('bc2-tpassword').value||'teacher1234';if(!count){toast('莠ｺ謨ｰ繧貞・蜉・,'error');return;}try{document.getElementById('bulk-result').innerHTML='<div class="skeleton h-12"></div>';const r=await api('/api/admin/bulk-create/teachers',{method:'POST',body:{count,password}});document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-green-50 text-green-700 text-sm">'+r.count+'莠ｺ菴懈・縺励∪縺励◆</div>';toast(r.count+'莠ｺ菴懈・縺励∪縺励◆','success');}catch(e){document.getElementById('bulk-result').innerHTML='<div class="card p-3 bg-red-50 text-red-600 text-sm">'+(e.message||'螟ｱ謨・)+'</div>';}}

async function loadAdminPosts(){const c=document.getElementById('admin-content');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="flex gap-2"><button onclick="loadAdminPosts()" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm"><i class="fas fa-sync mr-1"></i>蜀崎ｪｭ霎ｼ</button></div><div id="admin-posts-list"><div class="skeleton h-32"></div></div></div>';try{const r=await api('/api/admin/posts');const l=document.getElementById('admin-posts-list');if(!r.posts.length){l.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>謚慕ｨｿ縺ｪ縺・/p></div>';return;}l.innerHTML=r.posts.map(p=>'<div class="card p-3 flex items-start gap-3"><div class="flex-1 min-w-0"><div class="flex justify-between items-start"><p class="text-sm font-semibold truncate">'+esc(p.author_name)+'</p><span class="text-xs text-gray-400">'+formatRelative(p.created_at)+'</span></div><p class="text-sm mt-1 line-clamp-2">'+esc(p.content||'')+'</p></div><button onclick="deleteAdminPost('+p.id+')" class="text-red-500 hover:text-red-700 flex-shrink-0"><i class="fas fa-trash"></i></button></div>').join('');}catch{const l=document.getElementById('admin-posts-list');if(l)l.innerHTML='<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>隱ｭ霎ｼ螟ｱ謨・/p></div>';}}

async function deleteAdminPost(id){if(!confirm('縺薙・謚慕ｨｿ繧貞炎髯､縺励∪縺吶°・・))return;try{await api('/api/admin/posts/bulk-delete',{method:'POST',body:{ids:[id]}});toast('蜑企勁縺励∪縺励◆','success');loadAdminPosts();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function generateTokens(){const c=document.getElementById('token-results');if(!c)return;c.innerHTML='<div class="skeleton h-12"></div>';try{const r=await api('/api/admin/tokens',{method:'POST',body:{role:document.getElementById('token-role-select').value,hours:parseInt(document.getElementById('token-hours').value)||72,count:parseInt(document.getElementById('token-count').value)||1}});c.innerHTML='<div class="card p-4 bg-green-50"><p class="text-sm text-green-700 font-semibold mb-2">逋ｺ陦悟ｮ御ｺ・ｼ・ｼ域悄髯・ '+formatRelative(r.expires_at)+'・・/p><div class="space-y-1">'+r.tokens.map(t=>'<div class="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border"><code class="flex-1 text-sm font-mono">'+esc(t)+'</code><button onclick="copyToken(\''+t+'\')" class="text-blue-600 text-xs hover:underline">繧ｳ繝斐・</button></div>').join('')+'</div></div>';}catch(e){c.innerHTML='<div class="card p-4 bg-red-50 text-red-600 text-sm">逋ｺ陦悟､ｱ謨・ '+(e.message||'')+'</div>';}}

function copyToken(t){navigator.clipboard.writeText(t).then(()=>toast('繧ｳ繝斐・縺励∪縺励◆','success')).catch(()=>toast('謇句虚縺ｧ繧ｳ繝斐・縺励※縺上□縺輔＞','error'));}

// === Notifications ===
function renderNotifications(container) {
  container.innerHTML='<div class="bg-white border-b px-4 py-3"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bell text-red-500"></i>騾夂衍</h2></div><div class="p-3"><div class="flex gap-2 mb-3"><button onclick="switchNotifTab(\'list\',this)" class="sub-nav-btn active"><i class="fas fa-list mr-1"></i>蜿嶺ｿ｡</button><button onclick="switchNotifTab(\'self\',this)" class="sub-nav-btn"><i class="fas fa-clock mr-1"></i>閾ｪ蛻・夂衍</button></div><div id="notif-list"><div class="skeleton h-20"></div></div></div>';
  loadNotifications();
}

function switchNotifTab(tab,btn){document.querySelectorAll('.sub-nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(tab==='list')loadNotifications();else if(tab==='self')loadSelfNotifications();}

async function loadSelfNotifications(){const c=document.getElementById('notif-list');if(!c)return;c.innerHTML='<div class="space-y-4"><div class="card p-4"><h3 class="font-bold text-sm mb-3">譁ｰ隕丈ｽ懈・</h3><div><label class="form-label">騾夂衍蜀・ｮｹ</label><textarea id="self-notif-msg" class="form-input" rows="2" placeholder="萓・ 3髯舌・謨ｰ蟄ｦ縲∝ｰ上ユ繧ｹ繝医′縺ゅｊ縺ｾ縺・></textarea></div><div><label class="form-label">莠育ｴ・律譎ゑｼ育怐逡･縺ｧ莉翫☆縺撰ｼ・/label><input id="self-notif-time" type="datetime-local" class="form-input"></div><button onclick="submitSelfNotification()" class="mt-2 bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>菴懈・</button></div><div id="self-notif-list"><div class="skeleton h-12"></div></div></div>';try{const r=await api('/api/admin/notifications/self');const l=document.getElementById('self-notif-list');if(!r.notifications.length){l.innerHTML='<div class="empty-state"><i class="fas fa-clock"></i><p>閾ｪ蛻・夂衍縺ｯ縺ゅｊ縺ｾ縺帙ｓ</p></div>';return;}l.innerHTML=r.notifications.map(n=>'<div class="card p-3 flex justify-between items-center"><div><p class="text-sm">'+esc(n.title||n.message||'')+'</p><span class="text-xs text-gray-400">'+(n.scheduled_at?'莠亥ｮ・ '+formatRelative(n.scheduled_at):'莉翫☆縺・)+'</span></div><button onclick="deleteSelfNotif('+n.id+')" class="text-red-500 text-xs hover:underline">蜑企勁</button></div>').join('');}catch{}}

async function submitSelfNotification(){const msg=document.getElementById('self-notif-msg').value.trim();if(!msg){toast('繝｡繝・そ繝ｼ繧ｸ繧貞・蜉・,'error');return;}const scheduled=document.getElementById('self-notif-time').value||null;try{await api('/api/admin/notifications/self',{method:'POST',body:{message:msg,scheduled_at:scheduled?new Date(scheduled).toISOString():null}});document.getElementById('self-notif-msg').value='';document.getElementById('self-notif-time').value='';toast('菴懈・縺励∪縺励◆','success');loadSelfNotifications();}catch(e){toast(e.message||'螟ｱ謨・,'error');}}

async function deleteSelfNotif(id){try{const r=await api('/api/notifications/'+id+'/read',{method:'POST'});loadSelfNotifications();}catch{}}
async function testPush(){try{const r=await api('/api/admin/notifications/test',{method:'POST'});if(r.error){toast(r.error+(r.endpoint?' ['+r.endpoint+']':''),'error');return;}toast(r.message+(r.devices?' ['+r.devices+']':''),'success');}catch(e){toast('螟ｱ謨・ '+(e.message||'繧ｨ繝ｩ繝ｼ'),'error');}}

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
            try { new Notification('荳贋ｸｭ鮟呈攸', { body: n.title, icon: '/icons/icon-192.png' }) } catch {}
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

async function loadNotifications(){const c=document.getElementById('notif-list');if(!c)return;try{const r=await api('/api/auth/notifications');if(!r.notifications.length){c.innerHTML='<div class="empty-state"><i class="fas fa-bell-slash"></i><p>騾夂衍縺ｯ縺ゅｊ縺ｾ縺帙ｓ</p></div>';updateNotifBadge();return;}c.innerHTML=r.notifications.map(n=>'<div class="card p-4 mb-2 flex items-start gap-3'+(n.id>getLastReadNotifId()?' cursor-pointer':'')+'"'+(n.id>getLastReadNotifId()?' onclick="markNotifRead('+n.id+')"':'')+' data-nid="'+n.id+'"><div class="w-8 h-8 rounded-full '+(n.id>getLastReadNotifId()?'bg-blue-100':'bg-gray-200')+' flex items-center justify-center text-sm"><i class="fas '+(n.icon||'fa-bell')+' text-blue-600"></i></div><div class="flex-1"><p class="text-sm '+(n.id>getLastReadNotifId()?'text-gray-800 font-semibold':'text-gray-500')+'">'+esc(n.title||n.message||n.body||'')+'</p><span class="text-xs text-gray-400">'+formatRelative(n.created_at)+'</span></div></div>').join('');updateNotifBadge()}catch{}}

async function markNotifRead(id){setLastReadNotifId(id);loadNotifications();updateNotifBadge();try{await api('/api/auth/notifications/'+id+'/read',{method:'POST'})}catch{}setLastReadNotifId(id)}

function esc(str){if(!str)return '';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');}

// === Utilities ===
function formatRelative(d){if(!d)return '';const t=new Date(d);const n=new Date();const diff=(n-t)/1000;if(diff<60)return '縺溘▲縺滉ｻ・;if(diff<3600)return Math.floor(diff/60)+'蛻・燕';if(diff<86400)return Math.floor(diff/3600)+'譎る俣蜑・;if(diff<172800)return '譏ｨ譌･';if(diff<2592000)return Math.floor(diff/86400)+'譌･蜑・;return t.toLocaleDateString('ja-JP',{month:'short',day:'numeric',year:diff>31536000?'numeric':undefined});}

function formatDate(d){if(!d)return '';return new Date(d).toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}

function renderFilePreview(url,type){if(!url)return '';if(type==='image')return '<img src="'+url+'" class="mt-2 max-h-64 rounded-lg object-contain border" onerror="this.style.display=\'none\'">';if(type==='pdf')return '<a href="'+url+'" target="_blank" class="mt-2 flex items-center gap-2 text-blue-600 hover:underline text-sm"><i class="fas fa-file-pdf text-red-500"></i> PDF髢ｲ隕ｧ</a>';return'';}

function showModal(title,body,actions){const o=document.getElementById('modal-overlay'),c=document.getElementById('modal-box'),t=document.getElementById('modal-title'),b=document.getElementById('modal-body'),a=document.getElementById('modal-footer');if(!o)return;t.textContent=title;b.innerHTML=body;a.innerHTML='';(actions||[]).forEach(ac=>{const btn=document.createElement('button');btn.textContent=ac.label;btn.className=ac.className||'px-4 py-2 rounded-xl font-semibold';btn.onclick=ac.action;a.appendChild(btn);});o.classList.remove('hidden');c.classList.add('modal-enter');}

function closeModal(){const o=document.getElementById('modal-overlay'),c=document.getElementById('modal-box');if(!o)return;c.classList.remove('modal-enter');o.classList.add('hidden');}

function toast(msg,type){const tc=document.getElementById('toast-container');if(!tc)return;const t=document.createElement('div');t.className='toast toast-'+(type||'info');t.textContent=msg;tc.appendChild(t);setTimeout(()=>{t.classList.add('toast-out');setTimeout(()=>t.remove(),300);},3000);}

async function api(path,opts){const cfg=opts||{};const isForm=cfg.body instanceof FormData;const resp=await fetch(path,{method:cfg.method||'GET',headers:isForm?{}:{'Content-Type':'application/json'},body:cfg.body?(isForm?cfg.body:JSON.stringify(cfg.body)):undefined,credentials:'include'});const ct=resp.headers.get('content-type')||'';if(cfg.noJson||ct.includes('text/')||ct.includes('application/octet-stream')){if(!resp.ok){const txt=await resp.text();throw new Error(txt);}return resp;}const data=await resp.json();if(!resp.ok)throw new Error(data.error||data.message||'繧ｨ繝ｩ繝ｼ');return data;}

function logout(){fetch('/api/auth/logout',{method:'POST',credentials:'include'}).then(()=>{window.location.reload();}).catch(()=>{window.location.reload();});}

async function fetchWBGT(){try{const r=await api('/api/wbgt');const el=document.getElementById('wbgt-text');if(el){if(r.wbgt){const levelMap={'蜊ｱ髯ｺ':'text-red-300','蜴ｳ驥崎ｭｦ謌・:'text-yellow-300','隴ｦ謌・:'text-yellow-200','豕ｨ諢・:'text-green-200'};el.innerHTML='WBGT: <strong>'+r.wbgt+'ﾂｰC</strong> <span class="'+(levelMap[r.level]||'')+'">('+r.level+')</span>'+(r.alert?' <span class="text-yellow-200">笞'+r.alert+'</span>':'')+' | 豌玲ｸｩ'+r.temp+'ﾂｰC 貉ｿ蠎ｦ'+r.humidity+'%';}else{el.textContent='豌苓ｱ｡諠・ｱ蜿門ｾ嶺ｸｭ...';}}}catch{const el=document.getElementById('wbgt-text');if(el)el.textContent='豌苓ｱ｡諠・ｱ蜿門ｾ怜､ｱ謨・;}}

async function fetchUnreadCount(){try{const r=await api('/api/messages/unread-count');const badge=document.getElementById('msg-badge');if(badge){badge.textContent=r.count>0?(r.count>99?'99+':r.count):'';badge.classList.toggle('hidden',r.count===0);}}catch{}}
async function updateNotifBadge(){try{const r=await api('/api/auth/notifications');const lastRead=getLastReadNotifId();const unread=(r.notifications||[]).filter(n=>n.id>lastRead).length;const badge=document.getElementById('notif-badge');if(badge){if(unread>0){badge.textContent=unread>99?'99+':unread;badge.classList.remove('hidden')}else badge.classList.add('hidden')}}catch{}}
function markAllNotifRead(){const el=document.getElementById('notif-list');if(!el)return;const ids=(el.querySelectorAll('[onclick^=markNotifRead]')||[]).length;const r=document.querySelectorAll('#notif-list .cursor-pointer');r.forEach(n=>{n.classList.remove('cursor-pointer');n.removeAttribute('onclick');});const max=Array.from(document.querySelectorAll('#notif-list .card')).reduce((m,c)=>{const m2=parseInt(c.getAttribute('data-nid')||'0');return m2>m?m2:m;},0);if(max>getLastReadNotifId())setLastReadNotifId(max);updateNotifBadge();}

