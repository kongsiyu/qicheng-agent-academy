/* 启程 · Static, client-first learning application. No network/model calls. */
(() => {
  'use strict';
  const C = window.AgentCourseContent;
  const K = window.AgentLearningCore;
  const STORAGE_KEY = 'qicheng.agent-academy.v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const answerPreview = (text, style = 'output-preview') => `<div class="${style} answer-markdown">${window.AgentMarkdown.render(text)}</div>`;
  const answerEditorPreview = `<details class="answer-editor-preview"><summary>预览 Markdown</summary><div class="output-preview answer-markdown"></div></details>`;
  function updateAnswerPreview(details) {
    if (!details?.open || !details.matches('.answer-editor-preview')) return;
    const text = details.previousElementSibling.value;
    $('.answer-markdown', details).innerHTML = text.trim()
      ? window.AgentMarkdown.render(text)
      : '<p>粘贴回答后可在这里预览。</p>';
  }
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
  const iconAliases = {pdf:'knowledge',email:'meeting',feedback:'research',presentation:'weekly',cleanup:'spreadsheet',files:'folder'};
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons[iconAliases[name]] || icons.book}</svg>`;
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
  const ui = {filter:'全部',search:'',choices:{},feedback:{}};
  let toastTimer, pendingBackup;
  const main = $('#main');
  const dialog = $('#app-dialog');
  const lessonById = id => C.lessons.find(item => item.id === id);
  const taskById = id => C.tasks.find(item => item.id === id);
  const getStats = () => K.getStats(state, C);
  const P = window.createProjectUI({C,K,esc,icon,answerPreview,answerEditorPreview,main,getState:()=>state,save:()=>persist({quiet:true}),toast,download,copyText,openDialog,closeDialog:()=>dialog.close()});
  const tutorCourses = window.AcademyTutorCatalog;
  const tutors = new Map(tutorCourses.map(content => [content.slug, window.createTutorUI({
    main,esc,icon,answerPreview,openDialog,closeDialog:()=>dialog.close(),content
  })]));
  const workflowCatalog = window.AcademyWorkflowContent;
  const workflows = new Map(workflowCatalog.map(definition => [definition.id, window.createWorkflowUI({
    definition, sampleInput:definition.sampleInput ?? taskById(definition.taskId).sampleInput,
    esc,icon,main,answerPreview,answerEditorPreview,copyText,download,today:K.today,toast,
    getState:()=>state.workflows?.[definition.id]?.record,
    save:record=>{
      state.workflows ||= {};
      state.workflows[definition.id] = {record,updatedAt:new Date().toISOString()};
      return persist({quiet:true});
    }
  })]));
  function workflowCards(entries) {
    return entries.length ? `<section class="workflow-catalog" aria-label="工作流实验"><h2>工作流实验</h2>${entries.map(entry=>entry.entry()).join('')}</section>` : '';
  }
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
    const active = ['lesson','tutor'].includes(section) ? 'route' : ['task','project','workflow'].includes(section) ? 'tasks' : section;
    const links = [['overview','home','学习总览'],['route','route','学习路线'],['tasks','lab','任务实验室'],['artifacts','folder','我的成果'],['settings','settings','学习设置']];
    const savedPractices = state.learning.runs.filter(run=>!state.learning.withdrawnRunIds.includes(run.id) && !['baseline','pretest'].includes(run.kind)).length;
    $('#nav-links').innerHTML = links.map(([id,ic,label]) => `<a class="nav-item ${active===id?'active':''}" href="#/${id}" ${active===id?'aria-current="page"':''} aria-label="${label}">${icon(ic)}<span class="nav-label">${label}</span>${id==='artifacts'&&savedPractices?`<span class="nav-count">${savedPractices}</span>`:''}</a>`).join('');
    $('#breadcrumb').innerHTML = `我的学习空间 <span>/</span> <strong>${section==='task'?'动手练习':section==='project'?(['start','path'].includes(location.hash.split('/')[2])?'动手练习':'学习计划与记录'):links.find(x=>x[0]===active)?.[2] || '学习总览'}</strong>`;
    $('#sidebar-progress').innerHTML = ['overview','tasks','task','artifacts'].includes(section) || /^#\/project\/(start|path|records|train|pack)/.test(location.hash) ? `<div class="sidebar-practice-note"><strong>${savedPractices ? `已保存 ${savedPractices} 次练习` : '先完成一次练习'}</strong><p>准备资料，交给 Agent，再核对结果。</p><a class="text-link" href="#/route">之后再学课程 ${icon('arrow')}</a></div>` : `<div class="sidebar-progress-heading"><span>课程与项目记录</span><strong>${stats.percent}%</strong></div>${bar(stats.percent)}<p class="sidebar-note">${esc(stats.goal.title)}<br>${stats.completedLessons}/${stats.requiredLessons.length} 课理解检查 · ${stats.weeks.slice(0,stats.goal.weeks).filter(w=>w.done).length}/${stats.goal.weeks} 周项目证据</p>`;
  }
  function taskCard(task) {
    return `<article class="task-card surface-card beginner-task-card"><div class="task-card-top"><div class="task-icon">${icon(task.id)}</div>${task.id==='meeting'?'<span class="badge green">首次推荐</span>':''}</div><h3 class="task-title">${esc(task.title)}</h3><p class="task-description">${esc(task.summary)}</p><div class="task-footer"><span>约 ${task.minutes} 分钟 · 示例已备好</span><a class="button small secondary" href="#/project/start" data-project-action="choose-task" data-task="${task.id}">开始练习 ${icon('arrow')}</a></div></article>`;
  }
  function heroArt() {
    return `<svg viewBox="0 0 240 260" fill="none" role="img" aria-label="从目标出发，沿着路线逐步完成任务"><circle cx="132" cy="128" r="88" fill="var(--art-orbit)"/><circle cx="132" cy="128" r="67" stroke="var(--art-line)" stroke-dasharray="3 7"/><path d="M63 183c0-52 111 10 111-54S72 125 72 72" stroke="var(--art-line)" stroke-width="2" stroke-dasharray="5 6"/><rect x="36" y="42" width="100" height="59" rx="12" fill="var(--art-card)" transform="rotate(-7 36 42)"/><rect x="52" y="57" width="30" height="5" rx="2.5" fill="var(--art-detail)"/><rect x="52" y="71" width="60" height="4" rx="2" fill="var(--art-line)"/><rect x="52" y="82" width="46" height="4" rx="2" fill="var(--art-line)"/><rect x="113" y="112" width="95" height="63" rx="12" fill="var(--art-card)" transform="rotate(8 113 112)"/><circle cx="138" cy="138" r="11" fill="var(--art-orbit)"/><path d="m133 138 4 4 7-8" stroke="var(--art-detail)" stroke-width="2" stroke-linecap="round"/><path d="M158 135h29m-29 10h22" stroke="var(--art-line)" stroke-width="4" stroke-linecap="round"/><circle cx="66" cy="192" r="24" fill="var(--art-spot)"/><path d="m55 192 7 7 15-16" stroke="var(--art-card)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="190" cy="56" r="5" fill="var(--art-detail)"/><path d="M201 201v12m-6-6h12" stroke="var(--art-line)" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  function renderOverview() {
    const s = getStats();
    const next = s.nextLesson;
    const draft = state.learning.draft;
    const continuing = draft.kind==='practice' && !!(draft.input.trim() || draft.output.trim());
    const currentTask = continuing ? taskById(draft.taskId) : taskById('meeting');
    const saved = state.learning.runs.filter(run=>!state.learning.withdrawnRunIds.includes(run.id) && !['baseline','pretest'].includes(run.kind));
    main.innerHTML = `<div class="welcome-row"><div><p class="eyebrow">从一件小事开始</p><h1>让 Agent 帮你做成一次。</h1><p>先动手，遇到需要的方法再学。</p></div></div><section class="start-hero" aria-label="开始一次练习"><div class="start-hero-copy"><span class="badge green">${continuing?'接着上次的练习':'首次推荐 · 约 15 分钟'}</span><h2>${continuing?esc(currentTask.title):'把一段会议记录，变成待办清单。'}</h2><p>${continuing?'资料和编辑内容已保留，按步骤继续就好。':'示例资料和任务说明都已准备好。跟着三步完成，再试试自己的资料。'}</p><div class="start-main-actions"><a class="button primary" href="#/project/start" ${continuing?'':'data-project-action="choose-task" data-task="meeting"'}>${continuing?'继续上次练习':'开始一次 15 分钟练习'} ${icon('arrow')}</a><a class="button secondary" href="#/route">查看 AI 教练课</a><a class="text-link" href="#/tasks">换一个任务</a></div></div><div class="start-hero-art" aria-hidden="true">${heroArt()}</div></section><ol class="starter-steps" aria-label="练习只需三步"><li><span>1</span><div><h3>看资料</h3><p>直接用示例，也可以换成自己的。</p></div></li><li><span>2</span><div><h3>交给 Agent</h3><p>复制说明，执行后带回结果。</p></div></li><li><span>3</span><div><h3>对照检查</h3><p>核对依据，把未知和问题留清楚。</p></div></li></ol><div class="home-followups"><section class="home-followup surface-card"><div class="home-followup-icon">${icon('book')}</div><div><h2>做过一次，再把方法学扎实</h2><p>${next?`下一课：${esc(next.title)}`:'按需要回看课程，或进入项目验证自己的方法。'}</p><a class="text-link" href="${s.allCompletedLessons && next?'#/lesson/'+next.id:'#/route'}">${s.allCompletedLessons?'继续学课程':'看看学习路线'} ${icon('arrow')}</a></div></section><section class="home-followup surface-card"><div class="home-followup-icon">${icon('folder')}</div><div><h2>练习会留在这里</h2><p>${saved.length?`已保存 ${saved.length} 份练习记录，可随时回看。`:'完成后保存资料、实际输出和自检记录，方便下次继续。'}</p><a class="text-link" href="#/artifacts">查看我的成果 ${icon('arrow')}</a></div></section></div>`;
  }
  function renderRoute() {
    const s=getStats();
    main.innerHTML=pageHeading('学习路线','选一门课，练一项工作技能。','可以和 AI 教练对话练习，也可以按自己的进度学。',`<button class="button secondary" data-action="goal">${icon('target')} 调整目标</button>`)+
      `<section class="tutor-course-catalog" aria-labelledby="tutor-catalog-title">
        <h2 id="tutor-catalog-title">AI 教练课</h2>
        <div class="tutor-course-list">${tutorCourses.map(course => {
          const tutor = tutors.get(course.slug);
          const action = tutor.status();
          return `<article class="tutor-course-card surface-card">
            <div class="tutor-course-copy"><h3>${esc(course.title)}</h3><p>${esc(course.summary)}</p></div>
            <a class="button secondary" href="${tutor.href}" aria-label="${action} · ${esc(course.title)}">${action} ${icon('arrow')}</a>
          </article>`;
        }).join('')}</div>
      </section>
      <section class="route-self-study" aria-labelledby="route-self-study-title">
        <h2 id="route-self-study-title">自主学习</h2>
        <div class="route-summary surface-card"><div><h3>${esc(s.goal.title)}</h3><p class="muted">${s.completedLessons}/${s.requiredLessons.length} 节目标课程 · ${s.weeks.slice(0,s.goal.weeks).filter(w=>w.done).length}/${s.goal.weeks} 周项目证据</p></div><div><strong>${s.percent}%</strong>${bar(s.percent)}</div></div>`+C.modules.map(m=>{
      const done=m.lessonIds.filter(id=>state.lessons[id]?.passed).length;
      return `<section class="module-card surface-card"><header class="module-header"><span class="module-number">${m.scenario?'练':String(m.week).padStart(2,'0')}</span><div class="module-copy"><h2>${esc(m.title)} ${m.optional?'<span class="badge orange">'+(m.scenario?'按需':'选修')+'</span>':''}</h2><p>${esc(m.subtitle)}</p></div><div class="module-progress"><span>${done}/${m.lessonIds.length} 完成</span>${bar(Math.round(done/m.lessonIds.length*100))}</div></header><div class="lesson-list">${m.lessonIds.map(id=>{const l=lessonById(id),passed=state.lessons[id]?.passed;return `<a class="lesson-row" href="#/lesson/${id}"><span class="lesson-symbol ${passed?'done':''}">${icon(passed?'check':'book')}</span><span class="lesson-details"><strong>${esc(l.title)}</strong><p>${esc(l.summary)}</p></span><span class="lesson-meta"><span>${l.minutes} 分钟</span><span>${passed?'理解检查通过':'开始学习'}</span>${icon('chevron')}</span></a>`;}).join('')}</div>${m.scenario?'':P.weekCard('w'+m.week)}</section>`;
    }).join('')+'</section>';
  }
  function renderLesson(id) {
    const l=lessonById(id);if(!l)return renderNotFound();
    const m=C.modules.find(x=>x.id===l.moduleId),passed=state.lessons[id]?.passed;
    const selected=ui.choices[id] ?? state.lessons[id]?.answerIndex;
    const feedback=ui.feedback[id];
    const related=C.tasks.filter(t=>t.lessonIds.includes(id));
    const relatedExperiments=workflowCatalog.filter(definition=>related.some(task=>task.id===definition.taskId));
    const workflowLinks=relatedExperiments.map(definition=>`<a class="related-task" href="${workflows.get(definition.id).href}">${icon('route')}<span>${esc(definition.title)}<small>工作流实验</small></span>${icon('chevron')}</a>`).join('');
    const next=C.lessons[C.lessons.indexOf(l)+1];
    main.innerHTML=pageHeading(m.scenario?'场景加练 · 按需选学':`第 ${m.week} 周 · ${esc(m.title)}`,esc(l.title),`${l.minutes} 分钟 · ${esc(l.skill || m.subtitle)}`,`<a class="button ghost" href="#/route">返回学习路线</a>`)+`<div class="lesson-layout"><article class="lesson-main"><section class="lesson-section surface-card"><p class="lesson-intro">${esc(l.summary)}</p>${m.scenario?`<div class="callout scenario-outcome"><strong>这次做出什么</strong><p>${esc(related[0]?.outcome)}</p><a class="text-link" href="#/project/start" data-project-action="choose-task" data-task="${related[0]?.id}">跟着三步做一次 ${icon('arrow')}</a></div>`:''}${l.blocks.map((block,i)=>`<section class="lesson-block"><span class="block-index">${String(i+1).padStart(2,'0')}</span><div><h2>${esc(block.title)}</h2><p>${esc(block.text).replace(/\n/g,'<br>')}</p></div></section>`).join('')}</section><section class="quiz-card surface-card" aria-label="本课小测"><div class="section-heading"><div><p class="eyebrow">CHECK YOUR UNDERSTANDING</p><h2>检查本课的理解。</h2></div>${passed?'<span class="badge green">已通过</span>':''}</div><h3>${esc(l.quiz.question)}</h3><div class="quiz-options" role="radiogroup" aria-label="选择答案">${l.quiz.options.map((option,i)=>`<button type="button" role="radio" aria-checked="${selected===i}" class="quiz-option ${selected===i?'selected':''} ${feedback&&selected===i?(i===l.quiz.answerIndex?'correct':'incorrect'):''}" data-action="quiz-choice" data-id="${id}" data-index="${i}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span></button>`).join('')}</div>${feedback?`<div class="quiz-feedback ${feedback.correct?'success':'error'}" role="status"><strong>${feedback.correct?'理解检查通过。可以选一个相关任务，动手试一次。':'再想一想，你可以重新选择。'}</strong><p>${esc(l.quiz.explanation)}</p></div>`:''}<div class="lesson-navigation"><button class="button primary" data-action="quiz-submit" data-id="${id}" ${selected===undefined?'disabled':''}>${passed?'再次检查理解':'提交理解检查'} ${icon('check')}</button>${passed&&next?`<a class="button secondary" href="#/lesson/${next.id}">下一课 ${icon('arrow')}</a>`:''}</div></section></article><aside class="lesson-aside"><div class="sticky-summary surface-card"><p class="eyebrow">${m.scenario?'场景加练':'本周学习'}</p><h3>${esc(m.title)}</h3><div class="aside-lessons">${m.lessonIds.map(lid=>`<a class="aside-lesson ${lid===id?'active':''}" href="#/lesson/${lid}">${icon(state.lessons[lid]?.passed?'check':'book')}<span>${esc(lessonById(lid).title)}</span></a>`).join('')}</div></div><div class="sticky-summary surface-card"><p class="eyebrow">把方法用起来</p><h3>相关任务</h3>${related.slice(0,2).map(t=>`<a class="related-task" href="#/project/start" data-project-action="choose-task" data-task="${t.id}">${icon(t.id)}<span>${esc(t.title)}<small>按三步开始练习</small></span>${icon('chevron')}</a>`).join('')||'<p class="muted">到任务实验室，选择一件正在做的工作。</p>'}${workflowLinks}</div></aside></div>`;
  }
  function renderTaskCards() {
    const filtered=C.tasks.filter(t=>(ui.filter==='全部'||t.category===ui.filter)&&(`${t.title} ${t.summary} ${t.skills.join(' ')}`.includes(ui.search)));
    const groups=[['先从熟悉的小事开始',filtered.filter(t=>!t.scenario)],['场景加练 · 按需要选一个',filtered.filter(t=>t.scenario)]];
    $('#task-list').innerHTML=filtered.length?groups.filter(([,tasks])=>tasks.length).map(([title,tasks])=>`<section class="lab-task-group"><h2>${title}</h2><div class="task-grid beginner-task-grid">${tasks.map(taskCard).join('')}</div></section>`).join(''):'<div class="empty-state"><h3>暂时没有匹配的任务</h3><p>试试更短的关键词，或切换到全部任务。</p></div>';
  }
  function renderTasks() {
    ui.filter='全部';ui.search='';
    main.innerHTML=pageHeading('动手练习','今天，先做哪件小事？','选一个任务，就按步骤开始。每个任务都准备了示例资料和说明。')+
      workflowCards([...workflows.values()])+
      `<div class="lab-three-steps" aria-label="普通练习过程"><span><b>1</b> 看资料</span><span>${icon('chevron')}</span><span><b>2</b> 交给 Agent</span><span>${icon('chevron')}</span><span><b>3</b> 对照检查</span></div><div id="task-list"></div><p class="lab-next-note">初次使用，推荐从会议待办开始。准备好之后，再到<a class="text-link" href="#/route">学习路线</a>了解完整方法。</p>`;
    renderTaskCards();
  }
  function renderArtifacts() {
    const s=getStats();
    const runs=state.learning.runs.filter(r=>!state.learning.withdrawnRunIds.includes(r.id) && !['baseline','pretest'].includes(r.kind)).slice().reverse();
    const oldTasks=C.tasks.filter(t=>{const r=state.tasks[t.id];return r.input||r.output||r.notes;});
    const recent=runs.slice(0,6);
    const completedWorkflows = [...workflows.values()].filter(experiment => experiment.isComplete());
    const total = runs.length + completedWorkflows.length;
    main.innerHTML=pageHeading('我的成果','做过的练习，随时回来看看。',total?`已保存 ${total} 份练习与项目记录。保存记录后，仍可继续核查和改进。`:'资料、实际输出和自检记录会保存在这里。',`<a class="button primary" href="#/project/records">查看全部练习记录 ${icon('arrow')}</a><button class="button secondary" data-action="export">${icon('download')} 备份全部记录</button>`)+
      workflowCards(completedWorkflows) +
      (recent.length?`<div class="artifact-grid beginner-artifacts">${recent.map(r=>`<article class="artifact-card surface-card"><div class="section-heading"><div class="task-icon">${icon(r.taskId)}</div><span class="badge neutral">${r.kind==='practice'?'普通练习已保存':'项目自评记录'}</span></div><h2>${esc(taskById(r.taskId).title)}</h2><p class="artifact-record-meta">${esc(r.date)} · ${r.context==='work'?'自己的工作资料':'教学或模拟资料'}</p>${answerPreview(r.output,'artifact-preview')}<p class="field-hint">${r.kind==='practice'?'这是一份有引导的练习记录。':'项目判断与成果可在记录页查看并导出核查。'}</p><a class="text-link" href="#/project/records">查看练习记录 ${icon('arrow')}</a></article>`).join('')}</div>`:completedWorkflows.length?'':`<div class="empty-state surface-card">${icon('folder')}<h2>从一次小练习开始。</h2><p>示例已经准备好，跟着三步完成，最后保存结果。</p><a class="button primary" href="#/project/start" data-project-action="choose-task" data-task="meeting">开始会议待办练习 ${icon('arrow')}</a></div>`)+
      (oldTasks.length?`<details class="legacy-history"><summary>以前的自检成果 · ${oldTasks.length} 份</summary><p>旧资料、输出和自检记录都已保留。可展开查看原文，或按逐步流程继续。</p><div class="artifact-grid">${oldTasks.map(t=>legacyRecord(t,s.completedTaskIds.includes(t.id))).join('')}</div></details>`:'');
  }
  function legacyRecord(t,done) {
    const r=state.tasks[t.id];
    return `<article class="artifact-card surface-card"><span class="badge neutral">${done?'普通自检完成':'历史草稿'}</span><h3>${esc(t.title)}</h3>${r.output?answerPreview(r.output,'artifact-preview'):`<pre class="artifact-preview">${esc(r.input||r.notes)}</pre>`}<details class="task-faq"><summary>查看原记录</summary>${[['资料',r.input],['实际输出',r.output],['复盘',r.notes]].map(([label,value])=>`<h4>${label}</h4><pre class="output-preview">${esc(value||'未填写')}</pre>`).join('')}<h4>当时的自检记录</h4><ul class="project-list">${t.criteria.map(c=>`<li>${r.checks[c.id]?'已确认':'未确认'}：${esc(c.label)}</li>`).join('')}</ul></details><div class="task-actions"><button type="button" class="button secondary small" data-project-action="legacy-task" data-task="${t.id}">按步骤继续 ${icon('arrow')}</button><button class="button ghost small" data-action="download-artifact" data-id="${t.id}">${icon('download')} 导出原记录</button></div></article>`;
  }
  function renderSettings() {
    const s=getStats();
    main.innerHTML=pageHeading('MAKE IT YOURS','按自己的节奏，学会新方法。','设置目标、安排投入，也照顾好自己的学习记录。')+`<div class="settings-grid"><section class="settings-section surface-card"><div class="section-heading"><h2>AI 教练模型</h2>${icon('star')}</div><p class="muted">连接自己的模型服务。陪练对话从当前浏览器直接发给你配置的接口。</p><button type="button" class="button secondary" data-tutor-action="configure-model">配置模型</button></section><section class="settings-section surface-card"><div class="section-heading"><h2>我的学习计划</h2>${icon('target')}</div><div class="settings-list"><div class="settings-row"><span class="muted">当前目标</span><strong>${esc(s.goal.title)}</strong></div><div class="settings-row"><span class="muted">岗位方向</span><strong>${esc(state.profile.role)}</strong></div><div class="settings-row"><span class="muted">每周投入</span><strong>${state.profile.weeklyMinutes} 分钟</strong></div><div class="settings-row"><span class="muted">目标要求</span><strong>${s.requiredLessons.length} 节课 + ${s.goal.weeks} 周项目证据</strong></div><div class="settings-row"><span class="muted">开始日期</span><strong>${K.formatDate(state.profile.startedAt)}</strong></div></div><button class="button secondary" data-action="goal">调整目标与节奏</button><p class="field-hint">调整目标会保留已经完成的课程和成果。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>数据与备份</h2>${icon('folder')}</div><div class="callout"><strong>${storageAvailable?'记录保存在当前浏览器':'当前浏览器无法持久保存'}</strong><p>本工具无需登录。学习进度、练习资料和成果在本机处理，换设备或清理浏览器前，请先导出备份。</p></div><div class="backup-actions"><button class="button primary" data-action="export">${icon('download')} 导出完整备份</button><button class="button secondary" data-action="import">${icon('upload')} 从备份恢复</button></div><p class="field-hint">备份包含你的练习文本，请保存到自己信任的位置。恢复前会先展示记录摘要。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>这个学习空间如何工作</h2>${icon('info')}</div><div class="settings-list"><div class="settings-row"><span>课程与示例</span><strong>${C.lessons.length} 节短课 · ${C.tasks.length} 个任务包</strong></div><div class="settings-row"><span>示例结果</span><strong>预置教学材料</strong></div><div class="settings-row"><span>独立练习</span><strong>在常用 Agent 中执行，带回结果验收</strong></div><div class="settings-row"><span>进度规则</span><strong>理解检查 + 每周项目证据</strong></div></div><p class="field-hint">AI 教练课使用你配置的模型。课程、教程和普通练习可由静态站点提供。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>重新开始</h2></div><p class="muted">需要为新一轮学习腾出空间时，可以清空本机记录。建议先导出一份备份。</p><button class="button danger" data-action="reset-dialog">清空本机学习记录</button></section></div>`;
  }
  function renderNotFound() {main.innerHTML=`<div class="empty-state"><h1>这个页面暂时没有找到</h1><p>可以回到学习总览，接着完成下一步。</p><a class="button primary" href="#/overview">返回总览</a></div>`;}
  function render() {
    if(dialog.open)dialog.close();
    const [,page='overview',id]=location.hash.split('/');
    const routes={overview:renderOverview,route:renderRoute,tasks:renderTasks,artifacts:renderArtifacts,settings:renderSettings};
    if(page==='lesson')renderLesson(id);
    else if(page==='task'){if(taskById(id))P.openLegacy(id);else renderNotFound();}
    else if(page==='project')P.render(id);
    else if(page==='tutor'){const tutor=tutors.get(id);if(tutor && location.hash===tutor.href)tutor.render();else renderNotFound();}
    else if(page==='workflow'){const experiment=workflows.get(id);if(experiment)experiment.render();else renderNotFound();}
    else (routes[page]||renderNotFound)();
    updateShell();window.scrollTo({top:0,behavior:'instant'});
    document.title=`${({overview:'学习总览',route:'学习路线',tasks:'任务实验室',artifacts:'我的成果',settings:'学习设置',tutor:'AI 教练课',workflow:'工作流实验',project:['start','path'].includes(id)?'动手练习':'学习计划与记录',lesson:lessonById(id)?.title,task:taskById(id)?.title})[page] || '启程'} · 启程`;
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
    toast('备份已导出，包含学习记录、草稿和工作流实验。');
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
      openDialog('恢复这份学习记录？',`<p>备份包含以下内容：</p><div class="settings-list"><div class="settings-row"><span>学习目标</span><strong>${esc(s.goal.title)}</strong></div><div class="settings-row"><span>理解检查通过</span><strong>${s.allCompletedLessons} 节</strong></div><div class="settings-row"><span>项目练习 / 普通草稿</span><strong>${pendingBackup.learning.runs.length} / ${s.drafts}</strong></div><div class="settings-row"><span>工作流记录</span><strong>${Object.keys(pendingBackup.workflows || {}).length} 份</strong></div></div><p class="field-hint">恢复会替换当前浏览器的学习记录。可以先关闭此窗口，导出当前备份。</p>`,`<button class="button secondary" data-action="close-dialog">取消</button><button class="button primary" data-action="restore-backup">确认恢复</button>`);
    }catch(error){pendingBackup=null;const reason=error instanceof SyntaxError?'备份文件内容不完整或格式有误':error.message||'备份文件格式有误';toast(`无法恢复：${reason}。当前记录已保留。`);}
  }
  document.addEventListener('click',async event=>{
    const target=event.target.closest('[data-action]');
    if(!target)return;
    const action=target.dataset.action,id=target.dataset.id;
    if(action==='goal')goalDialog();
    if(action==='close-dialog')dialog.close();
    if(action==='export')exportBackup();
    if(action==='import'){$('#backup-file').value='';$('#backup-file').click();}
    if(action==='restore-backup'&&pendingBackup){state=pendingBackup;pendingBackup=null;Object.assign(ui,{choices:{},feedback:{}});persist();dialog.close();render();toast('学习记录已恢复。');}
    if(action==='reset-dialog')openDialog('清空本机学习记录？','<p>这会移除当前浏览器中的目标、课程进度、草稿和成果。建议先导出一份备份。</p>','<button class="button secondary" data-action="close-dialog">取消</button><button class="button danger" data-action="reset-confirm">确认清空并重新开始</button>');
    if(action==='reset-confirm'){state=K.createState(C);Object.assign(ui,{choices:{},feedback:{}});persist();dialog.close();location.hash='#/overview';render();toast('已开启新的学习记录。');}
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
    if(action==='download-artifact')downloadArtifact(id);
  });
  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.id==='task-search'){ui.search=el.value.trim();renderTaskCards();}
    updateAnswerPreview(el.nextElementSibling);
  });
  document.addEventListener('toggle',event=>updateAnswerPreview(event.target),true);
  document.addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='goal-id')$('#goal-description').textContent=C.goals.find(g=>g.id===el.value).description;
    if(el.id==='backup-file')await readBackup(el.files[0]);
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='goal-form')return;
    event.preventDefault();const data=new FormData(event.target);
    state.profile.goalId=data.get('goalId');state.profile.role=data.get('role');state.profile.weeklyMinutes=Number(data.get('weeklyMinutes'));
    activity('goal',state.profile.goalId);persist();dialog.close();render();toast('目标已更新，已完成的记录会继续保留。');
  });
  $('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();});
  window.addEventListener('hashchange',render);
  window.addEventListener('storage',event=>{
    if(event.key!==STORAGE_KEY||!event.newValue)return;
    try{
      const incoming=K.normalizeState(JSON.parse(event.newValue),C,{strict:true});
      const localLearning=state.learning;
      const mergedRuns=new Map([...incoming.learning.runs,...localLearning.runs].map(run=>[run.id,run]));
      if(mergedRuns.size>500)throw new Error('多标签页记录合并超出容量，请导出备份。');
      const withdrawn=[...new Set([...incoming.learning.withdrawnRunIds,...localLearning.withdrawnRunIds])];
      if(state.updatedAt>incoming.updatedAt||document.activeElement?.matches('[data-beginner-field],[data-project-field],[data-project-select],[data-project-time]'))incoming.learning=localLearning;
      incoming.learning.withdrawnRunIds=withdrawn;
      incoming.learning.runs=[...mergedRuns.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
      incoming.learning=window.AgentQualityCore.normalizeLearning(incoming.learning,C,{strict:true});
      for(const task of C.tasks){if((state.tasks[task.id].savedAt||'')>(incoming.tasks[task.id].savedAt||''))incoming.tasks[task.id]=state.tasks[task.id];}
      for(const lesson of C.lessons){if((state.lessons[lesson.id]?.answeredAt||'')>(incoming.lessons[lesson.id]?.answeredAt||''))incoming.lessons[lesson.id]=state.lessons[lesson.id];}
      const events=new Map([...state.activities,...incoming.activities].map(item=>[item.at+'|'+item.type+'|'+item.id,item]));
      incoming.activities=[...events.values()].sort((a,b)=>a.at.localeCompare(b.at)).slice(-3000);
      const workflowEditor = document.activeElement?.id==='workflow-output' || !!document.activeElement?.dataset?.workflowRoute;
      const editingWorkflowId = workflowEditor ? location.hash.split('/')[2] : null;
      if (state.workflows && incoming.workflows) {
        const remoteWins = Object.fromEntries(Object.entries(incoming.workflows).filter(([id,entry]) =>
          id !== editingWorkflowId && entry.updatedAt >= (state.workflows[id]?.updatedAt || '')));
        incoming.workflows = {...state.workflows,...remoteWins};
      } else if (state.workflows && (state.updatedAt > incoming.updatedAt || workflowEditor)) {
        incoming.workflows = state.workflows;
      }
      if(state.updatedAt>incoming.updatedAt)incoming.profile=state.profile;
      state=incoming;P.checkpoint();Object.assign(ui,{choices:{},feedback:{}});
      if(document.activeElement?.matches('[data-beginner-field],[data-project-field],[data-project-time]')){updateShell();toast('另一标签页已更新，当前正在编辑的草稿已保留。');}
      else if(workflowEditor){updateShell();toast('另一标签页已更新，当前正在编辑的工作流记录已保留。');}
      else{render();toast('已同步另一个标签页中的学习记录。');}
    }catch(error){toast('另一个标签页的记录未能读取，当前内容已保留。');}
  });
  if(!location.hash||location.hash==='#')history.replaceState(null,'','#/overview');
  render();
  try{localStorage.setItem('qicheng.storage-check','1');localStorage.removeItem('qicheng.storage-check');}catch(error){storageAvailable=false;$('#save-status').textContent='本地保存不可用';$('#storage-label').textContent='请导出备份保存进度';}
  if(loadWarning)toast(loadWarning);
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
