/* State and transitions for a guided workflow with ordered steps. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AcademyWorkflowCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OUTPUT_LIMIT = 200000;
  const statuses = ['draft', 'confirmed', 'pending'];

  function blank(definition) {
    return {
      workflowId: definition.id,
      version: definition.version,
      steps: definition.steps.map(step => ({ id: step.id, output: '', status: 'draft' }))
    };
  }

  function currentStep(state) {
    const index = state.steps.findIndex(step => step.status !== 'confirmed');
    return index < 0 ? state.steps.length : index;
  }

  function isComplete(state) {
    return currentStep(state) === state.steps.length;
  }

  function hasFields(value, expected) {
    if (!isRecord(value)) return false;
    const keys = Object.keys(value);
    return keys.length === expected.length && expected.every(key => keys.includes(key));
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function validOutput(output) {
    return typeof output === 'string' && output.length <= OUTPUT_LIMIT;
  }

  function reviewIndex(definition) {
    return definition.steps.findIndex(step => step.type === 'review');
  }

  function validRoute(review, choice) {
    return review.options.some(option => option.id === choice);
  }

  function restore(raw, definition) {
    const fields = ['workflowId', 'version', 'steps'];
    const hasRouting = isRecord(raw) && Object.keys(raw).includes('routing');
    if (hasRouting) fields.push('routing');
    if (!hasFields(raw, fields) || raw.workflowId !== definition.id || !Array.isArray(raw.steps)) {
      throw new Error('工作流记录与当前实验不匹配。');
    }
    const isPriorVersion = Number.isInteger(definition.appendFromVersion) && raw.version === definition.appendFromVersion;
    const stepCount = definition.steps.length - Number(isPriorVersion);
    if ((!isPriorVersion && raw.version !== definition.version) || raw.steps.length !== stepCount) {
      throw new Error('工作流记录与当前实验不匹配。');
    }

    let previousConfirmed = true;
    const steps = definition.steps.slice(0, stepCount).map((step, index) => {
      const saved = raw.steps[index];
      if (!hasFields(saved, ['id', 'output', 'status']) || saved.id !== step.id ||
          !validOutput(saved.output) || !statuses.includes(saved.status)) {
        throw new Error('工作流步骤记录无效。');
      }
      if (saved.status === 'confirmed' && (!previousConfirmed || !saved.output.trim())) {
        throw new Error('工作流步骤必须按顺序确认，且需有实际产物。');
      }
      if (saved.status === 'pending' && (index === 0 || !saved.output.trim())) {
        throw new Error('待复核的步骤必须保留实际产物。');
      }
      if (saved.status === 'draft' && !previousConfirmed && saved.output.trim()) {
        throw new Error('有内容的后续步骤需要标记为待复核。');
      }
      previousConfirmed = saved.status === 'confirmed';
      return { id: saved.id, output: saved.output, status: saved.status };
    });
    if (isPriorVersion) steps.push({ id: definition.steps[stepCount].id, output: '', status: 'draft' });

    const state = { workflowId: raw.workflowId, version: definition.version, steps };
    const index = reviewIndex(definition);
    const reviewStep = definition.steps[index];
    const savedReview = steps[index];
    if (!hasRouting) {
      if (reviewStep && !reviewStep.legacyTitle && savedReview.output) {
        throw new Error('工作流交接单缺少审核决定。');
      }
      return state;
    }

    const review = reviewStep?.review;
    const routing = raw.routing;
    if (!review || !hasFields(routing, ['choices', 'previousBrief']) || !isRecord(routing.choices) ||
        !validOutput(routing.previousBrief) || (!reviewStep.legacyTitle && routing.previousBrief)) {
      throw new Error('工作流分流记录无效。');
    }
    const choices = Object.entries(routing.choices);
    if (!choices.length || choices.some(([id, choice]) => !review.items.some(item => item.id === id) || !validRoute(review, choice)) ||
        (savedReview.status === 'confirmed' && choices.length !== review.items.length)) {
      throw new Error('工作流分流决定无效。');
    }
    state.routing = { choices: Object.fromEntries(choices), previousBrief: routing.previousBrief };
    const currentHandoff = routingHandoff(state, definition);
    const matchesPrior = isPriorVersion && savedReview.output === routingHandoff(state, definition, true);
    if (savedReview.output !== currentHandoff && !matchesPrior) {
      throw new Error('工作流交接单与分流决定不匹配。');
    }
    savedReview.output = currentHandoff;
    return state;
  }

  function requireAvailableStep(state, index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.steps.length || index > currentStep(state)) {
      throw new Error('请先确认前一步的产物。');
    }
  }

  function mustUseReview(state, index, definition) {
    if (!definition) return !!state.routing && index === state.steps.length - 1;
    const step = definition.steps[index];
    return step.type === 'review' && (!!state.routing || !step.legacyTitle);
  }

  function updateOutput(state, index, output, definition) {
    requireAvailableStep(state, index);
    if (mustUseReview(state, index, definition)) throw new Error('请通过分流决定修改交接单。');
    return applyOutput(state, index, output);
  }

  function applyOutput(state, index, output, force = false) {
    if (!validOutput(output)) throw new Error('步骤产物超出长度限制或格式无效。');
    if (!force && state.steps[index].output === output) return state;

    const steps = state.steps.map((step, position) => {
      if (position < index) return step;
      if (position === index) {
        const status = step.status === 'pending' && output.trim() ? 'pending' : 'draft';
        return { ...step, output, status };
      }
      return { ...step, status: step.output.trim() ? 'pending' : 'draft' };
    });
    return { ...state, steps };
  }

  function confirm(state, index, definition) {
    requireAvailableStep(state, index);
    if (mustUseReview(state, index, definition)) throw new Error('请通过分流确认完成交接单。');
    return markConfirmed(state, index);
  }

  function markConfirmed(state, index) {
    const step = state.steps[index];
    if (!step.output.trim()) throw new Error('请先粘贴本步的实际产物。');
    if (step.status === 'confirmed') return state;

    const steps = state.steps.slice();
    steps[index] = { ...step, status: 'confirmed' };
    return { ...state, steps };
  }

  function routingHandoff(state, definition, usePreviousContext = false) {
    if (!state.routing) return '';
    const review = definition.steps[reviewIndex(definition)]?.review;
    if (!review) throw new Error('当前工作流没有可用的审核步骤。');
    const { choices } = state.routing;
    return review.options.map(option => {
      const lines = review.items.filter(item => choices[item.id] === option.id).map(item => {
        const context = usePreviousContext ? item.previousContext ?? item.context : item.context;
        return `- **${item.title}**（${item.refs.join('、')}）\n  - 依据 · ${context}\n  - 下一步 · ${item.actions[option.id]}`;
      });
      return `## ${option.heading}\n\n${lines.length ? lines.join('\n') : '暂无条目。'}`;
    }).join('\n\n');
  }

  function updateRouting(state, issueId, choice, definition) {
    const index = reviewIndex(definition);
    requireAvailableStep(state, index);
    const step = definition.steps[index];
    const review = step.review;
    if (!review || !review.items.some(item => item.id === issueId) || !validRoute(review, choice)) {
      throw new Error('请选择有效的审核条目和处理方式。');
    }
    if (state.routing?.choices[issueId] === choice) return state;

    const routing = state.routing || { choices: {}, previousBrief: step.legacyTitle ? state.steps[index].output : '' };
    const next = { ...state, routing: { ...routing, choices: { ...routing.choices, [issueId]: choice } } };
    return applyOutput(next, index, routingHandoff(next, definition), true);
  }

  function confirmRouting(state, definition) {
    const index = reviewIndex(definition);
    requireAvailableStep(state, index);
    const review = definition.steps[index].review;
    if (!state.routing || !review || !review.items.every(item => validRoute(review, state.routing.choices[item.id]))) {
      throw new Error('请为每项选择处理方式。');
    }
    return markConfirmed(state, index);
  }

  function promptInputs(state, index, definition, sampleInput) {
    requireAvailableStep(state, index);
    if (index === 0) {
      return sampleInput ? [{ label: definition.sourceLabel || '本次原始资料', output: sampleInput }] : [];
    }

    const included = new Set(definition.steps[index].includeSteps);
    const previous = index - 1;
    const inputs = [{ label: `已确认的上一步产物 · ${definition.steps[previous].outputLabel}`, output: state.steps[previous].output }];
    definition.steps.slice(0, previous).forEach((step, position) => {
      if (included.has(step.id)) inputs.push({ label: `已确认的前序产物 · ${step.outputLabel}`, output: state.steps[position].output });
    });
    return inputs;
  }

  function buildPrompt(state, index, definition, sampleInput) {
    const inputs = promptInputs(state, index, definition, sampleInput);
    const step = definition.steps[index];
    if (!step.prompt) throw new Error('请在本站完成审核步骤。');
    return [step.prompt, ...inputs.map(({ label, output }) => `【${label}】\n${output}`)].join('\n\n');
  }

  return { OUTPUT_LIMIT, blank, restore, currentStep, isComplete, updateOutput, confirm, buildPrompt,
    promptInputs, routingHandoff, updateRouting, confirmRouting };
});
