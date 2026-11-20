/* 启程 · Static, client-first learning application. No network/model calls. */
(() => {
  'use strict';
  const C = window.AgentCourseContent;
  const K = window.AgentLearningCore;
  const STORAGE_KEY = 'qicheng.agent-academy.v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    home:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    route:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v7a4 4 0 0 0 4 4h6M8 5h6a4 4 0 0 1 0 8H9"/>',
    lab:'<path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    book:'<path d="M12 5v15M3 4l9 2 9-2v15l-9 2-9-2z"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star:'<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9z"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    meeting:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h4m-4 3h8"/>',
    research:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
    spreadsheet:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11m7-11v11M3 14h18"/>',
    knowledge:'<path d="M4 3h12l4 4v14H4zM15 3v5h5M8 12h8m-8 4h6"/>',
    review:'<path d="M4 3h12l4 4v14H4zM8 12l2 2 5-5m-7 9h8"/>',
    weekly:'<path d="M4 20h16M7 16v-4m5 4V5m5 11V9"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
  let storageAvailable = true;
  let loadWarning = '';
  let state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? K.normalizeState(JSON.parse(raw), C, {strict:true}) : K.createState(C);
  } catch (error) {
    state = K.createState(C);
    loadWarning = '原有学习记录未能读取。你仍可使用课程，也可从备份恢复记录。';
  }
  const ui = {filter:'全部',search:'',choices:{},feedback:{},taskModes:{},steps:{},challenges:{}};
  let toastTimer, saveTimer, pendingBackup;
  const main = $('#main');
  const dialog = $('#app-dialog');
  const lessonById = id => C.lessons.find(item => item.id === id);
  const taskById = id => C.tasks.find(item => item.id === id);
  const getStats = () => K.getStats(state, C);
  const P = window.createProjectUI({C,K,esc,icon,main,getState:()=>state,save:()=>persist({quiet:true}),toast,download,copyText,openDialog,closeDialog:()=>dialog.close()});
  function toast(text) {
    clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3600);
  }
  function persist({quiet=false}={}) {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true; $('#save-status').textContent = '已保存在本机';
      $('#storage-label').textContent = '学习记录保存在本机';
    } catch (error) {
      storageAvailable = false; $('#save-status').textContent = '本地保存不可用';
      $('#storage-label').textContent = '请导出备份保存进度';
      if (!quiet) toast('浏览器未能保存记录。请到设置导出备份。');
    }
    updateShell();
    return storageAvailable;
  }
  function activity(type,id) {
    state.activities.push({type,id,date:K.today(),at:new Date().toISOString()});
    if (state.activities.length > 3000) state.activities = state.activities.slice(-3000);
  }
  function bar(value) { return `<div class="progress-track" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" aria-label="完成进度"><div class="progress-fill" style="width:${value}%"></div></div>`; }
  function pageHeading(eyebrow,title,description,actions='') {
    return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
  }
  function updateShell() {
    const stats = getStats();
    const section = (location.hash.split('/')[1] || 'overview');
    const active = section === 'lesson' ? 'route' : ['task','project'].includes(section) ? 'tasks' : section;
    const links = [['overview','home','学习总览'],['route','route','学习路线'],['tasks','lab','任务实验室'],['artifacts','folder','我的成果'],['settings','settings','学习设置']];
    const savedPractices = state.learning.runs.filter(run=>!state.learning.withdrawnRunIds.includes(run.id) && !['baseline','pretest'].includes(run.kind)).length;
    $('#nav-links').innerHTML = links.map(([id,ic,label]) => `<a class="nav-item ${active===id?'active':''}" href="#/${id}" ${active===id?'aria-current="page"':''} aria-label="${label}">${icon(ic)}<span class="nav-label">${label}</span>${id==='artifacts'&&savedPractices?`<span class="nav-count">${savedPractices}</span>`:''}</a>`).join('');
    $('#breadcrumb').innerHTML = `我的学习空间 <span>/</span> <strong>${section==='project'?(['start','path'].includes(location.hash.split('/')[2])?'动手练习':'学习计划与记录'):links.find(x=>x[0]===active)?.[2] || '学习总览'}</strong>`;
    $('#sidebar-progress').innerHTML = ['overview','tasks','artifacts'].includes(section) || /^#\/project\/(start|path|records)/.test(location.hash) ? `<div class="sidebar-practice-note"><strong>${savedPractices ? `已保存 ${savedPractices} 次练习` : '先完成一次练习'}</strong><p>准备资料，交给 Agent，再核对结果。</p><a class="text-link" href="#/route">之后再学课程 ${icon('arrow')}</a></div>` : `<div class="sidebar-progress-heading"><span>课程与项目记录</span><strong>${stats.percent}%</strong></div>${bar(stats.percent)}<p class="sidebar-note">${esc(stats.goal.title)}<br>${stats.completedLessons}/${stats.requiredLessons.length} 课理解检查 · ${stats.weeks.slice(0,stats.goal.weeks).filter(w=>w.done).length}/${stats.goal.weeks} 周项目证据</p>`;
  }
  function taskCard(task) {
    return `<article class="task-card surface-card beginner-task-card"><div class="task-card-top"><div class="task-icon">${icon(task.id)}</div>${task.id==='meeting'?'<span class="badge green">首次推荐</span>':''}</div><h3 class="task-title">${esc(task.title)}</h3><p class="task-description">${esc(task.summary)}</p><div class="task-footer"><span>约 ${task.minutes} 分钟 · 示例已备好</span><a class="button small secondary" href="#/project/start" data-project-action="choose-task" data-task="${task.id}">开始练习 ${icon('arrow')}</a></div></article>`;
  }
  function heroArt() {
    return `<svg viewBox="0 0 240 260" fill="none" role="img" aria-label="从目标出发，沿着路线逐步完成任务"><circle cx="132" cy="128" r="88" fill="#e2ebd4"/><circle cx="132" cy="128" r="67" stroke="#c8d7b7" stroke-dasharray="3 7"/><path d="M63 183c0-52 111 10 111-54S72 125 72 72" stroke="#92ad78" stroke-width="2" stroke-dasharray="5 6"/><rect x="36" y="42" width="100" height="59" rx="12" fill="#fffdf6" transform="rotate(-7 36 42)"/><rect x="52" y="57" width="30" height="5" rx="2.5" fill="#9caf86"/><rect x="52" y="71" width="60" height="4" rx="2" fill="#d9e2d0"/><rect x="52" y="82" width="46" height="4" rx="2" fill="#d9e2d0"/><rect x="113" y="112" width="95" height="63" rx="12" fill="#fffdf6" transform="rotate(8 113 112)"/><circle cx="138" cy="138" r="11" fill="#e4eed9"/><path d="m133 138 4 4 7-8" stroke="#557c41" stroke-width="2" stroke-linecap="round"/><path d="M158 135h29m-29 10h22" stroke="#d9e2d0" stroke-width="4" stroke-linecap="round"/><circle cx="66" cy="192" r="24" fill="#e7ba8f"/><path d="m55 192 7 7 15-16" stroke="#fffdf6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="190" cy="56" r="5" fill="#d7ac76"/><path d="M201 201v12m-6-6h12" stroke="#adbd92" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  function renderOverview() {
    const s = getStats();
    const next = s.nextLesson;
    const draft = state.learning.draft;
    const continuing = draft.kind==='practice' && !!(draft.input.trim() || draft.output.trim());
    const currentTask = continuing ? taskById(draft.taskId) : taskById('meeting');
    const saved = state.learning.runs.filter(run=>!state.learning.withdrawnRunIds.includes(run.id) && !['baseline','pretest'].includes(run.kind));
    main.innerHTML = `<div class="welcome-row"><div><p class="eyebrow">从一件小事开始</p><h1>让 Agent 帮你做成一次。</h1><p>先动手，遇到需要的方法再学。</p></div></div><section class="start-hero" aria-label="开始一次练习"><div class="start-hero-copy"><span class="badge green">${continuing?'接着上次的练习':'首次推荐 · 约 15 分钟'}</span><h2>${continuing?esc(currentTask.title):'把一段会议记录，变成待办清单。'}</h2><p>${continuing?'资料和编辑内容已保留，按步骤继续就好。':'示例资料和任务说明都已准备好。跟着三步完成，再试试自己的资料。'}</p><div class="start-main-actions"><a class="button primary" href="#/project/start" ${continuing?'':'data-project-action="choose-task" data-task="meeting"'}>${continuing?'继续上次练习':'开始一次 15 分钟练习'} ${icon('arrow')}</a><a class="text-link" href="#/tasks">换一个任务</a></div></div><div class="start-hero-art" aria-hidden="true">${heroArt()}</div></section><ol class="starter-steps" aria-label="练习只需三步"><li><span>1</span><div><h3>看资料</h3><p>直接用示例，也可以换成自己的。</p></div></li><li><span>2</span><div><h3>交给 Agent</h3><p>复制说明，执行后带回结果。</p></div></li><li><span>3</span><div><h3>对照检查</h3><p>核对依据，把未知和问题留清楚。</p></div></li></ol><div class="home-followups"><section class="home-followup surface-card"><div class="home-followup-icon">${icon('book')}</div><div><h2>做过一次，再把方法学扎实</h2><p>${next?`下一课：${esc(next.title)}`:'按需要回看课程，或进入项目验证自己的方法。'}</p><a class="text-link" href="${s.allCompletedLessons && next?'#/lesson/'+next.id:'#/route'}">${s.allCompletedLessons?'继续学课程':'看看学习路线'} ${icon('arrow')}</a></div></section><section class="home-followup surface-card"><div class="home-followup-icon">${icon('folder')}</div><div><h2>练习会留在这里</h2><p>${saved.length?`已保存 ${saved.length} 份练习记录，可随时回看。`:'完成后保存资料、实际输出和自检记录，方便下次继续。'}</p><a class="text-link" href="#/artifacts">查看我的成果 ${icon('arrow')}</a></div></section></div>`;
  }
  function renderRoute() {
    const s=getStats();
    main.innerHTML=pageHeading('YOUR LEARNING PATH','每一步，都离独立完成更近。',`${s.goal.weeks} 周建议路线。课程随时可学，理解检查与项目证据分别记录。`,`<button class="button secondary" data-action="goal">${icon('target')} 调整目标</button>`)+`<div class="route-summary surface-card"><div><h3>${esc(s.goal.title)}</h3><p class="muted">${s.completedLessons}/${s.requiredLessons.length} 节目标课程 · ${s.weeks.slice(0,s.goal.weeks).filter(w=>w.done).length}/${s.goal.weeks} 周项目证据</p></div><div><strong>${s.percent}%</strong>${bar(s.percent)}</div></div>`+C.modules.map(m=>{
      const done=m.lessonIds.filter(id=>state.lessons[id]?.passed).length;
      return `<section class="module-card surface-card"><header class="module-header"><span class="module-number">${String(m.week).padStart(2,'0')}</span><div class="module-copy"><h2>${esc(m.title)} ${m.optional?'<span class="badge orange">选修</span>':''}</h2><p>${esc(m.subtitle)}</p></div><div class="module-progress"><span>${done}/${m.lessonIds.length} 完成</span>${bar(Math.round(done/m.lessonIds.length*100))}</div></header><div class="lesson-list">${m.lessonIds.map(id=>{const l=lessonById(id),passed=state.lessons[id]?.passed;return `<a class="lesson-row" href="#/lesson/${id}"><span class="lesson-symbol ${passed?'done':''}">${icon(passed?'check':'book')}</span><span class="lesson-details"><strong>${esc(l.title)}</strong><p>${esc(l.summary)}</p></span><span class="lesson-meta"><span>${l.minutes} 分钟</span><span>${passed?'理解检查通过':'开始学习'}</span>${icon('chevron')}</span></a>`;}).join('')}</div>${P.weekCard('w'+m.week)}</section>`;
    }).join('');
  }
  function renderLesson(id) {
    const l=lessonById(id);if(!l)return renderNotFound();
    const m=C.modules.find(x=>x.id===l.moduleId),passed=state.lessons[id]?.passed;
    const selected=ui.choices[id] ?? state.lessons[id]?.answerIndex;
    const feedback=ui.feedback[id];
    const related=C.tasks.filter(t=>t.lessonIds.includes(id));
    const next=C.lessons[C.lessons.indexOf(l)+1];
    main.innerHTML=pageHeading(`第 ${m.week} 周 · ${esc(m.title)}`,esc(l.title),`${l.minutes} 分钟 · ${esc(l.skill || m.subtitle)}`,`<a class="button ghost" href="#/route">返回学习路线</a>`)+`<div class="lesson-layout"><article class="lesson-main"><section class="lesson-section surface-card"><p class="lesson-intro">${esc(l.summary)}</p>${l.blocks.map((block,i)=>`<section class="lesson-block"><span class="block-index">${String(i+1).padStart(2,'0')}</span><div><h2>${esc(block.title)}</h2><p>${esc(block.text).replace(/\n/g,'<br>')}</p></div></section>`).join('')}</section><section class="quiz-card surface-card" aria-label="本课小测"><div class="section-heading"><div><p class="eyebrow">CHECK YOUR UNDERSTANDING</p><h2>检查本课的理解。</h2></div>${passed?'<span class="badge green">已通过</span>':''}</div><h3>${esc(l.quiz.question)}</h3><div class="quiz-options" role="radiogroup" aria-label="选择答案">${l.quiz.options.map((option,i)=>`<button type="button" role="radio" aria-checked="${selected===i}" class="quiz-option ${selected===i?'selected':''} ${feedback&&selected===i?(i===l.quiz.answerIndex?'correct':'incorrect'):''}" data-action="quiz-choice" data-id="${id}" data-index="${i}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span></button>`).join('')}</div>${feedback?`<div class="quiz-feedback ${feedback.correct?'success':'error'}" role="status"><strong>${feedback.correct?'理解检查通过。可以选一个相关任务，动手试一次。':'再想一想，你可以重新选择。'}</strong><p>${esc(l.quiz.explanation)}</p></div>`:''}<div class="lesson-navigation"><button class="button primary" data-action="quiz-submit" data-id="${id}" ${selected===undefined?'disabled':''}>${passed?'再次检查理解':'提交理解检查'} ${icon('check')}</button>${passed&&next?`<a class="button secondary" href="#/lesson/${next.id}">下一课 ${icon('arrow')}</a>`:''}</div></section></article><aside class="lesson-aside"><div class="sticky-summary surface-card"><p class="eyebrow">本周学习</p><h3>${esc(m.title)}</h3><div class="aside-lessons">${m.lessonIds.map(lid=>`<a class="aside-lesson ${lid===id?'active':''}" href="#/lesson/${lid}">${icon(state.lessons[lid]?.passed?'check':'book')}<span>${esc(lessonById(lid).title)}</span></a>`).join('')}</div></div><div class="sticky-summary surface-card"><p class="eyebrow">把方法用起来</p><h3>相关任务</h3>${related.slice(0,2).map(t=>`<a class="related-task" href="#/project/start" data-project-action="choose-task" data-task="${t.id}">${icon(t.id)}<span>${esc(t.title)}<small>按三步开始练习</small></span>${icon('chevron')}</a>`).join('')||'<p class="muted">到任务实验室，选择一件正在做的工作。</p>'}</div></aside></div>`;
  }
  function renderTaskCards() {
    const filtered=C.tasks.filter(t=>(ui.filter==='全部'||t.category===ui.filter)&&(`${t.title} ${t.summary} ${t.skills.join(' ')}`.includes(ui.search)));
    $('#task-list').innerHTML=filtered.length?filtered.map(taskCard).join(''):'<div class="empty-state"><h3>暂时没有匹配的任务</h3><p>试试更短的关键词，或切换到全部任务。</p></div>';
  }
  function renderTasks() {
    ui.filter='全部';ui.search='';
    main.innerHTML=pageHeading('动手练习','今天，先做哪件小事？','选一个任务，就按步骤开始。每个任务都准备了示例资料和说明。')+`<div class="lab-three-steps" aria-label="练习过程"><span><b>1</b> 看资料</span><span>${icon('chevron')}</span><span><b>2</b> 交给 Agent</span><span>${icon('chevron')}</span><span><b>3</b> 对照检查</span></div><div class="task-grid beginner-task-grid" id="task-list"></div><p class="lab-next-note">初次使用，推荐从会议待办开始。准备好之后，再到<a class="text-link" href="#/route">学习路线</a>了解完整方法。</p>`;
    renderTaskCards();
  }
  function taskMode(id) {
    const r=state.tasks[id];
    return ui.taskModes[id] || r.mode || 'example';
  }
  function taskStep(id) { return ui.steps[id] ?? state.tasks[id].checkpoint ?? 0; }
  function renderTask(id) {
    const t=taskById(id);if(!t)return renderNotFound();
    const r=state.tasks[id],mode=taskMode(id),step=taskStep(id),demo=mode==='example';
    const completed=getStats().completedTaskIds.includes(id);
    const checkpoint=t.checkpoints[step];
    let body='';
    if(step===0)body=`<h2>先看看这次要交付什么</h2><p>${esc(t.summary)}</p><div class="callout"><strong>完成标准</strong><p>${t.criteria.map(x=>esc(x.label)).join('；')}。</p></div><h3>示例资料</h3><pre class="output-preview">${esc(t.sampleInput)}</pre><div class="task-actions"><button class="button primary" data-action="task-step" data-id="${id}" data-step="1">${demo?'跟着示例开始':'准备我的资料'} ${icon('arrow')}</button></div>`;
    if(step===1)body=`<h2>${demo?'示例任务说明':'准备资料，交代任务'}</h2><p class="muted">${demo?'观察任务说明包含了哪些信息。':'把下面的说明复制到你常用的 Agent，并附上自己的资料。'}</p>${demo?`<div class="example-label">${icon('info')} 教学示例</div>`:`<div class="form-group"><label class="input-label" for="practice-input">你的资料或任务背景</label><textarea class="form-textarea" id="practice-input" data-task-field="input" data-id="${id}" maxlength="30000" placeholder="粘贴你自己的资料，或记录资料范围与处理要求…">${esc(r.input)}</textarea><div class="field-hint">只保存在当前浏览器。你也可以导入小于 100 KB 的 TXT、MD 或 CSV 文本。</div><label class="button small secondary upload-label">${icon('upload')} 导入文本<input type="file" data-task-upload="${id}" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" hidden></label></div>`}<div class="example-panel"><div class="section-heading"><h3>可直接复制的任务说明</h3><button class="button small secondary" data-action="copy-prompt" data-id="${id}">${icon('copy')} 复制说明</button></div><pre class="output-preview">${esc(t.prompt)}</pre></div><details class="task-faq"><summary>委派任务前，检查哪三件事？</summary><p>目标是否明确、资料是否齐全、输出是否能检查。涉及写入或对外发送时，先确定需要你确认的步骤。</p></details><div class="task-actions"><button class="button primary" data-action="task-step" data-id="${id}" data-step="2">${demo?'查看示例成果':'我已拿到结果，开始验收'} ${icon('arrow')}</button></div>`;
    if(step===2)body=`<h2>${demo?'对照示例，学会验收':'把结果带回来，逐项验收'}</h2>${demo?`<div class="example-label">${icon('info')} 静态教学示例 · 不计入独立成果</div><pre class="output-preview example-output">${esc(t.sampleOutput)}</pre>`:`<div class="form-group"><label class="input-label" for="practice-output">粘贴 Agent 的实际输出</label><textarea class="form-textarea output-editor" id="practice-output" data-task-field="output" data-id="${id}" maxlength="50000" placeholder="把实际输出粘贴到这里。请不要只填写“已完成”。">${esc(r.output)}</textarea><p class="field-hint">编辑会自动保存。修改已完成成果后，需要重新确认验收。</p></div>`}<h3>成果验收表</h3><div class="checklist">${t.criteria.map(c=>`<label class="check-item"><input type="checkbox" data-task-check="${esc(c.id)}" data-id="${id}" ${demo?'disabled':r.checks[c.id]?'checked':''}><span>${esc(c.label)}</span></label>`).join('')}</div><p class="field-hint">${demo?'切换到独立练习后，可根据实际结果勾选验收。':'这是你的自检记录，系统不会代替你判断事实是否正确。'}</p><div class="task-actions"><button class="button primary" data-action="task-step" data-id="${id}" data-step="3">记录复盘，继续练习 ${icon('arrow')}</button></div>`;
    if(step===3)body=`<h2>${demo?'把一次体验，变成可复用的方法':'留下这次的收获'}</h2>${demo?'<p>现在可以换一份自己的资料，试着独立完成。方法仍然是：说明目标、提供资料、检查结果、记录改进。</p>':`<div class="form-group"><label class="input-label" for="practice-notes">哪里需要人工修改？下次怎样做得更好？</label><textarea class="form-textarea" id="practice-notes" data-task-field="notes" data-id="${id}" maxlength="20000" placeholder="例如：补充了输出格式后，第二次结果更完整；仍需要核对截止时间…">${esc(r.notes)}</textarea></div>`}<div class="callout"><strong>下一次，多走一步</strong><div class="challenge-options">${t.challenges.map((c,i)=>`<button class="button small ${ui.challenges[id]===i?'primary':'secondary'}" data-action="challenge" data-id="${id}" data-index="${i}">${esc(c.title)}</button>`).join('')}</div><p id="challenge-description">${esc(t.challenges[ui.challenges[id]??0]?.description || '')}</p></div><div class="task-actions">${demo?`<button class="button primary" data-action="task-mode" data-id="${id}" data-mode="practice">用自己的资料，独立做一次 ${icon('arrow')}</button>`:`<button class="button primary" data-action="task-complete" data-id="${id}">${icon('check')} ${completed?'更新验收记录':'保存普通自检成果'}</button><button class="button secondary" data-action="save-draft" data-id="${id}">保存草稿</button>`}</div>`;
    main.innerHTML=pageHeading(`${esc(t.category)} · ${t.minutes} 分钟`,esc(t.title),esc(t.summary),`<a class="button primary" href="#/project/start" data-project-action="choose-task" data-task="${id}">按三步开始练习</a><a class="button ghost" href="#/tasks">返回任务实验室</a>`)+`${completed?'<div class="completion-banner">'+icon('check')+'<div><h3>这份成果已完成普通自检</h3><p>你可以重新查看、改进成果，或尝试更有挑战的资料。</p></div></div>':''}<div class="task-detail-grid"><article class="task-workspace"><div class="practice-tabs" role="group" aria-label="练习方式"><button class="tab-button ${demo?'active':''}" aria-pressed="${demo}" data-action="task-mode" data-id="${id}" data-mode="example">示例跟做</button><button class="tab-button ${!demo?'active':''}" aria-pressed="${!demo}" data-action="task-mode" data-id="${id}" data-mode="practice">独立练习</button></div><div class="stepper" aria-label="任务步骤">${t.checkpoints.map((cp,i)=>`<button class="step-item ${step===i?'active':step>i?'done':''}" data-action="task-step" data-id="${id}" data-step="${i}" aria-current="${step===i?'step':'false'}"><span>${i+1}</span>${esc(cp.title)}</button>`).join('')}</div><section class="workspace-section surface-card"><div class="step-intro"><span class="badge ${demo?'neutral':'green'}">${demo?'示例体验':'我的练习'} · ${step+1}/4</span><p class="muted">${esc(checkpoint.description)}</p></div>${body}</section><p class="save-indicator" id="task-save-indicator">${demo?'示例体验不增加独立成果数':r.savedAt?'草稿已保存在本机 · '+K.formatDate(r.savedAt):'输入后会自动保存在本机'}</p></article><aside class="task-sidebar"><div class="surface-card sticky-summary"><p class="eyebrow">这一步的小提示</p><h3>${esc(checkpoint.title)}</h3><p>${esc(checkpoint.tip)}</p></div><div class="surface-card sticky-summary"><p class="eyebrow">相关知识</p>${t.lessonIds.map(lid=>`<a class="related-task" href="#/lesson/${lid}">${icon(state.lessons[lid]?.passed?'check':'book')}<span>${esc(lessonById(lid).title)}</span></a>`).join('')}</div><div class="surface-card sticky-summary"><p class="eyebrow">卡住了？</p>${t.pitfalls.map(p=>`<details class="task-faq"><summary>${esc(p.problem)}</summary><p>${esc(p.solution)}</p></details>`).join('')}</div></aside></div>`;
  }
  function renderArtifacts() {
    const s=getStats();
    const runs=state.learning.runs.filter(r=>!state.learning.withdrawnRunIds.includes(r.id) && !['baseline','pretest'].includes(r.kind)).slice().reverse();
    const oldTasks=C.tasks.filter(t=>{const r=state.tasks[t.id];return r.input||r.output||r.notes;});
    const recent=runs.slice(0,6);
    main.innerHTML=pageHeading('我的成果','做过的练习，随时回来看看。',runs.length?`已保存 ${runs.length} 份练习与项目记录。保存记录后，仍可继续核查和改进。`:'资料、实际输出和自检记录会保存在这里。',`<a class="button primary" href="#/project/records">查看全部练习记录 ${icon('arrow')}</a><button class="button secondary" data-action="export">${icon('download')} 备份全部记录</button>`)+
      (recent.length?`<div class="artifact-grid beginner-artifacts">${recent.map(r=>`<article class="artifact-card surface-card"><div class="section-heading"><div class="task-icon">${icon(r.taskId)}</div><span class="badge neutral">${r.kind==='practice'?'普通练习已保存':'项目自评记录'}</span></div><h2>${esc(taskById(r.taskId).title)}</h2><p class="artifact-record-meta">${esc(r.date)} · ${r.context==='work'?'自己的工作资料':'教学或模拟资料'}</p><pre class="artifact-preview">${esc(r.output)}</pre><p class="field-hint">${r.kind==='practice'?'这是一份有引导的练习记录。':'项目判断与成果可在记录页查看并导出核查。'}</p><a class="text-link" href="#/project/records">查看练习记录 ${icon('arrow')}</a></article>`).join('')}</div>`:`<div class="empty-state surface-card">${icon('folder')}<h2>从一次小练习开始。</h2><p>示例已经准备好，跟着三步完成，最后保存结果。</p><a class="button primary" href="#/project/start" data-project-action="choose-task" data-task="meeting">开始会议待办练习 ${icon('arrow')}</a></div>`)+
      (oldTasks.length?`<details class="legacy-history"><summary>以前的自检成果 · ${oldTasks.length} 份</summary><p>旧资料、输出和自检记录都已保留，可以继续查看或导出。</p><div class="artifact-grid">${oldTasks.map(t=>{const r=state.tasks[t.id],done=s.completedTaskIds.includes(t.id);return `<article class="artifact-card surface-card"><span class="badge neutral">${done?'普通自检完成':'历史草稿'}</span><h3>${esc(t.title)}</h3><pre class="artifact-preview">${esc(r.output||r.input||r.notes)}</pre><div class="task-actions"><a class="text-link" href="#/task/${t.id}">查看历史记录 ${icon('arrow')}</a><button class="button ghost small" data-action="download-artifact" data-id="${t.id}">${icon('download')} 导出</button></div></article>`;}).join('')}</div></details>`:'');
  }
  function renderSettings() {
    const s=getStats();
    main.innerHTML=pageHeading('MAKE IT YOURS','按自己的节奏，学会新方法。','设置目标、安排投入，也照顾好自己的学习记录。')+`<div class="settings-grid"><section class="settings-section surface-card"><div class="section-heading"><h2>我的学习计划</h2>${icon('target')}</div><div class="settings-list"><div class="settings-row"><span class="muted">当前目标</span><strong>${esc(s.goal.title)}</strong></div><div class="settings-row"><span class="muted">岗位方向</span><strong>${esc(state.profile.role)}</strong></div><div class="settings-row"><span class="muted">每周投入</span><strong>${state.profile.weeklyMinutes} 分钟</strong></div><div class="settings-row"><span class="muted">目标要求</span><strong>${s.requiredLessons.length} 节课 + ${s.goal.weeks} 周项目证据</strong></div><div class="settings-row"><span class="muted">开始日期</span><strong>${K.formatDate(state.profile.startedAt)}</strong></div></div><button class="button secondary" data-action="goal">调整目标与节奏</button><p class="field-hint">调整目标会保留已经完成的课程和成果。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>数据与备份</h2>${icon('folder')}</div><div class="callout"><strong>${storageAvailable?'记录保存在当前浏览器':'当前浏览器无法持久保存'}</strong><p>本工具无需登录。学习进度、练习资料和成果在本机处理，换设备或清理浏览器前，请先导出备份。</p></div><div class="backup-actions"><button class="button primary" data-action="export">${icon('download')} 导出完整备份</button><button class="button secondary" data-action="import">${icon('upload')} 从备份恢复</button></div><p class="field-hint">备份包含你的练习文本，请保存到自己信任的位置。恢复前会先展示记录摘要。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>这个学习空间如何工作</h2>${icon('info')}</div><div class="settings-list"><div class="settings-row"><span>课程与示例</span><strong>17 节短课 · 6 个项目任务包</strong></div><div class="settings-row"><span>示例结果</span><strong>预置教学材料</strong></div><div class="settings-row"><span>独立练习</span><strong>在常用 Agent 中执行，带回结果验收</strong></div><div class="settings-row"><span>进度规则</span><strong>理解检查 + 每周项目证据</strong></div></div><p class="field-hint">这里不会自动调用模型，也不需要填写 API 密钥。发布到静态站点后即可使用。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>重新开始</h2></div><p class="muted">需要为新一轮学习腾出空间时，可以清空本机记录。建议先导出一份备份。</p><button class="button danger" data-action="reset-dialog">清空本机学习记录</button></section></div>`;
  }
  function renderNotFound() {main.innerHTML=`<div class="empty-state"><h1>这个页面暂时没有找到</h1><p>可以回到学习总览，接着完成下一步。</p><a class="button primary" href="#/overview">返回总览</a></div>`;}
  function render() {
    if(saveTimer){clearTimeout(saveTimer);saveTimer=null;persist({quiet:true});}
    if(dialog.open)dialog.close();
    const [,page='overview',id]=location.hash.split('/');
    const routes={overview:renderOverview,route:renderRoute,tasks:renderTasks,artifacts:renderArtifacts,settings:renderSettings};
    if(page==='lesson')renderLesson(id);else if(page==='task')renderTask(id);else if(page==='project')P.render(id);else (routes[page]||renderNotFound)();
    updateShell();window.scrollTo({top:0,behavior:'instant'});
    document.title=`${({overview:'学习总览',route:'学习路线',tasks:'任务实验室',artifacts:'我的成果',settings:'学习设置',project:['start','path'].includes(id)?'动手练习':'学习计划与记录',lesson:lessonById(id)?.title,task:taskById(id)?.title})[page] || '启程'} · 启程`;
  }
  function openDialog(title,body,footer='') {
    if(dialog.open)dialog.close();
    dialog.innerHTML=`<div class="dialog-card"><div class="dialog-header"><h2>${title}</h2><button class="icon-btn" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}</div>`;
    dialog.showModal();
  }
  function goalDialog() {
    openDialog('你想通过学习，做到什么？',`<form id="goal-form"><div class="form-group"><label class="input-label" for="goal-id">选择一个学习目标</label><select class="form-select" id="goal-id" name="goalId">${C.goals.map(g=>`<option value="${g.id}" ${state.profile.goalId===g.id?'selected':''}>${esc(g.title)} · ${g.weeks} 周 / ${g.targetLessons} 课 / ${g.weeks} 周项目</option>`).join('')}</select><p class="field-hint" id="goal-description">${esc(getStats().goal.description)}</p></div><div class="form-row"><div class="form-group"><label class="input-label" for="goal-role">我的工作方向</label><select class="form-select" id="goal-role" name="role">${['通用办公','行政与人事','运营与市场','销售与客服','项目与管理','学习与研究'].map(role=>`<option ${state.profile.role===role?'selected':''}>${role}</option>`).join('')}</select></div><div class="form-group"><label class="input-label" for="goal-minutes">每周可以投入</label><select class="form-select" id="goal-minutes" name="weeklyMinutes">${[60,120,180,240].map(n=>`<option value="${n}" ${state.profile.weeklyMinutes===n?'selected':''}>${n} 分钟 / 周</option>`).join('')}</select></div></div><div class="callout"><strong>完成标准</strong><p>完成课程理解检查与每周项目证据：一个任务持续练深，再迁移到第二个任务。证据齐备后可导出抽评。选修还需要实际助手与自动化测试。</p></div></form>`,`<button class="button secondary" data-action="close-dialog">稍后再说</button><button class="button primary" type="submit" form="goal-form">保存我的目标 ${icon('arrow')}</button>`);
  }
  async function copyText(text) {
    try {
      if(!navigator.clipboard)throw new Error('manual');
      await navigator.clipboard.writeText(text);toast('任务说明已复制，可以带到你常用的 Agent。');
    }catch(error){
      openDialog('复制任务说明',`<p class="field-hint">下方内容已选中，请按 Ctrl+C，或使用设备的复制操作。</p><textarea class="form-textarea" id="manual-copy" readonly>${esc(text)}</textarea>`,`<button class="button primary" data-action="close-dialog">完成</button>`);
      $('#manual-copy').focus();$('#manual-copy').select();
    }
  }
  function download(name,text,type='application/json') {
    const url=URL.createObjectURL(new Blob([text],{type:`${type};charset=utf-8`}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportBackup() {
    download(`启程-学习备份-${K.today()}.json`,JSON.stringify({app:'qicheng-agent-academy',version:2,exportedAt:new Date().toISOString(),state},null,2));
    toast('备份已导出，包含项目证据、多次记录、任务包及原有成果。');
  }
  function downloadArtifact(id) {
    const t=taskById(id),r=state.tasks[id];
    download(`启程-${t.title}-${K.today()}.md`,`# ${t.title}\n\n## 我的资料\n${r.input || '未填写'}\n\n## 实际成果\n${r.output || '未填写'}\n\n## 验收记录\n${t.criteria.map(c=>`- [${r.checks[c.id]?'x':' '}] ${c.label}`).join('\n')}\n\n## 我的复盘\n${r.notes || '未填写'}\n`,'text/markdown');
  }
  async function readBackup(file) {
    if(!file)return;
    try {
      if(file.size>16*1024*1024)throw new Error('备份文件超过 16 MB，无法导入。');
      const raw=JSON.parse(await file.text());
      if(raw.app!=='qicheng-agent-academy'||![1,2].includes(raw.version)||!raw.state)throw new Error('这不是兼容的启程学习备份。');
      pendingBackup=K.normalizeState(raw.state,C,{strict:true});
      const s=K.getStats(pendingBackup,C);
      openDialog('恢复这份学习记录？',`<p>备份包含以下内容：</p><div class="settings-list"><div class="settings-row"><span>学习目标</span><strong>${esc(s.goal.title)}</strong></div><div class="settings-row"><span>理解检查通过</span><strong>${s.allCompletedLessons} 节</strong></div><div class="settings-row"><span>项目练习 / 普通草稿</span><strong>${pendingBackup.learning.runs.length} / ${s.drafts}</strong></div></div><p class="field-hint">恢复会替换当前浏览器的学习记录。可以先关闭此窗口，导出当前备份。</p>`,`<button class="button secondary" data-action="close-dialog">取消</button><button class="button primary" data-action="restore-backup">确认恢复</button>`);
    }catch(error){pendingBackup=null;const reason=error instanceof SyntaxError?'备份文件内容不完整或格式有误':error.message||'备份文件格式有误';toast(`无法恢复：${reason}。当前记录已保留。`);}
  }
  function saveTaskField(id,field,value) {
    const r=state.tasks[id];r.mode='practice';r[field]=value;
    if(field==='input'||field==='output') {
      r.completedAt=null;
      Object.keys(r.checks).forEach(key=>r.checks[key]=false);
    }
    r.savedAt=new Date().toISOString();
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
      saveTimer=null;persist({quiet:true});
      const indicator=$('#task-save-indicator');if(indicator)indicator.textContent=storageAvailable?'草稿已自动保存在本机':'未能自动保存，请导出备份';
    },300);
  }
  function completeTask(id) {
    const t=taskById(id),r=state.tasks[id];
    if(taskMode(id)!=='practice')return toast('请先使用自己的资料完成独立练习。');
    if(r.input.trim().length<10){ui.steps[id]=1;renderTask(id);return toast('请先记录自己的资料或任务背景，至少 10 个字符。');}
    if(r.output.trim().length<20){ui.steps[id]=2;renderTask(id);return toast('请先粘贴实际成果，至少 20 个字符。');}
    if(!t.criteria.every(c=>r.checks[c.id])){ui.steps[id]=2;renderTask(id);return toast('请先核对结果，并完成全部验收项。');}
    const first=!r.completedAt;r.mode='practice';r.completedAt=new Date().toISOString();r.savedAt=r.completedAt;
    if(first)activity('task',id);
    persist();renderTask(id);toast('普通自检成果已保存。进入学习项目，可积累多次练习与能力证据。');
  }
  document.addEventListener('click',async event=>{
    const target=event.target.closest('[data-action]');
    if(!target)return;
    const action=target.dataset.action,id=target.dataset.id;
    if(action==='goal')goalDialog();
    if(action==='close-dialog')dialog.close();
    if(action==='export')exportBackup();
    if(action==='import'){$('#backup-file').value='';$('#backup-file').click();}
    if(action==='restore-backup'&&pendingBackup){state=pendingBackup;pendingBackup=null;Object.assign(ui,{choices:{},feedback:{},taskModes:{},steps:{}});persist();dialog.close();render();toast('学习记录已恢复。');}
    if(action==='reset-dialog')openDialog('清空本机学习记录？','<p>这会移除当前浏览器中的目标、课程进度、草稿和成果。建议先导出一份备份。</p>','<button class="button secondary" data-action="close-dialog">取消</button><button class="button danger" data-action="reset-confirm">确认清空并重新开始</button>');
    if(action==='reset-confirm'){state=K.createState(C);Object.assign(ui,{choices:{},feedback:{},taskModes:{},steps:{},challenges:{}});persist();dialog.close();location.hash='#/overview';render();toast('已开启新的学习记录。');}
    if(action==='quiz-choice'){ui.choices[id]=Number(target.dataset.index);delete ui.feedback[id];renderLesson(id);}
    if(action==='quiz-submit'){
      const l=lessonById(id),answer=ui.choices[id]??state.lessons[id]?.answerIndex;
      if(answer===undefined)return;
      const correct=answer===l.quiz.answerIndex;ui.feedback[id]={correct};
      if(correct){const first=!state.lessons[id]?.passed;state.lessons[id]={passed:true,answerIndex:answer,answeredAt:new Date().toISOString()};if(first)activity('lesson',id);persist();}
      renderLesson(id);
      const quiz=$('.quiz-card');if(quiz)quiz.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
    if(action==='filter'){ui.filter=target.dataset.value;renderTasks();}
    if(action==='copy-prompt')await copyText(taskById(id).prompt);
    if(action==='task-mode'){
      const mode=target.dataset.mode;ui.taskModes[id]=mode;
      if(mode==='example'){ui.steps[id]=0;state.tasks[id].exampleSeen=true;}else{ui.steps[id]=state.tasks[id].mode==='practice'?state.tasks[id].checkpoint:1;state.tasks[id].mode='practice';state.tasks[id].checkpoint=ui.steps[id];}
      persist({quiet:true});renderTask(id);
    }
    if(action==='task-step'){
      const step=Number(target.dataset.step);ui.steps[id]=step;
      if(taskMode(id)==='practice')state.tasks[id].checkpoint=step;else state.tasks[id].exampleSeen=true;
      persist({quiet:true});renderTask(id);
    }
    if(action==='challenge'){ui.challenges[id]=Number(target.dataset.index);renderTask(id);}
    if(action==='save-draft'){state.tasks[id].savedAt=new Date().toISOString();persist();toast('练习草稿已保存，可以随时回来继续。');}
    if(action==='task-complete')completeTask(id);
    if(action==='download-artifact')downloadArtifact(id);
  });
  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.id==='task-search'){ui.search=el.value.trim();renderTaskCards();}
    if(el.dataset.taskField){
      saveTaskField(el.dataset.id,el.dataset.taskField,el.value);
      if(el.dataset.taskField!=='notes'){
        document.querySelectorAll('[data-task-check]').forEach(checkbox=>checkbox.checked=false);
        $('.completion-banner')?.remove();
      }
    }
  });
  document.addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='goal-id')$('#goal-description').textContent=C.goals.find(g=>g.id===el.value).description;
    if(el.id==='backup-file')await readBackup(el.files[0]);
    if(el.dataset.taskCheck){
      const r=state.tasks[el.dataset.id];r.mode='practice';r.checks[el.dataset.taskCheck]=el.checked;
      if(!el.checked){r.completedAt=null;$('.completion-banner')?.remove();}
      r.savedAt=new Date().toISOString();persist({quiet:true});
    }
    if(el.dataset.taskUpload){
      const file=el.files[0];if(!file)return;
      if(file.size>100*1024)return toast('请导入小于 100 KB 的文本文件。');
      if(!/\.(txt|md|csv)$/i.test(file.name))return toast('目前支持 TXT、MD 和 CSV 文本。');
      try{const text=await file.text();if(text.length>30000)return toast('文本超过 30000 字符，请先摘取任务需要的部分。');saveTaskField(el.dataset.taskUpload,'input',text);renderTask(el.dataset.taskUpload);toast('资料已在本机读取，没有上传。');}catch(error){toast('未能读取文件，请改用粘贴文本。');}
    }
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='goal-form')return;
    event.preventDefault();const data=new FormData(event.target);
    state.profile.goalId=data.get('goalId');state.profile.role=data.get('role');state.profile.weeklyMinutes=Number(data.get('weeklyMinutes'));
    activity('goal',state.profile.goalId);persist();dialog.close();render();toast('目标已更新，已完成的记录会继续保留。');
  });
  $('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();});
  window.addEventListener('hashchange',render);
  window.addEventListener('pagehide',()=>{if(saveTimer){clearTimeout(saveTimer);saveTimer=null;persist({quiet:true});}});
  window.addEventListener('storage',event=>{
    if(event.key!==STORAGE_KEY||!event.newValue)return;
    try{
      const incoming=K.normalizeState(JSON.parse(event.newValue),C,{strict:true});
      const localLearning=state.learning;
      const mergedRuns=new Map([...incoming.learning.runs,...localLearning.runs].map(run=>[run.id,run]));
      if(mergedRuns.size>500)throw new Error('多标签页记录合并超出容量，请导出备份。');
      const withdrawn=[...new Set([...incoming.learning.withdrawnRunIds,...localLearning.withdrawnRunIds])];
      if(state.updatedAt>incoming.updatedAt||document.activeElement?.matches('[data-project-field],[data-project-select],[data-project-time]'))incoming.learning=localLearning;
      incoming.learning.withdrawnRunIds=withdrawn;
      incoming.learning.runs=[...mergedRuns.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
      incoming.learning=window.AgentQualityCore.normalizeLearning(incoming.learning,C,{strict:true});
      for(const task of C.tasks){if((state.tasks[task.id].savedAt||'')>(incoming.tasks[task.id].savedAt||''))incoming.tasks[task.id]=state.tasks[task.id];}
      for(const lesson of C.lessons){if((state.lessons[lesson.id]?.answeredAt||'')>(incoming.lessons[lesson.id]?.answeredAt||''))incoming.lessons[lesson.id]=state.lessons[lesson.id];}
      const events=new Map([...state.activities,...incoming.activities].map(item=>[item.at+'|'+item.type+'|'+item.id,item]));
      incoming.activities=[...events.values()].sort((a,b)=>a.at.localeCompare(b.at)).slice(-3000);
      if(state.updatedAt>incoming.updatedAt)incoming.profile=state.profile;
      state=incoming;P.checkpoint();Object.assign(ui,{choices:{},feedback:{}});
      if(document.activeElement?.matches('[data-task-field],[data-project-field],[data-project-time]')){updateShell();toast('另一标签页已更新，当前正在编辑的草稿已保留。');}
      else{ui.taskModes={};ui.steps={};render();toast('已同步另一个标签页中的学习记录。');}
    }catch(error){toast('另一个标签页的记录未能读取，当前内容已保留。');}
  });
  if(!location.hash||location.hash==='#')history.replaceState(null,'','#/overview');
  render();
  try{localStorage.setItem('qicheng.storage-check','1');localStorage.removeItem('qicheng.storage-check');}catch(error){storageAvailable=false;$('#save-status').textContent='本地保存不可用';$('#storage-label').textContent='请导出备份保存进度';}
  if(loadWarning)toast(loadWarning);
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
