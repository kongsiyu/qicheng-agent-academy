/* Project learning: worked examples, decisions, saved evidence and transfer. */
window.createProjectUI = function (ctx) {
  'use strict';
  const { C, K, esc, icon, main, getState, save: saveState, toast, download, copyText } = ctx;
  const Q = window.AgentQualityCore;
  const view = { stage: getState().learning.draft.input ? 'run' : 'demo', errors: [], tab: 'path', taskId: null };
  const learning = () => getState().learning;
  let observedDraft=learning().draft;
  let lastValidLearning = JSON.stringify(learning());
  function checkpoint() {
    lastValidLearning = JSON.stringify(learning());
    if(observedDraft!==learning().draft){observedDraft=learning().draft;view.stage='run';view.taskId=null;}
  }
  function save() {
    try { Q.normalizeLearning(learning(),C,{strict:true}); }
    catch (error) {
      getState().learning = JSON.parse(lastValidLearning);
      render(view.tab);
      toast(`本次改动未保存：${error.message} 原记录已保留，请先导出备份。`);
      return false;
    }
    checkpoint();
    const ok = saveState();
    const indicator = document.querySelector('#project-save-status');
    if (ok === false && indicator) indicator.textContent = '浏览器未能保存，请立即导出评审包或完整备份。';
    return ok;
  }
  const quality = () => Q.getQualityStats(getState(), C);
  const B = window.createBeginnerPractice({...ctx,save});
  const task = id => C.tasks.find(t => t.id === id);
  const kinds = {
    practice: '跟着做一次',
    baseline: '人工流程耗时基线', pretest:'学前 Agent 尝试', normal: '正常资料', missing: '资料不足', conflict: '资料冲突或重复',
    independent: '结课独立任务', transfer: '第二任务迁移', delayed: '一周后复验',
    assistant: '定制助手实测', 'automation-normal': '自动化：正常输入',
    'automation-missing': '自动化：缺字段', 'automation-duplicate': '自动化：重复输入'
  };
  const R = window.createProjectRunner({C,K,esc,icon,Q,kinds,getLearning:learning,save,toast,copyText,timingFields,redraw:()=>render('train'),backToDemo:()=>{view.stage='demo';render('train');}});
  const list = values => `<ul class="project-list">${values.map(v => `<li>${esc(v)}</li>`).join('')}</ul>`;
  const button = (action, label, extra = '', secondary = false) => `<button type="button" class="button ${secondary ? 'secondary' : 'primary'}" data-project-action="${action}" ${extra}>${label}</button>`;
  const field = (label, key, value, hint = '', options = {}) => `<div class="form-group"><label class="input-label" for="project-${key}">${esc(label)}</label><textarea id="project-${key}" class="form-textarea ${options.tall ? 'tall' : ''}" data-project-field="${key}" data-project-scope="${options.scope || 'draft'}" maxlength="${options.max || 20000}" placeholder="${esc(hint)}">${esc(value)}</textarea>${hint ? `<p class="field-hint">${esc(hint)}</p>` : ''}</div>`;
  function note(text) { return `<div class="learning-tip">${icon('info')}<p>${esc(text)}</p></div>`; }
  function invalidateDraft() {
    const hadChecks = Object.values(learning().draft.checks).some(Boolean);
    Object.keys(learning().draft.checks).forEach(key=>learning().draft.checks[key]=false);
    main.querySelectorAll('[data-project-check]').forEach(el=>el.checked=false);
    const indicator = main.querySelector('#project-save-status');
    if (hadChecks && indicator) indicator.textContent = '内容已变更，原验收勾选已清除，请重新核查后存档。';
  }
  function statusLabel(level) { return ['尚无证据', '有引导练习', '有独立自评证据'][level] || '尚无证据'; }
  function comparisonNotice() {
    const l = learning(), runs = l.runs.filter(r=>!l.withdrawnRunIds.includes(r.id) && r.taskId===l.mainTaskId);
    const before = runs.find(r=>r.kind==='pretest'), after = runs.find(r=>r.kind==='independent' && r.support==='independent');
    if (!before) return '尚未记录学前 Agent 尝试，暂时无法比较课程前后的能力变化。若已经学习，请如实注明缺少前测，不要事后补写为学前表现。';
    if (!after) return '学前尝试已保留。结课时用难度相近的新材料独立完成，再对照关键判断与求助情况；人工省时另用原流程基线比较。';
    return '已保留学前与结课独立尝试。请导出评审包，由评审核对前后顺序、材料难度与八项能力表现，判断进步是否成立。';
  }
  function dashboard() {
    return `<section class="project-overview surface-card"><div><h2>先做成一次，再慢慢学深</h2><p>资料和任务说明已经备好。跟着三步走，把第一份结果做出来。</p></div><a class="button primary" href="#/project/start">开始练习 ${icon('arrow')}</a></section>`;
  }
  function skillCards() {
    return `<section class="skill-section"><div class="section-heading"><div><h2>八项能力的练习证据</h2><p>根据已存档练习与自评显示；可导出供教师或同事抽评。</p></div></div><div class="skill-grid">${quality().skills.map(s => `<div class="skill-item"><div><span>${esc(s.name)}</span><small>${s.evidenceCount} 份证据</small></div><p class="evidence-level level-${s.level}">${statusLabel(s.level)}</p></div>`).join('')}</div></section>`;
  }
  function weekCard(id) {
    const week = C.weeks.find(w => w.id === id), status = quality().weeks.find(w => w.id === id);
    if (!week || !status) return '';
    const start = {w1:['normal','开始正常资料练习'],w2:['missing','处理一份资料不足的输入'],w4:['independent','开始结课独立任务'],w5:['assistant','记录助手实际测试'],w6:['automation-normal','记录自动化正常输入']}[id];
    const action = id === 'w3' ? '<a class="button small secondary" href="#/project/pack">制作我的岗位任务包</a>' : button('start-kind',start[1],`data-kind="${start[0]}"`,true);
    return `<div class="week-project"><div class="section-heading"><h3>${week.optional ? '选修项目' : '本周项目'} · ${esc(week.title)}</h3><span class="badge ${status.done ? 'green' : 'neutral'}">${status.done ? '证据齐备 · 待抽评' : '继续练习'}</span></div><p>${esc(week.goal)}</p>${list(week.deliverables)}${status.missing.length ? `<details class="task-faq"><summary>还需要哪些证据？</summary>${list(status.missing)}</details>` : ''}<p class="field-hint">建议投入：学习 ${week.minutes.learn} 分钟＋实践 ${week.minutes.practice} 分钟＋核查 ${week.minutes.verify} 分钟。</p>${action}</div>`;
  }
  function pathView() {
    const s=quality(), goal=C.goals.find(g=>g.id===getState().profile.goalId);
    const next=s.weeks.slice(0,goal.weeks).find(w=>!w.done)||s.weeks[goal.weeks-1];
    return `<section class="surface-card project-section"><p class="eyebrow">一次只做当前这一项</p><h2>接下来，从这里继续</h2>${weekCard(next.id)}</section><details class="project-details"><summary>查看完整四周计划与选修</summary><div class="project-weeks">${C.weeks.map(w=>`<section class="surface-card">${weekCard(w.id)}<details class="project-week-steps"><summary>怎么做</summary>${list(w.steps)}</details></section>`).join('')}</div></details><details class="project-details"><summary>更换主线任务</summary><label class="input-label" for="project-main-task">主线任务</label><select class="form-select" id="project-main-task" data-project-main>${C.tasks.map(t=>`<option value="${t.id}" ${learning().mainTaskId===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select><p class="field-hint">原有任务包与记录都会保留；换任务后应重新确认用途和资料。</p></details><details class="project-details"><summary>课程前后对照与延后复验</summary><p>${esc(comparisonNotice())}</p><div class="task-actions">${button('pretest','做一次学前尝试','',true)}${button('baseline','记录人工流程基线','',true)}${button('start-kind','准备延后复验','data-kind="delayed"',true)}</div><p>${esc(s.delayed.dueDate?'延后复验建议从 '+s.delayed.dueDate+' 起完成。':'先完成独立交付，再安排一周后的复验。')}</p></details>`;
  }
  function stageTabs() {
    return `<div class="project-stages" role="group" aria-label="练习阶段">${[['demo','1 看示范'],['diagnose','2 做判断'],['scaffold','3 减少提示'],['run','4 独立与复验']].map(([id,label]) => button('stage', label, `data-stage="${id}" aria-pressed="${view.stage === id}"`, view.stage !== id)).join('')}</div>`;
  }
  function demoView(t, p) {
    return `<h2>看清每一步为什么这样做</h2><p>先读材料，再对照任务说明和成果。观察如何处理未知、来源和边界。</p><h3>示例资料</h3><pre class="output-preview">${esc(t.sampleInput)}</pre><details class="task-faq"><summary>查看示范任务说明</summary><pre class="output-preview">${esc(t.prompt)}</pre></details><h3>示例成果</h3><pre class="output-preview">${esc(t.sampleOutput)}</pre><div class="worked-reasons">${p.walkthrough.map((w,i) => `<section><span class="block-index">${i+1}</span><div><h3>${esc(w.title)}</h3><p>${esc(w.reason)}</p></div></section>`).join('')}</div>${button('stage','换你做一次判断','data-stage="diagnose"')}`;
  }
  function diagnoseView(t, p) {
    const r = learning().diagnostics[t.id] || { answers: {}, submitted: false };
    return `<h2>这份成果，哪些能用，哪些需要处理？</h2><p>${esc(p.diagnose.intro)}</p><pre class="output-preview">${esc(p.diagnose.input)}</pre>${p.diagnose.items.map((item,i) => `<fieldset class="diagnose-item"><legend>${i+1}. ${esc(item.text)}</legend><div class="diagnose-options">${[['accept','可以保留'],['fix','需要修正'],['ask','资料不足，先确认']].map(([value,label]) => `<label><input type="radio" name="diagnose-${esc(item.id)}" value="${value}" data-project-diagnose="${esc(item.id)}" data-task="${t.id}" ${r.answers[item.id] === value ? 'checked' : ''}>${label}</label>`).join('')}</div>${r.submitted ? `<div class="quiz-feedback ${r.answers[item.id] === item.answer ? 'success' : 'error'}"><strong>${r.answers[item.id] === item.answer ? '判断符合依据' : '再核对这条判断'}</strong><p>${esc(item.feedback)}</p></div>` : ''}</fieldset>`).join('')}<div class="task-actions">${button('diagnose','查看针对性反馈',`data-task="${t.id}"`)}${button('stage','接着练习写任务说明','data-stage="scaffold"',true)}</div><p class="field-hint">判断题用于练习；做对后还需要在新材料中独立核查。</p>`;
  }
  function scaffoldView(t, p) {
    return `<h2>保留结构，由你补齐关键决定</h2><pre class="output-preview">${esc(p.scaffold.input)}</pre><h3>这次只给一个起点</h3><pre class="output-preview">${esc(p.scaffold.instructionStarter)}</pre>${list(p.scaffold.questions)}${button('scaffold','带着这个框架开始练习',`data-task="${t.id}"`)}${note('提示会逐步减少。结课独立任务只提供新材料和交付要求，需要自己写任务说明和验收方式。')}`;
  }
  function caseFor(d) {
    if (d.kind === 'assistant') return C.electives.assistant;
    if (d.kind.startsWith('automation-')) return C.electives.automation;
    return C.practice[d.taskId].cases[d.kind];
  }
  function timingFields(d) {
    const labels = { manual:'相似人工任务总投入', prepare:'准备资料', operate:'操作与交互', wait:'阻塞等待', review:'核查', rework:'修改与返工', setup:'一次性学习或搭建' };
    return `<details class="project-details"><summary>完整时间账 · 第 4 周需要填写</summary><p class="field-hint">单位为分钟。空白表示未记录，确实没有耗时请填 0。阻塞等待指无法并行做其他工作的等待；已重叠的时间不要重复计入。</p><div class="timing-grid">${Object.entries(labels).map(([id,label]) => `<div class="form-group"><label class="input-label" for="time-${id}">${label}</label><input class="form-input" id="time-${id}" type="number" min="0" max="10080" step="0.1" data-project-time="${id}" value="${d.timing[id] ?? ''}"></div>`).join('')}</div><p class="field-hint">先确认人工与 Agent 成果达到相同标准，再比较完整投入。一次性投入单列；记录多次后再判断是否值得复用。</p></details>`;
  }
  function runView() { return R.render(); }
  function trainView() {
    const t = task(view.taskId || learning().draft.taskId), p = C.practice[t.id];
    if(learning().draft.kind==='practice' && view.stage==='run')view.stage='demo';
    return `${stageTabs()}<section class="surface-card project-section">${view.stage !== 'run' ? `<div class="form-group"><label class="input-label" for="project-learning-task">练习任务</label><select id="project-learning-task" class="form-select" data-project-select="taskId">${C.tasks.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>` : ''}${view.stage === 'demo' ? demoView(t,p) : view.stage === 'diagnose' ? diagnoseView(t,p) : view.stage === 'scaffold' ? scaffoldView(t,p) : runView()}</section>`;
  }
  function timeText(run) {
    const t = Q.getTimeSummary(run);
    if(run.kind==='baseline')return typeof run.timing.manual==='number' ? `人工原流程投入 ${run.timing.manual} 分钟（学员记录）。` : '人工原流程耗时尚未记录。';
    return t.complete ? `人工基线 ${t.manual} 分钟；Agent 人工投入 ${t.active} 分钟；含阻塞等待 ${t.elapsed} 分钟；完整阻塞净省 ${t.netElapsed} 分钟；仅操作时间净省 ${t.netActive} 分钟；一次性投入 ${t.setup} 分钟另计。` : '时间账尚未完整记录。';
  }
  function recordView() {
    const runs = learning().runs;
    return `${note('普通练习与独立验证分别记录。可以导出，也可以撤回有误的自检。')}<div class="task-actions"><a class="button primary" href="#/project/start">继续练习</a>${button('export-review','导出完整评审包','',true)}</div>${runs.length ? `<div class="project-records">${runs.slice().reverse().map(r => `<article class="surface-card project-section"><div class="section-heading"><h2>${esc(kinds[r.kind])} · ${esc(task(r.taskId).title)}</h2><span class="badge neutral">${learning().withdrawnRunIds.includes(r.id) ? '已撤回自评' : r.kind==='practice' ? '普通练习 · 已保存' : ['baseline','pretest'].includes(r.kind) ? '基线或学前记录' : '独立验证 · 自评记录'}</span></div><p class="muted">${esc(r.date)} · ${r.kind==='practice' ? '普通练习' : r.context === 'work' ? '真实工作资料（自述）' : '教学或模拟材料'} · ${r.support === 'independent' ? '独立组织与核查' : '使用课程或他人提示'}</p><pre class="output-preview">${esc(r.output)}</pre><p class="field-hint">${esc(r.kind==='practice'?'已确认 '+Object.values(r.checks).filter(Boolean).length+' / 4 项自检':timeText(r))}</p><details class="project-details"><summary>查看本次材料与判断</summary><h3>资料</h3><pre class="output-preview">${esc(r.input)}</pre><h3>任务说明</h3><pre class="output-preview">${esc(r.instruction)}</pre>${[['来源核查',r.sourceCheck],['纠错记录',r.correction],['缺口与权限',r.decision],['迁移调整',r.adaptation],['补充记录',r.notes]].filter(x=>x[1]).map(([title,value])=>`<h3>${title}</h3><p class="preserve-text">${esc(value)}</p>`).join('')}</details>${button('export-run','导出这次记录',`data-run="${esc(r.id)}"`,true)}${learning().withdrawnRunIds.includes(r.id) ? '' : button('withdraw','撤回这次自检',`data-run="${esc(r.id)}"`,true)}</article>`).join('')}</div>` : `<div class="empty-state"><h2>还没有保存的练习</h2><p>先跟着三步做一次练习，资料和任务说明已经准备好。</p></div>`}`;
  }
  const packSteps=[['choice','这套方法适合做什么？','说明用途、适用情况和需要保留给人的判断。'],['materials','开始前要准备什么资料？','写清来源、版本、日期和必要背景；不知道的保留待确认。'],['instruction','别人可以怎样交代任务？','保存可复用说明，把每次变化的对象、日期或资料设为占位。'],['rubric','拿到结果后，怎么检查？','写出具体检查动作和参照材料。'],['recovery','遇到问题时怎么办？','记录真实遇到的异常与处理方法，没有验证的不要写成已验证。'],['handoff','别人试用后，有什么反馈？','填写真实接手者、使用材料、卡点和修改；尚未试用可以留空。']];
  let packIndex=null;
  function packView() {
    const p=learning().pack;
    if(packIndex===null)packIndex=Math.max(0,packSteps.findIndex(([key])=>p[key].trim().length<10));
    const [key,title,hint]=packSteps[packIndex];
    return `<section class="surface-card project-section"><p class="eyebrow">任务包 · ${packIndex+1} / ${packSteps.length}</p><h2>${esc(title)}</h2><p>一次补充一项，之前的内容已经保留。</p>${learning().packTaskId!==learning().mainTaskId?`<div class="project-errors"><p>当前任务包属于另一任务。修订后再确认归属。</p>${button('bind-pack','确认用于当前主线','',true)}</div>`:''}${field(title,key,p[key],hint,{scope:'pack'})}<div class="guided-footer">${button('pack-back','上一步','',true)}${packIndex<packSteps.length-1?button('pack-next','保存并继续'):`<a class="button primary" href="#/project/plan">保存，回到计划</a>`}</div><details class="guided-optional"><summary>其他操作</summary><div class="task-actions">${button('export-pack','导出任务包','',true)}${button('use-pack','带入下一次练习','',true)}</div><p class="field-hint">每次输入都会自动保存；未完成也可以稍后回来。</p></details></section>`;
  }
  function reviewView() {
    return `<section class="surface-card project-section"><h2>怎样判断学员是否掌握</h2><p>自评时按本次材料判断，抽评时请评审先对照原始材料。不要把提示后完成记作独立完成。</p><div class="rubric-levels"><div><strong>0 · 尚未体现</strong><p>缺少动作或依据，结果有关键问题。</p></div><div><strong>1 · 提示后做到</strong><p>依靠模板、教师或同事提醒完成。</p></div><div><strong>2 · 独立做到</strong><p>面对新材料，自行组织、核查并处理异常。</p></div></div>${C.competencies.map(s=>`<details class="project-details"><summary>${esc(s.name)}</summary><p>${esc(s.performance)}</p><p>证据：${esc(s.evidence)}</p><div class="task-actions">${s.lessonIds.map(id=>`<a class="text-link" href="#/lesson/${id}">${esc(C.lessons.find(l=>l.id===id)?.title || id)}</a>`).join('')}</div></details>`).join('')}<div class="project-errors"><strong>需要先处理的关键问题</strong><p>编造事实或来源、错误计算改变结论、漏掉重要条件、越权写入或发送，均应处理后再验收。语言和排版的优点不能抵消这些问题。</p></div><h3>试学怎样开展</h3><p>先用少量目标用户观察学习障碍，再做学前任务、结课新材料任务和一周后迁移。评审先共同评价几份作品，校准标准。记录独立完成、关键错误、求助和完整耗时；效果数据来自真实试学。</p><h3>设计参考</h3><div class="project-sources">${(C.sources||[]).map(s=>`<p><a class="text-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><small>${esc(s.use)} · 复查 ${esc(s.reviewedAt)}</small></p>`).join('')}</div></section>`;
  }
  function render(tab = 'path') {
    checkpoint();
    if(['path','start'].includes(tab)) {view.tab='start';B.render();return;}
    view.tab = ['plan','train','records','pack','review'].includes(tab) ? tab : 'plan';
    if(view.tab==='train'&&view.stage==='run'&&learning().draft.kind!=='practice'){
      const t=task(learning().draft.taskId);
      main.innerHTML=`<div class="guided-workspace"><div class="page-heading guided-heading"><div><p class="eyebrow">按步骤继续 · ${esc(kinds[learning().draft.kind])}</p><h1>${esc(t.title)}</h1></div><a class="text-link" href="#/project/plan">返回学习计划</a></div><section class="surface-card project-section guided-panel">${R.render()}</section></div>`;return;
    }
    if(view.tab==='pack'){
      main.innerHTML=`<div class="guided-workspace"><div class="page-heading guided-heading"><div><p class="eyebrow">逐项整理，随时保存</p><h1>制作我的任务包</h1></div><a class="text-link" href="#/project/plan">返回学习计划</a></div>${packView()}</div>`;return;
    }
    main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">按需深入</p><h1>${view.tab==='records'?'我的练习记录':'学习计划与独立验证'}</h1><p>${view.tab==='records'?'每次尝试都单独保存，可以回来继续检查。':'做过第一次练习后，再按需要制作任务包、比较省时或验证独立能力。'}</p></div><a class="button secondary" href="#/project/start">回到三步练习</a></div><nav class="project-tabs" aria-label="项目页面">${[['plan','四周计划'],['train','示范与验证'],['records','练习记录'],['pack','任务包'],['review','评价标准']].map(([id,label])=>`<a href="#/project/${id}" class="${id===view.tab?'active':''}" ${id===view.tab?'aria-current="page"':''}>${label}</a>`).join('')}</nav>${view.tab === 'plan' ? pathView() : view.tab === 'train' ? trainView() : view.tab === 'records' ? recordView() : view.tab === 'pack' ? packView() : reviewView()}`;
  }
  function go(tab) {
    view.tab = tab;
    const route = `#/project/${tab}`;
    if (location.hash === route) render(tab); else location.hash = route;
  }
  function resetDraft(kind, scaffold = false, taskId = null) {
    const l = learning(), d = Q.blankDraft(taskId || l.draft.taskId || l.mainTaskId);
    d.kind = kind || 'normal';
    if (scaffold) {
      d.input = C.practice[d.taskId].scaffold.input;
      d.instruction = C.practice[d.taskId].scaffold.instructionStarter;
    }
    l.draft = d; view.taskId = d.taskId; view.errors = []; view.stage = 'run'; R.reset(); save(); go('train');
  }
  let pendingDraft = null;
  function requestDraft(kind, scaffold = false, taskId = null) {
    const d = learning().draft;
    const archived=learning().runs.some(run=>Object.keys(d).every(key=>JSON.stringify(run[key])===JSON.stringify(d[key])));
    if (!archived && (d.input.trim() || d.instruction.trim() || d.output.trim())) {
      pendingDraft = {kind,scaffold,taskId};
      ctx.openDialog('开始一份新草稿？','<p>新草稿会替换当前未存档的编辑内容。已存档记录会保留。你可以先返回，存档或导出当前记录。</p>','<button class="button secondary" data-action="close-dialog">返回保留草稿</button><button class="button primary" data-project-action="reset-confirm">清空当前草稿并开始</button>');
    } else resetDraft(kind, scaffold,taskId);
  }
  function openLegacy(id) {
    const t=task(id);if(!t)return;
    const l=learning(), r=getState().tasks[id], d=l.draft;
    if(d.taskId===id && (d.input.trim()||d.output.trim())){
      if(d.kind==='practice'){B.choose(id);return;}
      view.stage='run';R.reset();go('train');return;
    }
    main.innerHTML=`<div class="page-heading"><div><p class="eyebrow">继续以前的练习</p><h1>${esc(t.title)}</h1><p>旧资料和结果会保留，接下来按步骤继续。</p></div></div><section class="surface-card project-section"><h2>从已保存的内容继续</h2><p>${r.input||r.output?'已经找到这项任务的历史资料或结果。':'这项任务还没有历史资料，可以用现成示例开始。'}</p>${button('legacy-import','按步骤继续',`data-task="${id}"`)}<a class="button secondary" href="#/artifacts">返回成果记录</a><p class="field-hint">如果另一份草稿尚未保存，会先请你确认，避免覆盖。</p></section>`;
  }
  function importLegacy(id, confirmed=false) {
    const l=learning(), current=l.draft;
    const archived=l.runs.some(run=>Object.keys(current).every(key=>JSON.stringify(run[key])===JSON.stringify(current[key])));
    if(!confirmed&&!archived&&(current.input.trim()||current.instruction.trim()||current.output.trim())){
      ctx.openDialog('先保留当前草稿','<p>继续这项历史任务会替换当前编辑中的草稿。原历史成果仍然保留，可以先返回保存当前草稿。</p>',`<button class="button secondary" data-action="close-dialog">返回保留草稿</button><button class="button primary" data-project-action="legacy-confirm" data-task="${id}">继续历史任务</button>`);return;
    }
    const old=getState().tasks[id], t=task(id), fresh=Q.blankDraft(id);
    Object.assign(fresh,{kind:'practice',input:old.input||C.practice[id].cases.normal.input,instruction:t.prompt,output:old.mode==='practice'?old.output:'',notes:old.notes,support:'guided'});
    l.draft=fresh;save();B.choose(id);
  }
  function usePack(confirmed=false) {
    const l=learning(), d=l.draft;
    if(!l.pack.instruction.trim())return toast('先在任务包中保存一份任务说明。');
    const archived=l.runs.some(run=>Object.keys(d).every(key=>JSON.stringify(run[key])===JSON.stringify(d[key])));
    if(!confirmed&&!archived&&(d.input.trim()||d.instruction.trim()||d.output.trim())){
      ctx.openDialog('先保留当前草稿','<p>使用任务包会开始一次新练习，当前编辑内容不会带入。可以先返回保存当前草稿，再继续。</p>','<button class="button secondary" data-action="close-dialog">返回保留草稿</button><button class="button primary" data-project-action="use-pack-confirm">用任务包开始新练习</button>');return;
    }
    const fresh=Q.blankDraft(l.packTaskId);fresh.instruction=l.pack.instruction;
    l.draft=fresh;view.taskId=fresh.taskId;view.stage='run';R.reset('materials');save();go('train');
  }
  function runMarkdown(r) {
    if(r.kind==='practice')return `# 普通练习：${task(r.taskId).title}\n\n日期：${r.date}\n记录性质：使用了课程模板，不作为独立掌握证据。\n状态：${learning().withdrawnRunIds.includes(r.id)?'已撤回':'已保存'}\n\n## 资料\n${r.input}\n\n## 使用的任务说明\n${r.instruction}\n\n## 实际结果\n${r.output}\n\n## 我的检查\n${task(r.taskId).criteria.map((c,i)=>`- [${r.checks[['facts','sources','complete','boundary'][i]]?'x':' '}] ${c.label}`).join('\n')}\n\n## 问题或修改\n${r.notes||'未填写（选填）'}\n`;
    return `# ${kinds[r.kind]}：${task(r.taskId).title}\n\n实际日期：${r.date}\n材料性质：${r.context === 'work' ? '真实工作资料（学员自述）' : '教学或模拟材料'}\n撤回状态：${learning().withdrawnRunIds.includes(r.id) ? '已撤回，不计项目与能力' : '有效记录'}\n提示情况：${r.support === 'independent' ? '独立组织与核查' : '使用提示'}\n记录性质：${['baseline','pretest'].includes(r.kind) ? '基线或学前记录' : '学员自评，待抽评'}\n\n## 资料\n${r.input}\n\n## 任务说明\n${r.instruction}\n\n## 实际成果\n${r.output}\n\n## 来源核查\n${r.sourceCheck}\n\n## 纠错\n${r.correction}\n\n## 缺口与权限决定\n${r.decision}\n\n## 迁移调整\n${r.adaptation}\n\n## 验收自检\n${Object.entries(r.checks).map(([key,value])=>`- [${value?'x':' '}] ${({facts:'事实数字日期',sources:'来源与未知',complete:'交付完整',boundary:'错误处理与权限'})[key]}`).join('\n')}\n\n## 能力自评（0未展示/1提示后/2独立）\n${C.competencies.map(s=>`- ${s.name}：${r.ratings[s.id]}`).join('\n')}\n\n## 时间账\n${timeText(r)}\n原始记录（分钟；null为未记录）：${JSON.stringify(r.timing)}\n同等质量比较后才能判断收益；一次性投入尚未分摊。\n\n## 补充记录\n${r.notes}\n`;
  }
  function packMarkdown() {
    const p = learning().pack;
    return `# 岗位任务包：${task(learning().mainTaskId).title}\n\n最近导出：${K.today()}\n\n${[['choice','任务选择与边界'],['materials','资料清单'],['instruction','可复用任务说明'],['rubric','验收表'],['recovery','异常处理与操作说明'],['handoff','他人使用反馈']].map(([key,label])=>`## ${label}\n${p[key] || '未填写'}\n`).join('\n')}`;
  }
  function exportReview() {
    const s = quality();
    const summary = comparisonNotice()+'\n\n'+s.weeks.map(w=>`- ${w.id}：${w.done ? '证据齐备，待抽评' : w.missing.join('；')}`).join('\n');
    download(`启程-项目评审包-${K.today()}.md`, `# 学习项目评审包\n\n这是学员记录与自评，不是自动认证。请对照原始材料抽评：0未体现，1提示后做到，2独立做到。关键事实、计算、来源、权限错误须先处理。\n\n## 项目证据\n${summary}\n\n## 延后复验\n${s.delayed.done ? '证据已记录，待抽评' : s.delayed.missing.join('；')}\n\n${packMarkdown()}\n\n${learning().runs.map(runMarkdown).join('\n---\n\n')}`, 'text/markdown');
  }
  document.addEventListener('input', event => {
    const el = event.target, l = learning();
    if (el.dataset.projectField) {
      const target = el.dataset.projectScope === 'pack' ? l.pack : l.draft;
      if (target === l.draft && (['input','instruction','output','sourceCheck','correction','decision','adaptation'].includes(el.dataset.projectField) || (el.dataset.projectField==='notes'&&(l.draft.kind==='assistant'||l.draft.kind.startsWith('automation-'))))) invalidateDraft();
      target[el.dataset.projectField] = el.value; save();
    }
    if (el.dataset.projectTime) {
      const value = el.value === '' ? null : Number(el.value);
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10080)) return;
      l.draft.timing[el.dataset.projectTime] = value; save();
    }
  });
  document.addEventListener('change', async event => {
    const el = event.target, l = learning();
    if (el.hasAttribute('data-project-main')) { l.mainTaskId = el.value; save(); render(view.tab); }
    if (el.dataset.projectSelect) {
      if (el.id === 'project-learning-task') { view.taskId = el.value; render(view.tab); return; }
      invalidateDraft();
      l.draft[el.dataset.projectSelect] = el.value;
      if(el.dataset.projectSelect==='taskId')view.taskId=el.value;
      if(l.draft.support==='guided')Object.keys(l.draft.ratings).forEach(key=>l.draft.ratings[key]=Math.min(1,l.draft.ratings[key]));
      view.errors = []; save(); render(view.tab);
    }
    if (el.dataset.projectCheck) { l.draft.checks[el.dataset.projectCheck] = el.checked; save(); }
    if (el.dataset.projectRating) { l.draft.ratings[el.dataset.projectRating] = Math.min(Number(el.value),l.draft.support==='guided'?1:2); save(); }
    if (el.dataset.projectDiagnose) {
      const r = l.diagnostics[el.dataset.task] ||= { answers: {}, submitted:false };
      r.answers[el.dataset.projectDiagnose] = el.value; r.submitted = false; save();
      // Remove stale feedback without replacing the focused radio control.
      main.querySelectorAll('.diagnose-item .quiz-feedback').forEach(node=>node.remove());
    }
    if (el.dataset.projectField === 'date' && (!el.value || el.value > K.today())) {
      l.draft.date = K.today(); el.value = l.draft.date; save(); toast('请记录今天或过去实际执行的日期。');
    }
    if (el.hasAttribute('data-project-upload')) {
      const file = el.files[0]; if (!file) return;
      if (file.size > 100 * 1024 || !/\.(txt|md|csv)$/i.test(file.name)) return toast('请选择小于 100 KB 的 TXT、MD 或 CSV 文件。');
      try {
        const text = await file.text();
        if (text.length > 100000) return toast('资料超过 100000 字符，请先摘取必要内容。');
        invalidateDraft(); l.draft.input = text; save(); render(view.tab); toast('资料已在本机读入。请核对性质、权限与内容是否完整。');
      } catch (error) { toast('文件未能读取，请改用粘贴。'); }
    }
  });
  document.addEventListener('click', async event => {
    const el = event.target.closest('[data-project-action]'); if (!el) return;
    const l = learning(), action = el.dataset.projectAction;
    if (action === 'stage') {
      if(el.dataset.stage==='run' && learning().draft.kind==='practice'){requestDraft('independent',false,view.taskId || learning().mainTaskId);return;}
      if(el.dataset.stage === 'run' && view.taskId && view.taskId !== l.draft.taskId) { requestDraft(l.draft.kind,false,view.taskId); return; }
      if(view.tab==='plan' && el.dataset.stage==='demo')view.taskId=l.mainTaskId;
      view.stage = el.dataset.stage; view.errors = []; go('train');
    }
    if (action === 'choose-task') { B.choose(el.dataset.task); }
    if (action === 'legacy-task') openLegacy(el.dataset.task);
    if (action === 'legacy-import') importLegacy(el.dataset.task);
    if (action === 'legacy-confirm') {ctx.closeDialog();importLegacy(el.dataset.task,true);}
    if (action === 'baseline') requestDraft('baseline',false,l.mainTaskId);
    if (action === 'pretest') requestDraft('pretest',false,l.mainTaskId);
    if (action === 'start-kind') requestDraft(el.dataset.kind);
    if (action === 'new-draft') requestDraft(l.draft.kind);
    if (action === 'scaffold') requestDraft('normal',true,el.dataset.task);
    if (action === 'reset-confirm' && pendingDraft) {
      ctx.closeDialog(); resetDraft(pendingDraft.kind,pendingDraft.scaffold,pendingDraft.taskId); pendingDraft = null;
    }
    if (action === 'load-case') {
      const c = caseFor(l.draft); if (c?.input) { invalidateDraft(); l.draft.input = c.input; l.draft.context = 'teaching'; save(); render(view.tab); }
    }
    if (action === 'diagnose') {
      const items = C.practice[el.dataset.task].diagnose.items;
      const r = l.diagnostics[el.dataset.task] ||= { answers:{}, submitted:false };
      if (items.some(item=>!r.answers[item.id])) return toast('请先对每个条目做一次判断。');
      r.submitted = true; save(); render('train');
      main.querySelector('.diagnose-item')?.scrollIntoView({block:'start',behavior:'smooth'});
    }
    if (action === 'archive') {
      view.errors = Q.validateRun(l.draft,C,l);
      if (view.errors.length) { R.showErrors(view.errors); render('train'); main.querySelector('.project-errors')?.focus(); return; }
      try { Q.archiveRun(l,C); const saved = save(); view.errors = []; toast(saved === false ? '浏览器未能持久保存，请立即导出评审包或完整备份。' : '本次证据已独立存档，可在记录页导出抽评。'); go('records'); }
      catch (error) { toast(error.message || '未能存档，请先导出备份。'); }
    }
    if (action === 'copy-instruction') {
      if (!l.draft.instruction.trim()) return toast('请先写下自己的任务说明。');
      await copyText(l.draft.instruction);
    }
    if (action === 'bind-pack') { l.packTaskId = l.mainTaskId; save(); render('pack'); toast('任务包已归属于当前主线，请确认六项内容均已修订。'); }
    if (action === 'pack-next') {packIndex=Math.min(packSteps.length-1,packIndex+1);save();render('pack');window.scrollTo({top:0,behavior:'instant'});}
    if (action === 'pack-back') {packIndex=Math.max(0,packIndex-1);render('pack');window.scrollTo({top:0,behavior:'instant'});}
    if (action === 'use-pack') usePack();
    if (action === 'use-pack-confirm') {ctx.closeDialog();usePack(true);}
    if (action === 'withdraw' && !l.withdrawnRunIds.includes(el.dataset.run)) { l.withdrawnRunIds.push(el.dataset.run); save(); render('records'); toast('已撤回这次自评，原记录保留，项目与能力证据已重新计算。'); }
    if (action === 'export-pack') download(`启程-岗位任务包-${K.today()}.md`,packMarkdown(),'text/markdown');
    if (action === 'export-run') { const r = l.runs.find(x=>x.id===el.dataset.run); if(r)download(`启程-练习记录-${r.date}.md`,runMarkdown(r),'text/markdown'); }
    if (action === 'export-review') exportReview();
  });
  return { render, dashboard, skillCards, weekCard, exportReview, checkpoint, openLegacy };
};
