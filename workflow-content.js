/* Teaching definitions for the guided workflows. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AcademyWorkflowContent = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const feedback = {
    id: 'feedback-workflow',
    version: 1,
    taskId: 'feedback',
    title: '把客户反馈交给下一位同事',
    summary: '用 Agent 整理反馈和去重统计，再结合客服回访做分流，生成产品与客服各自的跟进清单。',
    sourceLabel: '本批原始反馈',
    steps: [
      {
        id: 'classify',
        type: 'agent',
        title: '给反馈打标签',
        description: '先把每条反馈整理成可以逐条回查的记录。',
        prompt: '请逐条阅读这批客户反馈，输出一张 Markdown 表格。每行对应一条原始反馈，列出反馈编号、客户编号、原话和问题标签。一条反馈涉及多个问题时保留全部标签。相同客户的多条记录也分别保留。缺少编号时写“待确认”。这一步只整理记录和标签。',
        outputLabel: '反馈分类表',
        checks: [
          'F01 到 F05 都能回查原话，同一客户的多条反馈仍有各自的编号。',
          'F05 提到的两个问题都保留在同一条记录里。'
        ],
        example: [
          '| 反馈编号 | 客户编号 | 原话 | 问题标签 |',
          '| --- | --- | --- | --- |',
          '| F01 | A | 导入表格时一直报日期格式错误。 | 导入日期格式 |',
          '| F02 | A | 昨天那个日期格式错误还没解决。 | 导入日期格式 |',
          '| F03 | B | 导入表格也提示日期格式不对，希望给个样例。 | 导入日期格式 |',
          '| F04 | C | 找不到导出按钮。 | 导出入口 |',
          '| F05 | D | 导出按钮难找，帮助页链接还打不开。 | 导出入口、帮助链接 |'
        ].join('\n')
      },
      {
        id: 'count',
        type: 'agent',
        title: '去重并统计',
        description: '用确认后的分类表统计反馈条数和客户数。这份统计会交给负责分流的同事。',
        prompt: '使用下面已确认的反馈分类表，沿用其中的编号和标签。先列出全批去重反馈条数及去重客户数，再按问题标签统计。用 Markdown 表格列出每类的反馈编号、反馈条数、去重客户编号和去重客户数。同一反馈可以出现在多个类别，同一类别内按客户编号去重。客户编号不全时标明无法确认的客户数，保留能核对的反馈条数。说明跨类数字的合计口径。',
        outputLabel: '去重统计表',
        checks: [
          '核对客户 A 的两条记录，确认这两条反馈只计为一位客户。',
          '核对 F05 同时计入两个相关类别，确认全批条数和客户数按原始编号去重。'
        ],
        example: [
          '本批有 **5 条反馈、4 位不同客户**。',
          '',
          '| 问题类别 | 反馈编号 | 反馈条数 | 客户编号 | 去重客户数 |',
          '| --- | --- | ---: | --- | ---: |',
          '| 导入日期格式 | F01、F02、F03 | 3 | A、B | 2 |',
          '| 导出入口 | F04、F05 | 2 | C、D | 2 |',
          '| 帮助链接 | F05 | 1 | D | 1 |',
          '',
          '编号可跨类别出现，各类数字需按原始记录或客户编号去重后才能汇总。以上仅描述本批反馈。'
        ].join('\n')
      },
      {
        id: 'brief',
        type: 'review',
        title: '分流并交接',
        description: '你来值班处理这批反馈。对照统计和新收到的回访，决定每个问题下一步由谁跟进。',
        legacyTitle: '客户反馈问题简报',
        prompt: '根据已确认的去重统计表，写一份给产品团队的简短 Markdown 问题简报。说明样本范围、各类问题的反馈数和去重客户数，每类引用一条带编号的原话，再列出优先核查线索及要补的证据。原话回查原始资料。区分本批提及频次、待验证的原因和正式优先级。',
        outputLabel: '产品与客服交接单',
        review: {
          options: [
            { id: 'investigate', label: '交产品核查', heading: '产品核查' },
            { id: 'request', label: '请客服补资料', heading: '客服补资料' }
          ],
          items: [
            {
              id: 'import-date',
              title: '导入时报日期格式错误',
              refs: ['F01', 'F02', 'F03'],
              context: '客户 A 已提供脱敏的表格、产品版本和操作步骤。按步骤导入时仍出现同一条报错。',
              reflection: '已有样本、版本和步骤，可先交给产品复现。',
              actions: {
                investigate: '用客户 A 的脱敏表格和操作步骤复现日期报错，记录触发条件。',
                request: '请客服向客户 B 补收脱敏表格和版本，用于比较两位客户遇到的报错是否一致。'
              }
            },
            {
              id: 'export-entry',
              title: '找不到导出入口',
              refs: ['F04', 'F05'],
              context: '客服拿到了页面截图。两位客户的账号角色和导出权限还没确认。',
              reflection: '可以先查截图里的入口提示，也可以先补问权限，取决于你想先验证哪种可能。',
              actions: {
                investigate: '根据截图检查当前页面的导出入口和权限提示，区分入口难找和没有权限。',
                request: '请客服补问两位客户的账号角色和导出权限，并确认截图对应哪个页面。'
              }
            },
            {
              id: 'help-link',
              title: '帮助链接打不开',
              refs: ['F05'],
              context: '客户只说点了页面里的帮助链接，回访记录里仍缺链接地址和错误提示。',
              reflection: '先请客服补齐具体地址，后续核查才有明确对象。',
              actions: {
                investigate: '先检查相关页面的帮助入口是否能打开，记录已排查的链接和结果。',
                request: '请客服向客户确认链接地址、入口页面和打开时的错误提示。'
              }
            }
          ]
        }
      }
    ]
  };

  const meeting = {
    id: 'meeting-handoff',
    version: 2,
    appendFromVersion: 1,
    taskId: 'meeting',
    title: '把周会待办交给执行人',
    summary: '第一轮让 Agent 提取待办。核对会后消息后，再请同一个 Agent 把你的交接决定写成群消息。',
    sourceLabel: '周会记录',
    sampleInput: [
      '【虚构教学材料】12 月 1 日客户试用周会。',
      'M01｜何琳：我会在 12 月 3 日 17:00 前更新客户试用说明，更新后发到项目群。',
      'M02｜陈宇：我负责检查演示账号。等技术支持给到测试权限，我再确定什么时候能反馈。',
      'M03｜主持人：发布排期需要在 12 月 4 日前确认，请项目经理会后指定负责人。'
    ].join('\n'),
    steps: [
      {
        id: 'extract',
        type: 'agent',
        title: '从记录提取待办',
        description: '逐条整理事项、负责人、时间和依赖，让同事可以用编号回查。',
        prompt: '根据本次周会记录，用 Markdown 表格列出事项、负责人、截止时间、依赖和原文编号。只记录会议中已经明确的信息。根据原文标出待确认字段和阻塞项，尤其区分已经明确的责任人与尚待落实的权限，不推测截止时间。',
        outputLabel: '待办草稿',
        examplePreviewOnly: true,
        checks: [
          '保留 M01 至 M03 三条安排，每条都能按编号回查。',
          'M02 的期限和测试权限、M03 的负责人都保留为待确认。'
        ],
        example: [
          '| 事项 | 负责人 | 截止时间 | 依赖或缺口 | 原文编号 |',
          '| --- | --- | --- | --- | --- |',
          '| 更新客户试用说明并发项目群 | 何琳 | 12 月 3 日 17:00 前 | 无已知依赖 | M01 |',
          '| 检查演示账号 | 陈宇 | 待确认 | 测试权限待技术支持开通 | M02 |',
          '| 确认发布排期 | 待确认 | 12 月 4 日前 | 项目经理需指定负责人 | M03 |'
        ].join('\n')
      },
      {
        id: 'handoff',
        type: 'review',
        title: '核对后决定是否交接',
        description: '主持人补发了会后消息。对照待办草稿，判断各项现在能否交给执行人。',
        outputLabel: '待办交接决定',
        review: {
          options: [
            { id: 'handoff', label: '交给执行人', heading: '可交接待办' },
            { id: 'clarify', label: '暂放待确认', heading: '待确认事项' }
          ],
          items: [
            {
              id: 'trial-guide',
              title: '更新客户试用说明',
              refs: ['M01'],
              context: '何琳在项目群里确认，她会按会上约定的时间发最新版说明。',
              reflection: '负责人、交付内容和期限均已明确，可以按原约定交接。',
              actions: {
                handoff: '请何琳在 12 月 3 日 17:00 前更新说明并发到项目群。',
                clarify: '请主持人说明还有哪项信息需要确认，再同步给何琳。'
              }
            },
            {
              id: 'demo-access',
              title: '检查演示账号',
              refs: ['M02'],
              context: '技术支持已开通测试权限，陈宇确认能登录，也承诺在 12 月 4 日 12:00 前把检查结果发到项目群。',
              previousContext: '技术支持已开通测试权限，陈宇确认能登录，也承诺在 12 月 4 日 12:00 前给出检查结果。',
              reflection: '草稿中的权限与期限缺口已由会后消息补齐，可以交接。',
              actions: {
                handoff: '请陈宇检查演示账号，在 12 月 4 日 12:00 前把结果发到项目群。',
                clarify: '请陈宇说明还有哪些账号无法访问或哪一步影响按时交付。'
              }
            },
            {
              id: 'release-date',
              title: '确认发布排期',
              refs: ['M03'],
              context: '项目经理回复，发布排期仍需在 12 月 4 日前确认，负责人还在协调。',
              reflection: '期限明确，执行人仍缺失。先请项目经理确认归属。',
              actions: {
                handoff: '请项目经理指定执行人，再将排期确认事项转交给已确认的负责人。',
                clarify: '请项目经理确认由谁负责，并回复能否维持 12 月 4 日前的期限。'
              }
            }
          ]
        }
      },
      {
        id: 'deliver',
        type: 'agent',
        title: '请 Agent 写交接消息',
        description: '把任务粘贴到第一轮用的 Agent 对话，再带回它修订后的群消息。复制内容包含原待办草稿、会后补充和你确认的交接决定。',
        prompt: '请修订上一轮的周会待办草稿，写一条可直接发到项目群的 Markdown 交接消息。以这次确认的交接决定和其中的会后补充为准。按“可交接”和“待确认”分组。可交接项写清执行人、最新期限和交付内容。待确认项写明缺什么、找谁确认，保留原文编号。不要把待确认项写成已分派，也不要代为发送。',
        includeSteps: ['extract'],
        copyLabel: '复制给同一个 Agent',
        outputLabel: '周会交接消息',
        checks: [
          '每个事项都沿用我确认的分组，并保留原文编号。',
          '已经补齐的信息用的是会后版本，仍有缺口的事项明确写出找谁确认。'
        ]
      }
    ]
  };

  return [feedback, meeting];
});
