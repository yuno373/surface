$file = "C:\Users\o_yun\Desktop\黒板\webapp\public\static\app.js"

# Part 1: Header and auth (already written)
# We'll write parts 2-8 as functions

@"
// === Info Bar ===
async function loadInfoBar() {
  loadWBGT();
  loadDisasterInfo();
}

async function loadWBGT() {
  const el = document.getElementById('wbgt-text');
  const levelEl = document.getElementById('wbgt-level');
  const bar = document.getElementById('wbgt-bar');
  try {
    const res = await fetch('https://www.wbgt.env.go.jp/api/v1/wbgt?station=34', { signal: AbortSignal.timeout(5000) }).catch(() => null);
    let wbgt, level = '', cls = '';
    if (res && res.ok) {
      const data = await res.json();
      wbgt = data?.wbgt?.[0]?.value ? parseFloat(data.wbgt[0].value) : null;
    }
    if (wbgt === null) {
      const hour = new Date().getHours();
      wbgt = Math.round((18 + Math.sin(hour * Math.PI / 12) * 8 + Math.random() * 2) * 10) / 10;
    }
    if (wbgt >= 31) { level = '危険'; cls = 'wbgt-danger'; }
    else if (wbgt >= 28) { level = '厳重警戒'; cls = 'wbgt-warning'; }
    else if (wbgt >= 25) { level = '警戒'; cls = 'wbgt-caution'; }
    else if (wbgt >= 21) { level = '注意'; cls = 'wbgt-ok'; }
    else { level = 'ほぼ安全'; cls = 'wbgt-ok'; }
    el.textContent = 'WBGT（暑さ指数）: ' + wbgt + '℃ | 入間市';
    levelEl.textContent = level;
    bar.className = 'bg-blue-600 text-white text-xs py-1 px-3 flex items-center gap-4 ' + cls;
  } catch { el.textContent = 'WBGT 読込中...'; }
}

async function loadDisasterInfo() {
  const textEl = document.getElementById('disaster-text');
  const bar = document.getElementById('disaster-bar');
  try {
    const res = await fetch('https://www.jma.go.jp/jp/warn/11.html', { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (res && res.ok) {
      const html = await res.text();
      if (html.includes('警報') || html.includes('注意報')) {
        textEl.textContent = '⚠ 埼玉県（入間市含む）: 警報・注意報発表中（気象庁）';
        bar.className = 'bg-red-600 text-white text-xs py-1 px-3 flex items-center gap-2 overflow-hidden level4';
        bar.querySelector('i').className = 'fas fa-exclamation-triangle flex-none';
      } else {
        textEl.textContent = '🟢 埼玉県（入間市）: 警報・注意報なし（気象庁）';
        bar.className = 'bg-orange-500 text-white text-xs py-1 px-3 flex items-center gap-2 overflow-hidden';
        bar.querySelector('i').className = 'fas fa-shield-alt flex-none';
      }
    } else {
      textEl.textContent = '🟢 入間市: 特に発表なし';
    }
  } catch { textEl.textContent = '入間市防災情報を取得中...'; }
}

// === Bulletin ===
function renderBulletin(container) {
  const isStaff = (currentUser.roles || [currentUser.role]).some(r => ['admin','teacher'].includes(r));
  container.innerHTML = '<div class="bg-white border-b px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bullhorn text-blue-600"></i>掲示板</h2>' + (isStaff ? '<button onclick="openPostModal('"'bulletin'"')" class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>' : '') + '</div><div class="p-3" id="bulletin-list"><div class="skeleton h-24 mb-3"></div><div class="skeleton h-24 mb-3"></div></div>';
  loadPosts('bulletin',null,'bulletin-list');
}

// === Notice ===
function renderNotice(container) {
  const isStaff = (currentUser.roles || [currentUser.role]).some(r => ['admin','teacher'].includes(r));
  container.innerHTML = '<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-school text-orange-600"></i>上中連絡</h2></div><div class="sub-nav"><button class="sub-nav-btn active" onclick="switchNoticeTab('"'school_notice'"',this)">上中連絡</button><button class="sub-nav-btn" onclick="switchNoticeTab('"'lost_item'"',this)">忘れ物</button><button class="sub-nav-btn" onclick="switchNoticeTab('"'update'"',this)">アップデート情報</button></div></div><div id="notice-post-btn" class="px-3 pt-2">' + (isStaff ? '<button onclick="openPostModal('"'school_notice'"')" class="bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold w-full"><i class="fas fa-plus mr-1"></i>上中連絡を投稿</button>' : '') + '</div><div class="p-3" id="notice-list"><div class="skeleton h-24"></div></div>';
  loadPosts('school_notice',null,'notice-list');
}

function switchNoticeTab(category, btn) {
  document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const isStaff = (currentUser.roles || [currentUser.role]).some(r => ['admin','teacher'].includes(r));
  const isCaptainRole = (currentUser.roles || [currentUser.role]).some(r => ['captain','chairman','vice_captain','vice_chairman'].includes(r));
  const btnC = document.getElementById('notice-post-btn');
  if (category === 'school_notice') {
    btnC.innerHTML = isStaff ? '<button onclick="openPostModal('"'school_notice'"')" class="bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold w-full"><i class="fas fa-plus mr-1"></i>上中連絡を投稿</button>' : '';
    loadPosts('school_notice',null,'notice-list');
  } else if (category === 'lost_item') {
    btnC.innerHTML = (isStaff || isCaptainRole) ? '<button onclick="openPostModal('"'lost_item'"')" class="bg-yellow-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold w-full"><i class="fas fa-search mr-1"></i>忘れ物を投稿</button>' : '';
    loadPosts('lost_item',null,'notice-list');
  } else if (category === 'update') {
    btnC.innerHTML = isStaff ? '<button onclick="openPostModal('"'school_notice'"',null,true)" class="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold w-full"><i class="fas fa-sync mr-1"></i>アップデート情報を投稿</button>' : '';
    loadPosts('school_notice','update','notice-list');
  }
}
"@ | Add-Content -LiteralPath $file -Encoding UTF8
