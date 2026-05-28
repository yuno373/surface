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
