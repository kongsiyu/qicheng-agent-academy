/* Assemble the authored cases into the shared conversational lesson flow. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./tutor-content.js'), [
      ...require('./tutor-courses-office.js'),
      ...require('./tutor-courses-analysis.js'),
      ...require('./tutor-courses-skills.js')
    ]);
  } else {
    root.AcademyTutorCatalog = factory(root.AcademyTutorContent, [
      ...root.AcademyTutorOfficeCourses, ...root.AcademyTutorAnalysisCourses, ...root.AcademyTutorSkillsCourses
    ]);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (meeting, cases) {
  'use strict';

  const stages = [
    { title: '看一遍', description: '看示范，用一条新记录检查理解。' },
    { title: '跟着做', description: '根据材料给出一条规则或做出判断。' },
    { title: '找错并追问', description: '对照原文找出问题，告诉 Agent 怎么改。' },
    { title: '换一份独立做', description: '用新材料交付自己的结果。' }
  ];
  const introLabels = ['了解课程目标', '学习处理原则', '对照资料与成果', '看看怎么交代任务', '看教练如何核对', '换材料检查理解'];
  const order = ['intro', 'purpose', 'demo-result', 'demo-request', 'demo-verify', 'check', 'guided', 'review', 'independent', 'complete'];
  const assessment = {
    check: '理解检查', guided: '跟着做', review: '找错并追问', independent: '独立练习'
  };
  const completed = { guided: 1, review: 2, independent: 3, complete: 4 };
  const nextActions = {
    intro: '先看课程方法', purpose: '看看示范', 'demo-result': '看看怎么交代任务',
    'demo-request': '看看怎么核对', 'demo-verify': '换份材料试一题'
  };
  const hints = {
    check: '用自己的话回答这道题…', guided: '写下你的做法或交代给 Agent 的要求…',
    review: '指出问题，告诉 Agent 怎么改…', independent: '用新材料写出你的答案…',
    complete: '还可以回顾这门课…'
  };
  const hintAction = {label: '给个提示', value: '给个提示'};
  const acknowledge = /^(?:我)?(?:好(?:的|了)?|明白(?:了)?|懂(?:了)?|了解(?:了)?|知道(?:了)?|继续|开始(?:练习)?|下一步|准备好了|可以(?:了)?|没问题|完成了|ok)$/i;
  const help = /^(?:可以|请|能不能)?\s*(?:给.{0,4}提示|提示一下|提示|我不会|不知道怎么|怎么写|帮帮我|求助)[吧吗呀？?。！!\s]*$/;
  const shortcut = label => ({label, value: label});

  function makeCourse(lesson) {
    const {slug, title, summary, goal, principle, demo} = lesson;
    const lessons = {
      intro: '## ' + title + '\n\n' + goal + '\n\n先看一个例子，再换一份材料自己试。',
      purpose: '**做这类任务时，先记住这条原则。**\n\n' + principle,
      'demo-result': '**示范材料**\n\n' + demo.source + '\n\n**示范成果**\n\n' + demo.output,
      'demo-request': '**可以这样向 Agent 交代任务。**\n\n> ' + demo.request.split('\n').join('\n> '),
      'demo-verify': '**拿到回答后，回到原文核对。**\n\n' + demo.explanation,
      complete: '**这门课已完成。**\n\n你已经用新材料练习了「' + title + '」。可以回顾刚才的反馈，或继续提问。'
    };
    for (const phase of Object.keys(assessment)) {
      const activity = lesson[phase];
      lessons[phase] = '**' + assessment[phase] + '**\n\n' + activity.source +
        (activity.draft ? '\n\n**待核对的草稿**\n\n' + activity.draft : '') + '\n\n' + activity.question;
    }
    const phaseActions = phase => nextActions[phase] ? [shortcut(nextActions[phase])]
      : Object.hasOwn(assessment, phase) ? [{...hintAction}] : [];
    const nextPhase = phase => {
      const index = order.indexOf(phase);
      return index < 0 ? undefined : order[index + 1];
    };

    function reply(phase, text) {
      const message = text.trim();
      const advance = nextActions[phase] && (message === nextActions[phase] || acknowledge.test(message.replace(/[。！!\s]+$/g, '')));
      const destination = advance ? nextPhase(phase) : phase;
      const feedback = help.test(message) && Object.hasOwn(assessment, phase)
        ? lesson[phase].hint : lessons[destination];
      return {phase: destination, text: feedback, actions: phaseActions(destination)};
    }

    return {
      id: slug + '-tutor', slug, title, summary, stages,
      chat: {
        opening: {text: lessons.intro, actions: phaseActions('intro')},
        progress: phase => order.includes(phase) ? completed[phase] ?? 0 : undefined,
        position(phase) {
          const index = order.indexOf(phase);
          if (index < 0 || index >= introLabels.length) return undefined;
          return {current: index + 1, total: introLabels.length, label: introLabels[index]};
        },
        inputHint: phase => hints[phase] || '可以就刚才的示范提问…',
        isAssessment: phase => Object.hasOwn(assessment, phase),
        nextPhase, phaseActions, reply,
        phaseIntro: phase => lessons[phase] || '',
        artifactContext: () => '',
        phaseAfterArtifact: () => '',
        modelNextPhase(phase, text, advance, scripted) {
          const destination = nextPhase(phase);
          if (!destination || help.test(text.trim())) return phase;
          if (scripted.phase === destination) return destination;
          const answer = text.trim().replace(/[\s，。！？、,.!?]+/g, '');
          if (!Object.hasOwn(assessment, phase) || !advance || !answer || acknowledge.test(answer)) return phase;
          if (/^(?:我不懂|我想问|请解释)|(?:啥意思|什么意思|我该怎么做)[？?]?$/.test(text.trim())) return phase;
          return destination;
        },
        modelContext(phase) {
          const activity = Object.hasOwn(assessment, phase) ? lesson[phase] : null;
          return [
            '你是启程的中文 AI 教练，正在教「' + title + '」。这是一门使用虚构办公材料的练习。语气友好，直接回答学员当下的问题。',
            '课程目标：' + goal,
            '处理原则：' + principle,
            '当前环节展示给学员的内容：\n' + lessons[phase],
            activity ? '教练判断依据：' + activity.criteria : '',
            activity ? '学员求助或单纯确认听懂时将 advance 置为 false。学员作答时，把当前题目中此前的学员回答与本轮补答合起来看，以学员最新的修正为准。学员已经答对的内容不用再问。符合判断依据时，将 advance 设为 true，用一句话确认做对了什么，接下来由网页显示下一道练习。格式和礼貌用语可自由发挥。若有遗漏，只指出最重要的一处并让学员补上。'
              : '当前是讲解或回顾。学员的问题请直接回答，advance 设为 false。',
            activity ? '先逐项核对学员实际上写出的内容。教练在反馈里补充的内容不能算作学员答案。任何必需项缺失、与原文冲突，或 text 仍要求学员补写时，advance 必须为 false。判断依据标为选填的内容不影响推进。' : '',
            '引用本题材料时保留原有数字、日期和编号。避免把别的题目与当前材料混在一起。text 写具体反馈或提示，artifact 返回空字符串。'
          ].filter(Boolean).join('\n\n');
        }
      }
    };
  }

  const courseOrder = ['chat-change', 'customer-email', 'weekly-report', 'customer-feedback', 'expense-policy', 'conversion-rate', 'supplier-quotes', 'fact-review', 'clarify-requirements', 'prompt-testing'];
  const bySlug = new Map(cases.map(lesson => [lesson.slug, lesson]));
  return [
    {
      ...meeting, slug: 'meeting', title: '从会议记录整理待办', chatTitle: meeting.title,
      summary: '用新会议记录做出一份可交接的待办清单。写清负责人和期限，给缺失信息留出确认位置。'
    },
    ...courseOrder.map(slug => makeCourse(bySlug.get(slug)))
  ];
});
