const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const core = require('../core.js');
const Q = require('../quality-core.js');
const context = { window:{} };
for (const file of ['content.js','curriculum.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
const C = JSON.parse(JSON.stringify(context.window.AgentCourseContent));
const lessons = new Map(C.lessons.map(l=>[l.id,l]));
assert.equal(lessons.size,17);
assert.equal(C.competencies.length,8);
const required = C.modules.filter(m=>!m.optional).flatMap(m=>m.lessonIds);
assert.equal(required.length,14);
const ordered = C.modules.flatMap(m=>m.lessonIds);
assert.equal(new Set(ordered).size,17);
assert.deepEqual(C.lessons.map(l=>l.id),ordered,'rendered lesson navigation follows module order');
for (const m of C.modules) for (const id of m.lessonIds) assert.equal(lessons.get(id).moduleId,m.id);
assert.ok(C.modules[0].lessonIds.includes('l-concepts'));
assert.ok(C.modules[0].lessonIds.includes('l-permissions'));
assert.ok(C.modules[1].lessonIds.includes('l9'));
assert.ok(C.modules[2].lessonIds.includes('l10'));
for (const s of C.competencies) for (const id of s.lessonIds) assert.ok(lessons.has(id));
for (const w of C.weeks) {
  const total = Object.values(w.minutes).reduce((a,b)=>a+b,0);
  assert.ok(total>=180 && total<=240,'weekly allocation includes practice and verification');
  for (const id of w.lessonIds) assert.ok(lessons.has(id));
}
for (const task of C.tasks) {
  const p = C.practice[task.id];
  for (const kind of ['baseline','pretest','normal','missing','conflict','independent','transfer','delayed']) {
    assert.ok(p.cases[kind].input.length>=10,`${task.id}/${kind} has runnable material`);
    assert.ok(p.cases[kind].brief.length>10);
  }
  assert.notEqual(p.cases.pretest.input,p.cases.independent.input,'post-test must use new material');
  assert.notEqual(p.cases.baseline.input,p.cases.pretest.input,'manual timing and Agent pretest stay distinct');
  assert.notEqual(p.cases.independent.input,p.cases.delayed.input,'delayed test changes the material');
  assert.equal(new Set(p.diagnose.items.map(i=>i.id)).size,p.diagnose.items.length);
  assert.deepEqual([...new Set(p.diagnose.items.map(i=>i.answer))].sort(),['accept','ask','fix']);
  for (const item of p.diagnose.items) assert.ok(item.feedback.length>10,'judgment feedback explains evidence');
  const state = core.createState(C);
  state.learning.diagnostics[task.id]={answers:{[p.diagnose.items[0].id]:'accept'},submitted:false};
  assert.deepEqual(core.normalizeState(state,C,{strict:true}),state,'actual question IDs survive app normalization');
  assert.equal(Q.getQualityStats(state,C).skills.every(s=>s.level===0),true,'diagnosis completion is not mastery');
}
assert.ok(C.electives.assistant.testCases.length>=3);
assert.ok(C.electives.automation.testCases.length>=3);
console.log('PASS: published curriculum ordering, workload, fresh assessments, diagnosis IDs and complete project contracts.');
