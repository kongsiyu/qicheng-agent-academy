/* A guided first attempt. Saving a practice never establishes independent mastery. */
window.createBeginnerPractice = function (ctx) {
  'use strict';
  const {C,K,esc,icon,answerPreview,answerEditorPreview,main,getState,save,toast,copyText,openDialog,closeDialog} = ctx;
  const Q = window.AgentQualityCore;
  const l = () => getState().learning;
  const state = {step:null,taskId:null,own:false,issue:false,pending:null,finished:false,draftRef:null};
  const t = () => C.tasks.find(item=>item.id===(state.taskId || (l().draft.kind==='practice' ? l().draft.taskId : l().mainTaskId))) || C.tasks[0];
  const draft = () => l().draft.kind==='practice' && l().draft.taskId===t().id ? l().draft : null;
  const sample = () => C.practice[t().id].cases.normal.input;
  const content = () => draft()?.input || sample();
  const action = (name,label,secondary=false,extra='') => `<button class="button ${secondary?'secondary':'primary'}" type="button" data-beginner-action="${name}" ${extra}>${label}</button>`;
  function instruction(input, template=t().prompt) {
    let included=false;
    return template.replace(/\[[^\]\n]+\]/g,()=>{if(included)return '见上方资料中的问题和要求；未提供时先询问。';included=true;return input;});
  }
  function matchingRun() {
    const d = draft();
    return d && l().runs.find(r=>r.kind==='practice' && !l().withdrawnRunIds.includes(r.id) && ['taskId','input','instruction','output','notes'].every(key=>r[key]===d[key]) && Object.keys(d.checks).every(key=>r.checks[key]===d.checks[key]));
  }
  function archivedDraft(current) {
    return l().runs.some(run=>Object.keys(current).every(key=>JSON.stringify(run[key])===JSON.stringify(current[key])));
  }
  function begin(next) {
    const current = l().draft;
    const saved = archivedDraft(current);
    if ((current.input.trim() || current.instruction.trim() || current.output.trim()) && !saved && !draft()) {
      state.pending=next;
      openDialog('先保留正在做的练习','<p>你还有一份草稿。可以先回去保存；开始新的练习会替换这份草稿，已经存档的记录仍然保留。</p>','<button class="button secondary" data-action="close-dialog">返回保留草稿</button><button class="button primary" data-beginner-action="replace">开始新的练习</button>');
      return false;
    }
    if (!draft()) {
      const d=Q.blankDraft(t().id);
      d.kind='practice';d.input=sample();d.instruction=t().prompt;d.support='guided';
      l().draft=d;state.draftRef=d;
      if(save()===false)return false;
    }
    next(); return true;
  }
  function route() {
    if(location.hash==='#/project/start' || location.hash==='#/project/path')render();
    else location.hash='#/project/start';
  }
  function clearChecks() {
    if(!draft())return;
    Object.keys(draft().checks).forEach(key=>draft().checks[key]=false);
    main.querySelectorAll('[data-beginner-check]').forEach(el=>el.checked=false);
    state.finished=false;
  }
  function header() {
    const step=state.step??(draft()?(draft().output.trim().length>=20?2:1):0);
    return `<div class="page-heading guided-heading"><div><p class="eyebrow">一步一步，做成一次</p><h1>${esc(t().title)}</h1></div><a class="text-link" href="#/tasks">换个练习</a></div><ol class="guided-steps" aria-label="练习步骤">${['准备资料','让 Agent 帮忙','检查并保存'].map((name,index)=>`<li class="${step===index?'current':step>index?'done':''}" ${step===index?'aria-current="step"':''}><span>${index+1}</span>${name}</li>`).join('')}</ol>`;
  }
  function prepare() {
    const d=draft();
    return `<p class="eyebrow">第 1 步 / 共 3 步</p><h2>资料已经准备好了</h2><p>${esc(t().prepareHint || '先用这份虚构资料练一次，读一遍就能继续。')}</p>${t().outcome?`<p class="guided-outcome">这次做出：${esc(t().outcome)}</p>`:''}<pre class="output-preview guided-material">${esc(content())}</pre><p class="field-hint">留意资料中明确说了什么、什么还没说明。后面会用它检查结果。</p>${t().materialFile?`<details class="guided-optional"><summary>想练实际文件？下载练习材料</summary><p>文字案例已够完成这次练习。需要练文件读取时，下载后交给常用 Agent；本站不会上传或修改本机文件。</p><a class="text-link" href="${esc(t().materialFile)}" download>${esc(t().materialLabel)} ${icon('download')}</a></details>`:''}<details class="guided-optional" ${state.own?'open':''}><summary>我想换成自己的资料</summary>${d?`<label class="input-label" for="guided-input">粘贴资料</label><textarea class="form-textarea" id="guided-input" data-beginner-field="input" maxlength="100000" placeholder="粘贴一份你有权使用的资料，记得保留来源、日期或版本。">${esc(d.input)}</textarea><p class="field-hint">先去掉不需要的个人或客户信息。PDF 可在常用 Agent 中读取，这里保存必要摘录。</p>`:action('own','粘贴自己的资料',true)}</details><div class="guided-footer">${action('next','资料看过了，继续 '+icon('arrow'))}</div>`;
  }
  function execute() {
    const d=draft();
    if(!d)return prepare();
    return `<p class="eyebrow">第 2 步 / 共 3 步</p><h2>复制过去，把结果带回来</h2><p>点一下复制，粘贴到你常用的 Agent。资料和要求都在里面，不用再写一遍。</p><div class="guided-copy">${action('copy','复制完整任务 '+icon('copy'))}<span class="field-hint" role="status" id="guided-copy-status"></span></div><details class="guided-optional"><summary>看看这份任务是怎么说的</summary><pre class="output-preview">${esc(instruction(d.input,d.instruction))}</pre><p class="field-hint">这份说明已经写清目标、资料、输出格式和未知信息的处理方式。</p></details><div class="form-group"><label class="input-label" for="guided-output">把 Agent 的回答粘贴在这里</label><textarea class="form-textarea tall" id="guided-output" data-beginner-field="output" maxlength="200000" placeholder="去常用的 Agent 执行后，把实际回答带回来。">\n${esc(d.output)}</textarea>${answerEditorPreview}</div><div class="guided-footer">${action('back','上一步',true)}${action('next','拿到结果了，开始检查 '+icon('arrow'))}</div>`;
  }
  function check() {
    const d=draft();
    if(!d)return prepare();
    const keys=['facts','sources','complete','boundary'];
    return `<p class="eyebrow">第 3 步 / 共 3 步</p><h2>对照原文，检查这几件事</h2><p>确认一项就勾一项。不确定的先留着，也可以保存后继续修改。</p><div class="guided-compare"><details class="guided-optional"><summary>查看原始资料</summary><pre class="output-preview">${esc(d.input)}</pre></details><details class="guided-optional"><summary>查看我的结果</summary>${answerPreview(d.output)}<button type="button" class="text-link" data-beginner-action="edit-output">返回修改结果</button></details></div><div class="checklist guided-checks">${t().criteria.map((item,index)=>`<label class="check-item"><input type="checkbox" data-beginner-check="${keys[index]}" ${d.checks[keys[index]]?'checked':''}><span>${esc(item.label)}</span></label>`).join('')}</div>${t().scenario?`<details class="guided-optional"><summary>不确定怎么检查？看看示例和修改办法</summary><p>以下只对应原始教学材料；换了资料后，请回到自己的原文核对。</p><pre class="output-preview">${esc(t().sampleOutput)}</pre>${t().pitfalls.map(p=>`<h3>${esc(p.problem)}</h3><p>${esc(p.solution)}</p>`).join('')}</details>`:''}<details class="guided-optional" ${state.issue||d.notes?'open':''}><summary>发现问题？记一句，方便下次改</summary><label class="input-label" for="guided-notes">问题或修改（选填）</label><textarea class="form-textarea" id="guided-notes" data-beginner-field="notes" maxlength="20000" placeholder="例如：负责人没有依据，我已改成待确认。">${esc(d.notes)}</textarea><p class="field-hint">可以把具体条目和原文一起发给 Agent，修改后再回来检查。</p></details><div class="guided-footer">${action('back','上一步',true)}${action('save','保存这次练习 '+icon('check'))}</div><p class="field-hint">这是一次有模板帮助的练习。检查没有完成也能保存，不要求写复盘或打分。</p>`;
  }
  function finished() {
    const d=draft(), checked=Object.values(d.checks).filter(Boolean).length;
    return `<div class="guided-success">${icon('check')}<h2>这次练习已保存</h2><p>你已经走过了“准备资料 → 说明任务 → 检查结果”。${checked===4?'四项自检均已勾选。':`还有 ${4-checked} 项自检没确认，可以之后再检查。`}</p><p class="field-hint">这份记录保存在当前浏览器。普通练习不会自动算作独立掌握。</p><div class="guided-footer">${action('again','换自己的资料再试一次')}<a class="text-link" href="#/project/records">查看已保存的练习</a></div><details class="guided-optional"><summary>想再学一点？</summary><p><a class="text-link" href="#/lesson/${t().lessonIds[0]}">看看这次用到的方法</a></p><p><a class="text-link" href="#/project/plan">查看后面的学习计划与独立验证</a></p></details></div>`;
  }
  function render() {
    const d=draft();
    if(d!==state.draftRef){state.step=d&&d.input.trim()?(d.output.trim().length>=20?2:1):0;state.finished=false;state.draftRef=d;}
    if(!d){state.step=0;state.finished=false;}
    const step=state.step??(draft()?(draft().output.trim().length>=20?2:1):0);
    main.innerHTML=`<div class="guided-workspace">${header()}<section class="surface-card project-section guided-panel">${state.finished&&draft()?finished():step===0?prepare():step===1?execute():check()}</section><p class="guided-save" id="guided-save-status">资料和结果只保存在当前浏览器。${draft()?'编辑会自动保存。':''}</p><details class="guided-more"><summary>学习计划与更多功能</summary><div class="task-actions"><a class="text-link" href="#/project/plan">四周计划与独立验证</a><a class="text-link" href="#/project/records">练习记录</a><a class="text-link" href="#/route">学习课程</a></div></details></div>`;
    window.scrollTo({top:0,behavior:'instant'});
  }
  function persist() {
    const ok=save();
    const status=main.querySelector('#guided-save-status');
    if(status)status.textContent=ok===false?'浏览器未能保存，请到学习设置导出备份。':'已自动保存在当前浏览器。';
    return ok;
  }
  function choose(taskId) { state.taskId=taskId;state.step=0;state.finished=false;state.own=false;route(); }
  document.addEventListener('input',event=>{
    const el=event.target,key=el.dataset.beginnerField,d=draft();if(!key||!d)return;
    if(['input','output'].includes(key))clearChecks();
    d[key]=el.value;
    if(key==='input') {d.instruction=t().prompt;d.context='teaching';}
    persist();
  });
  document.addEventListener('change',event=>{
    const key=event.target.dataset.beginnerCheck;if(!key||!draft())return;
    draft().checks[key]=event.target.checked;persist();
  });
  document.addEventListener('click',async event=>{
    const el=event.target.closest('[data-beginner-action]');if(!el)return;
    const name=el.dataset.beginnerAction;
    if(name==='replace'&&state.pending){closeDialog();const next=state.pending;state.pending=null;const d=Q.blankDraft(t().id);d.kind='practice';d.input=sample();d.instruction=t().prompt;l().draft=d;state.draftRef=d;if(persist()!==false)next();return;}
    if(name==='begin'){state.taskId=el.dataset.task||l().mainTaskId;state.step=0;state.finished=false;route();return;}
    if(name==='own'){begin(()=>{state.own=true;render();main.querySelector('#guided-input')?.focus();});return;}
    if(name==='next'){
      const step=state.step??(draft()?(draft().output.trim().length>=20?2:1):0);
      if(step===0){begin(()=>{if(draft().input.trim().length<10)return toast('请先放入一份可以处理的资料。');state.step=1;render();});}
      else if(step===1){if(!draft()||draft().output.trim().length<20)return toast('先把 Agent 的实际回答带回来，再开始检查。');state.step=2;render();}
      return;
    }
    if(name==='back'){state.step=Math.max(0,(state.step??2)-1);render();}
    if(name==='edit-output'){state.step=1;render();main.querySelector('#guided-output')?.focus();}
    if(name==='copy'&&draft()){await copyText(instruction(draft().input,draft().instruction));const label=main.querySelector('#guided-copy-status');if(label)label.textContent='已准备好任务，可以粘贴到常用的 Agent。';}
    if(name==='save'&&draft()){
      try{if(!matchingRun())Q.archiveRun(l(),C);if(persist()===false)return;state.finished=true;render();}
      catch(error){toast(error.message||'未能保存，请到学习设置导出备份。');}
    }
    if(name==='again'){
      if(!draft()||!matchingRun())return toast('先保存这次练习，再开始下一次。');
      const d=Q.blankDraft(t().id);d.kind='practice';d.input='';d.instruction=t().prompt;d.support='guided';l().draft=d;
      state.step=0;state.own=true;state.finished=false;state.draftRef=d;persist();render();
    }
  });
  return {render,choose};
};
