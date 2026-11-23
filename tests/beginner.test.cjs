const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const Q = require('../quality-core.js');
const K = require('../core.js');
const data = {window:{}};
for(const name of ['content.js','curriculum.js','scenario-courses.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),data);
const C=JSON.parse(JSON.stringify(data.window.AgentCourseContent));
const state=K.createState(C);
const events={}; let warning='', copied='', dialog='';
const main={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
const sandbox={
  window:{AgentQualityCore:Q,scrollTo:()=>{}},
  document:{addEventListener:(type,fn)=>events[type]=fn},
  location:{hash:'#/project/start'}
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../beginner.js'),'utf8'),sandbox);
const ctx={C,K,main,getState:()=>state,esc:String,icon:()=>'',
  answerPreview:String,answerEditorPreview:'<details class="answer-editor-preview"></details>',
  save:()=>{Q.normalizeLearning(state.learning,C,{strict:true});return true;},
  toast:text=>warning=text,copyText:async text=>copied=text,
  openDialog:title=>dialog=title,closeDialog:()=>dialog=''
};
const ui=sandbox.window.createBeginnerPractice(ctx);
const click=async(name,extra={})=>events.click({target:{closest:()=>({dataset:{beginnerAction:name,...extra}})}});
const input=(key,value)=>events.input({target:{dataset:{beginnerField:key},value}});
const change=(key,value)=>events.change({target:{dataset:{beginnerCheck:key},checked:value}});
(async()=>{
  ui.render();
  assert.match(main.innerHTML,/资料已经准备好了/);
  assert.equal((main.innerHTML.match(/<textarea/g)||[]).length,0,'first screen requires no typing');
  assert.equal(main.innerHTML.includes('<select'),false,'first screen avoids configuration');
  await click('next');
  assert.equal(state.learning.draft.kind,'practice');
  assert.match(main.innerHTML,/复制过去，把结果带回来/);
  assert.match(main.innerHTML,/answer-editor-preview/);
  assert.equal((main.innerHTML.match(/<textarea/g)||[]).length,1,'execution has one answer field');
  await click('copy');
  assert.ok(copied.includes(state.learning.draft.input),'copy includes the selected material');
  assert.equal(/\[粘贴/.test(copied),false,'copy is immediately runnable');
  await click('next');
  assert.match(warning,/实际回答/);
  assert.match(main.innerHTML,/复制过去，把结果带回来/);
  input('output','虚构界面测试结果：依照记录整理了待办，日期和负责人均保留原文依据，未说明的事项写为待确认。');
  await click('next');
  assert.match(main.innerHTML,/对照原文/);
  change('facts',true);
  await click('save');
  assert.equal(state.learning.runs.length,1,'partial self-check can be saved');
  assert.match(main.innerHTML,/这次练习已保存/);
  assert.equal(state.learning.runs[0].checks.sources,false);
  assert.equal(state.learning.runs[0].sourceCheck,'','no long evidence field is required');
  assert.equal(Q.getQualityStats(state,C).skills.every(s=>s.level===0),true);
  assert.equal(Q.getQualityStats(state,C).projectPercent,0,'practice never claims formal validation');
  await click('save');
  assert.equal(state.learning.runs.length,1,'saving again does not duplicate an unchanged record');
  const previous=state.learning.runs[0].input;
  await click('again');
  assert.equal(state.learning.draft.input,'');
  input('input','我自己的虚构练习资料：周悦下周整理资料，具体日期与最终负责人尚未确定。');
  await click('copy');
  assert.ok(copied.includes('我自己的虚构练习资料'));
  assert.equal(state.learning.runs[0].input,previous,'new work never changes previous snapshots');
  change('facts',true);
  input('input','修改后的虚构练习资料：周悦本周整理资料，具体日期待确认。');
  assert.equal(state.learning.draft.checks.facts,false,'material changes require a new check');
  const oldDraft=state.learning.draft.input;
  ui.choose('research');
  await click('next');
  assert.ok(dialog,'switching away from unfinished work preserves it until confirmed');
  assert.equal(state.learning.draft.input,oldDraft);
  await click('replace');
  assert.equal(state.learning.draft.taskId,'research');
  assert.equal(state.learning.runs.length,1);
  input('input','长资料'.repeat(20000));
  assert.equal(state.learning.draft.input.length,60000,'long material stays separate from the short instruction template');
  await click('copy');
  assert.equal(copied.split('长资料'.repeat(20000)).length-1,1,'material is included once, even with multiple template slots');
  // A new UI instance must resume the saved execution step without displaying the whole form.
  const resumed=sandbox.window.createBeginnerPractice(ctx);resumed.render();
  assert.match(main.innerHTML,/复制过去，把结果带回来/);
  assert.equal((main.innerHTML.match(/<textarea/g)||[]).length,1);
  state.learning.draft=Q.blankDraft('research');
  state.learning.draft.input='这是未保存的正式任务材料，需要保留并且不能被普通练习覆盖。';
  resumed.render();
  assert.match(main.innerHTML,/资料已经准备好了/,'returning from a formal task resets the guided step');
  await click('next');
  assert.ok(dialog,'formal work is protected before a guided attempt');
  await click('replace');
  assert.equal(state.learning.draft.kind,'practice');
  assert.match(main.innerHTML,/复制过去，把结果带回来/,'the restarted next button remains usable');
  for(const task of C.tasks.filter(t=>t.scenario)) {
    const fresh=K.createState(C);
    const scene=sandbox.window.createBeginnerPractice({...ctx,getState:()=>fresh});
    scene.choose(task.id);
    assert.match(main.innerHTML,/资料已经准备好了/);
    assert.equal((main.innerHTML.match(/<textarea/g)||[]).length,0,'scenario starts without a required form');
    assert.ok(main.innerHTML.includes(task.prepareHint));
    if(task.materialFile)assert.ok(main.innerHTML.includes('href="'+task.materialFile+'"'));
    await click('next');
    assert.equal((main.innerHTML.match(/<textarea/g)||[]).length,1,'each scenario needs only the actual result');
    await click('copy');
    assert.equal(copied.split(task.sampleInput).length-1,1,'the entire selected material is copied exactly once');
    assert.equal(/\[粘贴/.test(copied),false);
    input('output',task.sampleOutput);
    await click('next');
    assert.match(main.innerHTML,/看看示例和修改办法/);
    assert.equal((main.innerHTML.match(/type="checkbox"/g)||[]).length,4);
    assert.equal(fresh.learning.draft.sourceCheck,'');
    await click('save');
    assert.equal(fresh.learning.runs[0].taskId,task.id);
    assert.equal(fresh.learning.runs[0].kind,'practice');
    assert.equal(Q.getQualityStats(fresh,C).projectPercent,0,'new scenario does not silently certify independent mastery');
    assert.deepEqual(K.normalizeState(fresh,C,{strict:true}),fresh,'saved scenario survives strict backup validation');
  }
  console.log('PASS: focused steps, six scenario flows, copy/save/backup, recovery and unfinished-draft protection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
