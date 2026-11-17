/* Client-only learning state, validation and progress. No network or storage side effects. */
(function (root, factory) {
  'use strict';
  var quality = typeof module === 'object' && module.exports ? require('./quality-core.js') : root.AgentQualityCore;
  var api = factory(root, quality);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgentLearningCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, Q) {
  'use strict';
  var VERSION = 2;
  var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var badKey = function (k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; };
  var isObject = function (o) { return o !== null && typeof o === 'object' && !Array.isArray(o) && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null); };
  var nowISO = function () { return new Date().toISOString(); };
  function dateAt(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
      var fields = {};
      parts.forEach(function (p) { fields[p.type] = p.value; });
      return fields.year + '-' + fields.month + '-' + fields.day;
    } catch (error) { return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
  }
  function today() { return dateAt(new Date()); }
  function formatDate(iso) {
    if (typeof iso !== 'string' || !iso) return '—';
    var day = validDay(iso) ? iso : dateAt(iso);
    if (!day) return '—';
    return Number(day.slice(5, 7)) + '月' + Number(day.slice(8, 10)) + '日';
  }
  function validDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var d = new Date(value + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }
  function validISO(value) {
    return typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
  }
  function contentOf(content) {
    var c = content || (root && root.AgentCourseContent) || {};
    return { goals: Array.isArray(c.goals) ? c.goals : [], lessons: Array.isArray(c.lessons) ? c.lessons : [], tasks: Array.isArray(c.tasks) ? c.tasks : [], modules: Array.isArray(c.modules) ? c.modules : [], practice: isObject(c.practice) ? c.practice : {} };
  }
  function defaultGoal(c) { return c.goals.find(function (g) { return g.id === 'starter'; }) || c.goals[0] || { id: 'starter', title: '完成学习主线', targetTasks: 3, targetLessons: 12, weeks: 4 }; }
  function blankTask(task) {
    var checks = {};
    (task.criteria || []).forEach(function (criterion) { if (!badKey(criterion.id)) checks[criterion.id] = false; });
    return { mode: 'example', input: '', output: '', notes: '', checks: checks, checkpoint: 0, exampleSeen: false, completedAt: null, savedAt: null };
  }
  function createState(content) {
    var c = contentOf(content), stamp = nowISO(), tasks = {};
    c.tasks.forEach(function (task) { if (!badKey(task.id)) tasks[task.id] = blankTask(task); });
    return { schemaVersion: VERSION, createdAt: stamp, updatedAt: stamp, profile: { goalId: defaultGoal(c).id, role: '通用办公', weeklyMinutes: 180, startedAt: today() }, lessons: {}, tasks: tasks, activities: [], learning: Q.createLearning(c) };
  }
  function guardTree(value) {
    var count = 0, active = new WeakSet();
    function visit(v, depth) {
      if (++count > 150000 || depth > 12) throw new Error('备份数据过大或层级过深。');
      if (typeof v === 'string' && v.length > 200000) throw new Error('备份中有过长的文本。');
      if (v === null || typeof v !== 'object') return;
      if ((!Array.isArray(v) && !isObject(v)) || active.has(v)) throw new Error('备份包含无效对象或循环引用。');
      active.add(v);
      Object.keys(v).forEach(function (key) {
        if (badKey(key)) throw new Error('备份包含不允许的字段：' + key);
        var descriptor = Object.getOwnPropertyDescriptor(v, key);
        if (descriptor.get || descriptor.set) throw new Error('备份包含不允许的动态字段。');
        visit(descriptor.value, depth + 1);
      });
      active.delete(v);
    }
    visit(value, 0);
  }
  function normalizeState(raw, content, options) {
    var c = contentOf(content), clean = createState(c), strict = !!(options && options.strict);
    function fail(message) { if (strict) throw new Error(message); return false; }
    function keys(object, allowed, label, required) {
      if (!isObject(object)) return fail(label + '格式无效。');
      Object.keys(object).forEach(function (key) { if (allowed.indexOf(key) < 0) fail(label + '含未知字段：' + key); });
      (required || []).forEach(function (key) { if (!own(object, key)) fail(label + '缺少字段：' + key); });
      return true;
    }
    function text(value, fallback, limit, label) {
      if (typeof value !== 'string' || value.length > limit) { fail(label + '必须为不超过 ' + limit + ' 字的文本。'); return fallback; }
      return value;
    }
    function timestamp(value, fallback, label, nullable) {
      if (nullable && value === null) return null;
      if (!validISO(value)) { fail(label + '时间格式无效。'); return fallback; }
      return value;
    }
    try {
      guardTree(raw);
      if (!isObject(raw) || (raw.schemaVersion !== 1 && raw.schemaVersion !== VERSION)) { fail('不支持此备份版本，请使用版本 1 或 2 的备份。'); return clean; }
      var topFields = ['schemaVersion', 'createdAt', 'updatedAt', 'profile', 'lessons', 'tasks', 'activities'];
      if (raw.schemaVersion === VERSION) topFields.push('learning');
      if (!keys(raw, topFields, '备份', topFields)) return clean;
      clean.createdAt = timestamp(raw.createdAt, clean.createdAt, '创建');
      clean.updatedAt = timestamp(raw.updatedAt, clean.updatedAt, '更新');
      var p = raw.profile, profileFields = ['goalId', 'role', 'weeklyMinutes', 'startedAt'];
      if (keys(p, profileFields, '学习设置', profileFields)) {
        if (c.goals.some(function (g) { return g.id === p.goalId; }) || (c.goals.length === 0 && p.goalId === 'starter')) clean.profile.goalId = p.goalId;
        else fail('学习目标不存在。');
        clean.profile.role = text(p.role, clean.profile.role, 80, '岗位').trim() || '通用办公';
        if (Number.isInteger(p.weeklyMinutes) && p.weeklyMinutes >= 15 && p.weeklyMinutes <= 10080) clean.profile.weeklyMinutes = p.weeklyMinutes;
        else fail('每周学习时间应为 15 至 10080 的整数分钟。');
        if (validDay(p.startedAt)) clean.profile.startedAt = p.startedAt;
        else fail('开始日期无效。');
      }
      if (isObject(raw.lessons)) {
        Object.keys(raw.lessons).forEach(function (id) {
          var lesson = c.lessons.find(function (l) { return l.id === id; }), record = raw.lessons[id];
          if (!lesson) { fail('课程 ID 不存在：' + id); return; }
          var lessonFields = ['passed', 'answerIndex', 'answeredAt'];
          if (!keys(record, lessonFields, '课程记录 ' + id, lessonFields)) return;
          var quiz = lesson.quiz || {};
          if (record.passed !== true || !Number.isInteger(record.answerIndex) || record.answerIndex < 0 || !Array.isArray(quiz.options) || record.answerIndex >= quiz.options.length || record.answerIndex !== quiz.answerIndex || !validISO(record.answeredAt)) { fail('课程记录无效：' + id); return; }
          clean.lessons[id] = { passed: true, answerIndex: record.answerIndex, answeredAt: record.answeredAt };
        });
      } else fail('课程进度格式无效。');
      if (isObject(raw.tasks)) {
        Object.keys(raw.tasks).forEach(function (id) {
          var task = c.tasks.find(function (t) { return t.id === id; }), record = raw.tasks[id];
          if (!task) { fail('任务 ID 不存在：' + id); return; }
          var fields = ['mode', 'input', 'output', 'notes', 'checks', 'checkpoint', 'exampleSeen', 'completedAt', 'savedAt'];
          if (!keys(record, fields, '任务记录 ' + id, fields)) return;
          var out = blankTask(task);
          if (record.mode === 'example' || record.mode === 'practice') out.mode = record.mode;
          else fail('任务练习模式无效：' + id);
          out.input = text(record.input, '', 100000, '任务输入');
          out.output = text(record.output, '', 200000, '任务成果');
          out.notes = text(record.notes, '', 20000, '任务复盘');
          var criterionIds = (task.criteria || []).map(function (criterion) { return criterion.id; });
          if (keys(record.checks, criterionIds, '验收记录 ' + id, criterionIds)) {
            criterionIds.forEach(function (criterionId) {
              if (typeof record.checks[criterionId] === 'boolean') out.checks[criterionId] = record.checks[criterionId];
              else fail('验收项必须为勾选状态：' + criterionId);
            });
          }
          var maxCheckpoint = Math.max(0, (task.checkpoints || []).length - 1);
          if (Number.isInteger(record.checkpoint) && record.checkpoint >= 0 && record.checkpoint <= maxCheckpoint) out.checkpoint = record.checkpoint;
          else fail('任务步骤超出范围：' + id);
          if (typeof record.exampleSeen === 'boolean') out.exampleSeen = record.exampleSeen;
          else fail('示例浏览状态无效：' + id);
          out.completedAt = timestamp(record.completedAt, null, '任务完成', true);
          out.savedAt = timestamp(record.savedAt, null, '任务保存', true);
          clean.tasks[id] = out;
        });
      } else fail('任务进度格式无效。');
      if (Array.isArray(raw.activities) && raw.activities.length <= 10000) {
        raw.activities.forEach(function (activity) {
          var activityFields = ['type', 'id', 'date', 'at'];
          if (!keys(activity, activityFields, '学习记录', activityFields)) return;
          var lists = { lesson: c.lessons, task: c.tasks, goal: c.goals };
          if (!own(lists, activity.type) || !lists[activity.type].some(function (entry) { return entry.id === activity.id; }) || !validDay(activity.date) || !validISO(activity.at)) { fail('学习活动包含未知内容或无效日期。'); return; }
          clean.activities.push({ type: activity.type, id: activity.id, date: activity.date, at: activity.at });
        });
      } else fail('学习活动记录应为不超过 10000 条的数组。');
      if (raw.schemaVersion === VERSION) clean.learning = Q.normalizeLearning(raw.learning, c, { strict: true });
      // Version 1 retains its drafts and self-checks but supplies no independent evidence.
      return clean;
    } catch (error) { if (strict) throw error; return createState(c); }
  }
  function getStats(state, content) {
    var c = contentOf(content), s = normalizeState(state, c), goal = c.goals.find(function (g) { return g.id === s.profile.goalId; }) || defaultGoal(c);
    var optional = new Set(c.modules.filter(function (m) { return m.optional; }).map(function (m) { return m.id; }));
    var ordered = c.lessons.filter(function (l) { return !optional.has(l.moduleId); }).concat(c.lessons.filter(function (l) { return optional.has(l.moduleId); }));
    var requiredLessons = ordered.slice(0, Math.max(0, Number.isInteger(goal.targetLessons) ? goal.targetLessons : ordered.length));
    var passed = function (l) { return !!(s.lessons[l.id] && s.lessons[l.id].passed); };
    var completedLessons = requiredLessons.filter(passed).length;
    var completedTaskIds = c.tasks.filter(function (task) {
      var record = s.tasks[task.id];
      return record && record.mode === 'practice' && !!record.completedAt && record.output.trim().length > 0 && (task.criteria || []).every(function (criterion) { return record.checks[criterion.id] === true; });
    }).map(function (task) { return task.id; });
    var requiredTasks = Math.max(0, Number.isInteger(goal.targetTasks) ? goal.targetTasks : 3);
    var lessonPercent = requiredLessons.length ? Math.min(100, Math.round(completedLessons / requiredLessons.length * 100)) : 100;
    var taskPercent = requiredTasks ? Math.min(100, Math.round(completedTaskIds.length / requiredTasks * 100)) : 100;
    var qualityStats = Q.getQualityStats(s, c);
    return {
      goal: goal, requiredLessons: requiredLessons, completedLessons: completedLessons,
      allCompletedLessons: c.lessons.filter(passed).length, completedTasks: completedTaskIds.length,
      requiredTasks: requiredTasks, lessonPercent: lessonPercent, taskPercent: taskPercent,
      percent: Math.min(100, Math.round((lessonPercent + qualityStats.projectPercent) / 2)),
      learningDays: new Set(s.activities.map(function (activity) { return activity.date; }).concat(s.learning.runs.map(function (run) { return run.date; }))).size,
      drafts: c.tasks.filter(function (task) { var r = s.tasks[task.id]; return r && (r.input.trim() || r.output.trim()) && completedTaskIds.indexOf(task.id) < 0; }).length,
      minutes: c.lessons.filter(passed).reduce(function (sum, lesson) { return sum + (Number(lesson.minutes) || 0); }, 0),
      completedTaskIds: completedTaskIds, nextLesson: requiredLessons.find(function (lesson) { return !passed(lesson); }) || null,
      skills: qualityStats.skills, projectPercent: qualityStats.projectPercent,
      weeks: qualityStats.weeks, delayed: qualityStats.delayed
    };
  }
  return { createState: createState, normalizeState: normalizeState, getStats: getStats, today: today, formatDate: formatDate };
});
