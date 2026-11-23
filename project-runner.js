/* All project drafts share this step-by-step editor, including restored legacy drafts. */
window.createProjectRunner = function (ctx) {
  'use strict';
  const {C,K,esc,icon,answerPreview,answerEditorPreview,getLearning,save,redraw,toast,copyText} = ctx;
  let active=null, bound=null, identity='', custom=false, errors=[];
  const d=()=>getLearning().draft;
  const task=()=>C.tasks.find(t=>t.id===d().taskId);
  const isEarly=()=>['pretest','baseline'].includes(d().kind);
  const needsDecision=()=>['missing','conflict'].includes(d().kind)||d().kind.startsWith('automation-');
  const needsAdaptation=()=>['transfer','delayed'].includes(d().kind);
  const needsTests=()=>d().kind==='assistant'||d().kind.startsWith('automation-');
  const enough=(s,n)=>typeof s==='string'&&s.trim().length>=n;
  function steps(){return ['materials','instruction','result',...(!isEarly()?['verify']:[]),...(needsDecision()?['decision']:[]),...(needsAdaptation()?['adaptation']:[]),...(needsTests()?['tests']:[]),'finish'];}
  function nextMissing(){
    const x=d();
    if(!enough(x.input,10))return 'materials';
    if(!enough(x.instruction,isEarly()?10:20)||x.instruction.includes('____'))return 'instruction';
    if(!enough(x.output,isEarly()?10:20))return 'result';
    if(!isEarly()&&(!enough(x.sourceCheck,10)||!Object.values(x.checks).every(Boolean)))return 'verify';
    if(needsDecision()&&!enough(x.decision,10))return 'decision';
    if(needsAdaptation()&&!enough(x.adaptation,10))return 'adaptation';
    if(needsTests()&&!enough(x.notes,30))return 'tests';
    return 'finish';
  }
  function caseData(){
    if(d().kind==='assistant')return C.electives.assistant;
    if(d().kind.startsWith('automation-'))return C.electives.automation;
    return C.practice[d().taskId]?.cases[d().kind];
  }
  const button=(action,label,secondary=false,extra='')=>`<button class="button ${secondary?'secondary':'primary'}" type="button" data-run-action="${action}" ${extra}>${label}</button>`;
  const text=(key,label,hint)=>`<div class="form-group"><label class="input-label" for="project-${key}">${esc(label)}</label><textarea id="project-${key}" class="form-textarea tall" data-project-field="${key}" maxlength="${key==='input'?100000:key==='output'?200000:key==='instruction'?30000:20000}" placeholder="${esc(hint)}">${key==='output'?'\n':''}${esc(d()[key])}</textarea>${key==='output'?answerEditorPreview:''}<p class="field-hint">${esc(hint)}</p></div>`;
  function materials(){
    const c=caseData(), input=d().input||c?.input||'';
    return `<h2>先确认这次要用的资料</h2><p>${esc(c?.brief||'只带入完成这次任务需要的资料，留意来源、版本和缺失信息。')}</p>${input?`<pre class="output-preview guided-material">${esc(input)}</pre>`:''}${!input||custom?text('input','这次的资料','粘贴资料，保留必要的来源、日期、版本或表格口径。'):`<details class="guided-optional"><summary>修改或更换资料</summary>${text('input','这次的资料','修改后会清除原验收勾选，需要重新核查。')}</details>`}${c?.steps?`<details class="guided-optional"><summary>查看实操步骤</summary><ol class="project-list">${c.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></details>`:''}`;
  }
  function instruction(){
    return `<h2>${d().kind==='baseline'?'这次原来是怎样处理的？':'把这次任务说明白'}</h2><p>${isEarly()?'按你目前的方法写，不需要先学完课程。':'写清要做什么、根据什么资料、交付什么，以及哪些内容不能自行补全。'}</p><details class="guided-optional"><summary>回看资料</summary><pre class="output-preview">${esc(d().input)}</pre></details>${text('instruction',d().kind==='baseline'?'原有处理方法':'这次的任务说明','已有内容已经保留，补齐空白后再继续。')}`;
  }
  function result(){
    return `<h2>${d().kind==='baseline'?'把原流程的结果留在这里':'去执行一次，把结果带回来'}</h2><p>${d().kind==='baseline'?'先不用 Agent，按原来的方法完成。':'复制下面的完整任务，到获准使用的 Agent 中执行，再把实际回答带回来。'}</p>${d().kind==='baseline'?'':button('copy','复制任务和资料 '+icon('copy'))}<details class="guided-optional"><summary>查看任务说明和资料</summary><pre class="output-preview">${esc(d().instruction)}\n\n本次资料：\n${esc(d().input)}</pre></details>${text('output',d().kind==='baseline'?'原有流程的结果':'实际得到的结果','保留本次真实输出，不用重新抄写资料或任务说明。')}`;
  }
  function verify(){
    return `<h2>挑一条关键结论，回到资料核查</h2><p>写一份核查记录即可。没有发现错误时，不需要另外编一段“纠错说明”。</p><div class="guided-compare"><details class="guided-optional"><summary>查看原始资料</summary><pre class="output-preview">${esc(d().input)}</pre></details><details class="guided-optional"><summary>查看实际结果</summary>${answerPreview(d().output)}</details></div>${text('sourceCheck','这条结论的核查记录','例如：结果说负责人是李明；记录第2段确有他的承诺，日期也一致。写清结论、依据和核查结果。')}<div class="checklist">${[['facts','事实、数字和日期核对过了'],['sources','结论有依据，没有依据的已标明未知'],['complete','关键内容没有遗漏，符合这次要求'],['boundary','问题已处理，需要人工确认的动作没有越过']].map(([key,label])=>`<label class="check-item"><input type="checkbox" data-project-check="${key}" ${d().checks[key]?'checked':''}><span>${label}</span></label>`).join('')}</div><div class="task-actions">${button('issue','发现错误？记录一次修改',true)}${!needsDecision()?button('optional-decision','有缺口或权限动作？记录处理决定',true):''}</div>${d().correction?`<p class="field-hint">已保留之前的修改记录，可按上方按钮继续编辑。</p>`:''}`;
  }
  function reviewField(key,title,hint){return `<h2>${title}</h2>${text(key,title,hint)}`;}
  function finish(){
    return `<h2>这次已经整理好了</h2><p>资料、任务说明、实际结果和核查记录已分别保留。现在可以保存这次记录。</p><dl class="run-summary"><div><dt>任务</dt><dd>${esc(task().title)}</dd></div><div><dt>日期</dt><dd>${esc(d().date)}</dd></div><div><dt>提示情况</dt><dd>${d().support==='independent'?'独立组织与核查':'参考了模板或他人提示'}</dd></div><div><dt>资料性质</dt><dd>${d().context==='work'?'真实工作资料（自述）':'教学材料或练习'}</dd></div></dl>${button('settings','更改日期和执行情况',true)}<details class="guided-optional"><summary>其他记录（按需填写）</summary><div class="task-actions">${button('timing','记录完整耗时',true)}${button('ratings','查看能力自评',true)}${!needsTests()?button('notes','补充一句备注',true):''}</div></details><p class="field-hint">保存的是自评记录。是否独立掌握仍要结合材料核查，不会由填写数量自动认定。</p>`;
  }
  function settings(){
    return `<h2>确认本次执行情况</h2><div class="form-group"><label class="input-label" for="project-date">实际日期</label><input id="project-date" class="form-input" type="date" max="${K.today()}" value="${esc(d().date)}" data-project-field="date"></div><div class="form-group"><label class="input-label" for="project-support">是否使用过课程或他人提示？</label><select id="project-support" class="form-select" data-project-select="support"><option value="guided" ${d().support==='guided'?'selected':''}>使用过提示</option><option value="independent" ${d().support==='independent'?'selected':''}>自行组织并核查（可以用 Agent）</option></select></div><div class="form-group"><label class="input-label" for="project-context">资料性质</label><select id="project-context" class="form-select" data-project-select="context"><option value="teaching" ${d().context==='teaching'?'selected':''}>教学材料或模拟练习</option><option value="work" ${d().context==='work'?'selected':''}>真实工作资料</option></select></div><p class="field-hint">练习类型由学习任务决定。若要换任务，先保存这次记录，再到实验室选择。</p>`;
  }
  function extras(){
    if(active==='timing')return `<h2>完整时间账</h2><p>用分钟记录。没有耗时填 0，未记录的留空。</p>${ctx.timingFields(d()).replace('<details class="project-details">','<details class="project-details" open>')}`;
    if(active==='ratings')return `<h2>能力自评（选填）</h2><p>只评本次实际展示的能力。</p>${C.competencies.map(s=>`<div class="rating-row"><label for="rating-${s.id}">${esc(s.name)}</label><select class="form-select" id="rating-${s.id}" data-project-rating="${s.id}">${[['0','本次未展示'],['1','提示后做到'],['2','独立做到']].map(([v,label])=>`<option value="${v}" ${v==='2'&&d().support==='guided'?'disabled':''} ${Number(v)===d().ratings[s.id]?'selected':''}>${label}</option>`).join('')}</select></div>`).join('')}`;
    if(active==='settings')return settings();
    if(active==='issue')return reviewField('correction','哪里出了问题，怎样改的？','保留具体条目、修改依据和修正结果。没有发现错误可以留空。');
    if(active==='optional-decision')return reviewField('decision','遇到缺口或权限动作时，怎样处理？','说明继续、询问、暂停或交给人工确认的理由；没有这些情况可以留空。');
    return reviewField('notes','补充记录（选填）','可记录本次求助、限制或下一次改进。');
  }
  function render(){
    const key=d().taskId+':'+d().kind;
    if(bound!==d()||identity!==key){bound=d();identity=key;active=nextMissing();custom=false;errors=[];}
    if(!active)active=nextMissing();
    const sequence=steps(), index=sequence.indexOf(active), major=active==='materials'?0:active==='instruction'?1:active==='result'?2:3;
    const body=active==='materials'?materials():active==='instruction'?instruction():active==='result'?result():active==='verify'?verify():active==='decision'?reviewField('decision','缺失、冲突或写入动作，怎样处理？','指出具体缺口或动作，并说明询问、暂停、审核或避免重复写入的处理决定。'):active==='adaptation'?reviewField('adaptation','换了任务后，哪些需要调整？','写出新资料、受众、口径或验收条件的具体变化。'):active==='tests'?`<h2>留下这次实际测试的结果</h2>${caseData()?.testCases?`<details class="guided-optional"><summary>回看需要测试的情况</summary>${caseData().testCases.map(t=>`<p><strong>${esc(t.label)}</strong>：${esc(t.input)}</p>`).join('')}</details>`:''}${text('notes','实际测试记录','写下外部工具、正常及异常输入、实际结果和修正；至少30字。模拟和未实测的部分请如实说明。')}`:active==='finish'?finish():extras();
    return `<div class="run-wizard"><ol class="guided-steps run-steps" aria-label="当前练习步骤">${['确认资料','说明任务','带回结果','检查保存'].map((label,i)=>`<li class="${major===i?'current':major>i?'done':''}" ${major===i?'aria-current="step"':''}><span>${i+1}</span>${label}</li>`).join('')}</ol>${errors.length?`<div class="project-errors" role="alert">${esc(errors[0])}</div>`:''}${body}<div class="guided-footer">${button('back',index<=0?'返回示范':'上一步',true)}${active==='finish'?`<button type="button" class="button primary" data-project-action="archive">保存这次记录 ${icon('check')}</button>`:button('next',index<0?'完成，返回检查':'下一步 '+icon('arrow'))}</div><p class="field-hint" id="project-save-status">编辑会自动保存。每次只需要完成当前这一步。</p></div>`;
  }
  function move(step){active=step;errors=[];redraw();window.scrollTo({top:0,behavior:'instant'});}
  function checkCurrent(){
    if(active==='materials'&&!enough(d().input,10))return '请确认或放入这次要使用的资料。';
    if(active==='instruction'&&(!enough(d().instruction,isEarly()?10:20)||d().instruction.includes('____')))return '请补齐任务说明里的空白，写明这次要完成什么、怎样检查结果。';
    if(active==='result'&&!enough(d().output,isEarly()?10:20))return '请把这次实际得到的结果带回来。';
    if(active==='verify'&&(!enough(d().sourceCheck,10)||!Object.values(d().checks).every(Boolean)))return '留下一条核查记录，并确认四项自检；尚未确认可先保留草稿。';
    if(active==='decision'&&!enough(d().decision,10))return '请记录这次缺失、冲突或写入动作的具体处理。';
    if(active==='adaptation'&&!enough(d().adaptation,10))return '请说明换任务后实际调整了什么。';
    if(active==='tests'&&!enough(d().notes,30))return '请记录实际测试结果，至少30字。';
    return '';
  }
  document.addEventListener('click',async event=>{
    const el=event.target.closest('[data-run-action]');if(!el)return;
    const action=el.dataset.runAction;
    if(action==='copy'){await copyText(d().instruction+'\n\n本次资料：\n'+d().input);return;}
    if(['issue','optional-decision','settings','timing','ratings','notes'].includes(action)){move(action);return;}
    if(action==='back'){
      const seq=steps(), i=seq.indexOf(active);
      if(i<0){move(nextMissing());return;}
      if(i===0){ctx.backToDemo();return;}
      move(seq[i-1]);return;
    }
    if(action==='next'){
      const seq=steps(),i=seq.indexOf(active);
      if(i<0){move(nextMissing());return;}
      if(active==='materials'&&!d().input.trim()&&!custom&&caseData()?.input){d().input=caseData().input;d().context='teaching';Object.keys(d().checks).forEach(key=>d().checks[key]=false);save();}
      const error=checkCurrent();if(error){errors=[error];redraw();return;}
      move(seq[Math.min(i+1,seq.length-1)]);
    }
  });
  document.addEventListener('input',event=>{
    if(event.target.dataset.projectField==='input')custom=true;
  });
  return {render,reset:step=>{bound=d();identity=d().taskId+':'+d().kind;active=step||nextMissing();errors=[];},showErrors:messages=>{active=messages[0]?.includes('日期')?'settings':nextMissing();errors=messages;}};
};
