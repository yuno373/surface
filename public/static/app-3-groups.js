// === Bulletin ===
function renderBulletin(container) {
  const isAdmin=(currentUser.roles||[currentUser.role]).includes('admin');
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bullhorn text-red-600"></i>掲示板</h2>'+(isAdmin?'<button onclick="openPostModal(\'bulletin\')" class="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div></div><div class="p-3" id="bulletin-list"><div class="skeleton h-24"></div></div>';
  loadPosts('bulletin','','bulletin-list');
}

// === Notice ===
function renderNotice(container) {
  const isStaff=(currentUser.roles||[currentUser.role]).some(r=>['admin','teacher'].includes(r));
  container.innerHTML='<div class="bg-white border-b"><div class="px-4 py-3 flex items-center justify-between"><h2 class="font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-school text-orange-600"></i>上中連絡</h2>'+(isStaff?'<button onclick="openPostModal(\'school_notice\')" class="bg-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold"><i class="fas fa-plus mr-1"></i>投稿</button>':'')+'</div></div><div class="p-3" id="notice-list"><div class="skeleton h-24"></div></div>';
  loadPosts('school_notice','','notice-list');
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
