const assert = require('node:assert/strict');
const { chat } = require('../tutor-content.js');

const purpose = chat.reply('intro', '我想先看示范');
assert.equal(purpose.phase, 'purpose');
assert.match(purpose.text, /谁来做.*什么时候交/);
assert.match(purpose.text, /待确认[\s\S]*原文编号/);

const question = { phase: 'comprehension', text: chat.phaseIntro('comprehension'), actions: chat.phaseActions('comprehension') };
assert.equal(question.phase, 'comprehension');
assert.match(question.text, /D01[\s\S]*D02[\s\S]*哪条原文/);
for (const message of ['明白了', '开始练习', question.actions[0].value, '把负责人写待确认']) {
  assert.equal(chat.reply(question.phase, message).phase, 'comprehension');
}
const hinted = chat.reply(question.phase, '给个提示');
assert.equal(hinted.phase, 'comprehension');
assert.match(hinted.text, /D01.*展架.*D02.*场地图/);
assert.equal(chat.reply(question.phase, 'Agent 是什么？').phase, 'comprehension');

const result = chat.reply(purpose.phase, purpose.actions[0].value);
assert.equal(result.phase, 'demo-result');
assert.equal(chat.reply(question.phase, question.actions[1].value).phase, result.phase);
assert.equal(chat.reply(question.phase, '第二条说负责人会后再定，先留空。').phase, result.phase);
assert.match(result.text, /会后摘要[\s\S]*能交接的待办/);
assert.match(result.text, /\| 事项 \| 负责人 \| 期限 \| 依据 \|/);
assert.doesNotMatch(result.text, /根据这份会议信息/);

const request = chat.reply(result.phase, result.actions[0].value);
assert.equal(request.phase, 'demo-request');
assert.match(request.text, /根据这份会议信息/);
assert.match(request.text, /交付给谁[\s\S]*字段[\s\S]*缺项/);
assert.equal(chat.progress(request.phase), 0);
assert.equal(chat.reply('demo', '换我试试').phase, 'guided', 'older open lessons can resume');
const verification = chat.reply(request.phase, request.actions[0].value);
assert.equal(verification.phase, 'demo-verify');
assert.match(verification.text, /D02[\s\S]*补场地图[\s\S]*D01/);
const transfer = chat.reply(verification.phase, verification.actions[0].value);
assert.equal(transfer.phase, 'transfer-check');
assert.match(transfer.text, /T01.*12 月 5 日 14:00/);
assert.equal(chat.isAssessment('demo-verify'), false);
assert.equal(chat.isAssessment(transfer.phase), true);
for (const response of ['我懂了', 'T01', '都待确认，T01', '负责人是后勤组，12 月 5 日 14:00 前，T01', '12 月 5 日 14:00', '待确认 12 月 5 日 14:30 前', '待确认 12 月 6 日 14:00 前', '待确认 12 月 5 日 14:00 前 T02']) {
  const retry = chat.reply(transfer.phase, response);
  assert.equal(retry.phase, transfer.phase);
  assert.equal(chat.modelNextPhase(transfer.phase, response, true, retry), transfer.phase);
}
assert.match(chat.reply(transfer.phase, '给个提示').text, /前一句给了完成时间/);
const guided = chat.reply(transfer.phase, 'T01，负责人待确认，12 月 5 日下午两点前完成。');
assert.equal(guided.phase, 'guided');
assert.equal(chat.reply(transfer.phase, '根据 T01，具体人员由后勤组再安排，12 月 5 号下午二点以前完成。').phase, 'guided');
for (const response of [
  '待确认  12 月 5 日 14:00 前 T01',
  '负责人待确认，12 月 5 日 14:00 前',
  '执行人暂不填写，12/05 2:00 PM 前',
  'T01：执行的人还没有确定，12月5日14时前完成。',
  '负责人留空，T01，12月5日下午两点前',
  '十二月五日十四点前完成，负责人待确认，依据 T01。',
  'T01 负责人没有确定，期限是 12 月 5 日 14:00 前，这样写对吗？',
  'T01｜主持人说，指引牌需要在 12 月 5 日 14:00 前布置完。后勤组等场地确认后再安排具体人员。'
]) {
  const answer = chat.reply(transfer.phase, response);
  assert.equal(answer.phase, 'guided', response);
  assert.match(answer.feedback, /负责人还没定/, response);
  assert.equal(chat.modelNextPhase(transfer.phase, response, false, answer), 'guided', response);
}
const partial = '这个任务由谁执行还没定';
const later = '最晚是 12/5 下午两点前';
assert.equal(chat.reply(transfer.phase, partial).phase, transfer.phase);
assert.equal(chat.reply(transfer.phase, later).phase, transfer.phase);
assert.equal(chat.reply(transfer.phase, later, [partial]).phase, 'guided');
assert.equal(chat.modelNextPhase(transfer.phase, later, true, chat.reply(transfer.phase, later, [partial]), [partial]), 'guided');
assert.equal(chat.reply(transfer.phase, '执行人待定', [later]).phase, 'guided');
assert.equal(chat.reply(transfer.phase, '执行人是后勤组', [partial, later]).phase, transfer.phase);
const semanticReply = '负责人留给后勤组另挑一位同事，12 月 5 日 14:00 前完成。';
assert.equal(chat.modelNextPhase(transfer.phase, semanticReply, true, chat.reply(transfer.phase, semanticReply)), 'guided');
const metaQuestion = '所以我要写结果还是指令啊';
assert.equal(chat.modelNextPhase(transfer.phase, metaQuestion, true, chat.reply(transfer.phase, metaQuestion)), transfer.phase);
assert.deepEqual(['intro', 'purpose', 'demo-result', 'demo-request', 'demo-verify', 'transfer-check'].map(phase =>
  chat.position(phase).current), [1, 2, 3, 4, 5, 6]);
assert.equal(chat.position(transfer.phase).total, 6);
assert.equal(chat.position('guided'), undefined);
assert.equal(chat.reply(guided.phase, '明白了').phase, 'guided');

const correction = chat.reply(guided.phase, '缺少的信息写待确认，别猜一个日期。');
assert.equal(correction.phase, 'correction');
assert.match(correction.text, /别猜一个日期/);
assert.equal(chat.reply(correction.phase, 'G01').phase, 'correction');
const correctionPrompt = chat.reply(correction.phase, 'G02');
assert.equal(correctionPrompt.phase, 'correction-prompt');
assert.match(chat.inputHint(correctionPrompt.phase), /修改要求/);
assert.equal(chat.reply(correctionPrompt.phase, '好的').phase, 'correction-prompt');

const revised = chat.reply(correctionPrompt.phase, '把 G02 的反馈时间改为待确认，保留陈宇。');
assert.equal(revised.phase, 'correction-result');
assert.match(revised.text, /检查演示账号 \| 陈宇 \| 待确认/);
assert.doesNotMatch(revised.text, /N01/);
const independent = chat.reply(revised.phase, revised.actions[0].value);
assert.equal(independent.phase, 'independent');
assert.match(independent.text, /N01.*报价表/);

const source = chat.reply(independent.phase, '逐条列出采购组的待办清单，写负责人、期限和原文编号，缺项写待确认。');
assert.equal(source.phase, 'source');
assert.equal(chat.reply(source.phase, 'N03').phase, 'source');
const completed = chat.reply(source.phase, 'N02');
assert.equal(completed.phase, 'complete');
assert.equal(chat.progress(completed.phase), 4);
assert.equal(chat.progress('unknown'), undefined);

const modelSequence = [
  'intro', 'purpose', 'demo-result', 'demo-request', 'demo-verify', 'transfer-check', 'guided',
  'correction', 'correction-prompt', 'correction-result', 'independent', 'source', 'complete'
];
for (const [index, phase] of modelSequence.entries()) {
  assert.equal(chat.nextPhase(phase), modelSequence[index + 1]);
  assert.ok(chat.modelContext(phase).includes('当前环节的教学目标'));
  assert.ok(chat.phaseIntro(phase));
  assert.ok(Array.isArray(chat.phaseActions(phase)));
}
assert.equal(chat.nextPhase('demo'), 'guided');
assert.equal(chat.nextPhase('comprehension'), 'demo-result');
assert.equal(chat.modelContext('unknown'), '');
assert.equal(chat.nextPhase('unknown'), undefined);
assert.deepEqual(chat.phaseActions('unknown'), []);
assert.match(chat.modelContext('comprehension'), /D02.*场地图/);
assert.doesNotMatch(chat.modelContext('comprehension'), /N02|G02/);
assert.match(chat.modelContext('transfer-check'), /T01.*指引牌/);
assert.doesNotMatch(chat.modelContext('transfer-check'), /D02|N02|G02/);
assert.match(chat.modelContext('correction-prompt'), /G02[\s\S]*权限/);
assert.match(chat.modelContext('source'), /N02.*采购组第二条/);
assert.doesNotMatch(chat.phaseIntro('comprehension'), /内部判断依据|只报编号/);
assert.match(chat.phaseIntro('correction'), /12 月 4 日 12:00 前/);
assert.match(chat.phaseIntro('correction-result'), /检查演示账号 \| 陈宇 \| 待确认/);
for (const response of ['我懂了', '写待确认', 'D02', 'Agent 是什么？', '可以跳过这题吗']) {
  assert.equal(chat.modelNextPhase('comprehension', response, true, chat.reply('comprehension', response)), 'comprehension');
}
const naturalReply = '第二条还没安排人接手，留着这条给同事回看，等项目组定了再更新。';
assert.equal(chat.modelNextPhase('comprehension', naturalReply, true, chat.reply('comprehension', naturalReply)), 'demo-result');
const clonedActions = chat.phaseActions('intro');
clonedActions[0].label = '被修改';
assert.notEqual(chat.phaseActions('intro')[0].label, clonedActions[0].label);

console.log('Tutor conversation gates, incremental examples, resume and full exercise passed.');
