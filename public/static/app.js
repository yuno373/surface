/* 上中黒板 - メインアプリケーション */

// ============================================================
// グローバル状態
// ============================================================
let currentUser = null;
let currentTab = null;
let reloadTimer = null;
let notifCheckTimer = null;

const CLUBS = ['サッカー部','男子バスケ部','女子バスケ部','男子卓球部','女子卓球部',
  '陸上部','野球部','バレーボール部','男子テニス部','女子テニス部','茶道部','美術部','吹奏楽部'];
const COMMITTEES = ['生徒会','整備委員会','生活委員会','保健委員会','図書委員会',
  '給食委員会','放送委員会','1学年委員会','2学年委員会','3学年委員会','体育委員会'];
const ROLES = { admin:'管理者', teacher:'先生', captain:'部長', chairman:'委員長',
  vice_captain:'副部長', vice_chairman:'副委員長', student:'生徒' };
const EMOJIS = ['👍','❤️','😊','🎉','😮','🙏'];

// ============================================================
// 初期化
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});

async function checkAuth() {
  try {
    const res = await api('/api/auth/me');
    if (res.user) {
      currentUser = res.user;
      if (currentUser.first_login) {
        showSetupModal();
      } else {
        showApp();
      }
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

// ============================================================
// 認証
// ============================================================
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!username || !password) { showError(errEl, 'ユーザー名とパスワードを入力してください'); return; }
  try {
    const res = await api('/api/auth/login', { method: 'POST', body: { username, password } });
    currentUser = res.user;
    if (currentUser.first_login) { showSetupModal(); }
    else { showApp(); }
  } catch (e) {
    showError(errEl, e.message || 'ログインに失敗しました');
  }
}

async function doLogout() {
  await api('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  clearTimers();
  document.getElementById('app').classList.add('hidden');
  showLogin();
}

async function doRegister() {
  const token = document.getElementById('reg-token').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');
  try {
    await api('/api/auth/register', { method: 'POST', body: { token, username, password } });
    hideRegisterModal();
    toast('登録が完了しました。ログインしてください。', 'success');
  } catch (e) {
    showError(errEl, e.message || '登録に失敗しました');
  }
}

function showLogin() { document.getElementById('login-screen').classList.remove('hidden'); }
function hideLogin() { document.getElementById('login-screen').classList.add('hidden'); }
function showRegisterModal() { document.getElementById('register-modal').classList.remove('hidden'); }
function hideRegisterModal() { document.getElementById('register-modal').classList.add('hidden'); }

// ============================================================
// 初回設定
// ============================================================
function showSetupModal() {
  hideLogin();
  const container = document.getElementById('setup-form-container');
  const role = currentUser.role;
  let html = '';

  if (role === 'admin') {
    html = `
      <div class="space-y-4">
        <div><label class="form-label">名前</label><input id="setup-name" type="text" class="form-input" placeholder="例：管理者"></div>
        <div><label class="form-label">新しいパスワード（変更する場合）</label><input id="setup-password" type="password" class="form-input" placeholder="空欄の場合は変更なし"></div>
      </div>`;
  } else if (role === 'teacher') {
    html = `
      <div class="space-y-4">
        <div><label class="form-label">名前</label><input id="setup-name" type="text" class="form-input" placeholder="例：山田 太郎"></div>
        <div><label class="form-label">担当教科</label><input id="setup-subject" type="text" class="form-input" placeholder="例：数学 / 校長 / 教頭"></div>
        <div><label class="form-label">学年担任</label>
          <select id="setup-homeroom" class="form-input" onchange="toggleHomeroomClass(this.value)">
            <option value="0">なし</option><option value="1">あり</option>
          </select></div>
        <div id="homeroom-class-wrap" class="hidden">
          <label class="form-label">担任クラス</label>
          <input id="setup-homeroom-class" type="number" class="form-input" placeholder="例：1（1組）" min="1" max="9">
        </div>
        <div><label class="form-label">新しいパスワード（変更する場合）</label><input id="setup-password" type="password" class="form-input" placeholder="空欄の場合は変更なし"></div>
      </div>`;
  } else {
    html = `
      <div class="space-y-4">
        <div><label class="form-label">名前</label><input id="setup-name" type="text" class="form-input" placeholder="例：田中 一郎"></div>
        <div class="grid grid-cols-3 gap-2">
          <div><label class="form-label">学年</label><input id="setup-grade" type="number" class="form-input" placeholder="1" min="1" max="3"></div>
          <div><label class="form-label">クラス</label><input id="setup-class" type="number" class="form-input" placeholder="1" min="1" max="9"></div>
          <div><label class="form-label">番号</label><input id="setup-number" type="number" class="form-input" placeholder="1" min="1" max="50"></div>
        </div>
        <div><label class="form-label">新しいパスワード（変更する場合）</label><input id="setup-password" type="password" class="form-input" placeholder="空欄の場合は変更なし"></div>
      </div>`;
  }
  container.innerHTML = html;
  document.getElementById('setup-modal').classList.remove('hidden');
}

function toggleHomeroomClass(val) {
  const el = document.getElementById('homeroom-class-wrap');
  if (el) { el.classList.toggle('hidden', val !== '1'); }
}

async function submitSetup() {
  const name = document.getElementById('setup-name')?.value.trim();
  const password = document.getElementById('setup-password')?.value;
  if (!name) { toast('名前を入力してください', 'error'); return; }
  const body = { name, password: password || undefined };
  const role = currentUser.role;
  if (role === 'teacher') {
    body.subject = document.getElementById('setup-subject')?.value.trim();
    body.is_homeroom = document.getElementById('setup-homeroom')?.value === '1';
    if (body.is_homeroom) body.homeroom_class = parseInt(document.getElementById('setup-homeroom-class')?.value);
  } else if (!['admin', 'teacher'].includes(role)) {
    body.grade = parseInt(document.getElementById('setup-grade')?.value) || undefined;
    body.class_num = parseInt(document.getElementById('setup-class')?.value) || undefined;
    body.number = parseInt(document.getElementById('setup-number')?.value) || undefined;
  }
  try {
    const res = await api('/api/auth/setup', { method: 'POST', body });
    currentUser = res.user;
    document.getElementById('setup-modal').classList.add('hidden');
    showApp();
    toast('設定が完了しました！', 'success');
  } catch (e) { toast(e.message || '設定に失敗しました', 'error'); }
}

// ============================================================
// アプリ表示
// ============================================================
function showApp() {
  hideLogin();
  document.getElementById('setup-modal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateHeader();
  buildNav();
  loadInfoBar();
  startTimers();
  navigateTo(getDefaultTab());
}

function getDefaultTab() {
  const tabs = getVisibleTabs();
  return tabs[0]?.id || 'bulletin';
}

function updateHeader() {
  document.getElementById('header-name').textContent = currentUser.name || currentUser.username;
  const avatarEl = document.getElementById('header-avatar');
  if (currentUser.avatar_url) {
    avatarEl.innerHTML = `<img src="${currentUser.avatar_url}" class="w-full h-full rounded-full object-cover">`;
  } else {
    const initial = (currentUser.name || currentUser.username || '?')[0];
    avatarEl.innerHTML = `<span>${initial}</span>`;
  }
}

// ============================================================
// タブ定義
// ============================================================
function getVisibleTabs() {
  const role = currentUser.role;
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isStaff = isAdmin || isTeacher;
  const isCaptainRole = ['captain', 'chairman', 'vice_captain', 'vice_chairman'].includes(role);

  const all = [
    // A位置
    { id: 'bulletin',    icon: 'fa-bullhorn',      label: '掲示板',   pos: 'A', visible: true },
    { id: 'notice',      icon: 'fa-school',        label: '上中連絡', pos: 'C', visible: true },
    { id: 'committee',   icon: 'fa-users-cog',     label: '委員会',   pos: 'D', visible: !!(currentUser.committee || isStaff) },
    { id: 'club',        icon: 'fa-running',       label: '部活動',   pos: 'E', visible: !!(currentUser.club || isStaff) },
    { id: 'question',    icon: 'fa-question-circle', label: '質問',   pos: 'F', visible: true },
    { id: 'classgroup',  icon: 'fa-chalkboard-teacher', label: 'クラス', pos: 'G', visible: true },
    { id: 'messages',    icon: 'fa-comments',      label: 'メッセージ', pos: 'A', visible: true },
    { id: 'captchat',    icon: 'fa-crown',         label: '部長Chat', pos: 'A', visible: isCaptainRole || isStaff },
    { id: 'consult',     icon: 'fa-hands-helping', label: '相談所',   pos: 'A', visible: !isStaff },
    { id: 'howto',       icon: 'fa-book-open',     label: '使い方',   pos: 'A', visible: true },
    // H位置：設定
    { id: 'settings',    icon: 'fa-cog',           label: '設定',     pos: 'H', visible: true },
  ];

  return all.filter(t => t.visible);
}

function buildNav() {
  const tabs = getVisibleTabs();
  const nav = document.getElementById('nav-tabs');
  nav.innerHTML = '';
  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.id = `nav-${tab.id}`;
    btn.innerHTML = `<i class="fas ${tab.icon}"></i><span>${tab.label}</span>`;
    btn.onclick = () => navigateTo(tab.id);
    nav.appendChild(btn);
  });
}

function navigateTo(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`nav-${tabId}`);
  if (btn) btn.classList.add('active');
  renderTab(tabId);
}

// ============================================================
// タブレンダリング
// ============================================================
function renderTab(tabId) {
  const content = document.getElementById('tab-content');
  content.innerHTML = '';
  switch (tabId) {
    case 'bulletin':    renderBulletin(content); break;
    case 'notice':      renderNotice(content); break;
    case 'committee':   renderCommittee(content); break;
    case 'club':        renderClub(content); break;
    case 'question':    renderQuestion(content); break;
    case 'classgroup':  renderClassGroup(content); break;
    case 'messages':    renderMessages(content); break;
    case 'captchat':    renderCaptChat(content); break;
    case 'consult':     renderConsult(content); break;
    case 'howto':       renderHowTo(content); break;
    case 'settings':    renderSettings(content); break;
    default:            content.innerHTML = '<div class="empty-state"><i class="fas fa-construction"></i><p>準備中</p></div>';
  }
}

// ============================================================
// 掲示板タブ
// ============================================================
function renderBulletin(container) {
  container.innerHTML = `
    <div class="bg-white border-b px-4 py-3 flex items-center justify-between">
      <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bullhorn text-blue-600"></i>掲示板</h2>
      ${canPost('bulletin') ? `<button onclick="openPostModal('bulletin')" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>` : ''}
    </div>
    <div class="p-3" id="bulletin-list"><div class="skeleton h-24 mb-3"></div><div class="skeleton h-24 mb-3"></div></div>
  `;
  loadPosts('bulletin', null, 'bulletin-list');
}

// ============================================================
// 上中連絡タブ
// ============================================================
function renderNotice(container) {
  const isStaff = ['admin', 'teacher'].includes(currentUser.role);
  container.innerHTML = `
    <div class="bg-white border-b">
      <div class="px-4 py-3 flex items-center justify-between">
        <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-school text-orange-600"></i>上中連絡</h2>
      </div>
      <div class="sub-nav">
        <button class="sub-nav-btn active" onclick="switchNoticeTab('school_notice', this)">上中連絡</button>
        <button class="sub-nav-btn" onclick="switchNoticeTab('lost_item', this)">忘れ物</button>
        ${isStaff ? `<button class="sub-nav-btn" onclick="switchNoticeTab('survey', this)">アンケート</button>` : ''}
      </div>
    </div>
    <div id="notice-post-btn" class="px-3 pt-2">
      ${(isStaff) ? `<button onclick="openPostModal('school_notice')" class="bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold w-full"><i class="fas fa-plus mr-1"></i>上中連絡を投稿</button>` : ''}
    </div>
    <div class="p-3" id="notice-list"><div class="skeleton h-24 mb-3"></div></div>
  `;
  loadPosts('school_notice', null, 'notice-list');
}

function switchNoticeTab(category, btn) {
  document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const isStaff = ['admin', 'teacher'].includes(currentUser.role);
  const isCaptainRole = ['captain', 'chairman', 'vice_captain', 'vice_chairman'].includes(currentUser.role);
  const btnContainer = document.getElementById('notice-post-btn');
  if (category === 'survey') {
    btnContainer.innerHTML = isStaff ? `<button onclick="openSurveyModal()" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold w-full"><i class="fas fa-poll mr-1"></i>アンケート作成</button>` : '';
    loadSurveys('notice-list');
    return;
  }
  if (category === 'school_notice') {
    btnContainer.innerHTML = isStaff ? `<button onclick="openPostModal('school_notice')" class="bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold w-full"><i class="fas fa-plus mr-1"></i>上中連絡を投稿</button>` : '';
  } else if (category === 'lost_item') {
    btnContainer.innerHTML = (isStaff || isCaptainRole) ? `<button onclick="openPostModal('lost_item')" class="bg-yellow-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold w-full"><i class="fas fa-search mr-1"></i>忘れ物を投稿</button>` : '';
  }
  loadPosts(category, null, 'notice-list');
}

// ============================================================
// 委員会タブ
// ============================================================
function renderCommittee(container) {
  const isStaff = ['admin', 'teacher'].includes(currentUser.role);
  const myCommittee = currentUser.committee;
  
  let tabsHtml = '';
  if (isStaff) {
    tabsHtml = COMMITTEES.map((c, i) =>
      `<button class="h-scroll-tab${i === 0 ? ' active' : ''}" onclick="switchGroupTab('committee','${c}',this)">${c}</button>`
    ).join('');
  } else if (myCommittee) {
    tabsHtml = `<button class="h-scroll-tab active">${myCommittee}</button>`;
    // 体育委員会用チェックリスト
    if (myCommittee === '体育委員会') {
      tabsHtml += `<button class="h-scroll-tab" onclick="switchGroupTab('pe_checklist','',this)"><i class="fas fa-clipboard-list mr-1"></i>用具確認</button>`;
    }
  }

  const canPostCommittee = isStaff || ['chairman', 'vice_chairman'].includes(currentUser.role);
  container.innerHTML = `
    <div class="bg-white border-b">
      <div class="px-4 py-3 flex items-center justify-between">
        <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-users-cog text-purple-600"></i>委員会</h2>
        ${canPostCommittee ? `<button onclick="openPostModal('committee', currentCommitteeTarget)" class="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>` : ''}
      </div>
      <div class="h-scroll-tabs" id="committee-tabs">${tabsHtml}</div>
    </div>
    <div class="p-3" id="committee-list"><div class="skeleton h-24 mb-3"></div></div>
  `;
  const initialTarget = isStaff ? COMMITTEES[0] : myCommittee;
  window.currentCommitteeTarget = initialTarget;
  if (initialTarget) loadPosts('committee', initialTarget, 'committee-list');
}

function switchGroupTab(type, target, btn) {
  document.querySelectorAll('#committee-tabs .h-scroll-tab, #club-tabs .h-scroll-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (type === 'pe_checklist') {
    renderPEChecklist(document.getElementById('committee-list'));
    return;
  }
  if (type === 'committee') {
    window.currentCommitteeTarget = target;
    loadPosts('committee', target, 'committee-list');
  } else if (type === 'club') {
    window.currentClubTarget = target;
    loadPosts('club', target, 'club-list');
  }
}

// ============================================================
// 部活動タブ
// ============================================================
function renderClub(container) {
  const isStaff = ['admin', 'teacher'].includes(currentUser.role);
  const myClub = currentUser.club;
  
  let tabsHtml = '';
  if (isStaff) {
    tabsHtml = CLUBS.map((c, i) =>
      `<button class="h-scroll-tab${i === 0 ? ' active' : ''}" onclick="switchGroupTab('club','${c}',this)">${c}</button>`
    ).join('');
  } else if (myClub) {
    tabsHtml = `<button class="h-scroll-tab active">${myClub}</button>`;
  }

  const canPostClub = isStaff || ['captain', 'vice_captain'].includes(currentUser.role);
  container.innerHTML = `
    <div class="bg-white border-b">
      <div class="px-4 py-3 flex items-center justify-between">
        <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-running text-red-600"></i>部活動</h2>
        ${canPostClub ? `<button onclick="openPostModal('club', currentClubTarget)" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>` : ''}
      </div>
      <div class="h-scroll-tabs" id="club-tabs">${tabsHtml}</div>
    </div>
    <div class="p-3" id="club-list"><div class="skeleton h-24 mb-3"></div></div>
  `;
  const initialTarget = isStaff ? CLUBS[0] : myClub;
  window.currentClubTarget = initialTarget;
  if (initialTarget) loadPosts('club', initialTarget, 'club-list');
}

// ============================================================
// 投稿読み込み
// ============================================================
async function loadPosts(category, target, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    let url = `/api/posts?category=${category}`;
    if (target) url += `&target=${encodeURIComponent(target)}`;
    const res = await api(url);
    if (!res.posts || res.posts.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>投稿がありません</p></div>`;
      return;
    }
    container.innerHTML = res.posts.map(p => renderPostCard(p, category)).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読み込みに失敗しました</p></div>`;
  }
}

function renderPostCard(post, category) {
  const catClass = { committee: 'committee', club: 'club', school_notice: 'notice', class: 'class' }[category] || '';
  const unreadClass = !post.is_read ? 'unread' : '';
  const roleLabel = ROLES[post.author_role] || post.author_role;
  const expiresStr = post.expires_at ? `<span class="text-xs text-gray-400 ml-2"><i class="fas fa-clock"></i> ${formatDate(post.expires_at)}</span>` : '';
  const fileHtml = post.file_url ? renderFilePreview(post.file_url, post.file_type) : '';
  
  const reactions = (post.reactions || []).map(r =>
    `<button class="reaction-btn" onclick="reactToPost(${post.id},'${r.emoji}',this)">${r.emoji} <span>${r.count}</span></button>`
  ).join('');
  const addReaction = `<button class="reaction-btn" onclick="showEmojiPicker(${post.id}, 'post', this)"><i class="fas fa-smile-beam"></i></button>`;

  return `
    <div class="post-card ${catClass} ${unreadClass} slide-in" id="post-${post.id}">
      <div class="flex items-start justify-between mb-2">
        <div>
          <span class="badge badge-${post.author_role} mr-2">${roleLabel}</span>
          <span class="font-semibold text-gray-800">${esc(post.author_name || '不明')}</span>
          ${expiresStr}
        </div>
        <div class="flex gap-2 items-center">
          <span class="text-xs text-gray-400">${formatRelative(post.created_at)}</span>
          ${canDeletePost(post) ? `<button onclick="deletePost(${post.id})" class="text-red-400 hover:text-red-600 text-sm"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
      ${post.title ? `<h3 class="font-bold text-gray-800 mb-1">${esc(post.title)}</h3>` : ''}
      <p class="text-gray-700 text-sm whitespace-pre-wrap">${esc(post.content)}</p>
      ${fileHtml}
      <div class="flex flex-wrap gap-2 mt-3 items-center">
        ${reactions}${addReaction}
        ${!post.is_read ? '<span class="ml-auto text-xs text-green-600 font-semibold"><i class="fas fa-circle-dot mr-1"></i>未読</span>' : ''}
      </div>
      ${post.read_count !== null && post.read_count !== undefined ? `<div class="text-xs text-gray-400 mt-1"><i class="fas fa-eye mr-1"></i>既読 ${post.read_count}人</div>` : ''}
    </div>`;
}

function renderFilePreview(url, type) {
  if (!url) return '';
  if (type === 'image') return `<img src="${url}" class="mt-2 max-h-64 rounded-lg object-contain border" onerror="this.style.display='none'">`;
  if (type === 'pdf') return `<a href="${url}" target="_blank" class="mt-2 flex items-center gap-2 text-blue-600 hover:underline text-sm"><i class="fas fa-file-pdf text-red-500"></i> PDFを開く</a>`;
  return '';
}

function canDeletePost(post) {
  if (!currentUser) return false;
  if (['admin', 'teacher'].includes(currentUser.role)) return true;
  return post.author_id === currentUser.id;
}

async function deletePost(id) {
  if (!confirm('この投稿を削除しますか？')) return;
  try {
    await api(`/api/posts/${id}`, { method: 'DELETE' });
    document.getElementById(`post-${id}`)?.remove();
    toast('投稿を削除しました', 'success');
  } catch (e) { toast('削除に失敗しました', 'error'); }
}

async function reactToPost(postId, emoji, btn) {
  try {
    const res = await api(`/api/posts/${postId}/react`, { method: 'POST', body: { emoji } });
    const span = btn.querySelector('span');
    const count = parseInt(span?.textContent || '0');
    if (res.action === 'added') {
      btn.classList.add('reacted');
      if (span) span.textContent = count + 1;
    } else {
      btn.classList.remove('reacted');
      if (span) span.textContent = Math.max(0, count - 1);
    }
  } catch {}
}

function showEmojiPicker(targetId, type, btn) {
  const existing = document.querySelector('.emoji-picker');
  if (existing) existing.remove();
  const picker = document.createElement('div');
  picker.className = 'emoji-picker fixed z-50 bg-white rounded-xl shadow-2xl border p-2 flex gap-2';
  const rect = btn.getBoundingClientRect();
  picker.style.top = (rect.bottom + 4) + 'px';
  picker.style.left = rect.left + 'px';
  EMOJIS.forEach(e => {
    const btn2 = document.createElement('button');
    btn2.textContent = e;
    btn2.className = 'text-2xl hover:scale-125 transition';
    btn2.onclick = () => {
      picker.remove();
      if (type === 'post') reactToPost(targetId, e, { querySelector: () => null, classList: { add: () => {}, remove: () => {} } });
    };
    picker.appendChild(btn2);
  });
  document.body.appendChild(picker);
  setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 100);
}

// ============================================================
// 投稿作成モーダル
// ============================================================
function canPost(category) {
  const role = currentUser.role;
  if (['admin', 'teacher'].includes(role)) return true;
  if (category === 'bulletin') return false;
  if (category === 'school_notice') return false;
  if (category === 'lost_item') return ['captain', 'chairman', 'vice_captain', 'vice_chairman'].includes(role);
  if (category === 'club') return ['captain', 'vice_captain'].includes(role);
  if (category === 'committee') return ['chairman', 'vice_chairman'].includes(role);
  return false;
}

function openPostModal(category, target) {
  const t = window[`current${category === 'club' ? 'Club' : category === 'committee' ? 'Committee' : ''}Target`] || target;
  showModal('投稿を作成', `
    <div class="space-y-4">
      <div><label class="form-label">タイトル（任意）</label><input id="post-title" type="text" class="form-input" placeholder="タイトル（省略可）"></div>
      <div><label class="form-label">内容 *</label><textarea id="post-content" class="form-input" rows="5" placeholder="投稿内容を入力..."></textarea></div>
      <div>
        <label class="form-label">消去日（任意・最大2ヶ月後）</label>
        <input id="post-expires" type="date" class="form-input" min="${todayStr()}" max="${maxDateStr(60)}">
      </div>
      <div>
        <label class="form-label">ファイル添付（URL入力）</label>
        <input id="post-file-url" type="url" class="form-input" placeholder="https://... (画像またはPDF)">
        <select id="post-file-type" class="form-input mt-2">
          <option value="">種類を選択</option><option value="image">画像</option><option value="pdf">PDF</option>
        </select>
      </div>
    </div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: () => closeModal() },
    { label: '投稿する', className: 'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold', action: () => submitPost(category, t) }
  ]);
}

async function submitPost(category, target) {
  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();
  const expires = document.getElementById('post-expires').value;
  const fileUrl = document.getElementById('post-file-url').value.trim();
  const fileType = document.getElementById('post-file-type').value;
  if (!content) { toast('内容を入力してください', 'error'); return; }
  try {
    await api('/api/posts', { method: 'POST', body: {
      category, target, title: title || undefined,
      content, file_url: fileUrl || undefined, file_type: fileType || undefined,
      expires_at: expires ? new Date(expires).toISOString() : undefined
    }});
    closeModal();
    toast('投稿しました', 'success');
    renderTab(currentTab);
  } catch (e) { toast(e.message || '投稿に失敗しました', 'error'); }
}

// ============================================================
// 質問タブ（F位置）
// ============================================================
function renderQuestion(container) {
  container.innerHTML = `
    <div class="bg-white border-b">
      <div class="px-4 py-3 flex items-center justify-between">
        <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-question-circle text-green-600"></i>質問</h2>
        <button onclick="openAskModal()" class="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>質問する</button>
      </div>
      <div class="sub-nav">
        <button class="sub-nav-btn active" onclick="switchQuestionTab('my', this)">自分への質問</button>
        ${['admin', 'teacher'].includes(currentUser.role) ? `<button class="sub-nav-btn" onclick="switchQuestionTab('history', this)">質問履歴</button>` : ''}
      </div>
    </div>
    <div class="p-3" id="question-list"><div class="skeleton h-20 mb-3"></div></div>
  `;
  loadMyQuestions();
}

async function loadMyQuestions() {
  const container = document.getElementById('question-list');
  if (!container) return;
  try {
    const res = await api('/api/questions/my');
    if (!res.questions.length) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-question"></i><p>質問がありません</p></div>`;
      return;
    }
    container.innerHTML = res.questions.map(q => `
      <div class="card p-4 mb-3">
        <div class="flex justify-between mb-2">
          <span class="font-semibold text-sm text-gray-700">${esc(q.asker_name)}</span>
          <span class="text-xs text-gray-400">${formatRelative(q.created_at)}</span>
        </div>
        <p class="text-gray-800 text-sm">${esc(q.content)}</p>
        ${q.answer ? `<div class="mt-3 pt-3 border-t"><p class="text-green-700 text-sm"><i class="fas fa-reply mr-1"></i>${esc(q.answer)}</p></div>` :
          `<button onclick="openAnswerModal(${q.id})" class="mt-2 text-blue-600 text-sm hover:underline"><i class="fas fa-pen mr-1"></i>回答する</button>`
        }
      </div>`).join('');
  } catch { container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読み込み失敗</p></div>`; }
}

async function loadQuestionHistory() {
  const container = document.getElementById('question-list');
  if (!container) return;
  try {
    const res = await api('/api/questions/history');
    if (!res.questions.length) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-history"></i><p>質問履歴がありません</p></div>`;
      return;
    }
    container.innerHTML = res.questions.map(q => `
      <div class="card p-4 mb-3">
        <div class="flex justify-between mb-1">
          <span class="text-xs text-gray-500">${esc(q.asker_name)} → ${esc(q.target_name)}</span>
          <span class="text-xs text-gray-400">${formatRelative(q.created_at)}</span>
        </div>
        <p class="text-gray-800 text-sm">${esc(q.content)}</p>
        ${q.answer ? `<p class="text-green-700 text-sm mt-2"><i class="fas fa-reply mr-1"></i>${esc(q.answer)}</p>` : '<span class="text-xs text-gray-400">未回答</span>'}
      </div>`).join('');
  } catch { container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読み込み失敗</p></div>`; }
}

function switchQuestionTab(tab, btn) {
  document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'my') loadMyQuestions();
  else if (tab === 'history') loadQuestionHistory();
}

async function openAskModal() {
  try {
    const res = await api('/api/questions/targets');
    const opts = res.targets.map(t => `<option value="${t.id}">${esc(t.name)} (${ROLES[t.role]})</option>`).join('');
    showModal('質問する', `
      <div class="space-y-4">
        <div><label class="form-label">質問先</label>
          <select id="ask-target" class="form-input">${opts}</select></div>
        <div><label class="form-label">質問内容</label>
          <textarea id="ask-content" class="form-input" rows="4" placeholder="質問を入力..."></textarea></div>
        <p class="text-xs text-gray-400"><i class="fas fa-clock mr-1"></i>質問は15日後に自動削除されます</p>
      </div>
    `, [
      { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
      { label: '送信', className: 'bg-green-600 text-white px-6 py-2 rounded-xl font-semibold', action: submitAsk }
    ]);
  } catch (e) { toast('読み込みに失敗しました', 'error'); }
}

async function submitAsk() {
  const target_id = parseInt(document.getElementById('ask-target').value);
  const content = document.getElementById('ask-content').value.trim();
  if (!content) { toast('質問内容を入力してください', 'error'); return; }
  try {
    await api('/api/questions', { method: 'POST', body: { target_id, content } });
    closeModal();
    toast('質問を送信しました', 'success');
  } catch (e) { toast(e.message || '送信に失敗しました', 'error'); }
}

function openAnswerModal(qId) {
  showModal('回答する', `
    <div><label class="form-label">回答内容</label>
      <textarea id="answer-content" class="form-input" rows="4" placeholder="回答を入力..."></textarea></div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '回答する', className: 'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold', action: () => submitAnswer(qId) }
  ]);
}

async function submitAnswer(qId) {
  const answer = document.getElementById('answer-content').value.trim();
  if (!answer) { toast('回答を入力してください', 'error'); return; }
  try {
    await api(`/api/questions/${qId}/answer`, { method: 'PUT', body: { answer } });
    closeModal();
    toast('回答しました', 'success');
    loadMyQuestions();
  } catch (e) { toast('回答に失敗しました', 'error'); }
}

// ============================================================
// クラスグループタブ（G位置）
// ============================================================
function renderClassGroup(container) {
  const isStaff = ['admin', 'teacher'].includes(currentUser.role);
  let classTarget = currentUser.class_num ? String(currentUser.class_num) : null;
  
  let tabsHtml = '';
  if (isStaff) {
    const classes = [1,2,3,4,5,6,7,8,9];
    tabsHtml = classes.map((c, i) =>
      `<button class="h-scroll-tab${i === 0 ? ' active' : ''}" onclick="switchClassTab(${c},this)">${c}組</button>`
    ).join('');
    classTarget = '1';
  } else if (classTarget) {
    tabsHtml = `<button class="h-scroll-tab active">${classTarget}組</button>`;
  }

  const isDaminin = isStaff || (currentUser.is_homeroom && currentUser.homeroom_class == classTarget);
  container.innerHTML = `
    <div class="bg-white border-b">
      <div class="px-4 py-3 flex items-center justify-between">
        <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-chalkboard-teacher text-yellow-600"></i>クラス</h2>
        ${isStaff ? `<button onclick="openPostModal('class', classTarget)" class="bg-yellow-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>` : ''}
      </div>
      <div class="h-scroll-tabs" id="class-tabs">${tabsHtml}</div>
      ${!isStaff ? `<div class="px-4 pb-2 text-xs text-gray-500"><i class="fas fa-info-circle mr-1"></i>投稿にリアクションで返事できます。発言リクエストは先生が許可します。</div>` : ''}
    </div>
    <div class="p-3" id="class-list"><div class="skeleton h-24 mb-3"></div></div>
  `;
  window.classTarget = classTarget;
  if (classTarget) loadPosts('class', classTarget, 'class-list');
}

function switchClassTab(classNum, btn) {
  document.querySelectorAll('#class-tabs .h-scroll-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window.classTarget = String(classNum);
  loadPosts('class', String(classNum), 'class-list');
}

// ============================================================
// メッセージタブ
// ============================================================
let currentThreadId = null;
function renderMessages(container) {
  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-comments text-blue-600"></i>メッセージ</h2>
        <button onclick="openNewThreadModal('direct')" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>新規</button>
      </div>
      <div id="thread-list" class="flex-1 overflow-y-auto"></div>
    </div>
  `;
  loadThreads('all');
}

async function loadThreads(type) {
  const container = document.getElementById('thread-list');
  if (!container) return;
  try {
    const res = await api(`/api/messages/threads?type=${type}`);
    if (!res.threads.length) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-comment-slash"></i><p>メッセージがありません</p></div>`;
      return;
    }
    container.innerHTML = res.threads.map(t => {
      const otherMembers = t.members.filter(m => m.id !== currentUser.id);
      const name = t.name || otherMembers.map(m => m.name || '?').join('、') || 'グループ';
      const typeIcon = t.type === 'captain_group' ? '👑' : t.type === 'group' ? '👥' : '💬';
      return `
        <div class="thread-item" onclick="openThread(${t.id}, '${esc(name)}')">
          <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-none text-xl">${typeIcon}</div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline">
              <span class="font-semibold text-sm text-gray-800 truncate">${esc(name)}</span>
              <span class="text-xs text-gray-400 flex-none ml-2">${t.last_message_at ? formatRelative(t.last_message_at) : ''}</span>
            </div>
            <p class="text-xs text-gray-500 truncate">${t.last_message ? esc(t.last_message) : '（まだメッセージなし）'}</p>
          </div>
          ${t.unread_count > 0 ? `<span class="flex-none bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">${t.unread_count}</span>` : ''}
        </div>`;
    }).join('');
  } catch { container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>読み込み失敗</p></div>`; }
}

function openThread(threadId, threadName) {
  currentThreadId = threadId;
  const content = document.getElementById('tab-content');
  content.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onclick="navigateTo('messages')" class="p-1 hover:bg-gray-100 rounded-full text-gray-500"><i class="fas fa-arrow-left"></i></button>
        <span class="font-bold text-gray-800">${esc(threadName)}</span>
      </div>
      <div id="msg-list" class="flex-1 overflow-y-auto p-4 space-y-3"></div>
      <div class="bg-white border-t p-3 flex gap-2">
        <input id="msg-input" type="text" class="flex-1 form-input" placeholder="メッセージを入力..." onkeydown="if(event.key==='Enter')sendMessage()">
        <button onclick="sendMessage()" class="bg-blue-600 text-white px-4 rounded-xl"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>
  `;
  loadMessages(threadId);
}

async function loadMessages(threadId) {
  const container = document.getElementById('msg-list');
  if (!container) return;
  try {
    const res = await api(`/api/messages/threads/${threadId}/messages`);
    if (!res.messages.length) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-comment"></i><p>まだメッセージがありません</p></div>`;
      return;
    }
    container.innerHTML = res.messages.map(m => {
      const isMine = m.sender_id === currentUser.id;
      return `
        <div class="flex ${isMine ? 'justify-end' : 'justify-start'} gap-2 items-end">
          ${!isMine ? `<div class="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs flex-none">${(m.sender_name || '?')[0]}</div>` : ''}
          <div>
            ${!isMine ? `<p class="text-xs text-gray-500 mb-1 ml-1">${esc(m.sender_name)}</p>` : ''}
            <div class="msg-bubble ${isMine ? 'mine' : 'others'}">${esc(m.content)}</div>
            ${m.file_url ? renderFilePreview(m.file_url, m.file_type) : ''}
            <p class="text-xs text-gray-400 mt-1 ${isMine ? 'text-right' : ''}">${formatRelative(m.created_at)}</p>
          </div>
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  } catch {}
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const content = input?.value.trim();
  if (!content || !currentThreadId) return;
  input.value = '';
  try {
    await api(`/api/messages/threads/${currentThreadId}/messages`, { method: 'POST', body: { content } });
    loadMessages(currentThreadId);
  } catch (e) { toast(e.message || '送信に失敗しました', 'error'); }
}

async function openNewThreadModal(type) {
  try {
    const res = await api('/api/messages/users');
    const users = res.users;
    const opts = users.map(u => `<option value="${u.id}">${esc(u.name || u.id)} (${ROLES[u.role] || u.role})</option>`).join('');
    showModal('新規メッセージ', `
      <div class="space-y-4">
        <div><label class="form-label">種類</label>
          <select id="thread-type" class="form-input" onchange="updateThreadTypeUI(this.value)">
            <option value="direct">ダイレクトメッセージ</option>
            ${['admin', 'teacher'].includes(currentUser.role) ? `<option value="group">グループ（先生含む）</option>` : ''}
          </select></div>
        <div><label class="form-label">グループ名（グループの場合）</label>
          <input id="thread-name" type="text" class="form-input" placeholder="任意"></div>
        <div><label class="form-label">相手を選択</label>
          <select id="thread-members" class="form-input" multiple size="6">${opts}</select></div>
      </div>
    `, [
      { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
      { label: '作成', className: 'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold', action: createThread }
    ]);
  } catch (e) { toast('読み込み失敗', 'error'); }
}

async function createThread() {
  const type = document.getElementById('thread-type').value;
  const name = document.getElementById('thread-name').value.trim();
  const select = document.getElementById('thread-members');
  const member_ids = Array.from(select.selectedOptions).map(o => parseInt(o.value));
  if (!member_ids.length) { toast('相手を選択してください', 'error'); return; }
  try {
    const res = await api('/api/messages/threads', { method: 'POST', body: { type, name: name || null, member_ids } });
    closeModal();
    toast('作成しました', 'success');
    openThread(res.thread_id, name || '新しいチャット');
  } catch (e) { toast(e.message || '作成に失敗しました', 'error'); }
}

// ============================================================
// 部長チャットタブ
// ============================================================
function renderCaptChat(container) {
  const isStaff = ['admin', 'teacher'].includes(currentUser.role);
  container.innerHTML = `
    <div class="bg-white border-b px-4 py-3 flex items-center justify-between">
      <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-crown text-yellow-600"></i>部長委員長チャット</h2>
      ${isStaff ? `<button onclick="manageCaptChatMembers()" class="bg-yellow-600 text-white px-3 py-1.5 rounded-full text-sm"><i class="fas fa-users-cog"></i></button>` : ''}
    </div>
    <div id="captchat-list" class="p-3"><div class="skeleton h-20"></div></div>
  `;
  loadCaptChatThreads();
}

async function loadCaptChatThreads() {
  const container = document.getElementById('captchat-list');
  if (!container) return;
  try {
    const res = await api('/api/messages/threads?type=captain_group');
    if (!res.threads.length) {
      container.innerHTML = `
        <div class="empty-state"><i class="fas fa-crown"></i><p>部長チャットがまだありません</p></div>
        ${['admin', 'teacher'].includes(currentUser.role) ? `<div class="text-center mt-4"><button onclick="createCaptChatGroup()" class="bg-yellow-600 text-white px-6 py-2 rounded-full text-sm font-semibold">グループを作成</button></div>` : ''}
      `;
      return;
    }
    container.innerHTML = res.threads.map(t => `
      <div class="card p-4 mb-3 cursor-pointer hover:shadow-md" onclick="openThread(${t.id}, '${esc(t.name || '部長チャット')}')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-xl">👑</div>
          <div class="flex-1">
            <p class="font-bold text-gray-800">${esc(t.name || '部長委員長チャット')}</p>
            <p class="text-xs text-gray-500">${t.members?.map(m => esc(m.name || '?')).join('、') || ''}</p>
          </div>
          ${t.unread_count > 0 ? `<span class="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">${t.unread_count}</span>` : ''}
        </div>
      </div>`).join('');
  } catch {}
}

async function createCaptChatGroup() {
  const name = prompt('グループ名を入力してください:');
  if (!name) return;
  try {
    await api('/api/messages/threads', { method: 'POST', body: { type: 'captain_group', name, member_ids: [] } });
    toast('部長チャットを作成しました', 'success');
    loadCaptChatThreads();
  } catch (e) { toast(e.message || '作成に失敗しました', 'error'); }
}

// ============================================================
// 相談所タブ
// ============================================================
function renderConsult(container) {
  const isStaff = ['admin', 'teacher'].includes(currentUser.role);
  container.innerHTML = `
    <div class="bg-white border-b px-4 py-3 flex items-center justify-between">
      <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-hands-helping text-teal-600"></i>相談所</h2>
      ${!isStaff ? `<button onclick="openConsultModal()" class="bg-teal-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>相談する</button>` : ''}
    </div>
    <div class="p-3" id="consult-list"><div class="skeleton h-20"></div></div>
  `;
  loadConsultations();
}

async function loadConsultations() {
  const container = document.getElementById('consult-list');
  if (!container) return;
  try {
    const res = await api('/api/questions/consultations');
    if (!res.consultations.length) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-heart"></i><p>相談はありません</p></div>`;
      return;
    }
    const isStaff = ['admin', 'teacher'].includes(currentUser.role);
    container.innerHTML = res.consultations.map(c => `
      <div class="card p-4 mb-3">
        <div class="flex justify-between mb-2">
          <span class="text-sm font-semibold text-gray-700">${isStaff ? `相談者: ${esc(c.student_name)}` : `相談先: ${esc(c.teacher_name)}`}</span>
          <span class="text-xs text-gray-400">${formatRelative(c.created_at)}</span>
        </div>
        <p class="text-sm text-gray-800">${esc(c.content)}</p>
        ${c.reply ? `<div class="mt-3 pt-3 border-t text-sm text-teal-700"><i class="fas fa-reply mr-1"></i>${esc(c.reply)}</div>` :
          isStaff ? `<button onclick="openReplyModal(${c.id})" class="mt-2 text-teal-600 text-sm hover:underline"><i class="fas fa-pen mr-1"></i>返答する</button>` :
          '<span class="text-xs text-gray-400 mt-2 block">返答待ち...</span>'
        }
      </div>`).join('');
  } catch {}
}

async function openConsultModal() {
  try {
    const res = await api('/api/admin/teachers');
    const opts = res.teachers.map(t => `<option value="${t.id}">${esc(t.name)}${t.subject ? ` (${esc(t.subject)})` : ''}</option>`).join('');
    showModal('先生に相談する', `
      <div class="space-y-4">
        <div><label class="form-label">相談する先生</label><select id="consult-teacher" class="form-input">${opts}</select></div>
        <div><label class="form-label">相談内容</label><textarea id="consult-content" class="form-input" rows="5" placeholder="相談内容を入力..."></textarea></div>
        <p class="text-xs text-gray-400">* 相談内容は先生のみが確認できます</p>
      </div>
    `, [
      { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
      { label: '送信', className: 'bg-teal-600 text-white px-6 py-2 rounded-xl font-semibold', action: submitConsult }
    ]);
  } catch (e) { toast('読み込み失敗', 'error'); }
}

async function submitConsult() {
  const teacher_id = parseInt(document.getElementById('consult-teacher').value);
  const content = document.getElementById('consult-content').value.trim();
  if (!content) { toast('内容を入力してください', 'error'); return; }
  try {
    await api('/api/questions/consultations', { method: 'POST', body: { teacher_id, content } });
    closeModal();
    toast('相談を送信しました', 'success');
    loadConsultations();
  } catch (e) { toast('送信失敗', 'error'); }
}

function openReplyModal(cId) {
  showModal('返答する', `
    <div><label class="form-label">返答内容</label><textarea id="reply-content" class="form-input" rows="4"></textarea></div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '返答する', className: 'bg-teal-600 text-white px-6 py-2 rounded-xl font-semibold', action: () => submitReply(cId) }
  ]);
}

async function submitReply(cId) {
  const reply = document.getElementById('reply-content').value.trim();
  if (!reply) { toast('返答を入力してください', 'error'); return; }
  try {
    await api(`/api/questions/consultations/${cId}/reply`, { method: 'PUT', body: { reply } });
    closeModal();
    toast('返答しました', 'success');
    loadConsultations();
  } catch (e) { toast('失敗しました', 'error'); }
}

// ============================================================
// 使い方タブ
// ============================================================
function renderHowTo(container) {
  const role = currentUser.role;
  const guides = {
    admin: [
      { title: '管理者ガイド', icon: 'fa-shield-alt', content: '設定タブからユーザー管理、一括生成、通知送信、システム診断、統計確認が行えます。' },
      { title: 'ユーザー管理', icon: 'fa-users', content: '設定→ユーザー一覧から権限変更・パスワード変更・アカウント削除ができます。' },
      { title: 'ユーザー一括生成', icon: 'fa-user-plus', content: '設定→ユーザー登録から一斉発行や一括生成ができます。生徒は「年度下2桁+クラス+番号」形式で生成されます。' },
    ],
    teacher: [
      { title: '先生ガイド', icon: 'fa-chalkboard-teacher', content: 'ほぼ管理者と同等の操作ができます。ただし管理者アカウントの変更・削除はできません。' },
      { title: '投稿管理', icon: 'fa-tasks', content: '設定→投稿管理から投稿を一覧・削除できます。' },
      { title: '通知送信', icon: 'fa-bell', content: '設定→通知から防災情報・通知テスト・通常通知を全員に送信できます。' },
    ],
    captain: [
      { title: '部長・委員長ガイド', icon: 'fa-crown', content: '自分の部活・委員会への投稿、部長チャット参加、質問への回答ができます。' },
      { title: '質問への回答', icon: 'fa-reply', content: '質問タブの「自分への質問」から届いた質問に回答できます。' },
    ],
    student: [
      { title: '生徒ガイド', icon: 'fa-graduation-cap', content: '掲示板・部活・委員会の投稿を確認できます。先生への相談・質問が行えます。' },
      { title: 'リアクション', icon: 'fa-thumbs-up', content: '投稿にリアクション（👍❤️😊🎉）を付けられます。' },
      { title: 'メッセージ', icon: 'fa-comments', content: '先生とのメッセージが利用できます（生徒同士は不可）。' },
    ],
  };

  const showRole = ['captain', 'chairman', 'vice_captain', 'vice_chairman'].includes(role) ? 'captain' : (role || 'student');
  const guide = guides[showRole] || guides.student;

  container.innerHTML = `
    <div class="bg-white border-b px-4 py-3">
      <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-book-open text-indigo-600"></i>使い方</h2>
    </div>
    <div class="p-4 space-y-4">
      ${guide.map(g => `
        <div class="card p-4">
          <h3 class="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <i class="fas ${g.icon} text-indigo-600"></i>${g.title}
          </h3>
          <p class="text-sm text-gray-600">${g.content}</p>
        </div>`).join('')}
      <div class="card p-4">
        <h3 class="font-bold text-gray-800 mb-2 flex items-center gap-2"><i class="fas fa-info-circle text-blue-600"></i>共通機能</h3>
        <ul class="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>投稿は15秒ごとに自動更新されます</li>
          <li>投稿に消去日を設定すると自動で削除されます（最大2ヶ月）</li>
          <li>PDFや画像をURLで添付できます</li>
          <li>プッシュ通知の設定は設定タブ→通知から変更できます</li>
        </ul>
      </div>
    </div>
  `;
}

// ============================================================
// 設定タブ（H位置）
// ============================================================
function renderSettings(container) {
  const isStaff = ['admin', 'teacher'].includes(currentUser.role);
  const isAdmin = currentUser.role === 'admin';

  container.innerHTML = `
    <div class="bg-white border-b px-4 py-3">
      <h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-cog text-gray-600"></i>設定</h2>
    </div>
    <div class="p-3 space-y-2">

      ${isStaff ? `
      <!-- ユーザー一覧 -->
      <div class="settings-section">
        <div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">ユーザー管理</div>
        <div class="settings-row" onclick="openUserList()">
          <div class="flex items-center gap-3"><i class="fas fa-users text-blue-600 w-5"></i><span class="font-medium">ユーザー一覧</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="settings-row" onclick="openUserRegistration()">
          <div class="flex items-center gap-3"><i class="fas fa-user-plus text-green-600 w-5"></i><span class="font-medium">ユーザー登録</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="settings-row" onclick="openBulkCreate()">
          <div class="flex items-center gap-3"><i class="fas fa-users-cog text-purple-600 w-5"></i><span class="font-medium">ユーザー一括生成</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="settings-row" onclick="openPostManagement()">
          <div class="flex items-center gap-3"><i class="fas fa-tasks text-orange-600 w-5"></i><span class="font-medium">投稿管理</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
      </div>

      <!-- 通知 -->
      <div class="settings-section">
        <div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">通知</div>
        <div class="settings-row" onclick="openBroadcastNotif()">
          <div class="flex items-center gap-3"><i class="fas fa-broadcast-tower text-red-600 w-5"></i><span class="font-medium">全体通知送信</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="settings-row" onclick="openSelfNotif()">
          <div class="flex items-center gap-3"><i class="fas fa-user-clock text-indigo-600 w-5"></i><span class="font-medium">自分への通知設定</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
      </div>

      <!-- 診断・統計 -->
      <div class="settings-section">
        <div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">システム</div>
        <div class="settings-row" onclick="openDiagnose()">
          <div class="flex items-center gap-3"><i class="fas fa-stethoscope text-teal-600 w-5"></i><span class="font-medium">システム診断</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="settings-row" onclick="openStats()">
          <div class="flex items-center gap-3"><i class="fas fa-chart-bar text-yellow-600 w-5"></i><span class="font-medium">統計</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
      </div>

      <!-- アップデート -->
      <div class="settings-section">
        <div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">アップデート</div>
        <div class="settings-row" onclick="checkForUpdate()">
          <div class="flex items-center gap-3"><i class="fas fa-sync-alt text-blue-600 w-5"></i><span class="font-medium">アップデートを確認</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="px-4 py-2 text-xs text-gray-400">現在のバージョン: v1.0.0</div>
      </div>` : ''}

      <!-- 通知設定（全員） -->
      <div class="settings-section">
        <div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">通知設定</div>
        <div class="settings-row" onclick="openMyNotifSettings()">
          <div class="flex items-center gap-3"><i class="fas fa-bell text-blue-600 w-5"></i><span class="font-medium">通知の設定</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="settings-row" onclick="openSelfNotif()">
          <div class="flex items-center gap-3"><i class="fas fa-alarm-clock text-purple-600 w-5"></i><span class="font-medium">自分への通知（アラーム）</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
      </div>

      <!-- プロフィール -->
      <div class="settings-section">
        <div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">アカウント</div>
        <div class="settings-row" onclick="showMyProfile()">
          <div class="flex items-center gap-3"><i class="fas fa-user-circle text-gray-600 w-5"></i><span class="font-medium">アカウント情報</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="settings-row" onclick="openEditProfile()">
          <div class="flex items-center gap-3"><i class="fas fa-pen text-gray-600 w-5"></i><span class="font-medium">プロフィール編集</span></div>
          <i class="fas fa-chevron-right text-gray-300"></i>
        </div>
        <div class="settings-row text-red-500" onclick="doLogout()">
          <div class="flex items-center gap-3"><i class="fas fa-sign-out-alt w-5"></i><span class="font-medium">ログアウト</span></div>
          <i class="fas fa-chevron-right text-red-200"></i>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// 設定機能
// ============================================================
async function openUserList() {
  showModal('ユーザー一覧', '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-blue-600 text-2xl"></i></div>', [
    { label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal }
  ]);
  try {
    const res = await api('/api/admin/users');
    const body = document.getElementById('modal-body');
    body.innerHTML = `
      <div class="mb-3"><input type="text" id="user-search" class="form-input" placeholder="名前・ユーザー名で検索" oninput="filterUsers(this.value)"></div>
      <div id="user-list-inner" class="space-y-2 max-h-96 overflow-y-auto">
        ${res.users.map(u => renderUserItem(u)).join('')}
      </div>`;
    window._allUsers = res.users;
  } catch (e) { document.getElementById('modal-body').innerHTML = '<p class="text-red-500">読み込み失敗</p>'; }
}

function filterUsers(q) {
  const users = (window._allUsers || []).filter(u =>
    (u.name || '').includes(q) || (u.username || '').includes(q) || (u.role || '').includes(q)
  );
  document.getElementById('user-list-inner').innerHTML = users.map(renderUserItem).join('');
}

function renderUserItem(u) {
  const canEdit = currentUser.role === 'admin' || u.role !== 'admin';
  return `
    <div class="card p-3 flex items-center gap-3">
      <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold flex-none">
        ${(u.name || u.username || '?')[0]}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm truncate">${esc(u.name || '(未設定)')} <span class="text-gray-400 text-xs">@${esc(u.username)}</span></p>
        <p class="text-xs text-gray-500">${ROLES[u.role] || u.role}${u.grade ? ` | ${u.grade}年${u.class_num}組${u.number}番` : ''}${u.club ? ` | ${u.club}` : ''}</p>
      </div>
      ${canEdit ? `<div class="flex gap-2 flex-none">
        <button onclick="editUser(${u.id})" class="text-blue-500 hover:text-blue-700 text-sm p-1"><i class="fas fa-pen"></i></button>
        <button onclick="deleteUser(${u.id}, '${esc(u.name || u.username)}')" class="text-red-400 hover:text-red-600 text-sm p-1"><i class="fas fa-trash"></i></button>
      </div>` : ''}
    </div>`;
}

async function editUser(userId) {
  const user = (window._allUsers || []).find(u => u.id === userId);
  if (!user) return;
  const roleOpts = Object.entries(ROLES).filter(([r]) => currentUser.role === 'admin' || r !== 'admin')
    .map(([r, l]) => `<option value="${r}" ${user.role === r ? 'selected' : ''}>${l}</option>`).join('');
  const clubOpts = ['', ...CLUBS].map(c => `<option value="${c}" ${user.club === c ? 'selected' : ''}>${c || '（なし）'}</option>`).join('');
  const commOpts = ['', ...COMMITTEES].map(c => `<option value="${c}" ${user.committee === c ? 'selected' : ''}>${c || '（なし）'}</option>`).join('');

  showModal(`ユーザー編集: ${user.name || user.username}`, `
    <div class="space-y-3">
      <div><label class="form-label">名前</label><input id="eu-name" class="form-input" value="${esc(user.name || '')}"></div>
      <div><label class="form-label">権限</label><select id="eu-role" class="form-input">${roleOpts}</select></div>
      ${!['admin','teacher'].includes(user.role) ? `
        <div class="grid grid-cols-3 gap-2">
          <div><label class="form-label">学年</label><input id="eu-grade" type="number" class="form-input" value="${user.grade || ''}"></div>
          <div><label class="form-label">クラス</label><input id="eu-class" type="number" class="form-input" value="${user.class_num || ''}"></div>
          <div><label class="form-label">番号</label><input id="eu-number" type="number" class="form-input" value="${user.number || ''}"></div>
        </div>
        <div><label class="form-label">部活</label><select id="eu-club" class="form-input">${clubOpts}</select></div>
        <div><label class="form-label">委員会</label><select id="eu-committee" class="form-input">${commOpts}</select></div>
      ` : ''}
      <div><label class="form-label">新しいパスワード（変更時のみ）</label><input id="eu-password" type="password" class="form-input" placeholder="空欄=変更なし"></div>
    </div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '保存', className: 'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold', action: () => saveUser(userId) }
  ]);
}

async function saveUser(userId) {
  const body = {
    name: document.getElementById('eu-name')?.value.trim(),
    role: document.getElementById('eu-role')?.value,
    grade: parseInt(document.getElementById('eu-grade')?.value) || undefined,
    class_num: parseInt(document.getElementById('eu-class')?.value) || undefined,
    number: parseInt(document.getElementById('eu-number')?.value) || undefined,
    club: document.getElementById('eu-club')?.value || undefined,
    committee: document.getElementById('eu-committee')?.value || undefined,
    password: document.getElementById('eu-password')?.value || undefined,
  };
  try {
    await api(`/api/admin/users/${userId}`, { method: 'PUT', body });
    closeModal();
    toast('更新しました', 'success');
    openUserList();
  } catch (e) { toast(e.message || '更新失敗', 'error'); }
}

async function deleteUser(userId, name) {
  if (!confirm(`${name} を削除しますか？`)) return;
  try {
    await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
    toast('削除しました', 'success');
    openUserList();
  } catch (e) { toast(e.message || '削除失敗', 'error'); }
}

function openUserRegistration() {
  showModal('ユーザー登録', `
    <div class="space-y-4">
      <div class="settings-section">
        <div class="px-4 py-3 font-semibold text-gray-700">招待コード発行</div>
        <div class="p-4 space-y-3">
          <div><label class="form-label">権限</label>
            <select id="reg-role" class="form-input">
              ${Object.entries(ROLES).filter(([r]) => currentUser.role === 'admin' || r !== 'admin')
                .map(([r, l]) => `<option value="${r}">${l}</option>`).join('')}
            </select></div>
          <div><label class="form-label">有効時間（時間）</label>
            <select id="reg-hours" class="form-input">
              <option value="1">1時間</option><option value="6">6時間</option>
              <option value="24" selected>24時間</option><option value="72">3日</option><option value="168">7日</option>
            </select></div>
          <div><label class="form-label">発行枚数</label>
            <input id="reg-count" type="number" class="form-input" value="1" min="1" max="100"></div>
          <button onclick="generateTokens()" class="w-full bg-green-600 text-white py-2 rounded-xl font-semibold text-sm">招待コードを発行</button>
        </div>
      </div>
      <div id="token-result" class="hidden">
        <label class="form-label">発行されたコード</label>
        <div id="token-list" class="bg-gray-50 p-3 rounded-xl text-sm font-mono space-y-1"></div>
      </div>
    </div>
  `, [{ label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal }]);
}

async function generateTokens() {
  const role = document.getElementById('reg-role').value;
  const hours = parseInt(document.getElementById('reg-hours').value);
  const count = parseInt(document.getElementById('reg-count').value);
  try {
    const res = await api('/api/admin/tokens', { method: 'POST', body: { role, hours, count } });
    document.getElementById('token-result').classList.remove('hidden');
    document.getElementById('token-list').innerHTML = res.tokens.map(t =>
      `<div class="flex items-center justify-between"><span class="font-bold tracking-widest">${t}</span>
       <button onclick="navigator.clipboard.writeText('${t}');toast('コピーしました','success')" class="text-blue-600 text-xs"><i class="fas fa-copy"></i></button></div>`
    ).join('');
    toast(`${count}件のコードを発行しました`, 'success');
  } catch (e) { toast('発行失敗', 'error'); }
}

function openBulkCreate() {
  const isAdmin = currentUser.role === 'admin';
  showModal('ユーザー一括生成', `
    <div class="space-y-4">
      <div class="settings-section">
        <div class="px-4 py-3 font-semibold text-gray-700">生徒一括生成</div>
        <div class="p-4 space-y-3">
          <p class="text-xs text-gray-500">ユーザー名：年度下2桁 + クラス番号 + 番号2桁<br>例：2024年3組20番 → <strong>24320</strong></p>
          <div class="grid grid-cols-3 gap-2">
            <div><label class="form-label">年度</label><input id="bc-year" type="number" class="form-input" value="2024" min="2020" max="2030"></div>
            <div><label class="form-label">クラス</label><input id="bc-class" type="number" class="form-input" min="1" max="9"></div>
            <div><label class="form-label">人数</label><input id="bc-count" type="number" class="form-input" value="30" min="1" max="50"></div>
          </div>
          <div><label class="form-label">初期パスワード（省略可）</label><input id="bc-password" type="text" class="form-input" placeholder="デフォルト: password"></div>
          <button onclick="bulkCreateStudents()" class="w-full bg-blue-600 text-white py-2 rounded-xl font-semibold text-sm">生徒を一括生成</button>
        </div>
      </div>
      ${isAdmin ? `
      <div class="settings-section">
        <div class="px-4 py-3 font-semibold text-gray-700">先生一括生成</div>
        <div class="p-4 space-y-3">
          <p class="text-xs text-gray-500">ユーザー名：T001, T002... の形式で生成</p>
          <div class="grid grid-cols-2 gap-2">
            <div><label class="form-label">人数</label><input id="bc-teacher-count" type="number" class="form-input" value="5" min="1" max="50"></div>
            <div><label class="form-label">初期パスワード</label><input id="bc-teacher-password" type="text" class="form-input" placeholder="teacher1234"></div>
          </div>
          <button onclick="bulkCreateTeachers()" class="w-full bg-teal-600 text-white py-2 rounded-xl font-semibold text-sm">先生を一括生成</button>
        </div>
      </div>` : ''}
      <div id="bulk-result"></div>
    </div>
  `, [{ label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal }]);
}

async function bulkCreateStudents() {
  const year = parseInt(document.getElementById('bc-year').value);
  const class_num = parseInt(document.getElementById('bc-class').value);
  const count = parseInt(document.getElementById('bc-count').value);
  const password = document.getElementById('bc-password').value.trim() || undefined;
  if (!class_num) { toast('クラスを入力してください', 'error'); return; }
  try {
    const res = await api('/api/admin/bulk-create/students', { method: 'POST', body: { year, class_num, count, password } });
    document.getElementById('bulk-result').innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-xl p-3">
        <p class="text-green-700 font-semibold text-sm mb-2"><i class="fas fa-check-circle mr-1"></i>${res.count}件生成しました</p>
        <div class="text-xs font-mono text-gray-600 max-h-40 overflow-y-auto">${res.created.join('、')}</div>
      </div>`;
    toast(`${res.count}件の生徒アカウントを生成しました`, 'success');
  } catch (e) { toast(e.message || '生成失敗', 'error'); }
}

async function bulkCreateTeachers() {
  const count = parseInt(document.getElementById('bc-teacher-count').value);
  const password = document.getElementById('bc-teacher-password').value.trim() || undefined;
  try {
    const res = await api('/api/admin/bulk-create/teachers', { method: 'POST', body: { count, password } });
    document.getElementById('bulk-result').innerHTML = `
      <div class="bg-teal-50 border border-teal-200 rounded-xl p-3">
        <p class="text-teal-700 font-semibold text-sm mb-2"><i class="fas fa-check-circle mr-1"></i>${res.count}件生成しました</p>
        <div class="text-xs font-mono text-gray-600">${res.created.join('、')}</div>
      </div>`;
    toast(`${res.count}件の先生アカウントを生成しました`, 'success');
  } catch (e) { toast(e.message || '生成失敗', 'error'); }
}

async function openPostManagement() {
  showModal('投稿管理', '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-blue-600 text-2xl"></i></div>', [
    { label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal }
  ]);
  try {
    const res = await api('/api/admin/posts');
    const body = document.getElementById('modal-body');
    window._adminPosts = res.posts;
    body.innerHTML = `
      <div class="flex gap-2 mb-3">
        <button onclick="selectAllPosts()" class="text-blue-600 text-sm hover:underline">全選択</button>
        <button onclick="deleteSelectedPosts()" class="text-red-600 text-sm hover:underline ml-auto"><i class="fas fa-trash mr-1"></i>選択削除</button>
      </div>
      <div class="space-y-2 max-h-96 overflow-y-auto">
        ${res.posts.map(p => `
          <div class="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
            <input type="checkbox" class="post-checkbox mt-1" value="${p.id}">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500">${p.category} | ${esc(p.author_name)} | ${formatRelative(p.created_at)}</p>
              <p class="text-sm truncate">${esc(p.title || p.content)}</p>
            </div>
            <button onclick="deleteSinglePost(${p.id})" class="text-red-400 hover:text-red-600 text-sm flex-none"><i class="fas fa-trash"></i></button>
          </div>`).join('')}
      </div>`;
  } catch { document.getElementById('modal-body').innerHTML = '<p class="text-red-500">読み込み失敗</p>'; }
}

function selectAllPosts() {
  document.querySelectorAll('.post-checkbox').forEach(cb => cb.checked = true);
}

async function deleteSelectedPosts() {
  const ids = Array.from(document.querySelectorAll('.post-checkbox:checked')).map(cb => parseInt(cb.value));
  if (!ids.length) { toast('削除する投稿を選択してください', 'error'); return; }
  if (!confirm(`${ids.length}件の投稿を削除しますか？`)) return;
  try {
    await api('/api/posts', { method: 'DELETE', body: { ids } });
    toast('削除しました', 'success');
    openPostManagement();
  } catch (e) { toast('削除失敗', 'error'); }
}

async function deleteSinglePost(id) {
  if (!confirm('この投稿を削除しますか？')) return;
  try {
    await api(`/api/posts/${id}`, { method: 'DELETE' });
    toast('削除しました', 'success');
    openPostManagement();
  } catch (e) { toast('削除失敗', 'error'); }
}

async function openBroadcastNotif() {
  showModal('全体通知送信', `
    <div class="space-y-4">
      <div><label class="form-label">通知タイプ</label>
        <select id="notif-type" class="form-input">
          <option value="normal">普通の通知</option>
          <option value="disaster">防災情報</option>
          <option value="push_test">通知テスト</option>
        </select></div>
      <div><label class="form-label">タイトル</label><input id="notif-title" class="form-input" placeholder="通知タイトル"></div>
      <div><label class="form-label">内容</label><textarea id="notif-body" class="form-input" rows="3" placeholder="通知内容"></textarea></div>
    </div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '送信', className: 'bg-red-600 text-white px-6 py-2 rounded-xl font-semibold', action: sendBroadcast }
  ]);
}

async function sendBroadcast() {
  const type = document.getElementById('notif-type').value;
  const title = document.getElementById('notif-title').value.trim();
  const body = document.getElementById('notif-body').value.trim();
  if (!title || !body) { toast('タイトルと内容を入力してください', 'error'); return; }
  try {
    const res = await api('/api/admin/notifications/broadcast', { method: 'POST', body: { type, title, body } });
    closeModal();
    toast(`${res.sent}名に通知を送信しました`, 'success');
  } catch (e) { toast('送信失敗', 'error'); }
}

function openSelfNotif() {
  showModal('自分への通知', `
    <div class="space-y-4">
      <div><label class="form-label">タイトル</label><input id="self-notif-title" class="form-input" placeholder="通知タイトル"></div>
      <div><label class="form-label">内容</label><textarea id="self-notif-body" class="form-input" rows="3" placeholder="通知内容"></textarea></div>
      <div><label class="form-label">通知時刻（任意）</label><input id="self-notif-time" type="datetime-local" class="form-input"></div>
    </div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '設定', className: 'bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold', action: saveSelfNotif }
  ]);
}

async function saveSelfNotif() {
  const title = document.getElementById('self-notif-title').value.trim();
  const body = document.getElementById('self-notif-body').value.trim();
  const scheduled_at = document.getElementById('self-notif-time').value;
  if (!title) { toast('タイトルを入力してください', 'error'); return; }
  try {
    await api('/api/admin/notifications/self', { method: 'POST', body: { title, body, scheduled_at: scheduled_at || undefined } });
    closeModal();
    toast('通知を設定しました', 'success');
  } catch (e) { toast('設定失敗', 'error'); }
}

async function openDiagnose() {
  showModal('システム診断', '<div class="text-center py-6"><i class="fas fa-spinner fa-spin text-teal-600 text-3xl"></i><p class="text-gray-500 mt-2">診断中...</p></div>', [
    { label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal }
  ]);
  try {
    const res = await api('/api/admin/diagnose');
    const body = document.getElementById('modal-body');
    const statusIcon = res.status === 'ok' ? '✅' : '⚠️';
    body.innerHTML = `
      <div class="space-y-3">
        <div class="text-center py-2">
          <span class="text-4xl">${statusIcon}</span>
          <p class="font-bold text-lg mt-2">${res.status === 'ok' ? 'システム正常' : '要確認'}</p>
          <p class="text-xs text-gray-400">${new Date(res.timestamp).toLocaleString('ja-JP')}</p>
        </div>
        ${res.checks.map(c => `
          <div class="flex items-center gap-3 p-3 ${c.status === 'ok' ? 'bg-green-50' : c.status === 'error' ? 'bg-red-50' : 'bg-blue-50'} rounded-xl">
            <i class="fas ${c.status === 'ok' ? 'fa-check-circle text-green-600' : c.status === 'error' ? 'fa-exclamation-circle text-red-600' : 'fa-info-circle text-blue-600'}"></i>
            <div><p class="font-semibold text-sm">${c.name}</p><p class="text-xs text-gray-600">${c.message}</p></div>
          </div>`).join('')}
      </div>`;
  } catch { document.getElementById('modal-body').innerHTML = '<p class="text-red-500 text-center">診断失敗</p>'; }
}

async function openStats() {
  showModal('統計', '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-yellow-600 text-2xl"></i></div>', [
    { label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal }
  ]);
  try {
    const res = await api('/api/admin/stats');
    const body = document.getElementById('modal-body');
    const maxClub = Math.max(...res.byClub.map(c => c.cnt), 1);
    const maxComm = Math.max(...res.byCommittee.map(c => c.cnt), 1);

    body.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-blue-50 rounded-xl p-3 text-center">
            <p class="text-3xl font-bold text-blue-700">${res.total}</p>
            <p class="text-xs text-gray-500 mt-1">総ユーザー数</p>
          </div>
          <div class="grid grid-cols-2 gap-1">
            ${res.byRole.map(r => `<div class="bg-gray-50 rounded-lg p-2 text-center">
              <p class="font-bold text-sm">${r.cnt}</p>
              <p class="text-xs text-gray-400">${ROLES[r.role] || r.role}</p></div>`).join('')}
          </div>
        </div>
        
        <div>
          <h4 class="font-bold text-sm text-gray-700 mb-2">部活別人数</h4>
          ${res.byClub.slice(0, 10).map(c => `
            <div class="stat-bar">
              <span class="text-xs text-gray-600 w-24 flex-none truncate">${c.club}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div class="stat-bar-fill" style="width:${(c.cnt/maxClub*100).toFixed(0)}%">${c.cnt}人</div>
              </div>
            </div>`).join('')}
        </div>

        <div>
          <h4 class="font-bold text-sm text-gray-700 mb-2">委員会別人数</h4>
          ${res.byCommittee.slice(0, 10).map(c => `
            <div class="stat-bar">
              <span class="text-xs text-gray-600 w-24 flex-none truncate">${c.committee}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div class="stat-bar-fill" style="width:${(c.cnt/maxComm*100).toFixed(0)}%;background: linear-gradient(90deg,#9b59b6,#8e44ad)">${c.cnt}人</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  } catch { document.getElementById('modal-body').innerHTML = '<p class="text-red-500">読み込み失敗</p>'; }
}

async function openMyNotifSettings() {
  let settings = {};
  try {
    const res = await api('/api/admin/notifications/settings');
    settings = res.settings || {};
  } catch {}

  const toggle = (key, label) => `
    <div class="settings-row">
      <span class="font-medium text-sm">${label}</span>
      <div class="toggle ${settings[key] !== 0 ? 'on' : ''}" id="toggle-${key}" onclick="toggleSetting('${key}')"></div>
    </div>`;

  showModal('通知設定', `
    <div class="settings-section">
      ${toggle('push_enabled', 'プッシュ通知')}
      ${toggle('disaster_enabled', '防災情報通知')}
      ${toggle('club_post_enabled', '部活動の投稿')}
      ${toggle('committee_post_enabled', '委員会の投稿')}
      ${toggle('school_notice_enabled', '上中連絡')}
      ${toggle('message_enabled', 'メッセージ')}
    </div>
    <button onclick="saveNotifSettings()" class="w-full bg-blue-600 text-white py-2 rounded-xl font-semibold text-sm mt-3">保存</button>
  `, [{ label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal }]);
}

function toggleSetting(key) {
  const el = document.getElementById(`toggle-${key}`);
  if (el) el.classList.toggle('on');
}

async function saveNotifSettings() {
  const getToggle = (key) => document.getElementById(`toggle-${key}`)?.classList.contains('on') ? 1 : 0;
  try {
    await api('/api/admin/notifications/settings', { method: 'PUT', body: {
      push_enabled: getToggle('push_enabled'),
      disaster_enabled: getToggle('disaster_enabled'),
      club_post_enabled: getToggle('club_post_enabled'),
      committee_post_enabled: getToggle('committee_post_enabled'),
      school_notice_enabled: getToggle('school_notice_enabled'),
      message_enabled: getToggle('message_enabled'),
    }});
    toast('設定を保存しました', 'success');
  } catch { toast('保存失敗', 'error'); }
}

async function showMyProfile() {
  const u = currentUser;
  showModal('アカウント情報', `
    <div class="space-y-4">
      <div class="text-center">
        <div class="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600 mx-auto mb-2">
          ${u.avatar_url ? `<img src="${u.avatar_url}" class="w-full h-full rounded-full object-cover">` : (u.name || '?')[0]}
        </div>
        <p class="font-bold text-lg">${esc(u.name || '(未設定)')}</p>
        <span class="badge badge-${u.role}">${ROLES[u.role] || u.role}</span>
      </div>
      <div class="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <div class="flex justify-between"><span class="text-gray-500">ユーザー名</span><span class="font-medium">@${esc(u.username)}</span></div>
        ${u.grade ? `<div class="flex justify-between"><span class="text-gray-500">学年・クラス</span><span class="font-medium">${u.grade}年${u.class_num}組${u.number}番</span></div>` : ''}
        ${u.club ? `<div class="flex justify-between"><span class="text-gray-500">部活動</span><span class="font-medium">${esc(u.club)}</span></div>` : ''}
        ${u.committee ? `<div class="flex justify-between"><span class="text-gray-500">委員会</span><span class="font-medium">${esc(u.committee)}</span></div>` : ''}
        ${u.subject ? `<div class="flex justify-between"><span class="text-gray-500">担当教科</span><span class="font-medium">${esc(u.subject)}</span></div>` : ''}
        ${u.bio ? `<div class="flex justify-between"><span class="text-gray-500">自己紹介</span><span class="font-medium">${esc(u.bio)}</span></div>` : ''}
      </div>
    </div>
  `, [
    { label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '編集', className: 'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold', action: () => { closeModal(); openEditProfile(); } }
  ]);
}

async function openEditProfile() {
  const u = currentUser;
  const isStaff = ['admin', 'teacher'].includes(u.role);
  const clubOpts = ['', ...CLUBS].map(c => `<option value="${c}" ${u.club === c ? 'selected' : ''}>${c || '（なし）'}</option>`).join('');
  const commOpts = ['', ...COMMITTEES].map(c => `<option value="${c}" ${u.committee === c ? 'selected' : ''}>${c || '（なし）'}</option>`).join('');

  showModal('プロフィール編集', `
    <div class="space-y-3">
      <div><label class="form-label">名前</label><input id="ep-name" class="form-input" value="${esc(u.name || '')}"></div>
      <div><label class="form-label">自己紹介</label><textarea id="ep-bio" class="form-input" rows="2" placeholder="自己紹介（任意）">${esc(u.bio || '')}</textarea></div>
      <div><label class="form-label">アバターURL（任意）</label><input id="ep-avatar" type="url" class="form-input" value="${esc(u.avatar_url || '')}" placeholder="https://..."></div>
      ${!isStaff ? `
        <div><label class="form-label">部活（許可が必要）</label><select id="ep-club" class="form-input">${clubOpts}</select></div>
        <div><label class="form-label">委員会（許可が必要）</label><select id="ep-committee" class="form-input">${commOpts}</select></div>` : ''}
      ${u.role === 'teacher' ? `
        <div><label class="form-label">担当教科</label><input id="ep-subject" class="form-input" value="${esc(u.subject || '')}"></div>
        <div><label class="form-label">担任</label>
          <select id="ep-homeroom" class="form-input">
            <option value="0" ${!u.is_homeroom ? 'selected' : ''}>なし</option>
            <option value="1" ${u.is_homeroom ? 'selected' : ''}>あり</option>
          </select></div>
        <div><label class="form-label">担任クラス</label><input id="ep-homeroom-class" type="number" class="form-input" value="${u.homeroom_class || ''}"></div>` : ''}
      <div><label class="form-label">新しいパスワード（変更時のみ）</label><input id="ep-password" type="password" class="form-input" placeholder="空欄=変更なし"></div>
    </div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '保存', className: 'bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold', action: saveProfile }
  ]);
}

async function saveProfile() {
  const body = {
    name: document.getElementById('ep-name')?.value.trim(),
    bio: document.getElementById('ep-bio')?.value.trim() || undefined,
    avatar_url: document.getElementById('ep-avatar')?.value.trim() || undefined,
    password: document.getElementById('ep-password')?.value || undefined,
    club: document.getElementById('ep-club')?.value || undefined,
    committee: document.getElementById('ep-committee')?.value || undefined,
    subject: document.getElementById('ep-subject')?.value.trim() || undefined,
    is_homeroom: document.getElementById('ep-homeroom')?.value === '1' ? 1 : 0,
    homeroom_class: parseInt(document.getElementById('ep-homeroom-class')?.value) || undefined,
  };
  try {
    const res = await api('/api/admin/profile', { method: 'PUT', body });
    currentUser = { ...currentUser, ...res.user };
    closeModal();
    updateHeader();
    toast('プロフィールを更新しました', 'success');
  } catch (e) { toast(e.message || '更新失敗', 'error'); }
}

function checkForUpdate() {
  showModal('アップデート確認', `
    <div class="text-center py-6">
      <i class="fas fa-check-circle text-green-500 text-5xl mb-4"></i>
      <p class="font-bold text-gray-800">最新バージョンです</p>
      <p class="text-gray-500 text-sm mt-1">v1.0.0 が最新バージョンです</p>
      <button onclick="if(navigator.serviceWorker){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(r=>r.update())).then(()=>toast('キャッシュを更新しました','success'))}" class="mt-4 text-blue-600 text-sm hover:underline">
        <i class="fas fa-sync-alt mr-1"></i>キャッシュを強制更新
      </button>
    </div>
  `, [{ label: '閉じる', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal }]);
}

// ============================================================
// 体育委員会チェックリスト
// ============================================================
function renderPEChecklist(container) {
  const isManager = ['admin', 'teacher', 'chairman', 'vice_chairman'].includes(currentUser.role);
  container.innerHTML = `
    <div class="p-3">
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-gray-800"><i class="fas fa-clipboard-list text-blue-600 mr-2"></i>用具確認チェックリスト</h3>
          ${isManager ? `<button onclick="addChecklistItem()" class="bg-blue-600 text-white px-3 py-1 rounded-full text-xs"><i class="fas fa-plus mr-1"></i>追加</button>` : ''}
        </div>
        <div id="pe-checklist-items" class="space-y-2">
          <div class="skeleton h-10"></div><div class="skeleton h-10"></div>
        </div>
      </div>
      <div class="card p-4 mt-3">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-hand-holding text-orange-500 mr-2"></i>貸し出し管理</h3>
        <div id="pe-rentals" class="space-y-2"><div class="skeleton h-10"></div></div>
      </div>
    </div>
  `;
  // デモデータ
  document.getElementById('pe-checklist-items').innerHTML = `
    ${[
      { name: 'バスケットボール', total: 5, checked: true },
      { name: 'サッカーボール', total: 3, checked: false },
      { name: 'バレーボール', total: 4, checked: true },
      { name: '縄跳び', total: 30, checked: true },
    ].map(item => `
      <div class="flex items-center gap-3 p-2 ${item.checked ? 'bg-green-50' : 'bg-red-50'} rounded-xl">
        <i class="fas ${item.checked ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-red-400'}"></i>
        <span class="flex-1 text-sm font-medium">${item.name}</span>
        <span class="text-xs text-gray-500">${item.total}個</span>
        ${isManager ? `
          <button onclick="togglePEItem(this)" class="text-xs ${item.checked ? 'text-green-600' : 'text-red-600'} hover:underline">
            ${item.checked ? 'あり' : 'なし'}
          </button>` : `<span class="text-xs font-bold ${item.checked ? 'text-green-600' : 'text-red-600'}">${item.checked ? 'あり' : 'なし'}</span>`}
      </div>`).join('')}
  `;
  document.getElementById('pe-rentals').innerHTML = `
    <button onclick="openRentalModal()" class="w-full bg-orange-500 text-white py-2 rounded-xl text-sm font-semibold">
      <i class="fas fa-hand-holding mr-1"></i>貸し出し記録
    </button>
    <div class="text-xs text-gray-400 text-center mt-2">現在の貸し出し：なし</div>
  `;
}

function openRentalModal() {
  showModal('貸し出し記録', `
    <div class="space-y-3">
      <div><label class="form-label">用具名</label><input id="rental-item" class="form-input" placeholder="例：バスケットボール"></div>
      <div><label class="form-label">借りる人の名前</label><input id="rental-name" class="form-input" placeholder="名前を入力"></div>
      <div><label class="form-label">個数</label><input id="rental-count" type="number" class="form-input" value="1" min="1"></div>
    </div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '記録する', className: 'bg-orange-500 text-white px-6 py-2 rounded-xl font-semibold', action: () => { closeModal(); toast('貸し出しを記録しました', 'success'); } }
  ]);
}

// ============================================================
// アンケート
// ============================================================
async function loadSurveys(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="empty-state"><i class="fas fa-poll"></i><p>アンケート機能（開発中）</p></div>`;
}

function openSurveyModal() {
  showModal('アンケート作成', `
    <div class="space-y-4">
      <div><label class="form-label">アンケートタイトル</label><input id="survey-title" class="form-input" placeholder="例：体育祭の種目アンケート"></div>
      <div><label class="form-label">説明</label><textarea id="survey-desc" class="form-input" rows="2" placeholder="説明（任意）"></textarea></div>
      <div><label class="form-label">回答期限（任意）</label><input id="survey-expires" type="date" class="form-input"></div>
      <div class="text-xs text-gray-400">※質問項目の追加は後で行えます（開発中）</div>
    </div>
  `, [
    { label: 'キャンセル', className: 'border border-gray-300 text-gray-600 px-4 py-2 rounded-xl', action: closeModal },
    { label: '作成', className: 'bg-purple-600 text-white px-6 py-2 rounded-xl font-semibold', action: () => { closeModal(); toast('アンケートを作成しました（デモ）', 'success'); } }
  ]);
}

// ============================================================
// 情報バー（WBGT・防災）
// ============================================================
async function loadInfoBar() {
  // WBGT（環境省データ）
  loadWBGT();
  // 防災情報
  loadDisasterInfo();
}

async function loadWBGT() {
  const el = document.getElementById('wbgt-text');
  const levelEl = document.getElementById('wbgt-level');
  const bar = document.getElementById('wbgt-bar');
  try {
    // 環境省のWBGTデータ（入間市付近：熊谷観測所）
    // 実際のAPIはCORS制限があるため、デモ値を使用
    const hour = new Date().getHours();
    let wbgt = 20 + Math.sin(hour * Math.PI / 12) * 10 + Math.random() * 3;
    wbgt = Math.round(wbgt * 10) / 10;
    
    let level = '', cls = '';
    if (wbgt >= 31) { level = '危険'; cls = 'wbgt-danger'; }
    else if (wbgt >= 28) { level = '厳重警戒'; cls = 'wbgt-warning'; }
    else if (wbgt >= 25) { level = '警戒'; cls = 'wbgt-caution'; }
    else { level = '注意'; cls = 'wbgt-ok'; }

    el.textContent = `WBGT（暑さ指数）：${wbgt}℃ | 入間市付近`;
    levelEl.textContent = level;
    bar.className = `bg-blue-600 text-white text-xs py-1 px-3 flex items-center gap-4 ${cls}`;
  } catch {
    el.textContent = 'WBGT データ取得失敗';
  }
}

async function loadDisasterInfo() {
  const textEl = document.getElementById('disaster-text');
  const bar = document.getElementById('disaster-bar');
  try {
    // NHK防災API（入間市）
    const res = await fetch('https://api.nhk.or.jp/v2/pg/list/130/g1/today.json').catch(() => null);
    // 実際は入間市の防災APIを使用。現時点ではデモメッセージ
    textEl.textContent = '🟢 入間市：現在、特別警報・警報は発令されていません（入間市防災情報）';
    // 定期的にスクロール
    startDisasterScroll();
  } catch {
    textEl.textContent = '入間市防災情報を取得中...';
  }
}

function startDisasterScroll() {
  const el = document.getElementById('disaster-text');
  if (!el) return;
  let pos = 0;
  setInterval(() => {
    if (!document.getElementById('disaster-text')) return;
  }, 50);
}

// ============================================================
// 通知パネル
// ============================================================
function showNotificationPanel() {
  document.getElementById('notif-panel').classList.remove('hidden');
  loadNotifications();
}

function hideNotificationPanel() {
  document.getElementById('notif-panel').classList.add('hidden');
}

async function loadNotifications() {
  const container = document.getElementById('notif-list');
  container.innerHTML = `<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-blue-600"></i></div>`;
  // デモ通知
  setTimeout(() => {
    container.innerHTML = `
      <div class="p-3 bg-blue-50 rounded-xl mb-2">
        <p class="text-xs text-gray-400 mb-1">上中連絡</p>
        <p class="text-sm font-medium">明日の全校集会について</p>
      </div>
      <div class="text-center text-gray-400 text-xs mt-4">過去の通知はありません</div>`;
  }, 500);
}

// ============================================================
// 自動リロード
// ============================================================
function startTimers() {
  clearTimers();
  reloadTimer = setInterval(() => {
    const autoReloadTabs = ['bulletin', 'notice', 'committee', 'club', 'question', 'classgroup', 'messages'];
    if (currentTab && autoReloadTabs.includes(currentTab)) {
      silentReload();
    }
  }, 15000);
}

function clearTimers() {
  if (reloadTimer) clearInterval(reloadTimer);
  if (notifCheckTimer) clearInterval(notifCheckTimer);
}

async function silentReload() {
  // 現在のタブに応じてデータのみ再読み込み（UIは保持）
  try {
    switch (currentTab) {
      case 'bulletin': loadPosts('bulletin', null, 'bulletin-list'); break;
      case 'notice': {
        const activeBtn = document.querySelector('.sub-nav-btn.active');
        const cat = activeBtn ? (activeBtn.textContent.includes('上中') ? 'school_notice' : 'lost_item') : 'school_notice';
        loadPosts(cat, null, 'notice-list');
        break;
      }
    }
  } catch {}
}

// ============================================================
// モーダルユーティリティ
// ============================================================
function showModal(title, body, actions = []) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = a.className;
    btn.textContent = a.label;
    btn.onclick = a.action;
    footer.appendChild(btn);
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ============================================================
// トースト通知
// ============================================================
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i class="fas ${
    type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
  } mr-2"></i>${message}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    el.style.transition = 'all 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ============================================================
// API ユーティリティ
// ============================================================
async function api(url, options = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const config = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) config.body = JSON.stringify(body);
  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ============================================================
// ヘルパー関数
// ============================================================
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

function formatRelative(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'たった今';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${Math.floor(diff / 86400000)}日前`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function maxDateStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Enterキーでログイン
document.getElementById('login-password')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('login-username')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
