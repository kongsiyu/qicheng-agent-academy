const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const K = require('../core.js');
const W = require('../workflow-core.js');
const catalog = require('../workflow-content.js');
const workflow = catalog.find(item => item.id === 'feedback-workflow');
const meeting = catalog.find(item => item.id === 'meeting-handoff');

const [first, second] = workflow.steps;
const legacyBrief = '## 本批反馈概况\n\n旧版本填写的简报保留为原始 Markdown。';
const context = { window: {} };
for (const file of ['content.js', 'curriculum.js', 'scenario-courses.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
}
const sampleInput = context.window.AgentCourseContent.tasks.find(task => task.id === workflow.taskId).sampleInput;
const content = JSON.parse(JSON.stringify(context.window.AgentCourseContent));
const blank = W.blank(workflow);

assert.equal(W.currentStep(blank), 0);
assert.equal(W.isComplete(blank), false);
assert.equal(blank.workflowId, workflow.id);
assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
assert.deepEqual(workflow.steps.map(step => step.type), ['agent', 'agent', 'review']);
assert.equal(new Set(workflow.steps.map(step => step.id)).size, workflow.steps.length);
for (const line of sampleInput.split('\n').filter(line => /^F\d{2}｜/.test(line))) {
  const [feedbackId, , quotation] = line.split('｜');
  assert.ok(first.example.includes(feedbackId), `missing teaching record ${feedbackId} in workflow example`);
  assert.ok(first.example.includes(quotation), `teaching record ${feedbackId} changed in workflow example`);
}
assert.throws(() => W.buildPrompt(blank, 1, workflow, sampleInput), /先确认/);
assert.throws(() => W.confirm(blank, 1), /先确认/);
assert.throws(() => W.confirm(blank, 0), /实际产物/);
assert.throws(() => W.confirm(W.updateOutput(blank, 0, ' \n  '), 0), /实际产物/);
assert.throws(() => W.updateOutput(blank, 1, second.example), /先确认/);
assert.throws(() => W.updateOutput(blank, 0, 'x'.repeat(W.OUTPUT_LIMIT + 1)), /长度限制/);

const firstPrompt = W.buildPrompt(blank, 0, workflow, sampleInput);
assert.ok(firstPrompt.includes(first.prompt));
assert.ok(firstPrompt.includes(sampleInput));
assert.ok(!firstPrompt.includes('已确认的上一步产物'));

const firstDraft = W.updateOutput(blank, 0, first.example);
assert.equal(blank.steps[0].output, '', 'updating a draft does not change the original state');
assert.equal(W.updateOutput(firstDraft, 0, first.example), firstDraft);
assert.equal(W.currentStep(firstDraft), 0);
assert.throws(() => W.buildPrompt(firstDraft, 1, workflow, sampleInput), /先确认/);

const firstConfirmed = W.confirm(firstDraft, 0);
assert.equal(W.currentStep(firstConfirmed), 1);
assert.equal(W.confirm(firstConfirmed, 0), firstConfirmed);
const secondPrompt = W.buildPrompt(firstConfirmed, 1, workflow, sampleInput);
assert.ok(secondPrompt.includes(first.example));
assert.ok(!secondPrompt.includes(sampleInput), 'step two receives only the confirmed predecessor');
assert.equal(W.buildPrompt(firstConfirmed, 0, workflow, sampleInput), firstPrompt);

const secondDraft = W.updateOutput(firstConfirmed, 1, second.example);
const revisedFirstWhileDoingSecond = W.updateOutput(secondDraft, 0, `${first.example}\n复核了原话。`);
assert.equal(revisedFirstWhileDoingSecond.steps[1].output, second.example);
assert.equal(revisedFirstWhileDoingSecond.steps[1].status, 'pending');
assert.deepEqual(W.restore(JSON.parse(JSON.stringify(revisedFirstWhileDoingSecond)), workflow), revisedFirstWhileDoingSecond);

const secondConfirmed = W.confirm(secondDraft, 1);
const lastPrompt = W.buildPrompt(secondConfirmed, 2, workflow, sampleInput);
assert.ok(lastPrompt.includes(second.example));
assert.ok(!lastPrompt.includes(first.example));
const completed = W.confirm(W.updateOutput(secondConfirmed, 2, legacyBrief), 2);
assert.equal(W.currentStep(completed), completed.steps.length);
assert.equal(W.isComplete(completed), true);
assert.equal(W.updateOutput(completed, 0, first.example), completed);
assert.equal(W.buildPrompt(completed, 2, workflow, sampleInput), lastPrompt);

const revisedFirst = `${first.example}\n已复核多标签记录。`;
const revised = W.updateOutput(completed, 0, revisedFirst);
assert.deepEqual(revised.steps.map(step => step.status), ['draft', 'pending', 'pending']);
assert.deepEqual(revised.steps.map(step => step.output), [revisedFirst, second.example, legacyBrief]);
assert.equal(W.isComplete(revised), false);
assert.throws(() => W.buildPrompt(revised, 1, workflow, sampleInput), /先确认/);

const resumed = W.restore(JSON.parse(JSON.stringify(revised)), workflow);
assert.notEqual(resumed.steps, revised.steps);
assert.equal(W.currentStep(resumed), 0);
const firstReconfirmed = W.confirm(resumed, 0);
assert.equal(W.currentStep(firstReconfirmed), 1);
assert.ok(W.buildPrompt(firstReconfirmed, 1, workflow, sampleInput).includes(revisedFirst));
assert.equal(firstReconfirmed.steps[1].status, 'pending');
assert.throws(() => W.confirm(firstReconfirmed, 2), /先确认/);
assert.equal(W.confirm(firstReconfirmed, 1).steps[2].status, 'pending');

assert.throws(() => W.restore(null, workflow), /不匹配/);
assert.throws(() => W.restore({ ...blank, version: 2 }, workflow), /不匹配/);
assert.throws(() => W.restore({ ...blank, extra: true }, workflow), /不匹配/);
assert.throws(() => W.restore({ ...blank, steps: blank.steps.slice(1) }, workflow), /不匹配/);
assert.throws(() => W.restore({ ...blank, steps: [...blank.steps].reverse() }, workflow), /步骤记录无效/);
assert.throws(() => W.restore({ ...blank, steps: [{ ...blank.steps[0], output: 123 }, ...blank.steps.slice(1)] }, workflow), /步骤记录无效/);
assert.throws(() => W.restore({ ...blank, steps: [blank.steps[0], ...completed.steps.slice(1)] }, workflow), /按顺序确认/);
assert.throws(() => W.restore({ ...blank, steps: [blank.steps[0], { ...blank.steps[1], status: 'pending' }, blank.steps[2]] }, workflow), /待复核/);
assert.deepEqual(W.restore(JSON.parse(JSON.stringify(completed)), workflow), completed);

assert.equal(W.routingHandoff(blank, workflow), '');
assert.throws(() => W.updateRouting(firstConfirmed, 'import-date', 'investigate', workflow), /先确认/);
assert.throws(() => W.confirmRouting(secondConfirmed, workflow), /每项选择/);
assert.throws(() => W.updateRouting(secondConfirmed, 'unknown', 'request', workflow), /有效/);
assert.throws(() => W.updateRouting(secondConfirmed, 'help-link', 'skip', workflow), /有效/);

const legacy = W.restore(JSON.parse(JSON.stringify(completed)), workflow);
assert.equal(legacy.steps[2].output, legacyBrief);
assert.equal(legacy.routing, undefined);
const pendingLegacy = W.updateOutput(legacy, 1, `${second.example}\n重新核对客户编号。`);
assert.equal(pendingLegacy.steps[2].status, 'pending');
assert.equal(pendingLegacy.steps[2].output, legacyBrief);
assert.throws(() => W.updateRouting(pendingLegacy, 'import-date', 'investigate', workflow), /先确认/);
const recheckedLegacy = W.confirm(pendingLegacy, 1);

const firstChoice = W.updateRouting(recheckedLegacy, 'import-date', 'investigate', workflow);
assert.equal(firstChoice.steps[2].status, 'pending');
assert.equal(firstChoice.routing.previousBrief, legacyBrief);
assert.equal(firstChoice.steps[2].output, W.routingHandoff(firstChoice, workflow));
assert.match(firstChoice.steps[2].output, /产品核查\n\n- \*\*导入时报日期格式错误\*\*（F01、F02、F03）/);
assert.match(firstChoice.steps[2].output, /客服补资料\n\n暂无条目。/);
assert.doesNotMatch(firstChoice.steps[2].output, /帮助链接/);
assert.equal(W.updateRouting(firstChoice, 'import-date', 'investigate', workflow), firstChoice);
assert.throws(() => W.confirmRouting(firstChoice, workflow), /每项选择/);
assert.throws(() => W.confirm(firstChoice, 2), /通过分流/);
assert.throws(() => W.updateOutput(firstChoice, 2, '与分流选择无关的内容'), /通过分流/);

const routed = W.updateRouting(W.updateRouting(firstChoice, 'help-link', 'request', workflow), 'export-entry', 'investigate', workflow);
const handoff = W.confirmRouting(routed, workflow);
assert.ok(W.isComplete(handoff));
assert.equal(W.confirmRouting(handoff, workflow), handoff);
const historicalHandoff = [
  '## 产品核查',
  '',
  '- **导入时报日期格式错误**（F01、F02、F03）',
  '  - 依据 · 客户 A 已提供脱敏的表格、产品版本和操作步骤。按步骤导入时仍出现同一条报错。',
  '  - 下一步 · 用客户 A 的脱敏表格和操作步骤复现日期报错，记录触发条件。',
  '- **找不到导出入口**（F04、F05）',
  '  - 依据 · 客服拿到了页面截图。两位客户的账号角色和导出权限还没确认。',
  '  - 下一步 · 根据截图检查当前页面的导出入口和权限提示，区分入口难找和没有权限。',
  '',
  '## 客服补资料',
  '',
  '- **帮助链接打不开**（F05）',
  '  - 依据 · 客户只说点了页面里的帮助链接，回访记录里仍缺链接地址和错误提示。',
  '  - 下一步 · 请客服向客户确认链接地址、入口页面和打开时的错误提示。'
].join('\n');
assert.equal(handoff.steps[2].output, historicalHandoff, 'new catalog preserves historical Markdown exactly');
assert.deepEqual(W.restore(JSON.parse(JSON.stringify(handoff)), workflow), handoff);

const archivedSource = W.updateRouting(legacy, 'help-link', 'request', workflow);
assert.equal(archivedSource.steps[2].status, 'draft');
assert.equal(archivedSource.routing.previousBrief, legacyBrief);
assert.equal(legacy.steps[2].output, legacyBrief);
const fresh = W.updateRouting(secondConfirmed, 'import-date', 'investigate', workflow);
assert.equal(fresh.routing.previousBrief, '');
assert.equal(fresh.steps[2].status, 'draft');

const rerouted = W.updateRouting(handoff, 'help-link', 'investigate', workflow);
assert.equal(rerouted.steps[2].status, 'draft');
assert.equal(rerouted.routing.previousBrief, legacyBrief);
assert.match(rerouted.steps[2].output, /检查相关页面的帮助入口/);
assert.doesNotMatch(rerouted.steps[2].output, /请客服向客户确认链接地址/);

const upstreamChanged = W.updateOutput(handoff, 0, revisedFirst);
assert.equal(upstreamChanged.steps[2].status, 'pending');
assert.deepEqual(upstreamChanged.routing, handoff.routing);
assert.deepEqual(W.restore(JSON.parse(JSON.stringify(upstreamChanged)), workflow), upstreamChanged);
assert.throws(() => W.confirmRouting(upstreamChanged, workflow), /先确认/);
const upstreamReconfirmed = W.confirm(W.confirm(upstreamChanged, 0), 1);
assert.ok(W.isComplete(W.confirmRouting(upstreamReconfirmed, workflow)));

assert.throws(() => W.restore({ ...handoff, routing: { ...handoff.routing, choices: [] } }, workflow), /分流记录无效/);
assert.throws(() => W.restore({ ...handoff, routing: { ...handoff.routing, choices: { unknown: 'request' } } }, workflow), /分流决定无效/);
assert.throws(() => W.restore({ ...handoff, routing: { ...handoff.routing, choices: { 'import-date': 'investigate' } } }, workflow), /分流决定无效/);
assert.throws(() => W.restore({ ...handoff, steps: [...handoff.steps.slice(0, 2), { ...handoff.steps[2], output: legacyBrief }] }, workflow), /交接单与分流决定不匹配/);

const backup = K.createState(content);
backup.workflow = handoff;
const restoredBackup = K.normalizeState(JSON.parse(JSON.stringify(backup)), content, { strict: true });
assert.equal(restoredBackup.workflow, undefined);
assert.deepEqual(restoredBackup.workflows, { [workflow.id]: { record: handoff, updatedAt: backup.updatedAt } });
assert.equal(restoredBackup.workflows[workflow.id].record.routing.previousBrief, legacyBrief);

assert.deepEqual(meeting.steps.map(step => step.type), ['agent', 'review', 'agent']);
const [extract, meetingReview, deliver] = meeting.steps;
const meetingBlank = W.blank(meeting);
assert.match(W.buildPrompt(meetingBlank, 0, meeting, meeting.sampleInput), /【周会记录】/);
assert.throws(() => W.updateRouting(meetingBlank, 'demo-access', 'handoff', meeting), /先确认/);
const meetingDraft = W.updateOutput(meetingBlank, 0, extract.example, meeting);
const readyForReview = W.confirm(meetingDraft, 0, meeting);
assert.throws(() => W.buildPrompt(readyForReview, 1, meeting), /本站/);
assert.throws(() => W.updateOutput(readyForReview, 1, '人工审核不能写成自由文本', meeting), /通过分流/);
assert.throws(() => W.confirm(readyForReview, 1, meeting), /通过分流/);
assert.throws(() => W.updateRouting(readyForReview, 'demo-access', 'investigate', meeting), /有效/);
const meetingChoices = { 'trial-guide': 'handoff', 'demo-access': 'handoff', 'release-date': 'clarify' };
const meetingRouted = meetingReview.review.items.reduce((state, item) =>
  W.updateRouting(state, item.id, meetingChoices[item.id], meeting), readyForReview);
assert.throws(() => W.buildPrompt(meetingRouted, 2, meeting, meeting.sampleInput), /先确认/);
const meetingReviewed = W.confirmRouting(meetingRouted, meeting);
assert.equal(W.currentStep(meetingReviewed), 2);
assert.equal(W.isComplete(meetingReviewed), false);
assert.equal(meetingReviewed.routing.previousBrief, '');
const reviewOutput = meetingReviewed.steps[1].output;
const [meetingHandoffs, meetingRequests] = reviewOutput.split('\n\n## 待确认事项');
assert.match(meetingHandoffs, /^## 可交接待办/);
assert.match(meetingHandoffs, /检查演示账号/);
assert.match(meetingHandoffs, /12 月 4 日 12:00/);
assert.doesNotMatch(meetingHandoffs, /确认发布排期/);
assert.match(meetingRequests, /确认发布排期/);

const finalPrompt = W.buildPrompt(meetingReviewed, 2, meeting, meeting.sampleInput);
assert.ok(finalPrompt.startsWith(deliver.prompt));
assert.ok(finalPrompt.includes(reviewOutput));
assert.ok(finalPrompt.includes(extract.example));
assert.ok(!finalPrompt.includes(meeting.sampleInput));
assert.deepEqual(W.promptInputs(meetingReviewed, 2, meeting, meeting.sampleInput).map(input => input.output), [reviewOutput, extract.example]);
const deliveryReply = '## 可交接\n\n- M01 何琳于 12 月 3 日 17:00 前更新说明。\n- M02 陈宇于 12 月 4 日 12:00 前发检查结果。\n\n## 待确认\n\n- M03 请项目经理确认负责人。';
const meetingDelivery = W.updateOutput(meetingReviewed, 2, deliveryReply, meeting);
const meetingComplete = W.confirm(meetingDelivery, 2, meeting);
assert.equal(W.isComplete(meetingComplete), true);
assert.deepEqual(W.restore(JSON.parse(JSON.stringify(meetingComplete)), meeting), meetingComplete);

const changedReview = W.updateRouting(meetingComplete, 'release-date', 'handoff', meeting);
assert.notEqual(changedReview.steps[1].output, reviewOutput);
assert.equal(changedReview.steps[2].status, 'pending');
assert.equal(changedReview.steps[2].output, deliveryReply);
assert.throws(() => W.buildPrompt(changedReview, 2, meeting), /先确认/);
const resumedDelivery = W.confirmRouting(changedReview, meeting);
assert.equal(W.currentStep(resumedDelivery), 2);
assert.equal(resumedDelivery.steps[2].status, 'pending');
assert.equal(W.updateOutput(meetingComplete, 0, `${extract.example}\n补查原文。`, meeting).steps[1].status, 'pending');

const previousMeeting = { ...meetingReviewed, version: 1, steps: meetingReviewed.steps.slice(0, 2) };
assert.deepEqual(W.restore(previousMeeting, meeting), meetingReviewed);
const earlierMeeting = {
  ...previousMeeting,
  steps: [previousMeeting.steps[0], {
    ...previousMeeting.steps[1],
    output: reviewOutput.replace('也承诺在 12 月 4 日 12:00 前把检查结果发到项目群。', '也承诺在 12 月 4 日 12:00 前给出检查结果。')
  }]
};
assert.notEqual(earlierMeeting.steps[1].output, reviewOutput);
assert.deepEqual(W.restore(earlierMeeting, meeting), meetingReviewed);
assert.deepEqual(W.restore({ ...previousMeeting, steps: meetingRouted.steps.slice(0, 2), routing: meetingRouted.routing }, meeting), meetingRouted);
assert.deepEqual(W.restore({ ...meetingBlank, version: 1, steps: meetingBlank.steps.slice(0, 2) }, meeting), meetingBlank);
assert.throws(() => W.restore({ ...previousMeeting, version: 2 }, meeting), /不匹配/);
assert.throws(() => W.restore({ ...meetingComplete, version: 1 }, meeting), /不匹配/);
assert.throws(() => W.restore({ ...previousMeeting, steps: [...previousMeeting.steps].reverse() }, meeting), /步骤记录无效/);
assert.throws(() => W.restore({ workflowId: previousMeeting.workflowId, version: 1, steps: previousMeeting.steps }, meeting), /缺少审核决定/);

restoredBackup.workflows[meeting.id] = { record: previousMeeting, updatedAt: backup.updatedAt };
const upgradedBackup = K.normalizeState(JSON.parse(JSON.stringify(restoredBackup)), content, { strict: true });
assert.deepEqual(upgradedBackup.workflows[meeting.id], { record: meetingReviewed, updatedAt: backup.updatedAt });
assert.deepEqual(upgradedBackup.workflows[workflow.id], restoredBackup.workflows[workflow.id]);
restoredBackup.workflows[meeting.id] = { record: meetingComplete, updatedAt: backup.updatedAt };
const restoredCatalog = K.normalizeState(JSON.parse(JSON.stringify(restoredBackup)), content, { strict: true });
assert.deepEqual(restoredCatalog.workflows, restoredBackup.workflows);
assert.throws(() => K.normalizeState({ ...backup, workflows: restoredCatalog.workflows }, content, { strict: true }), /两种工作流记录/);
assert.throws(() => K.normalizeState({ ...restoredBackup, workflows: { [workflow.id]: restoredCatalog.workflows[meeting.id] } }, content, { strict: true }), /不匹配/);

console.log('workflow tests passed');
