/* Authored examples and local feedback for the meeting tutor. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AcademyTutorContent = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const stages = [
    { id: 'demo', title: '看一遍', description: '看一条会议记录怎样变成能核对的待办。' },
    { id: 'guided', title: '跟着做', description: '给 Agent 一份有明确要求的任务。' },
    { id: 'review', title: '找错并追问', description: '找出一处与会议信息不符的内容，写一句追问。' },
    { id: 'independent', title: '换一份独立做', description: '给 Agent 写一份任务说明，再用新会议记录核查结果。' }
  ];

  const demoSource = 'D01｜林然说，她会在 12 月 2 日 16:00 前把展架清单发到群里。\nD02｜主持人说，还要补一张场地图，负责人由会后确认。';
  const demoPrompt = '根据这份会议信息，为项目组整理待办。每条写清事项、负责人、期限和原文编号。资料没说的字段标为“待确认”。';
  const demoOutput = [
    '| 事项 | 负责人 | 期限 | 依据 |',
    '| --- | --- | --- | --- |',
    '| 发展架清单到群里 | 林然 | 12 月 2 日 16:00 前 | D01 |',
    '| 补一张场地图 | 待确认 | 待确认 | D02 |'
  ].join('\n');
  const transferSource = 'T01｜主持人说，指引牌需要在 12 月 5 日 14:00 前布置完。后勤组等场地确认后再安排具体人员。';
  const transferAnswer = '负责人待确认，期限是 12 月 5 日 14:00 前，依据 T01。';

  const guidedSources = [
    { id: 'G01', text: '何琳会在 12 月 3 日 17:00 前更新客户试用说明，发到项目群。' },
    { id: 'G02', text: '陈宇负责检查演示账号。等技术支持开通权限后，他再确认反馈时间。' },
    { id: 'G03', text: '发布排期需在 12 月 4 日前确认，项目经理会后指定负责人。' }
  ];
  const toSourceText = rows => rows.map(({ id, text }) => `${id}｜${text}`).join('\n');

  const guided = {
    source: toSourceText(guidedSources),
    goal: '为项目组整理一份会议待办清单。',
    fields: ['事项', '负责人', '期限', '前置条件', '原文编号'],
    ruleOptions: [
      { label: '缺少的信息标为“待确认”，保留原文编号。' },
      { label: '根据其他待办推测，把负责人和期限补齐。', feedback: '推测出的负责人和期限会被误读为会议承诺。试着让每个字段都能回到原文。' },
      { feedback: '需要跟进的事项会被一起删掉。想想怎样既保留事项，也标出缺口。' }
    ],
    hint: '看 G02。陈宇的责任已经明确。反馈时间还要等权限开通，再由陈宇确认。'
  };

  function meetingDraft(demoDeadline) {
    return [
      '| 事项 | 负责人 | 期限 | 前置条件 | 原文编号 |',
      '| --- | --- | --- | --- | --- |',
      '| 更新客户试用说明并发项目群 | 何琳 | 12 月 3 日 17:00 前 | 无已知前置条件 | G01 |',
      `| 检查演示账号 | 陈宇 | ${demoDeadline} | 等技术支持开通权限 | G02 |`,
      '| 确认发布排期 | 待确认 | 12 月 4 日前 | 项目经理会后指定负责人 | G03 |'
    ].join('\n');
  }

  const badDraft = meetingDraft('12 月 4 日 12:00 前');
  const correctedDraft = meetingDraft('待确认');
  const reviewHint = '先找谁承诺检查演示账号，再看他有没有承诺什么时候反馈。';

  const independentSources = [
    { id: 'N01', text: '周芮会在 12 月 8 日 15:00 前把供应商报价表发给采购组。' },
    { id: 'N02', text: '采购组说要更新报价对比表，具体由谁负责将在下次碰头时确认。' },
    { id: 'N03', text: '乔瑜负责核对合同模板，等法务发来最新版后再确认完成时间。' }
  ];
  const independent = {
    source: toSourceText(independentSources),
    reviewProbe: '另一份草稿把“更新报价对比表”的负责人写成了周芮。',
    hint: '先分清原文里的“发送报价表”和“更新报价对比表”，再分别核对对应的负责人。'
  };

  function reviewSource(sourceId) {
    const messages = {
      G01: 'G01 记录的是何琳发试用说明的期限。继续找陈宇说的话。',
      G02: 'G02 说权限开通后再确认时间。草稿里的 12 月 4 日 12:00 没有依据。',
      G03: 'G03 的日期对应发布排期。继续找检查演示账号的那条记录。'
    };
    return { ok: sourceId === 'G02', feedback: Object.hasOwn(messages, sourceId) ? messages[sourceId] : '先选择一条原文。' };
  }

  function runCorrection(sourceId, message) {
    const result = reviewSource(sourceId);
    if (!result.ok) return { ...result, output: '' };
    const correction = typeof message === 'string' ? message.trim() : '';
    const removesInventedTime = /(?:删除|去掉|撤回)[^。；，]{0,12}(?:期限|截止|时间|12\s*月\s*4\s*日)|(?:期限|截止|时间)[^。；，]{0,8}(?:删除|去掉|撤回)/.test(correction);
    if (!/(G02|陈宇|演示账号)/i.test(correction) || !/(期限|截止|完成时间|反馈时间|时间)/.test(correction) ||
        !(makesUnknownExplicit(correction) || removesInventedTime)) {
      return { ok: false, output: '', feedback: '试着写明要改哪一条、哪个字段，以及怎样保留未知信息。例如明确指出 G02 的反馈时间仍待确认。' };
    }
    return { ok: true, output: correctedDraft, feedback: '对照 G02 再看一次。修订后的期限标为待确认，陈宇和权限条件都保留了。' };
  }

  function makesUnknownExplicit(instruction) {
    if (/(不要|无需|不用|不必)[^，。；]{0,10}(待确认|待定|待核实|标注未知)/.test(instruction)) return false;
    return /(待确认|待定|待核实|标.*未知|未知.*标|注明.*未知|标.*未明确|不自行补|不推测|不猜|不要猜|不编造|不能杜撰|不要编|别猜|保留空白|留空)/.test(instruction);
  }

  function checkRequest(message) {
    const request = typeof message === 'string' ? message.trim() : '';
    const definesDeliverable = /(待办|行动项|跟进|任务|事项|每件事|下一步)/.test(request) && /(清单|表|逐条|每条|列出|列表|列明)/.test(request);
    const definesFields = /(负责人|责任人|执行人|责任方|经办人|谁来|谁负责|谁做)/.test(request) &&
      /(期限|截止|完成时间|时间|日期|何时|什么时候)/.test(request);
    const preservesUnknown = makesUnknownExplicit(request);
    const requiresEvidence = /(来源|依据|引用|编号|行号|回查|出处|原句|原话|证据)/.test(request);
    return [
      { label: '说清交付内容', ok: definesDeliverable && definesFields, feedback: definesDeliverable && definesFields
        ? '说明写清了要交付待办，以及如何列出负责人和期限。'
        : '写明你需要一份待办清单，并交代如何列出负责人和期限。' },
      { label: '保留缺失信息', ok: preservesUnknown, feedback: preservesUnknown
        ? '说明交代了缺失信息怎么保留。'
        : '说明资料缺少负责人或期限时怎么办，例如标为待确认。' },
      { label: '保留可核查依据', ok: requiresEvidence, feedback: requiresEvidence
        ? '说明给每条待办留出了回查入口。'
        : '请 Agent 给每条待办附可回查的原文编号或依据。' }
    ];
  }

  function runIndependent(message) {
    const checks = checkRequest(message);
    const [deliverable, unknown, evidence] = checks;
    const ok = checks.every(check => check.ok);
    if (!deliverable.ok) {
      return {
        ok, checks,
        output: '采购组接下来要跟进供应商报价、报价对比表和合同模板。',
        feedback: deliverable.feedback
      };
    }

    const rows = [
      ['把供应商报价表发给采购组', '周芮', '12 月 8 日 15:00 前', '无已知前置条件', 'N01'],
      ['更新报价对比表', unknown.ok ? '待确认' : '周芮', '待确认', '下次碰头确认负责人', 'N02'],
      ['核对合同模板', '乔瑜', '待确认', '等法务发最新版', 'N03']
    ];
    const columns = ['事项', '负责人', '期限', '前置条件'];
    if (evidence.ok) columns.push('原文编号');
    const tableRow = cells => `| ${cells.join(' | ')} |`;
    const output = [tableRow(columns), tableRow(columns.map(() => '---')),
      ...rows.map(row => tableRow(evidence.ok ? row : row.slice(0, -1)))].join('\n');
    return { ok, output, checks, feedback: ok ? '草稿已生成。接着回到原文核查一条待办。' : checks.find(check => !check.ok).feedback };
  }

  const exampleAction = { label: '先看我们要做什么', value: '我想先看示范' };
  const checkAction = { label: '举个例子', value: '举个例子' };
  const requestAction = { label: '看看怎么问 Agent', value: '看看怎么问 Agent' };
  const verifyAction = { label: '看一遍怎样核对', value: '看一遍怎样核对' };
  const transferAction = { label: '换一条记录试试看', value: '换一条记录试试看' };
  const practiceAction = { label: '换我试试', value: '换我试试' };
  const independentAction = { label: '换一份材料', value: '换一份材料' };
  const hintAction = { label: '给个提示', value: '给个提示' };
  const sourceAction = id => ({ label: id, value: id });
  const comprehensionActions = [
    { label: '先写林然负责，方便分工', value: '让林然负责场地图，因为她也在跟进展架。' },
    { label: '把负责人留待确认，附上原文编号', value: 'D02 没有确定场地图的负责人，应该写待确认并保留 D02 编号。' }
  ];
  const opening = {
    text: '假设你刚开完一场活动筹备会。同事问你：「接下来谁负责什么？什么时候交？」\n\n我陪你把几条会议记录变成一份能发到群里、让同事接手的 **待办清单**。',
    actions: [exampleAction]
  };
  const phaseProgress = {
    intro: 0, purpose: 0, comprehension: 0, 'demo-result': 0, 'demo-request': 0, 'demo-verify': 0, 'transfer-check': 0, demo: 0,
    guided: 1, correction: 2, 'correction-prompt': 2, 'correction-result': 3, independent: 3, source: 3, complete: 4
  };
  const introSteps = [
    ['intro', '了解课程目标'],
    ['purpose', '理解待办清单的用途'],
    ['demo-result', '对比摘要和待办'],
    ['demo-request', '学习怎么提要求'],
    ['demo-verify', '学习怎么核对'],
    ['transfer-check', '换一条记录检查理解']
  ];
  const inputHints = {
    intro: '说说你想先了解什么…', purpose: '告诉我你想先看什么…',
    comprehension: '说说负责人怎么写，以及依据是哪一句…', 'demo-result': '问问清单里的一条记录…',
    'demo-request': '问问任务说明，或说你准备好了…', demo: '问问任务说明，或说你准备好了…',
    'demo-verify': '问问怎样回查，或换一条记录试试看…', 'transfer-check': '用自己的话写负责人和期限…',
    guided: '写一句规则，告诉 Agent 怎么处理缺项…', correction: '写下你要回查的原文编号…',
    'correction-prompt': '给 Agent 写一句修改要求…', 'correction-result': '说说你还想核对什么，或继续…',
    independent: '给 Agent 写一份完整的任务说明…', source: '发一条原文编号，或引用这一句…', complete: '回顾本轮练习…'
  };
  const successor = {
    intro: 'purpose', purpose: 'demo-result', comprehension: 'demo-result',
    'demo-result': 'demo-request', 'demo-request': 'demo-verify', 'demo-verify': 'transfer-check', 'transfer-check': 'guided', demo: 'guided',
    guided: 'correction', correction: 'correction-prompt', 'correction-prompt': 'correction-result',
    'correction-result': 'independent', independent: 'source', source: 'complete'
  };

  function chatMessage(phase, text, actions = []) {
    return { phase, text, actions };
  }

  function quote(source) {
    return source.split('\n').map(line => `> ${line}`).join('\n>\n');
  }

  function explainPurpose() {
    return chatMessage('purpose', [
      '会上大家聊了好几件事。散会后，同事要按约定接着做。一份待办清单把每件事写成一行，让人看到 **做什么、谁来做、什么时候交**。',
      '会里没定的字段写「待确认」，让接手的人知道还要补问什么。每行再留下 **原文编号**，有疑问就能找回当时那句话。'
    ].join('\n\n'), [checkAction]);
  }

  function askComprehension() {
    return chatMessage('comprehension', [
      '这是活动筹备会的两条记录。', quote(demoSource),
      '**你会怎么写「补场地图」的负责人？哪条原文支持你的写法？**'
    ].join('\n\n'), comprehensionActions);
  }

  function showDemoResult() {
    return chatMessage('demo-result', [
      '看活动筹备会里的两条原话。', quote(demoSource),
      '**一句会后摘要**  讨论了展架清单和场地图。',
      '**能交接的待办**', demoOutput,
      '看第一行，林然知道要把什么发到群里，也知道最晚几点交。第二行保留了需要补问的负责人和时间。'
    ].join('\n\n'), [requestAction]);
  }

  function replyComprehension(message, asksForHelp) {
    if (asksForHelp) {
      return chatMessage('comprehension', '把两件事分开看。D01 说的是展架清单，D02 说的是场地图。先看 D02 有没有给场地图指派一个人。', comprehensionActions);
    }
    const keepsUnknown = makesUnknownExplicit(message) || /(还没定|没有确定|没有指派|没人负责|负责人未定|负责人没定|不知道谁负责|没说谁负责|会后确认|等会后|先问)/.test(message);
    const citesSource = /D\s*0?2|第二条|第\s*2\s*条|(?:记录|原文).{0,12}(?:负责人|会后|谁负责)|负责人.{0,8}(?:由会后确认|会后再定)/i.test(message);
    if (keepsUnknown && citesSource && !/让林然负责|林然来做|先写林然|不用.{0,4}(?:待确认|核对)/.test(message)) {
      const example = showDemoResult();
      return { ...example, text: '对，D02 提到了场地图，负责人要到会后才确认。\n\n' + example.text };
    }
    const feedback = keepsUnknown ? '这条写「待确认」有道理。加上哪条记录支持你，接手的同事就能回查。'
      : /林然|D01|猜|随便/i.test(message) ? '林然在 D01 承诺的是展架清单。看看 D02 有没有把场地图也交给她。'
        : '试着写出你会把谁填在负责人一栏，或怎么标记目前还没定，并告诉我你看的是哪条原文。';
    return chatMessage('comprehension', feedback, [...comprehensionActions, hintAction]);
  }

  function showRequest() {
    return chatMessage('demo-request', [
      '可以把给 Agent 的任务说明分成三句，再附上会议原文。',
      '1. **说明交付给谁。** 为项目组整理待办。\n2. **列出要填的字段。** 事项、负责人、期限和原文编号。\n3. **交代缺项怎么写。** 资料没说的字段写「待确认」。',
      '**合起来可以这样发**', quote(demoPrompt)
    ].join('\n\n'), [verifyAction]);
  }

  function showVerification() {
    return chatMessage('demo-verify', [
      '拿到 Agent 的草稿后，先挑一行核对。看这行的依据是 **D02**。',
      quote('D02｜主持人说，还要补一张场地图，负责人由会后确认。'),
      '原话确认了 **要补场地图**。负责人要等会后定，原话也没给期限，所以这两个字段都是「待确认」。如果草稿填了林然，回到她的 D01 承诺就能看出她只负责发展架清单。'
    ].join('\n\n'), [transferAction]);
  }

  function askTransfer() {
    return chatMessage('transfer-check', [
      '活动筹备会又补了一条记录。', quote(transferSource),
      '**请写出这条待办的内容。** 说清负责人怎么填、最晚什么时候完成。可以用一句话，也可以分开回答。'
    ].join('\n\n'), [hintAction]);
  }

  function transferFacts(message) {
    const normalized = message.normalize('NFKC')
      .replace(/十二\s*月\s*零?五\s*[日号]/g, '12月5日')
      .replace(/(?:下午|午后)[2两二]点(?:整|钟)?(?!半|[0-9])|十四[点时](?:整)?(?!半|[0-9])/g, '14:00');
    const text = normalized.replace(/\s/g, '');
    const ownerContext = /负责人|执行人|执行的人|人员|人选|谁来|谁负责|谁做|谁执行|后勤组|场地|人手|定人|安排人|指派|派人|分工|点名/.test(text);
    const unknown = /待确认|待定|未定|没定|还没|尚未|没说|没有明确|没有确定|没有人选|等场地|再定|再指派|再安排|只负责安排|安排人|未知|留空|暂不填|空着|另行安排/;
    const implicitOwner = /^(?:先|暂时)?(?:待确认|未定|待定|没定|留空|未知|空着)(?:[，,。:：、|]|\d|T0?1|$)/i.test(text);
    const showsUnknown = implicitOwner || (ownerContext && unknown.test(text));
    const wrongOwner = /(?:负责人|执行人)(?:就是|为|是|:|写成)后勤组|后勤组(?:是负责人|负责布置)|让后勤组负责|(?:都|全部|一律)(?:写|标)?已确认/.test(text);
    const dates = [...normalized.matchAll(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]|(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?!\d)/g)];
    const times = [...normalized.matchAll(/(?<!\d)(?:(上午|下午|晚上|早上)\s*)?(\d{1,2})\s*(?::\s*(\d{2})(?!\d)|[点时](半|\d{1,2}分)?)(?:\s*(p\.?m\.?))?/gi)];
    const rightDate = dates.every(match => Number(match[1] || match[3]) === 12 && Number(match[2] || match[4]) === 5);
    const rightTime = times.every(([, period, hour, minutes, clockMinutes, pm]) => {
      const hour24 = (pm || period === '下午' || period === '晚上') && Number(hour) < 12 ? Number(hour) + 12 : Number(hour);
      return hour24 === 14 && period !== '上午' && period !== '早上' &&
        Number(minutes || clockMinutes?.replace('分', '') || 0) === 0;
    });
    const unknownTime = /(?:期限|截止(?:时间)?|日期)[：:]?(?:也是|也|仍)?(?:待确认|未定|没定)|(?:都|全部|一律)(?:写|标)?待确认/.test(text);
    const sourceIds = [...text.matchAll(/(?:[DGTN]0?\d+)(?!\d)/gi)].map(([id]) => id.toUpperCase());
    const citesT01 = sourceIds.some(id => /^T0?1$/.test(id));
    return {
      owner: wrongOwner ? false : showsUnknown ? true : undefined,
      date: dates.length ? rightDate : undefined,
      time: times.length ? rightTime : undefined,
      unknownTime,
      citesT01,
      conflictingSource: sourceIds.length > 0 && !citesT01,
      ownerContext
    };
  }

  function assessTransfer(message, attempts) {
    const recent = Array.isArray(attempts) ? attempts.slice(-4).filter(value => typeof value === 'string') : [];
    const facts = [...recent, message].filter(value => typeof value === 'string').map(transferFacts);
    const newest = field => facts.findLast(item => item[field] !== undefined)?.[field];
    const latestDeadline = facts.findLast(item => item.unknownTime || item.date !== undefined || item.time !== undefined);
    const last = facts.at(-1) || {};
    const latestCitation = facts.findLast(item => item.citesT01 || item.conflictingSource);
    const owner = newest('owner');
    const deadline = newest('date') === true && newest('time') === true && !latestDeadline?.unknownTime;
    return {
      owner,
      deadline,
      source: !latestCitation?.conflictingSource,
      semanticCandidate: owner !== false && deadline && !latestCitation?.conflictingSource && facts.some(item => item.ownerContext),
      currentContribution: last.owner !== undefined || last.date !== undefined || last.time !== undefined || last.ownerContext || last.citesT01
    };
  }

  function replyTransfer(message, asksForHelp, attempts) {
    if (asksForHelp) {
      return chatMessage('transfer-check', '分别看原话的前后两句。前一句给了完成时间。后勤组还要安排具体人员，负责人这一格要怎么写？', [hintAction]);
    }
    const { owner, deadline, source, currentContribution } = assessTransfer(message, attempts);
    if (owner && deadline && source && currentContribution) {
      const practice = startGuided();
      const feedback = '对，具体负责人还没定，原文给了明确的完成时间。' + transferAnswer;
      return { ...practice, feedback, text: `${feedback}\n\n${practice.text}` };
    }
    const feedback = !owner ? '后勤组会安排人。原文有说最终由谁布置指引牌吗？'
      : !deadline ? '你保留了待确认的负责人。再看看前一句有没有写明什么时候布置完。'
        : !source ? '你提到的是另一条记录。这里看指引牌这条补充记录。'
          : '接着说说你想怎么写负责人或期限。';
    return chatMessage('transfer-check', feedback, [hintAction]);
  }

  function startGuided() {
    return chatMessage('guided', [
      '这次项目组需要一份客户试用周会的待办清单。', quote(guided.source),
      '我已经写好了目标和字段。还差一句处理规则。**记录没说的负责人或截止时间，你会怎么交代 Agent？**'
    ].join('\n\n'), [hintAction]);
  }

  function showDraftForReview() {
    return chatMessage('correction', [
      '**本轮练习的 Agent 草稿**', badDraft,
      '先核一次时间。草稿写陈宇要在 12 月 4 日中午前反馈。**你会回查哪条记录？** 可以发编号。'
    ].join('\n\n'), [hintAction]);
  }

  function replyGuided(message, asksForHelp) {
    if (asksForHelp) {
      return chatMessage('guided', `${guided.hint} 怎样保留这条待办，同时提醒接手的人还要问时间？`,
        [{ label: '把缺项标为待确认', value: guided.ruleOptions[0].label },
          { label: '根据分工补齐', value: guided.ruleOptions[1].label }]);
    }
    if (!makesUnknownExplicit(message) && !/(等.{0,8}确认|问清.{0,8}再填|没说的.{0,8}先不填)/.test(message)) {
      const feedback = /(删|去掉|忽略|跳过)/.test(message) ? guided.ruleOptions[2].feedback : guided.ruleOptions[1].feedback;
      return chatMessage('guided', `${feedback} 试着写一句规则，告诉 Agent 碰到缺项怎么写。`, [hintAction]);
    }
    const draft = showDraftForReview();
    return { ...draft, text: [
      '我把你写的规则连同目标和字段放进任务说明，跑了一次模拟。',
      quote([guided.goal, `每条列出${guided.fields.join('、')}。`, message].join('\n')),
      draft.text
    ].join('\n\n') };
  }

  function askCorrectionPrompt() {
    return chatMessage('correction-prompt', '请你给 Agent 写一句修改要求。你会怎么交代这处期限的改法？', [hintAction]);
  }

  function replyCorrection(message, asksForHelp) {
    if (asksForHelp) {
      return chatMessage('correction', reviewHint, guidedSources.map(({ id }) => sourceAction(id)));
    }
    const id = /\bG0[1-3]\b/i.exec(message)?.[0].toUpperCase();
    if (id && id !== 'G02') return chatMessage('correction', `${reviewSource(id).feedback} 再试一次。`, [hintAction]);
    if (id === 'G02' || /陈宇.{0,18}(权限|演示账号)|检查演示账号.{0,24}权限/.test(message)) {
      if (runCorrection('G02', message).ok) return replyCorrectionPrompt(message, false);
      const prompt = askCorrectionPrompt();
      return { ...prompt, text: `${reviewSource('G02').feedback}\n\n${prompt.text}` };
    }
    return chatMessage('correction', '找找哪条原文记录了检查演示账号的安排，可以先回复它的编号。', [hintAction]);
  }

  function replyCorrectionPrompt(message, asksForHelp) {
    if (asksForHelp) {
      return chatMessage('correction-prompt', '追问里说清三件事。哪一条要改？哪个字段有问题？希望 Agent 怎么写？');
    }
    const result = runCorrection('G02', message);
    if (!result.ok) {
      return chatMessage('correction-prompt', result.feedback, [hintAction]);
    }
    const revised = showCorrectionResult();
    return { ...revised, text: [result.feedback, revised.text].join('\n\n') };
  }

  function showCorrectionResult() {
    return chatMessage('correction-result', [
      '**修订后的练习草稿**', correctedDraft,
      '接下来换一份资料，你自己写整段任务说明。'
    ].join('\n\n'), [independentAction]);
  }

  function startIndependent() {
    return chatMessage('independent', [
      '现在你参加的是采购组碰头会。', quote(independent.source),
      '**请你写完整的任务说明。** 采购组要能接手这份清单，你会怎么交代 Agent？'
    ].join('\n\n'), [hintAction]);
  }

  function replyIndependent(message, asksForHelp) {
    if (asksForHelp) {
      return chatMessage('independent', '先写清要交付的是什么，再补两句。每条需要哪些信息？资料有缺口时怎么写，接手的人又怎么查原文？');
    }
    const result = runIndependent(message);
    if (!result.ok) {
      return chatMessage('independent', ['**按这份说明得到的模拟草稿**', result.output, `${result.feedback} 把补充后的整段任务说明发给我，再试一次。`].join('\n\n'), [hintAction]);
    }
    const source = askSource();
    return { ...source, text: ['**按你的说明得到的模拟草稿**', result.output, source.text].join('\n\n') };
  }

  function askSource() {
    return chatMessage('source', `${independent.reviewProbe} **你会回查哪条原文？** 可以发编号或直接引用原文。`, [hintAction]);
  }

  function phaseAfterArtifact(phase) {
    if (phase === 'source') return askSource().text;
    if (phase === 'correction-result') {
      return '对照 G02，看看期限和权限条件是否写对了。准备好后，我们换一份资料。';
    }
    return '';
  }

  function artifactContext(phase) {
    if (phase === 'correction-prompt') return [
      '按学员要求修订待办草稿。输出完整 Markdown 表格，保留三行和原文编号。陈宇的期限按 G02 原文处理。',
      '会议记录', guided.source, '待修改的草稿', badDraft
    ].join('\n\n');
    if (phase === 'independent') return [
      '按用户的任务说明，从会议记录整理一份待办。输出完整 Markdown 表格，保留三行和原文编号。每项事实均以会议记录为依据。',
      '会议记录', independent.source
    ].join('\n\n');
    return '';
  }

  function showComplete() {
    return chatMessage('complete', [
      '**这一轮练完了。**',
      '- **交代任务。** 你的采购待办说明写了交付内容、负责人和期限。\n- **保留缺口。** 你的规则让缺失信息留待确认。\n- **追问修订。** 你让 Agent 改掉 G02 没有依据的期限。\n- **回查原文。** 你用 N02 核实了报价对比表的负责人。'
    ].join('\n\n'));
  }

  function replySource(message, asksForHelp) {
    if (asksForHelp) return chatMessage('source', independent.hint, independentSources.map(({ id }) => sourceAction(id)));
    const id = /\bN0[1-3]\b/i.exec(message)?.[0].toUpperCase();
    if (id === 'N02' || (!id && /更新.*对比表/.test(message) && /(下次|待确认|负责人.{0,8}确认)/.test(message))) {
      const completed = showComplete();
      return { ...completed, text: '找对了。N02 说要等下次碰头才确认负责人。周芮在 N01 承诺的是发送报价表，所以这条应改为「负责人待确认」。\n\n' + completed.text };
    }
    return chatMessage('source', id === 'N01' ? 'N01 说的是把报价表发给采购组。再找找哪条在说「更新报价对比表」。'
      : id === 'N03' ? 'N03 说的是核对合同模板。再找找哪条在说「更新报价对比表」。'
        : '选一条写到「更新报价对比表」的原文，发它的编号或直接引用那句话。', [hintAction]);
  }

  const livePhases = {
    comprehension: replyComprehension, 'transfer-check': replyTransfer,
    guided: replyGuided, correction: replyCorrection, 'correction-prompt': replyCorrectionPrompt,
    independent: replyIndependent, source: replySource
  };
  const assessmentPhases = new Set(Object.keys(livePhases));

  function modelNextPhase(phase, message, advance, scripted, attempts) {
    const next = successor[phase];
    if (!next) return phase;
    const normalized = message.normalize('NFKC').replace(/[\s，。！？、,.!?]+/g, '');
    if ((phase !== 'transfer-check' && /[？?]\s*$/.test(message)) ||
        /^(?:能|可以|请|能不能)?给.{0,4}提示|跳过这题|直接判我通过|agent是(?:什么|啥)/i.test(normalized)) return phase;
    if (assessmentPhases.has(phase) &&
        (/^(?:我)?(?:明白了?|懂了?|知道了?|好的?|可以了?|继续|开始(?:练习)?|下一步|准备好了|没问题|完成了)$/.test(normalized) ||
          !normalized)) return phase;
    if (phase === 'comprehension' &&
        /^(?:D0?2|第二条|第2条|(?:(?:先|就)?写(?:成|为)?|标(?:成|为)?|记(?:成|为)?)?待确认)$/i.test(normalized)) return phase;
    if (phase === 'transfer-check') {
      const assessment = assessTransfer(message, attempts);
      return assessment.currentContribution && (scripted.phase === next || (advance && assessment.semanticCandidate)) ? next : phase;
    }
    return scripted.phase === next || (advance && assessmentPhases.has(phase)) ? next : phase;
  }
  const phaseIntros = {
    intro: () => opening, purpose: explainPurpose, comprehension: askComprehension,
    'demo-result': showDemoResult, 'demo-request': showRequest,
    demo: () => ({ ...showRequest(), actions: [practiceAction] }),
    'demo-verify': showVerification, 'transfer-check': askTransfer,
    guided: startGuided, correction: showDraftForReview, 'correction-prompt': askCorrectionPrompt,
    'correction-result': showCorrectionResult, independent: startIndependent, source: askSource, complete: showComplete
  };
  const demoMaterial = ['活动筹备会原文', demoSource, '参考任务说明', demoPrompt];
  const guidedMaterial = ['客户试用周会原文', guided.source];
  const correctionMaterial = [...guidedMaterial, '含一处错误的练习草稿', badDraft];
  const independentMaterial = ['采购组碰头会原文', independent.source];
  const modelLessons = {
    intro: {
      goal: '通过活动筹备会的场景介绍课程。学员接下来会把原始记录转成同事可以接手的待办。',
      advance: '学员明确想开始、看示范或了解练习目标时可推进。问概念时解释概念并留在此处。',
      question: '要先看看同事需要什么样的待办吗？'
    },
    purpose: {
      goal: '解释一份能交接的待办需要做什么、谁做、何时交付。缺项留待确认，原文编号让人能回查。',
      advance: '学员愿意看例子或继续即可进入随后的摘要和待办对比。',
      question: '想用两条会议记录看看这些信息怎么写吗？'
    },
    comprehension: {
      goal: '请学员根据原文判断场地图负责人的写法，这是示范前的理解检查。',
      advance: '回答须同时表达负责人仍未确定，以及依据来自 D02、第二条、对场地图负责人的原话或无歧义转述。接受任何自然表述。只确认听懂、只写待确认、只报编号、猜林然负责或引用 D01 均需继续练习。',
      question: '场地图的负责人该怎么写，哪条记录支持你的写法？',
      material: ['活动筹备会原文', demoSource]
    },
    'demo-result': {
      goal: '从成品看待办是否可执行和可追溯。D01 是明确安排，D02 还有负责人和期限要问。',
      advance: '学员明确想看任务说明或愿意继续时推进。若学员问清单里的内容，先根据表和原文作答。',
      question: '现在看看这份清单是怎么交代给 Agent 的吗？',
      material: ['活动筹备会原文', demoSource, '待办表', demoOutput]
    },
    'demo-request': {
      goal: '帮助学员看出任务说明含交付对象、要列的字段、遇到缺项的规则和可追溯的依据。',
      advance: '学员愿意看怎样核对草稿、表示已理解或继续时推进。',
      question: '一起看看如何从待办表的编号回查事实吗？',
      material: demoMaterial
    },
    'demo-verify': {
      goal: '展示如何顺着表里的编号回查一行。D02 只确认要补场地图，负责人会后再定，期限未给。D01 的林然只承诺发清单。',
      advance: '学员愿意用一条新记录尝试自己核对时推进。先回答关于原文和表格的具体提问。',
      question: '换一条新记录，试着判断哪些字段已经确定了吗？',
      material: ['活动筹备会原文', demoSource, '待办表', demoOutput]
    },
    'transfer-check': {
      goal: '学员将前面学过的核对方法用于同一会议的新记录。区分负责安排人的小组和具体执行人，还要保留原文已确定的时间。',
      advance: '学员写出具体负责人待定以及 12 月 5 日 14:00 前的期限即可推进，答的是待办结果。接受自然日期格式、口语和上下文中明确的简写，例如“待确认 12 月 5 日 14:00 前 T01”。不用写字段名。题面只有 T01，无需重复编号，也无需写后勤组负责安排人。学员可以在当前这道题的几条消息里补齐两项，后续订正覆盖先前答案。若缺一项只问这一项，不要求重写。把后勤组当作执行人或把完成期限写待定则继续练习。',
      question: '指引牌这条待办的负责人和期限该怎么写？',
      material: ['活动筹备会的补充记录', transferSource]
    },
    guided: {
      goal: '带学员补一条处理未知信息的规则。目标和清单字段已预先写好，可只补需要的规则。',
      advance: '学员清楚要求保留事项，并把未知的负责人、期限等显式留空、标待确认或等核实后补写时可推进。接受自然同义表达。不能把原文没有给出的信息当作承诺，也不能删掉整行。只表示认同时继续追问。',
      question: '记录没有说负责人或截止时间时，你会给 Agent 写哪条处理要求？',
      material: guidedMaterial
    },
    correction: {
      goal: '识别演示账号错误期限对应的原始记录。',
      advance: '学员提供 G02、客户试用周会第二条或无歧义地引用陈宇关于权限开通之后再确认的原话时可推进。引用 G01 或 G03 时回到陈宇的安排。',
      question: '草稿中的 12 月 4 日中午对应哪条原始记录？',
      material: correctionMaterial
    },
    'correction-prompt': {
      goal: '学员应给 Agent 一句实际可执行的修订要求。上一轮已经定位 G02，短句也可以引用它的上下文。',
      advance: '学员明确要求把 G02 的期限改为待确认、等权限开通再确认，或撤掉草稿编出的具体时间。接受「把这个日期撤掉，等权限开了再确认」等可由上一轮确定所指的表述。只说日期有问题或要求重写整份时，追问想改成什么。',
      question: '你会用哪一句话请 Agent 改正这处期限？',
      material: correctionMaterial,
      artifact: '通过时额外返回 artifact 字段，是按学员要求修订的完整 Markdown 待办表。每行保留 G01、G02 或 G03。按原文保留人物、时间、未知信息及权限依赖。'
    },
    'correction-result': {
      goal: '让学员看到 G02 期限已恢复为待确认，陈宇和权限依赖仍保留。随后换案例。',
      advance: '学员愿意换材料、独立做或继续时推进。问前后区别时先解释。',
      question: '准备好用采购组的新材料自己尝试了吗？',
      material: ['客户试用周会原文', guided.source, '修订过的草稿', correctedDraft]
    },
    independent: {
      goal: '让学员用自己的话为采购组写可执行且可核对的交接要求。',
      advance: '说明须能判断出交付待办清单或逐条行动项，并要求至少负责人和期限、对缺项保留未知、保留原文编号或同等可追溯依据。接受列表、简短段落、原文摘录等合理交付方式。无需照抄课文或使用特定术语。缺一项就点评已有部分，再追问最值得补的一项。',
      question: '你会怎么交代 Agent 整理出一份采购组能接手的待办？',
      material: independentMaterial,
      artifact: '通过时额外返回 artifact 字段，按学员的任务说明实际整理这份会议记录。使用 Markdown，保留 N01、N02、N03 以便回查。按原文保留人物、时间和未知。'
    },
    source: {
      goal: '迁移核对方法，查证报价对比表负责人。另一份草稿给了错误负责人周芮。',
      advance: '学员引用 N02、采购组第二条，或清晰转述「更新报价对比表，谁负责要下次碰头时确认」即可推进。若回答 N01，说明周芮承担的是发送报价表；若回答 N03，说明那条是核对合同模板。',
      question: '要核对谁负责更新报价对比表，应该回哪条原文？',
      material: independentMaterial
    },
    complete: {
      goal: '课程已结束。可以围绕本轮具体动作给学员复习解释。',
      advance: '留在完成状态。依据课程材料作答，用新手能懂的表达。'
    }
  };

  function modelContext(phase, message) {
    const lessonPhase = phase === 'demo' ? 'demo-request' : phase;
    if (!Object.hasOwn(modelLessons, lessonPhase)) return '';
    const lesson = modelLessons[lessonPhase];
    const text = typeof message === 'string' ? message.trim() : '';
    const selectedAction = phaseIntros[phase]().actions.find(action => action.value === text);
    return [
      '你在带办公新人完成一节如何把会议记录整理成待办的课程。联系学员自己的措辞给具体反馈，用简体中文和日常办公表达。',
      '当前环节的教学目标', lesson.goal,
      '你的内部判断依据', lesson.advance,
      selectedAction ? '学员发送的文字与当前环节的一项快捷回复一致。按同一标准判断其意思，选了建议不代表答对。' : '',
      ...(lesson.material || []),
      lesson.artifact || '',
      lesson.question ? `本轮待解决的问题\n${lesson.question}` : '',
      '学员提出具体问题时，先直接回答问题。结合对方提到的细节给出实用的说明或例子，区分课内已知事实与对方假设的情境。确实缺少信息时，指出还需确认什么。只提问或求提示时保持当前阶段。已经作答并问“这样对吗”时仍评价答案。学员在尝试作答而尚未通过时，只追问一个缺口。不要转述内部判断依据、完整标准答案或后续活动。',
      '通过时简短肯定学员实际做对的点。系统会展示下一轮的材料和问题，所以你的正文不再重复材料或提下一问。保留课程原文中的人名、时间、编号与未知信息。',
      lesson.artifact ? '完整 JSON 格式示例（填写实际内容）：{"text":"一句简短反馈","advance":true,"artifact":"完整 Markdown 表格"}。不通过时仍返回 text 和 advance，可省略 artifact。' : ''
    ].filter(Boolean).join('\n\n');
  }

  const chat = {
    opening,
    progress(phase) {
      return Object.hasOwn(phaseProgress, phase) ? phaseProgress[phase] : undefined;
    },
    position(phase) {
      const resumedPhase = phase === 'demo' ? 'demo-request' : phase === 'comprehension' ? 'transfer-check' : phase;
      const index = introSteps.findIndex(([id]) => id === resumedPhase);
      if (index < 0) return undefined;
      const label = phase === 'comprehension' ? '检查理解' : introSteps[index][1];
      return { current: index + 1, total: introSteps.length, label };
    },
    inputHint(phase) {
      return Object.hasOwn(inputHints, phase) ? inputHints[phase] : '发一条消息…';
    },
    modelContext,
    modelNextPhase,
    isAssessment(phase) {
      return assessmentPhases.has(phase);
    },
    phaseAfterArtifact,
    artifactContext,
    nextPhase(phase) {
      return Object.hasOwn(successor, phase) ? successor[phase] : undefined;
    },
    phaseActions(phase) {
      if (!Object.hasOwn(phaseIntros, phase)) return [];
      return phaseIntros[phase]().actions.map(action => ({ ...action }));
    },
    phaseIntro(phase) {
      return Object.hasOwn(phaseIntros, phase) ? phaseIntros[phase]().text : '';
    },
    reply(phase, rawMessage, attempts) {
      const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
      const asksForHelp = /^(?:能|可以|请|能不能)?\s*(?:给.{0,5}提示|提示|我不会|不知道怎么|怎么写|帮帮我|求助)/.test(message);
      if (phase === 'complete') return chatMessage('complete', '这轮已经完成。你可以向上翻看哪句追问改变了草稿，或从陪练页重新练一轮。');
      if (Object.hasOwn(phaseProgress, phase) && /(?:agent\s*(?:是|指)(?:什么|啥|什么意思)|(?:什么|啥)是\s*agent|不懂\s*agent)/i.test(message)) {
        const text = 'Agent 可以理解成帮你做具体任务的 AI 助手。比如你给它会议记录和整理要求，它会给你一份待办草稿。拿到草稿后，你可以回到原文核对，再交代它改哪一处。';
        return chatMessage(phase, text, phaseIntros[phase]().actions);
      }
      if (phase === 'intro') {
        if (/(示范|开始|试试|好的|可以|准备好|^好[。！!\s]*$)/.test(message)) return explainPurpose();
        return chatMessage('intro', '我们用活动筹备会的记录练习。会议一散，同事就需要知道要做什么、什么还要问。', [exampleAction]);
      }
      if (phase === 'purpose') {
        if (/(举个例子|看看|继续|明白|懂|开始|^好[。！!\s]*$)/.test(message)) return showDemoResult();
        return chatMessage('purpose', '可以把这份清单想成同事接手时要看的记录。能直接开始的事写清安排，没定的事把问题留下。', [checkAction]);
      }
      if (phase === 'demo-result') {
        if (/(怎么问|提示词|怎么写|继续|看看|明白|^好[。！!\s]*$)/.test(message)) return showRequest();
        return chatMessage('demo-result', 'D01 的负责人和期限都有依据，D02 还需要确认。现在来看看怎么把这些要求说给 Agent 听。', [requestAction]);
      }
      if (phase === 'demo' || phase === 'demo-request') {
        if (/(怎样核对|怎么核对|试试|继续|跟着|开始|好了|准备好|^好[。！!\s]*$)/.test(message)) {
          return phase === 'demo' ? startGuided() : showVerification();
        }
        if (/(D02|场地图|待确认|为什么)/i.test(message)) {
          return chatMessage(phase, 'D02 说负责人会后确认，也没有给期限。把两个字段标为待确认，项目组就知道下一步需要补什么。', phaseIntros[phase]().actions);
        }
        return chatMessage(phase, '你可以把这段任务说明分成三句。先说交付的清单，再说要列哪些信息，最后交代缺项怎么处理。', phaseIntros[phase]().actions);
      }
      if (phase === 'demo-verify') {
        if (/(换一条|继续|试试|好了|准备好|^好[。！!\s]*$)/.test(message)) return askTransfer();
        return chatMessage(phase, '核对一行时，先顺着编号找到原文，再分别核对事项、负责人和期限。你可以用一条新记录试试看。', [transferAction]);
      }
      if (phase === 'correction-result') {
        if (/(材料|下一步|独立|继续|试试|开始|^好[。！!\s]*$)/.test(message)) return startIndependent();
        return chatMessage(phase, '可以对照 G02 看看，改前和改后只调整了期限。准备好后再换一份采购组的材料。', [independentAction]);
      }
      return Object.hasOwn(livePhases, phase)
        ? livePhases[phase](message, asksForHelp, attempts)
        : chatMessage('intro', opening.text, opening.actions);
    }
  };

  return {
    id: 'meeting-tutor',
    title: 'Agent 陪练 · 从会议记录整理待办',
    summary: '看示范、交代任务、回查并纠错，再换一份会议记录自己练。',
    stages, chat
  };
});
