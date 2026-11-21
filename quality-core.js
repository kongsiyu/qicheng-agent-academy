/* Evidence records and project gates. These checks establish completeness, never certify competence. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgentQualityCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var KINDS = ['practice', 'pretest', 'baseline', 'normal', 'missing', 'conflict', 'independent', 'transfer', 'delayed', 'assistant', 'automation-normal', 'automation-missing', 'automation-duplicate'];
  var PACK_KEYS = ['choice', 'materials', 'instruction', 'rubric', 'recovery', 'handoff'];
  var CHECK_KEYS = ['facts', 'sources', 'complete', 'boundary'];
  var TIME_KEYS = ['manual', 'prepare', 'operate', 'wait', 'review', 'rework', 'setup'];
  var MAX_BYTES = 4 * 1024 * 1024;
  var SKILL_NAMES = ['任务选择', '概念辨析', '需求说明', '资料与上下文', '人机协作', '工具与权限', '验收与纠错', '复用与收益'];
  var TEXT_LIMITS = { input: 100000, instruction: 30000, output: 200000, sourceCheck: 20000, correction: 20000, decision: 20000, adaptation: 20000, notes: 20000 };
  var DRAFT_KEYS = ['taskId', 'kind', 'date', 'context'].concat(Object.keys(TEXT_LIMITS), ['support', 'checks', 'timing', 'ratings']);
  var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var isObject = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null); };
  var copy = function (v) { return JSON.parse(JSON.stringify(v)); };
  var enough = function (v, n) { return typeof v === 'string' && v.trim().length >= n; };
  function today() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()), fields = {};
    parts.forEach(function (p) { fields[p.type] = p.value; });
    return fields.year + '-' + fields.month + '-' + fields.day;
  }
  function validDay(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }
  function validISO(v) { return typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && validDay(v.slice(0, 10)) && Number.isFinite(Date.parse(v)); }
  function dayNumber(v) { return Date.parse(v + 'T00:00:00Z') / 86400000; }
  function addDays(v, n) { return new Date((dayNumber(v) + n) * 86400000).toISOString().slice(0, 10); }
  function taskIds(content) { return ((content && content.tasks) || []).map(function (t) { return t.id; }); }
  function blankDraft(taskId) {
    var draft = { taskId: taskId || 'meeting', kind: 'normal', date: today(), context: 'teaching' };
    Object.keys(TEXT_LIMITS).forEach(function (k) { draft[k] = ''; });
    draft.support = 'guided'; draft.checks = {}; draft.timing = {}; draft.ratings = {};
    CHECK_KEYS.forEach(function (k) { draft.checks[k] = false; });
    TIME_KEYS.forEach(function (k) { draft.timing[k] = null; });
    SKILL_NAMES.forEach(function (_, i) { draft.ratings['s' + (i + 1)] = 0; });
    return draft;
  }
  function createLearning(content) {
    var ids = taskIds(content), main = ids.indexOf('meeting') >= 0 ? 'meeting' : ids[0] || 'meeting', pack = {};
    PACK_KEYS.forEach(function (k) { pack[k] = ''; });
    return { mainTaskId: main, packTaskId: main, pack: pack, draft: blankDraft(main), runs: [], diagnostics: {}, withdrawnRunIds: [] };
  }
  function guardTree(value) {
    var active = new WeakSet(), count = 0, characters = 0;
    function visit(v, depth) {
      if (++count > 150000 || depth > 12) throw new Error('学习证据过大或层级过深。');
      if (typeof v === 'string') {
        if (v.length > 200000) throw new Error('学习证据文本过长。');
        characters += v.length;
        if (characters > MAX_BYTES) throw new Error('学习证据超过 4 MiB，请先导出并整理记录。');
      }
      if (v === null || typeof v !== 'object') return;
      if ((!Array.isArray(v) && !isObject(v)) || active.has(v)) throw new Error('学习证据包含无效对象或循环引用。');
      active.add(v);
      Object.keys(v).forEach(function (k) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw new Error('学习证据包含不允许的字段。');
        var d = Object.getOwnPropertyDescriptor(v, k);
        if (d.get || d.set) throw new Error('学习证据包含动态字段。');
        visit(d.value, depth + 1);
      });
      active.delete(v);
    }
    visit(value, 0);
  }
  function assertSize(value) {
    var text = JSON.stringify(value), bytes = 0;
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code < 128) bytes++;
      else if (code < 2048) bytes += 2;
      else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) { bytes += 4; i++; }
      else bytes += 3;
      if (bytes > MAX_BYTES) throw new Error('学习证据超过 4 MiB，请先导出并整理记录；本次没有写入新存档。');
    }
  }
  function assertKeys(v, expected, label) {
    if (!isObject(v)) throw new Error(label + '格式无效。');
    Object.keys(v).forEach(function (k) { if (expected.indexOf(k) < 0) throw new Error(label + '含未知字段：' + k); });
    expected.forEach(function (k) { if (!own(v, k)) throw new Error(label + '缺少字段：' + k); });
  }
  function assertDraft(draft, content, archived) {
    assertKeys(draft, archived ? DRAFT_KEYS.concat(['id', 'createdAt']) : DRAFT_KEYS, '练习记录');
    if (taskIds(content).indexOf(draft.taskId) < 0) throw new Error('练习任务不存在。');
    if (KINDS.indexOf(draft.kind) < 0) throw new Error('练习案例类型无效。');
    if (!validDay(draft.date) && (archived || draft.date !== '')) throw new Error('练习日期无效。');
    if (draft.context !== 'teaching' && draft.context !== 'work') throw new Error('练习资料情境无效。');
    if (draft.support !== 'guided' && draft.support !== 'independent') throw new Error('练习支持方式无效。');
    Object.keys(TEXT_LIMITS).forEach(function (k) { if (typeof draft[k] !== 'string' || draft[k].length > TEXT_LIMITS[k]) throw new Error('练习字段 ' + k + ' 超长或格式无效。'); });
    assertKeys(draft.checks, CHECK_KEYS, '验收检查');
    CHECK_KEYS.forEach(function (k) { if (typeof draft.checks[k] !== 'boolean') throw new Error('验收检查必须为勾选状态。'); });
    assertKeys(draft.timing, TIME_KEYS, '时间账');
    TIME_KEYS.forEach(function (k) { var n = draft.timing[k]; if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 10080)) throw new Error('时间账应为 0 至 10080 的分钟数，未记录使用 null。'); });
    var ratingIds = SKILL_NAMES.map(function (_, i) { return 's' + (i + 1); });
    assertKeys(draft.ratings, ratingIds, '能力自评');
    ratingIds.forEach(function (k) { if (!Number.isInteger(draft.ratings[k]) || draft.ratings[k] < 0 || draft.ratings[k] > 2) throw new Error('能力自评只能为 0、1、2。'); });
    if (archived && (typeof draft.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(draft.id) || !validISO(draft.createdAt))) throw new Error('运行存档标识或时间无效。');
  }
  function normalizeLearning(raw, content, options) {
    try {
      guardTree(raw);
      assertSize(raw);
      assertKeys(raw, ['mainTaskId', 'packTaskId', 'pack', 'draft', 'runs', 'diagnostics', 'withdrawnRunIds'], '学习证据');
      if (taskIds(content).indexOf(raw.mainTaskId) < 0) throw new Error('主线任务不存在。');
      if (taskIds(content).indexOf(raw.packTaskId) < 0) throw new Error('任务包归属任务不存在。');
      assertKeys(raw.pack, PACK_KEYS, '岗位任务包');
      PACK_KEYS.forEach(function (k) { if (typeof raw.pack[k] !== 'string' || raw.pack[k].length > 30000) throw new Error('任务包内容超长或格式无效。'); });
      assertDraft(raw.draft, content, false);
      if (!Array.isArray(raw.runs) || raw.runs.length > 500) throw new Error('运行存档应为不超过 500 条的列表。');
      var ids = new Set();
      raw.runs.forEach(function (run) {
        assertDraft(run, content, true);
        if (ids.has(run.id)) throw new Error('运行存档 ID 重复。');
        ids.add(run.id);
        if (run.date > today()) throw new Error('运行存档不可使用未来日期。');
        // Changing the selected main task must not invalidate a historical snapshot.
        // Its eligibility for today's project is recomputed in getQualityStats.
        var problems = validateRun(run, content, { mainTaskId: '' });
        if (problems.length) throw new Error('运行存档未满足保存要求：' + problems[0]);
      });
      if (!Array.isArray(raw.withdrawnRunIds) || raw.withdrawnRunIds.length > raw.runs.length) throw new Error('撤回记录格式无效。');
      var withdrawn = new Set();
      raw.withdrawnRunIds.forEach(function (id) {
        if (typeof id !== 'string' || !ids.has(id) || withdrawn.has(id)) throw new Error('撤回记录包含未知或重复的运行 ID。');
        withdrawn.add(id);
      });
      if (!isObject(raw.diagnostics)) throw new Error('辨错练习记录格式无效。');
      Object.keys(raw.diagnostics).forEach(function (taskId) {
        var practice = content && content.practice && content.practice[taskId], items = practice && practice.diagnose && practice.diagnose.items;
        if (taskIds(content).indexOf(taskId) < 0 || !Array.isArray(items)) throw new Error('辨错练习任务不存在。');
        var entry = raw.diagnostics[taskId];
        assertKeys(entry, ['answers', 'submitted'], '辨错练习');
        if (typeof entry.submitted !== 'boolean' || !isObject(entry.answers)) throw new Error('辨错练习答案格式无效。');
        Object.keys(entry.answers).forEach(function (id) {
          if (!items.some(function (item) { return item.id === id; }) || ['accept', 'fix', 'ask'].indexOf(entry.answers[id]) < 0) throw new Error('辨错练习包含无效题目或答案。');
        });
      });
      return copy(raw);
    } catch (error) {
      if (options && options.strict) throw error;
      return createLearning(content);
    }
  }
  function validateRun(draft, content, learning) {
    var problems = [];
    try { guardTree(draft); assertDraft(draft, content, own(draft || {}, 'id')); } catch (error) { return [error.message]; }
    if (!validDay(draft.date)) problems.push('请填写实际执行日期。');
    if (draft.date > today()) problems.push('请记录实际执行日期，不能使用未来日期。');
    if (draft.kind === 'pretest' || draft.kind === 'baseline') {
      var label = draft.kind === 'pretest' ? '学前 Agent 尝试' : '人工原流程基线';
      ['input', 'instruction', 'output'].forEach(function (k) { if (!enough(draft[k], 10)) problems.push(label + '的资料、任务说明和输出均需至少 10 个字符。'); });
      return problems;
    }
    if (draft.kind === 'practice') {
      if (!enough(draft.input, 10)) problems.push('请记录练习资料，至少 10 个字符。');
      if (!enough(draft.instruction, 10)) problems.push('请记录练习任务说明，至少 10 个字符。');
      if (!enough(draft.output, 20)) problems.push('请记录练习实际输出，至少 20 个字符。');
      if (draft.support !== 'guided') problems.push('普通练习按有引导练习保存；独立表现请使用相应项目验收。');
      return problems;
    }
    if (!enough(draft.input, 10)) problems.push('请记录实际资料，至少 10 个字符。');
    if (!enough(draft.instruction, 20)) problems.push('请记录实际任务说明，至少 20 个字符。');
    if (!enough(draft.output, 20)) problems.push('请记录实际输出，至少 20 个字符。');
    if (!enough(draft.sourceCheck, 10)) problems.push('请记录一条关键结论、对应资料依据和实际核查结果，至少 10 个字符。');
    if ((draft.kind === 'missing' || draft.kind === 'conflict' || draft.kind.indexOf('automation-') === 0) && !enough(draft.decision, 10)) problems.push('请记录资料缺口、冲突或流程写入的具体处理及人工确认依据，至少 10 个字符。');
    if (!CHECK_KEYS.every(function (k) { return draft.checks[k]; })) problems.push('请完成事实、来源、完整性与边界四项自检。');
    if (draft.kind === 'transfer' || draft.kind === 'delayed') {
      if (!learning || draft.taskId === learning.mainTaskId) problems.push('迁移与延后复验请选择主线之外的第二项任务。');
      if (!enough(draft.adaptation, 10)) problems.push('请说明新场景中调整了哪些资料、要求或验收方法，至少 10 个字符。');
    }
    if ((draft.kind === 'assistant' || draft.kind.indexOf('automation-') === 0) && !enough(draft.notes, 30)) problems.push('选修项目需记录实际测试结果与过程，至少 30 个字符。');
    return problems;
  }
  function archiveRun(learning, content) {
    var clean = normalizeLearning(learning, content, { strict: true });
    var errors = validateRun(clean.draft, content, clean);
    if (errors.length) throw new Error(errors.join('\n'));
    if (clean.runs.length >= 500) throw new Error('已达 500 条运行存档上限，请先导出备份。');
    var run = copy(clean.draft), prefix = 'run-' + Date.now().toString(36), suffix = 1;
    run.id = prefix;
    while (clean.runs.some(function (item) { return item.id === run.id; })) run.id = prefix + '-' + suffix++;
    run.createdAt = new Date().toISOString();
    clean.runs.push(run);
    assertSize(clean);
    learning.runs.push(copy(run));
    return run;
  }
  function getTimeSummary(run) {
    var t = run && run.timing || {}, complete = TIME_KEYS.every(function (k) { return typeof t[k] === 'number' && Number.isFinite(t[k]) && t[k] >= 0 && t[k] <= 10080; });
    if (!complete) return { complete: false, manual: null, active: null, elapsed: null, netActive: null, netElapsed: null, setup: typeof t.setup === 'number' && Number.isFinite(t.setup) && t.setup >= 0 && t.setup <= 10080 ? t.setup : null };
    var active = t.prepare + t.operate + t.review + t.rework;
    return { complete: true, manual: t.manual, active: active, elapsed: active + t.wait, netActive: t.manual - active, netElapsed: t.manual - active - t.wait, setup: t.setup };
  }
  function getQualityStats(state, content) {
    var learning = normalizeLearning(state && state.learning || createLearning(content), content), main = learning.mainTaskId;
    var accepted = learning.runs.filter(function (run) { return ['practice', 'pretest', 'baseline'].indexOf(run.kind) < 0 && learning.withdrawnRunIds.indexOf(run.id) < 0 && validateRun(run, content, learning).length === 0; });
    var mainRuns = accepted.filter(function (run) { return run.taskId === main && ['normal', 'missing', 'conflict', 'independent'].indexOf(run.kind) >= 0; });
    function mainKind(kind) { return mainRuns.some(function (run) { return run.kind === kind; }); }
    function week(id, missing) { return { id: id, done: missing.length === 0, missing: missing }; }
    var missing1 = [], missing2 = [], missing3 = [], missing4 = [], missing5 = [], missing6 = [];
    if (learning.packTaskId !== main) missing1.push('当前任务包属于另一项任务，请调整内容并明确更新归属。');
    if (!enough(learning.pack.choice, 10)) missing1.push('记录为何选择这个主线任务（至少 10 个字符）。');
    if (!mainKind('normal')) missing1.push('保存一次主线任务的正常案例验收记录。');
    [['normal', '正常'], ['missing', '资料缺失'], ['conflict', '冲突或重复']].forEach(function (pair) { if (!mainKind(pair[0])) missing2.push('保存主线任务的' + pair[1] + '案例验收记录。'); });
    var inputSets = ['normal', 'missing', 'conflict'].map(function (kind) {
      return Array.from(new Set(mainRuns.filter(function (run) { return run.kind === kind; }).map(function (run) { return run.input.trim(); })));
    });
    if (inputSets.every(function (inputs) { return inputs.length > 0; })) {
      var threeInputs = inputSets[0].some(function (normal) {
        return inputSets[1].some(function (missing) {
          return normal !== missing && inputSets[2].some(function (conflict) { return conflict !== normal && conflict !== missing; });
        });
      });
      if (!threeInputs) missing2.push('正常、资料缺失、冲突或重复三类案例需要三份不同的实际输入；仅更改案例名称不计。');
    }
    var packLabels = { choice: '任务选择理由', materials: '资料清单', instruction: '任务说明', rubric: '验收表', recovery: '异常处理说明', handoff: '他人用新资料按任务包操作后的反馈' };
    if (learning.packTaskId !== main) missing3.push('调整旧任务包的资料、任务说明和验收要求后，明确将归属更新为当前主线任务。');
    PACK_KEYS.forEach(function (k) { if (!enough(learning.pack[k], 10)) missing3.push('补充' + packLabels[k] + '（至少 10 个字符）。'); });
    if (!mainKind('normal')) missing3.push('保存正常案例验收记录。');
    if (!mainKind('missing')) missing3.push('保存资料缺失案例验收记录。');
    var independent = mainRuns.filter(function (run) { return run.kind === 'independent' && run.support === 'independent'; }).sort(function (a, b) { return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt); });
    if (!independent.length) missing4.push('撤去课程提示，保存主线任务的独立结课记录。');
    if (!accepted.some(function (run) { return run.kind === 'transfer' && run.taskId !== main && run.support === 'independent'; })) missing4.push('独立将方法迁移到第二项任务，记录调整和实际成果。');
    var workRuns = mainRuns.filter(function (run) { return run.context === 'work'; });
    var actualDates = Array.from(new Set(workRuns.map(function (run) { return run.date; }))).sort();
    if (actualDates.length < 2 || dayNumber(actualDates[actualDates.length - 1]) - dayNumber(actualDates[0]) < 6) missing4.push('在至少两个真实工作日期使用主线方法，首末记录覆盖至少 7 个日历日；教学材料不计，这不代表每天连续使用。');
    if (!workRuns.some(function (run) { return getTimeSummary(run).complete; })) missing4.push('为至少一次真实主线工作记录完整时间账，包括核查、返工和一次性投入（没有则填 0）。');
    if (!accepted.some(function (run) { return run.kind === 'assistant'; })) missing5.push('保存定制助手实测，记录正常、资料无答案、超出边界三类问题及实际结果。');
    [['automation-normal', '正常'], ['automation-missing', '缺字段'], ['automation-duplicate', '重复输入']].forEach(function (pair) {
      if (!accepted.some(function (run) { return run.kind === pair[0]; })) missing6.push('保存自动化' + pair[1] + '测试，记录触发、字段映射、人工审核、写入和日志。');
    });
    var weeks = [week('w1', missing1), week('w2', missing2), week('w3', missing3), week('w4', missing4), week('w5', missing5), week('w6', missing6)];
    var dueDate = independent.length ? addDays(independent[0].date, 7) : null, delayedMissing = [];
    if (!dueDate) delayedMissing.push('先保存主线任务的独立结课记录，才能安排一周后的复验。');
    else {
      if (today() < dueDate) delayedMissing.push('延后复验最早可在 ' + dueDate + ' 使用新资料完成。');
      if (!accepted.some(function (run) { return run.kind === 'delayed' && run.taskId !== main && run.support === 'independent' && run.date >= dueDate; })) delayedMissing.push('在到期日或之后独立完成第二任务的延后复验，并说明场景调整。');
    }
    var skills = SKILL_NAMES.map(function (name, i) {
      var id = 's' + (i + 1), evidence = accepted.filter(function (run) { return run.ratings[id] > 0; });
      var level = evidence.reduce(function (max, run) { return Math.max(max, Math.min(run.ratings[id], run.support === 'guided' ? 1 : 2)); }, 0);
      return { id: id, name: name, level: level, evidenceCount: evidence.length };
    });
    var goal = ((content && content.goals) || []).find(function (g) { return state && state.profile && g.id === state.profile.goalId; });
    var count = goal && goal.weeks > 4 ? 6 : 4;
    return { weeks: weeks, skills: skills, projectPercent: Math.round(weeks.slice(0, count).filter(function (w) { return w.done; }).length / count * 100), delayed: { dueDate: dueDate, done: delayedMissing.length === 0, missing: delayedMissing }, mainTaskId: main };
  }
  return { createLearning: createLearning, blankDraft: blankDraft, normalizeLearning: normalizeLearning, validateRun: validateRun, archiveRun: archiveRun, getQualityStats: getQualityStats, getTimeSummary: getTimeSummary };
});
