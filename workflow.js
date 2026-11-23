/* Shared interface for course-defined workflow experiments. */
window.createWorkflowUI = function (ctx) {
  'use strict';
  const {definition, sampleInput, esc, icon, main, getState, save, answerPreview,
    answerEditorPreview, copyText, download, today, toast} = ctx;
  const core = window.AcademyWorkflowCore;
  const blank = core.blank(definition);
  const href = '#/workflow/' + definition.id;
  const count = definition.steps.length;
  const finalIndex = count - 1;
  const finalStep = definition.steps[finalIndex];
  const routingIndex = definition.steps.findIndex(step => step.type === 'review');
  const reviewStep = definition.steps[routingIndex];
  const review = reviewStep.review;
  const state = () => getState() || blank;
  const confirmedCount = () => core.currentStep(state());
  let active = 0;
  let editing = false;

  function entry() {
    const progress = confirmedCount();
    const label = progress === count ? '查看工作流成果' : getState() ? '继续工作流实验' : '开始工作流实验';
    return `<article class="surface-card workflow-card">
      <div><h3>${esc(definition.title)}</h3><p>${esc(definition.summary)}</p></div>
      <ol class="workflow-card-steps">${definition.steps.map(step => `<li>${esc(step.title)}</li>`).join('')}</ol>
      <a class="button primary" href="${href}" aria-label="${label} · ${esc(definition.title)}">${label} ${icon('arrow')}</a>
    </article>`;
  }

  function navigation() {
    const progress = confirmedCount();
    return `<ol class="workflow-steps" aria-label="工作流步骤">${definition.steps.map((step, index) => {
      const status = state().steps[index].status;
      // Pending outputs can still be read while an upstream step is being checked.
      const locked = index > progress && status !== 'pending';
      const label = status === 'confirmed' ? '已确认' : status === 'pending' ? '待复核' : locked ? '等待上一步' : '进行中';
      return `<li><button type="button" data-workflow-step="${index}" data-status="${status}"
        ${active === index ? 'aria-current="step"' : ''} ${locked ? 'disabled' : ''}>
        <span class="workflow-step-number" aria-hidden="true">${status === 'confirmed' ? icon('check') : index + 1}</span>
        <span class="workflow-step-label"><strong>${esc(step.title)}</strong><small>${label}</small></span>
      </button></li>`;
    }).join('')}</ol>`;
  }

  function button(action, label, kind = 'secondary') {
    return `<button type="button" class="button ${kind}" data-workflow-action="${action}">${label}</button>`;
  }

  function handoff(index) {
    const upstream = definition.steps[index - 1];
    return `<details class="guided-optional workflow-handoff" open>
      <summary>${upstream ? '本步输入 · 已确认的' + esc(upstream.outputLabel) : esc(definition.sourceLabel)}</summary>
      ${upstream ? answerPreview(state().steps[index - 1].output) : `<pre class="output-preview workflow-prompt">${esc(sampleInput)}</pre>`}
    </details>`;
  }

  function agentInstructions(index) {
    const step = definition.steps[index];
    const prompt = core.buildPrompt(state(), index, definition, sampleInput);
    return `${handoff(index)}
    <div class="workflow-actions">
      ${button('copy', esc(step.copyLabel || '复制本步任务') + ' ' + icon('copy'), 'primary')}
      ${step.example && !step.examplePreviewOnly ? button('example', '填入示例产物') : ''}
    </div>
    ${step.example && step.examplePreviewOnly ? `<details class="guided-optional">
      <summary>查看参考${esc(step.outputLabel)}</summary>${answerPreview(step.example)}
    </details>` : ''}
    <details class="guided-optional"><summary>查看完整提示词</summary>
      <pre class="output-preview workflow-prompt">${esc(prompt)}</pre>
    </details>
    ${index > 0 ? `<details class="guided-optional"><summary>回查${esc(definition.sourceLabel)}</summary>
      <pre class="output-preview workflow-prompt">${esc(sampleInput)}</pre>
    </details>` : ''}`;
  }

  function previousBrief() {
    return state().routing?.previousBrief || (!state().routing ? state().steps[routingIndex].output : '');
  }

  function previousBriefDetails() {
    const brief = previousBrief();
    return brief ? `<details class="guided-optional"><summary>查看之前保存的简报</summary>${answerPreview(brief)}</details>` : '';
  }

  function routingProgress() {
    const assigned = Object.keys(state().routing?.choices || {}).length;
    return `已判断 ${assigned} / ${review.items.length} 项。`;
  }

  function routingPreview() {
    const handoff = core.routingHandoff(state(), definition);
    return handoff ? answerPreview(handoff) : '';
  }

  function routingForm() {
    const choices = state().routing?.choices || {};
    return `${handoff(routingIndex)}
    <div class="workflow-routing">
      ${review.items.map(item => `<fieldset class="workflow-issue">
        <legend>${esc(item.title)} <small>${esc(item.refs.join('、'))}</small></legend>
        <p>${esc(item.context)}</p>
        <div class="workflow-route-options">
          ${review.options.map(option =>
            `<label class="workflow-route-option">
              <input type="radio" name="route-${esc(item.id)}" data-workflow-route="${esc(item.id)}" value="${esc(option.id)}" ${choices[item.id] === option.id ? 'checked' : ''}>
              <span><strong>${esc(option.label)}</strong><small>${esc(item.actions[option.id])}</small></span>
            </label>`).join('')}
        </div>
      </fieldset>`).join('')}
    </div>
    <div class="workflow-routing-summary">
      <h3>${esc(reviewStep.outputLabel)}预览</h3>
      <p class="workflow-routing-progress" role="status">${routingProgress()}</p>
      <div class="workflow-routing-preview">${routingPreview()}</div>
    </div>
    <div class="workflow-actions">${button('confirm-routing', routingIndex === finalIndex
      ? '确认交接单 ' + icon('check')
      : '确认交接决定，进入下一轮 ' + icon('arrow'), 'primary')}</div>
    <p class="workflow-status" role="status">选择会自动保存在当前浏览器。</p>
    ${previousBriefDetails()}`;
  }

  function stepPanel() {
    const step = definition.steps[active];
    const {output, status} = state().steps[active];
    const locked = active > confirmedCount();
    const readOnly = status === 'confirmed' && !editing;
    const routing = step.type === 'review';
    return `<section class="surface-card project-section workflow-panel">
      <h2 data-workflow-heading tabindex="-1">${esc(step.title)}</h2><p>${esc(step.description)}</p>
      ${status === 'pending' ? `<p class="workflow-stale">${locked ? '上游产物有改动。上游重新确认前，可以先回看这份草稿。' : '上游产物已更新。请对照新的输入，复核这份草稿。'}</p>` : ''}
      ${locked || readOnly ? `
        <h3>${esc(routing && !state().routing ? step.legacyTitle || step.outputLabel : step.outputLabel)}</h3>${answerPreview(output)}
        <div class="workflow-actions">${locked
          ? button('resume', '回到需要确认的步骤', 'primary')
          : button('edit', routing ? '复核交接决定' : '修改这一步') + button('resume', confirmedCount() === count ? '查看工作流成果' : '继续实验', 'primary')}</div>
        ` : routing ? routingForm() : `
        ${agentInstructions(active)}
        <div class="form-group workflow-output">
          <label class="input-label" for="workflow-output">${esc(step.outputLabel)}</label>
          <textarea class="form-textarea tall" id="workflow-output" maxlength="${core.OUTPUT_LIMIT}" placeholder="在这里粘贴 Agent 回答，支持 Markdown。">\n${esc(output)}</textarea>
          ${answerEditorPreview}
        </div>
        <fieldset class="workflow-review">
          <legend>对照本步产物</legend>
          ${step.checks.map(check => `<label class="check-item"><input type="checkbox" data-workflow-check><span>${esc(check)}</span></label>`).join('')}
        </fieldset>
        <div class="workflow-actions">${button('confirm', active === finalIndex
          ? '确认并查看成果 ' + icon('check')
          : '确认并进入下一步 ' + icon('arrow'), 'primary')}</div>
        <p class="workflow-status" role="status">结果会自动保存在当前浏览器。</p>
      `}
    </section>`;
  }

  function resultPanel() {
    const steps = state().steps;
    const routed = !!state().routing;
    const reflections = review.items.filter(item => item.reflection);
    return `<section class="surface-card project-section workflow-panel workflow-result">
      <h2 data-workflow-heading tabindex="-1">${routed
        ? (routingIndex === finalIndex ? '交接单已确认' : esc(finalStep.outputLabel) + '已确认')
        : '工作流已完成'}</h2>
      ${answerPreview(steps[finalIndex].output)}
      ${steps.slice(0, -1).map((step, index) => `<details class="guided-optional">
        <summary>查看${esc(definition.steps[index].outputLabel)}</summary>${answerPreview(step.output)}
      </details>`).join('')}
      ${routed && reflections.length ? `<details class="guided-optional"><summary>复盘判断依据</summary>
        <ul class="project-list">${reflections.map(item =>
          `<li><strong>${esc(item.title)}。</strong>${esc(item.reflection)}</li>`).join('')}</ul>
      </details>` : ''}
      ${routed ? previousBriefDetails() : ''}
      <div class="workflow-actions">
        ${routed ? button('export-handoff', '下载' + (routingIndex === finalIndex ? '交接单' : esc(finalStep.outputLabel)) + ' ' + icon('download'), 'primary') : ''}
        ${button('export', '导出完整实验记录 ' + icon('download'), routed ? 'secondary' : 'primary')}
        ${button('edit-routing', routed ? '复核交接决定' : '试做人工审核')}
        <a class="button ghost" href="#/tasks">返回动手练习</a></div>
    </section>`;
  }

  function render({focus = false} = {}) {
    main.innerHTML = `<div class="guided-workspace workflow-workspace" data-workflow-id="${esc(definition.id)}">
      <div class="page-heading workflow-header">
        <div><p class="eyebrow">工作流实验</p><h1>${esc(definition.title)}</h1><p>${esc(definition.summary)}</p></div>
        <a class="text-link" href="#/tasks">返回动手练习</a>
      </div>
      ${navigation()}${active === count ? resultPanel() : stepPanel()}
    </div>`;
    if (focus) main.querySelector('[data-workflow-heading]').focus();
  }

  function show(index, edit = false) {
    active = index;
    editing = edit;
    render({focus:true});
  }

  function update(value) {
    const previous = state();
    const next = core.updateOutput(previous, active, value, definition);
    if (next === previous) return;
    const saved = save(next);
    main.querySelectorAll('[data-workflow-check]').forEach(check => { check.checked = false; });
    // Refresh progress after editing a confirmed answer while preserving textarea focus.
    main.querySelector('.workflow-steps').outerHTML = navigation();
    main.querySelector('.workflow-status').textContent = saved
      ? '已自动保存在当前浏览器。' : '浏览器未能保存，请在学习设置中导出备份。';
  }

  main.addEventListener('input', event => {
    if (event.target.id === 'workflow-output' && ownsEvent(event)) update(event.target.value);
  });

  function ownsEvent(event) {
    return event.target.closest('[data-workflow-id]')?.dataset.workflowId === definition.id;
  }

  main.addEventListener('change', event => {
    const issueId = event.target.dataset.workflowRoute;
    if (!issueId || !ownsEvent(event)) return;
    const next = core.updateRouting(state(), issueId, event.target.value, definition);
    const saved = save(next);
    main.querySelector('.workflow-steps').outerHTML = navigation();
    main.querySelector('.workflow-routing-progress').textContent = routingProgress();
    main.querySelector('.workflow-routing-preview').innerHTML = routingPreview();
    main.querySelector('.workflow-status').textContent = saved
      ? '已自动保存在当前浏览器。' : '浏览器未能保存，请在学习设置中导出备份。';
  });

  main.addEventListener('click', event => {
    const target = event.target.closest('[data-workflow-step], [data-workflow-action]');
    if (!target || !ownsEvent(event)) return;
    if (target.dataset.workflowStep !== undefined) {
      if (!target.disabled) show(Number(target.dataset.workflowStep));
      return;
    }
    switch (target.dataset.workflowAction) {
      case 'resume':
        show(confirmedCount());
        break;
      case 'edit':
        show(active, true);
        main.querySelector('#workflow-output')?.focus();
        break;
      case 'edit-routing':
        show(routingIndex, true);
        break;
      case 'copy':
        copyText(core.buildPrompt(state(), active, definition, sampleInput));
        break;
      case 'example': {
        const editor = main.querySelector('#workflow-output');
        if (editor.value.trim() && editor.value !== definition.steps[active].example) {
          toast('已填入产物。清空输入框后即可填入示例。');
          break;
        }
        editor.value = definition.steps[active].example;
        editor.dispatchEvent(new Event('input', {bubbles:true}));
        const preview = editor.nextElementSibling;
        preview.open = true;
        preview.querySelector('summary').focus();
        break;
      }
      case 'confirm': {
        if (!state().steps[active].output.trim()) {
          const step = definition.steps[active];
          toast(step.example && !step.examplePreviewOnly ? '请先带回本步产物，或填入示例产物。' : '请粘贴本轮 Agent 返回的结果。');
          main.querySelector('#workflow-output').focus();
          break;
        }
        const unchecked = main.querySelector('[data-workflow-check]:not(:checked)');
        if (unchecked) {
          toast('请核对并勾选本步的检查项。');
          unchecked.focus();
          break;
        }
        const next = core.confirm(state(), active, definition);
        const saved = next === state() || save(next);
        show(confirmedCount());
        if (!saved) toast('本次结果在当前页面可用。请导出备份保存改动。');
        break;
      }
      case 'confirm-routing': {
        const choices = state().routing?.choices;
        const missing = review.items.find(item => !choices?.[item.id]);
        if (missing) {
          toast('请为每项选择下一步。');
          main.querySelector(`input[name="route-${missing.id}"]`).focus();
          break;
        }
        const saved = save(core.confirmRouting(state(), definition));
        show(confirmedCount());
        if (!saved) toast('本次结果在当前页面可用。请导出备份保存改动。');
        break;
      }
      case 'export-handoff': {
        const steps = state().steps;
        const sources = core.promptInputs(state(), finalIndex, definition, sampleInput);
        download('启程-' + finalStep.outputLabel + '-' + today() + '.md',
          '# ' + finalStep.outputLabel + '\n\n' + steps[finalIndex].output +
          sources.map(source => '\n\n## ' + source.label + '\n\n' + source.output).join(''), 'text/markdown');
        break;
      }
      case 'export': {
        const sections = definition.steps.map((step, index) => {
          const routing = index === routingIndex && !!state().routing;
          const title = index === routingIndex && !routing ? step.legacyTitle || step.outputLabel : step.outputLabel;
          const output = '## ' + title + '\n\n' + state().steps[index].output;
          return routing ? output : output + '\n\n' + (step.checks || []).map(check => '- [x] ' + check).join('\n');
        });
        if (state().routing?.previousBrief) sections.push('## 之前保存的简报\n\n' + state().routing.previousBrief);
        download('启程-' + definition.title + '-' + today() + '.md',
          '# ' + definition.title + '\n\n## ' + definition.sourceLabel + '\n\n' + sampleInput + '\n\n' + sections.join('\n\n'), 'text/markdown');
        break;
      }
    }
  });

  return {entry, href, isComplete:() => confirmedCount() === count, render() { show(confirmedCount()); }};
};
