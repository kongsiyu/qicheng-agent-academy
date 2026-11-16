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
    const active = section === 'lesson' ? 'route' : section === 'task' ? 'tasks' : section;
    const links = [['overview','home','学习总览'],['route','route','学习路线'],['tasks','lab','任务实验室'],['artifacts','folder','我的成果'],['settings','settings','学习设置']];
    $('#nav-links').innerHTML = links.map(([id,ic,label]) => `<a class="nav-item ${active===id?'active':''}" href="#/${id}" ${active===id?'aria-current="page"':''} aria-label="${label}">${icon(ic)}<span class="nav-label">${label}</span>${id==='artifacts'&&stats.completedTasks?`<span class="nav-count">${stats.completedTasks}</span>`:''}</a>`).join('');
    $('#breadcrumb').innerHTML = `我的学习空间 <span>/</span> <strong>${links.find(x=>x[0]===active)?.[2] || '学习总览'}</strong>`;
    $('#sidebar-progress').innerHTML = `<div class="sidebar-progress-heading"><span>当前目标</span><strong>${stats.percent}%</strong></div>${bar(stats.percent)}<p class="sidebar-note">${esc(stats.goal.title)}<br>${stats.completedLessons}/${stats.requiredLessons.length} 课 · ${Math.min(stats.completedTasks,stats.requiredTasks)}/${stats.requiredTasks} 个独立成果</p>`;
  }
  function taskCard(task) {
    const record = state.tasks[task.id];
    const done = getStats().completedTaskIds.includes(task.id);
    return `<article class="task-card surface-card"><div class="task-icon">${icon(task.id)}</div><div class="task-meta"><span class="badge ${done?'green':'neutral'}">${done?'已独立完成':esc(task.category)}</span><span>${task.minutes} 分钟</span></div><h3 class="task-title">${esc(task.title)}</h3><p class="task-description">${esc(task.summary)}</p><div class="task-footer"><span>${record.output&&!done?'有未完成的练习':esc(task.level)}</span><a class="button small secondary" href="#/task/${task.id}">${done?'查看成果':record.input?'继续练习':'开始任务'} ${icon('arrow')}</a></div></article>`;
  }
  function heroArt() {
    return `<svg viewBox="0 0 240 260" fill="none" role="img" aria-label="从目标出发，沿着路线逐步完成任务"><circle cx="132" cy="128" r="88" fill="#e2ebd4"/><circle cx="132" cy="128" r="67" stroke="#c8d7b7" stroke-dasharray="3 7"/><path d="M63 183c0-52 111 10 111-54S72 125 72 72" stroke="#92ad78" stroke-width="2" stroke-dasharray="5 6"/><rect x="36" y="42" width="100" height="59" rx="12" fill="#fffdf6" transform="rotate(-7 36 42)"/><rect x="52" y="57" width="30" height="5" rx="2.5" fill="#9caf86"/><rect x="52" y="71" width="60" height="4" rx="2" fill="#d9e2d0"/><rect x="52" y="82" width="46" height="4" rx="2" fill="#d9e2d0"/><rect x="113" y="112" width="95" height="63" rx="12" fill="#fffdf6" transform="rotate(8 113 112)"/><circle cx="138" cy="138" r="11" fill="#e4eed9"/><path d="m133 138 4 4 7-8" stroke="#557c41" stroke-width="2" stroke-linecap="round"/><path d="M158 135h29m-29 10h22" stroke="#d9e2d0" stroke-width="4" stroke-linecap="round"/><circle cx="66" cy="192" r="24" fill="#e7ba8f"/><path d="m55 192 7 7 15-16" stroke="#fffdf6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="190" cy="56" r="5" fill="#d7ac76"/><path d="M201 201v12m-6-6h12" stroke="#adbd92" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  function renderOverview() {
    const s = getStats();
    const next = s.nextLesson;
    const hasStarted = s.allCompletedLessons > 0 || s.completedTasks > 0;
    main.innerHTML = `<div class="welcome-row"><div><p class="eyebrow">A LITTLE EVERY DAY</p><h1>${hasStarted?'欢迎回来，继续向前一点。':'从第一次上手，到独立做好。'}</h1><p>把学习放进真实任务，让每一步都有收获。</p></div><span class="date-label">${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Shanghai'}).format(new Date())}</span></div>
    <section class="hero-grid" aria-label="当前目标与下一步"><div class="hero-card"><div class="hero-copy"><p class="hero-label">${icon('star')} YOUR NEXT STEP</p><h2 class="hero-title">${s.percent===100?'你已经达成学习目标。':next?`${esc(next.title)}`:'把学到的方法，用在自己的工作里。'}</h2><p class="hero-text">${next?esc(next.summary):'选一个真实任务，准备自己的资料，独立完成并验收成果。'}</p><a class="button primary" href="${next?'#/lesson/'+next.id:'#/tasks'}">${hasStarted?'继续我的学习':'开始第一课'} ${icon('arrow')}</a><div class="hero-progress">${bar(s.percent)}<p>当前目标已完成 ${s.percent}% · 按自己的节奏学习</p></div></div><div class="hero-art">${heroArt()}</div></div>
    <div class="goal-card"><div><p class="eyebrow">我的学习目标</p><h3>${esc(s.goal.title)}</h3><p class="muted">建议 ${s.goal.weeks} 周 · 每周 ${state.profile.weeklyMinutes} 分钟</p></div><div class="goal-metrics"><div><div class="metric-value">${s.completedLessons}<small>/ ${s.requiredLessons.length}</small></div><p class="metric-label">目标课程</p></div><div><div class="metric-value">${Math.min(s.completedTasks,s.requiredTasks)}<small>/ ${s.requiredTasks}</small></div><p class="metric-label">独立成果</p></div></div><button class="button ghost small" data-action="goal">调整学习目标 ${icon('chevron')}</button></div></section>
    <section class="stats-grid" aria-label="学习记录">${[['book',s.allCompletedLessons,'节课程已掌握'],['folder',s.completedTasks,'个独立成果'],['clock',s.learningDays,'天留下学习记录'],['knowledge',s.drafts,'份练习草稿']].map(([ic,n,label])=>`<div class="stat-card"><div class="stat-icon">${icon(ic)}</div><strong class="stat-value">${n}</strong><span class="stat-label">${label}</span></div>`).join('')}</section>
    <div class="content-grid"><section><div class="section-heading"><div><h2>你的成长路线</h2><p>先学会使用，再按需深入。</p></div><a class="button ghost small" href="#/route">完整路线 ${icon('arrow')}</a></div><div class="route-preview surface-card">${C.modules.filter(m=>!m.optional).map(m=>{const done=m.lessonIds.filter(id=>state.lessons[id]?.passed).length;const current=next?.moduleId===m.id;return `<a class="week-row ${done===m.lessonIds.length?'done':current?'current':''}" href="#/lesson/${m.lessonIds.find(id=>!state.lessons[id]?.passed)||m.lessonIds[0]}"><span class="week-index">${done===m.lessonIds.length?icon('check'):m.week}</span><span class="week-info"><strong>${esc(m.title)}</strong><small>第 ${m.week} 周 · ${esc(m.subtitle)}</small></span><span class="week-state">${done}/${m.lessonIds.length} ${icon('chevron')}</span></a>`;}).join('')}</div><div class="learning-tip">${icon('info')}<p>先跟着示例做成一次，再换自己的资料。看过示例和独立完成，会分别记录。</p></div></section>
    <section><div class="section-heading"><div><h2>从一个小任务开始</h2><p>带着成果离开，带着方法回来。</p></div><a class="button ghost small" href="#/tasks">全部任务 ${icon('arrow')}</a></div><div class="task-grid dashboard-tasks">${C.tasks.slice(0,2).map(taskCard).join('')}</div></section></div>
    <section class="skill-section"><div class="section-heading"><div><h2>正在积累的能力</h2><p>由通过测验的课程计算，逐步建立自己的工作方法。</p></div></div><div class="skill-grid">${s.skills.map(skill=>`<div class="skill-item"><div><span>${esc(skill.name)}</span><small>${skill.done}/${skill.total}</small></div>${bar(Math.round(skill.done/skill.total*100))}</div>`).join('')}</div></section>`;
  }
  function renderRoute() {
    const s=getStats();
    main.innerHTML=pageHeading('YOUR LEARNING PATH','每一步，都离独立完成更近。',`${s.goal.weeks} 周建议路线。课程随时可学，进度按验收结果记录。`,`<button class="button secondary" data-action="goal">${icon('target')} 调整目标</button>`)+`<div class="route-summary surface-card"><div><h3>${esc(s.goal.title)}</h3><p class="muted">${s.completedLessons}/${s.requiredLessons.length} 节目标课程 · ${Math.min(s.completedTasks,s.requiredTasks)}/${s.requiredTasks} 个独立成果</p></div><div><strong>${s.percent}%</strong>${bar(s.percent)}</div></div>`+C.modules.map(m=>{
      const done=m.lessonIds.filter(id=>state.lessons[id]?.passed).length;
      return `<section class="module-card surface-card"><header class="module-header"><span class="module-number">${String(m.week).padStart(2,'0')}</span><div class="module-copy"><h2>${esc(m.title)} ${m.optional?'<span class="badge orange">选修</span>':''}</h2><p>${esc(m.subtitle)}</p></div><div class="module-progress"><span>${done}/${m.lessonIds.length} 完成</span>${bar(Math.round(done/m.lessonIds.length*100))}</div></header><div class="lesson-list">${m.lessonIds.map(id=>{const l=lessonById(id),passed=state.lessons[id]?.passed;return `<a class="lesson-row" href="#/lesson/${id}"><span class="lesson-symbol ${passed?'done':''}">${icon(passed?'check':'book')}</span><span class="lesson-details"><strong>${esc(l.title)}</strong><p>${esc(l.summary)}</p></span><span class="lesson-meta"><span>${l.minutes} 分钟</span><span>${passed?'已掌握':'开始学习'}</span>${icon('chevron')}</span></a>`;}).join('')}</div></section>`;
    }).join('');
  }
  function renderLesson(id) {
    const l=lessonById(id);if(!l)return renderNotFound();
    const m=C.modules.find(x=>x.id===l.moduleId),passed=state.lessons[id]?.passed;
    const selected=ui.choices[id] ?? state.lessons[id]?.answerIndex;
    const feedback=ui.feedback[id];
    const related=C.tasks.filter(t=>t.lessonIds.includes(id));
    const next=C.lessons[C.lessons.indexOf(l)+1];
    main.innerHTML=pageHeading(`第 ${m.week} 周 · ${esc(m.title)}`,esc(l.title),`${l.minutes} 分钟 · ${esc(l.skill || m.subtitle)}`,`<a class="button ghost" href="#/route">返回学习路线</a>`)+`<div class="lesson-layout"><article class="lesson-main"><section class="lesson-section surface-card"><p class="lesson-intro">${esc(l.summary)}</p>${l.blocks.map((block,i)=>`<section class="lesson-block"><span class="block-index">${String(i+1).padStart(2,'0')}</span><div><h2>${esc(block.title)}</h2><p>${esc(block.text).replace(/\n/g,'<br>')}</p></div></section>`).join('')}</section><section class="quiz-card surface-card" aria-label="本课小测"><div class="section-heading"><div><p class="eyebrow">CHECK YOUR UNDERSTANDING</p><h2>做一次判断，确认你学会了。</h2></div>${passed?'<span class="badge green">已通过</span>':''}</div><h3>${esc(l.quiz.question)}</h3><div class="quiz-options" role="radiogroup" aria-label="选择答案">${l.quiz.options.map((option,i)=>`<button type="button" role="radio" aria-checked="${selected===i}" class="quiz-option ${selected===i?'selected':''} ${feedback&&selected===i?(i===l.quiz.answerIndex?'correct':'incorrect'):''}" data-action="quiz-choice" data-id="${id}" data-index="${i}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span></button>`).join('')}</div>${feedback?`<div class="quiz-feedback ${feedback.correct?'success':'error'}" role="status"><strong>${feedback.correct?'理解正确，已经记入学习进度。':'再想一想，你可以重新选择。'}</strong><p>${esc(l.quiz.explanation)}</p></div>`:''}<div class="lesson-navigation"><button class="button primary" data-action="quiz-submit" data-id="${id}" ${selected===undefined?'disabled':''}>${passed?'再次检查理解':'提交答案并完成本课'} ${icon('check')}</button>${passed&&next?`<a class="button secondary" href="#/lesson/${next.id}">下一课 ${icon('arrow')}</a>`:''}</div></section></article><aside class="lesson-aside"><div class="sticky-summary surface-card"><p class="eyebrow">本周学习</p><h3>${esc(m.title)}</h3><div class="aside-lessons">${m.lessonIds.map(lid=>`<a class="aside-lesson ${lid===id?'active':''}" href="#/lesson/${lid}">${icon(state.lessons[lid]?.passed?'check':'book')}<span>${esc(lessonById(lid).title)}</span></a>`).join('')}</div></div><div class="sticky-summary surface-card"><p class="eyebrow">把方法用起来</p><h3>相关任务</h3>${related.slice(0,2).map(t=>`<a class="related-task" href="#/task/${t.id}">${icon(t.id)}<span>${esc(t.title)}</span>${icon('chevron')}</a>`).join('')||'<p class="muted">到任务实验室，选择一件正在做的工作。</p>'}</div></aside></div>`;
  }
  function renderTaskCards() {
    const filtered=C.tasks.filter(t=>(ui.filter==='全部'||t.category===ui.filter)&&(`${t.title} ${t.summary} ${t.skills.join(' ')}`.includes(ui.search)));
    $('#task-list').innerHTML=filtered.length?filtered.map(taskCard).join(''):'<div class="empty-state"><h3>暂时没有匹配的任务</h3><p>试试更短的关键词，或切换到全部任务。</p></div>';
  }
  function renderTasks() {
    main.innerHTML=pageHeading('LEARN BY DOING','今天，想让 AI 帮你做好什么？','每个任务都准备了示例、任务说明和验收表。从一次小成功开始。')+`<div class="lab-toolbar"><div class="filter-row" aria-label="任务分类">${['全部',...new Set(C.tasks.map(t=>t.category))].map(category=>`<button class="filter-button ${ui.filter===category?'active':''}" data-action="filter" data-value="${esc(category)}" aria-pressed="${ui.filter===category}">${esc(category)}</button>`).join('')}</div><label class="search-input">${icon('research')}<input type="search" id="task-search" placeholder="搜索任务或能力" aria-label="搜索任务或能力" value="${esc(ui.search)}"></label></div><div class="task-grid" id="task-list"></div><div class="learning-tip">${icon('info')}<p>示例演示不会调用模型。独立练习时，把任务说明带到你常用的 Agent，再将结果带回来验收。</p></div>`;
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
    if(step===3)body=`<h2>${demo?'把一次体验，变成可复用的方法':'留下这次的收获'}</h2>${demo?'<p>现在可以换一份自己的资料，试着独立完成。方法仍然是：说明目标、提供资料、检查结果、记录改进。</p>':`<div class="form-group"><label class="input-label" for="practice-notes">哪里需要人工修改？下次怎样做得更好？</label><textarea class="form-textarea" id="practice-notes" data-task-field="notes" data-id="${id}" maxlength="20000" placeholder="例如：补充了输出格式后，第二次结果更完整；仍需要核对截止时间…">${esc(r.notes)}</textarea></div>`}<div class="callout"><strong>下一次，多走一步</strong><div class="challenge-options">${t.challenges.map((c,i)=>`<button class="button small ${ui.challenges[id]===i?'primary':'secondary'}" data-action="challenge" data-id="${id}" data-index="${i}">${esc(c.title)}</button>`).join('')}</div><p id="challenge-description">${esc(t.challenges[ui.challenges[id]??0]?.description || '')}</p></div><div class="task-actions">${demo?`<button class="button primary" data-action="task-mode" data-id="${id}" data-mode="practice">用自己的资料，独立做一次 ${icon('arrow')}</button>`:`<button class="button primary" data-action="task-complete" data-id="${id}">${icon('check')} ${completed?'更新验收记录':'确认验收，记录独立成果'}</button><button class="button secondary" data-action="save-draft" data-id="${id}">保存草稿</button>`}</div>`;
    main.innerHTML=pageHeading(`${esc(t.category)} · ${t.minutes} 分钟`,esc(t.title),esc(t.summary),`<a class="button ghost" href="#/tasks">返回任务实验室</a>`)+`${completed?'<div class="completion-banner">'+icon('check')+'<div><h3>这项任务已独立验收</h3><p>你可以重新查看、改进成果，或尝试更有挑战的资料。</p></div></div>':''}<div class="task-detail-grid"><article class="task-workspace"><div class="practice-tabs" role="group" aria-label="练习方式"><button class="tab-button ${demo?'active':''}" aria-pressed="${demo}" data-action="task-mode" data-id="${id}" data-mode="example">示例跟做</button><button class="tab-button ${!demo?'active':''}" aria-pressed="${!demo}" data-action="task-mode" data-id="${id}" data-mode="practice">独立练习</button></div><div class="stepper" aria-label="任务步骤">${t.checkpoints.map((cp,i)=>`<button class="step-item ${step===i?'active':step>i?'done':''}" data-action="task-step" data-id="${id}" data-step="${i}" aria-current="${step===i?'step':'false'}"><span>${i+1}</span>${esc(cp.title)}</button>`).join('')}</div><section class="workspace-section surface-card"><div class="step-intro"><span class="badge ${demo?'neutral':'green'}">${demo?'示例体验':'我的练习'} · ${step+1}/4</span><p class="muted">${esc(checkpoint.description)}</p></div>${body}</section><p class="save-indicator" id="task-save-indicator">${demo?'示例体验不增加独立成果数':r.savedAt?'草稿已保存在本机 · '+K.formatDate(r.savedAt):'输入后会自动保存在本机'}</p></article><aside class="task-sidebar"><div class="surface-card sticky-summary"><p class="eyebrow">这一步的小提示</p><h3>${esc(checkpoint.title)}</h3><p>${esc(checkpoint.tip)}</p></div><div class="surface-card sticky-summary"><p class="eyebrow">相关知识</p>${t.lessonIds.map(lid=>`<a class="related-task" href="#/lesson/${lid}">${icon(state.lessons[lid]?.passed?'check':'book')}<span>${esc(lessonById(lid).title)}</span></a>`).join('')}</div><div class="surface-card sticky-summary"><p class="eyebrow">卡住了？</p>${t.pitfalls.map(p=>`<details class="task-faq"><summary>${esc(p.problem)}</summary><p>${esc(p.solution)}</p></details>`).join('')}</div></aside></div>`;
  }
  function renderArtifacts() {
    const s=getStats();
    const list=C.tasks.filter(t=>{const r=state.tasks[t.id];return r.input||r.output||r.notes;});
    main.innerHTML=pageHeading('YOUR WORK, YOUR PROGRESS','学到的方法，做成的成果。',`${s.completedTasks} 个独立成果 · ${s.drafts} 份进行中的练习。保留每次尝试，也看见每次进步。`,`<button class="button secondary" data-action="export">${icon('download')} 备份全部记录</button>`)+
    (list.length?`<div class="artifact-grid">${list.map(t=>{const r=state.tasks[t.id],done=s.completedTaskIds.includes(t.id);return `<article class="artifact-card surface-card"><div class="section-heading"><div class="task-icon">${icon(t.id)}</div><span class="badge ${done?'green':'orange'}">${done?'已独立验收':'练习草稿'}</span></div><h2>${esc(t.title)}</h2><p class="artifact-meta">${r.savedAt?K.formatDate(r.savedAt)+' 更新':'尚未保存'} · ${r.checks?Object.values(r.checks).filter(Boolean).length:0}/${t.criteria.length} 项验收</p><pre class="artifact-preview">${esc(r.output||r.input||r.notes)}</pre>${r.notes?`<p class="artifact-note">我的复盘：${esc(r.notes.slice(0,90))}${r.notes.length>90?'…':''}</p>`:''}<div class="task-actions"><a class="button secondary small" href="#/task/${t.id}">${done?'查看与改进':'继续练习'} ${icon('arrow')}</a><button class="button ghost small" data-action="download-artifact" data-id="${t.id}">${icon('download')} 导出作品</button></div></article>`;}).join('')}</div>`:`<div class="empty-state surface-card">${icon('folder')}<h2>你的第一份成果，从这里开始。</h2><p>选一个任务，换上自己的资料。草稿与通过验收的成果都会保存在这里。</p><a class="button primary" href="#/tasks">去任务实验室 ${icon('arrow')}</a></div>`);
  }
  function renderSettings() {
    const s=getStats();
    main.innerHTML=pageHeading('MAKE IT YOURS','按自己的节奏，学会新方法。','设置目标、安排投入，也照顾好自己的学习记录。')+`<div class="settings-grid"><section class="settings-section surface-card"><div class="section-heading"><h2>我的学习计划</h2>${icon('target')}</div><div class="settings-list"><div class="settings-row"><span class="muted">当前目标</span><strong>${esc(s.goal.title)}</strong></div><div class="settings-row"><span class="muted">岗位方向</span><strong>${esc(state.profile.role)}</strong></div><div class="settings-row"><span class="muted">每周投入</span><strong>${state.profile.weeklyMinutes} 分钟</strong></div><div class="settings-row"><span class="muted">目标要求</span><strong>${s.requiredLessons.length} 节课 + ${s.requiredTasks} 个成果</strong></div><div class="settings-row"><span class="muted">开始日期</span><strong>${K.formatDate(state.profile.startedAt)}</strong></div></div><button class="button secondary" data-action="goal">调整目标与节奏</button><p class="field-hint">调整目标会保留已经完成的课程和成果。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>数据与备份</h2>${icon('folder')}</div><div class="callout"><strong>${storageAvailable?'记录保存在当前浏览器':'当前浏览器无法持久保存'}</strong><p>本工具无需登录。学习进度、练习资料和成果在本机处理，换设备或清理浏览器前，请先导出备份。</p></div><div class="backup-actions"><button class="button primary" data-action="export">${icon('download')} 导出完整备份</button><button class="button secondary" data-action="import">${icon('upload')} 从备份恢复</button></div><p class="field-hint">备份包含你的练习文本，请保存到自己信任的位置。恢复前会先展示记录摘要。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>这个学习空间如何工作</h2>${icon('info')}</div><div class="settings-list"><div class="settings-row"><span>课程与示例</span><strong>15 节短课 · 6 个任务包</strong></div><div class="settings-row"><span>示例结果</span><strong>预置教学材料</strong></div><div class="settings-row"><span>独立练习</span><strong>在常用 Agent 中执行，带回结果验收</strong></div><div class="settings-row"><span>进度规则</span><strong>测验通过 + 独立任务验收</strong></div></div><p class="field-hint">这里不会自动调用模型，也不需要填写 API 密钥。发布到静态站点后即可使用。</p></section><section class="settings-section surface-card"><div class="section-heading"><h2>重新开始</h2></div><p class="muted">需要为新一轮学习腾出空间时，可以清空本机记录。建议先导出一份备份。</p><button class="button danger" data-action="reset-dialog">清空本机学习记录</button></section></div>`;
  }
  function renderNotFound() {main.innerHTML=`<div class="empty-state"><h1>这个页面暂时没有找到</h1><p>可以回到学习总览，接着完成下一步。</p><a class="button primary" href="#/overview">返回总览</a></div>`;}
  function render() {
    if(saveTimer){clearTimeout(saveTimer);saveTimer=null;persist({quiet:true});}
    if(dialog.open)dialog.close();
    const [,page='overview',id]=location.hash.split('/');
    const routes={overview:renderOverview,route:renderRoute,tasks:renderTasks,artifacts:renderArtifacts,settings:renderSettings};
    if(page==='lesson')renderLesson(id);else if(page==='task')renderTask(id);else (routes[page]||renderNotFound)();
    updateShell();window.scrollTo({top:0,behavior:'instant'});
    document.title=`${({overview:'学习总览',route:'学习路线',tasks:'任务实验室',artifacts:'我的成果',settings:'学习设置',lesson:lessonById(id)?.title,task:taskById(id)?.title})[page] || '启程'} · 启程`;
  }
  function openDialog(title,body,footer='') {
    if(dialog.open)dialog.close();
    dialog.innerHTML=`<div class="dialog-card"><div class="dialog-header"><h2>${title}</h2><button class="icon-btn" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}</div>`;
    dialog.showModal();
  }
  function goalDialog() {
    openDialog('你想通过学习，做到什么？',`<form id="goal-form"><div class="form-group"><label class="input-label" for="goal-id">选择一个学习目标</label><select class="form-select" id="goal-id" name="goalId">${C.goals.map(g=>`<option value="${g.id}" ${state.profile.goalId===g.id?'selected':''}>${esc(g.title)} · ${g.weeks} 周 / ${g.targetLessons} 课 / ${g.targetTasks} 个成果</option>`).join('')}</select><p class="field-hint" id="goal-description">${esc(getStats().goal.description)}</p></div><div class="form-row"><div class="form-group"><label class="input-label" for="goal-role">我的工作方向</label><select class="form-select" id="goal-role" name="role">${['通用办公','行政与人事','运营与市场','销售与客服','项目与管理','学习与研究'].map(role=>`<option ${state.profile.role===role?'selected':''}>${role}</option>`).join('')}</select></div><div class="form-group"><label class="input-label" for="goal-minutes">每周可以投入</label><select class="form-select" id="goal-minutes" name="weeklyMinutes">${[60,120,180,240].map(n=>`<option value="${n}" ${state.profile.weeklyMinutes===n?'selected':''}>${n} 分钟 / 周</option>`).join('')}</select></div></div><div class="callout"><strong>完成标准</strong><p>目标课程通过测验，并用自己的资料完成指定数量的任务。示例跟做单独记录。</p></div></form>`,`<button class="button secondary" data-action="close-dialog">稍后再说</button><button class="button primary" type="submit" form="goal-form">保存我的目标 ${icon('arrow')}</button>`);
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
    download(`启程-学习备份-${K.today()}.json`,JSON.stringify({app:'qicheng-agent-academy',version:1,exportedAt:new Date().toISOString(),state},null,2));
    toast('备份已导出，包含目标、进度、草稿和成果。');
  }
  function downloadArtifact(id) {
    const t=taskById(id),r=state.tasks[id];
    download(`启程-${t.title}-${K.today()}.md`,`# ${t.title}\n\n## 我的资料\n${r.input || '未填写'}\n\n## 实际成果\n${r.output || '未填写'}\n\n## 验收记录\n${t.criteria.map(c=>`- [${r.checks[c.id]?'x':' '}] ${c.label}`).join('\n')}\n\n## 我的复盘\n${r.notes || '未填写'}\n`,'text/markdown');
  }
  async function readBackup(file) {
    if(!file)return;
    try {
      if(file.size>8*1024*1024)throw new Error('备份文件超过 8 MB，无法导入。');
      const raw=JSON.parse(await file.text());
      if(raw.app!=='qicheng-agent-academy'||raw.version!==1||!raw.state)throw new Error('这不是兼容的启程学习备份。');
      pendingBackup=K.normalizeState(raw.state,C,{strict:true});
      const s=K.getStats(pendingBackup,C);
      openDialog('恢复这份学习记录？',`<p>备份包含以下内容：</p><div class="settings-list"><div class="settings-row"><span>学习目标</span><strong>${esc(s.goal.title)}</strong></div><div class="settings-row"><span>已掌握课程</span><strong>${s.allCompletedLessons} 节</strong></div><div class="settings-row"><span>独立成果 / 草稿</span><strong>${s.completedTasks} / ${s.drafts}</strong></div></div><p class="field-hint">恢复会替换当前浏览器的学习记录。可以先关闭此窗口，导出当前备份。</p>`,`<button class="button secondary" data-action="close-dialog">取消</button><button class="button primary" data-action="restore-backup">确认恢复</button>`);
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
    persist();renderTask(id);toast('独立成果已记录，总览与目标进度已更新。');
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
      for(const task of C.tasks){if((state.tasks[task.id].savedAt||'')>(incoming.tasks[task.id].savedAt||''))incoming.tasks[task.id]=state.tasks[task.id];}
      for(const lesson of C.lessons){if((state.lessons[lesson.id]?.answeredAt||'')>(incoming.lessons[lesson.id]?.answeredAt||''))incoming.lessons[lesson.id]=state.lessons[lesson.id];}
      const events=new Map([...state.activities,...incoming.activities].map(item=>[item.at+'|'+item.type+'|'+item.id,item]));
      incoming.activities=[...events.values()].sort((a,b)=>a.at.localeCompare(b.at)).slice(-3000);
      if(state.updatedAt>incoming.updatedAt)incoming.profile=state.profile;
      state=incoming;Object.assign(ui,{choices:{},feedback:{}});
      if(document.activeElement?.matches('[data-task-field]')){updateShell();toast('另一标签页已更新，当前正在编辑的草稿已保留。');}
      else{ui.taskModes={};ui.steps={};render();toast('已同步另一个标签页中的学习记录。');}
    }catch(error){toast('另一个标签页的记录未能读取，当前内容已保留。');}
  });
  if(!location.hash||location.hash==='#')history.replaceState(null,'','#/overview');
  render();
  try{localStorage.setItem('qicheng.storage-check','1');localStorage.removeItem('qicheng.storage-check');}catch(error){storageAvailable=false;$('#save-status').textContent='本地保存不可用';$('#storage-label').textContent='请导出备份保存进度';}
  if(loadWarning)toast(loadWarning);
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
