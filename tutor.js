/* Course conversation and local resume state. */
window.createTutorUI = function (ctx) {
  'use strict';

  const {main, esc, icon, answerPreview, content, openDialog, closeDialog} = ctx;
  const provider = window.AcademyTutorProvider;
  const {chat, stages} = content;
  const storageKey = 'qicheng.tutor.' + content.id + '.chat.v1';
  const modelStorageKey = 'qicheng.tutor.model.v1';
  const href = '#/tutor/' + content.slug;
  const isCurrent = () => location.hash === href;
  const messageLimit = 1200;
  const transcriptLimit = 120;
  const initialState = () => ({
    phase: 'intro',
    messages: [{role: 'assistant', source: 'lesson', text: chat.opening.text}],
    actions: chat.opening.actions
  });
  const validActions = actions => Array.isArray(actions) && actions.every(action =>
    action && typeof action.label === 'string' && typeof action.value === 'string');

  let state = initialState();
  let savedLocally = true;
  let modelConfig = null;
  let rememberKey = false;
  let modelAnswered = false;
  let pending = null;
  let requestError = '';
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Number.isInteger(chat.progress(saved.phase)) && validActions(saved.actions) &&
        Array.isArray(saved.messages) && saved.messages.length > 0 && saved.messages.length <= transcriptLimit &&
        saved.messages.every(message => message && ['assistant', 'user'].includes(message.role) &&
          typeof message.text === 'string' && message.text.length <= 20000)) state = saved;
  } catch {}
  if (typeof state.outbox !== 'string' || state.outbox.length > messageLimit) delete state.outbox;
  function loadModelConfig() {
    try {
      const stored = JSON.parse(localStorage.getItem(modelStorageKey));
      const sessionKey = window.sessionStorage.getItem(modelStorageKey);
      const config = provider.normalizeConfig(stored && {...stored, key: stored.key || sessionKey || ''});
      if (JSON.stringify(config) !== JSON.stringify(modelConfig)) modelAnswered = false;
      modelConfig = config;
      rememberKey = Boolean(stored?.key);
    } catch {}
  }

  const avatar = () => `<span class="tutor-avatar" aria-hidden="true">${icon('star')}</span>`;
  const field = () => main.querySelector('#tutor-input');
  const select = selector => main.querySelector(selector);
  function modeLabel() {
    if (!modelConfig) return '尚未配置模型';
    return (modelAnswered ? '模型已回复' : '已配置模型') + ' · ' + modelConfig.model;
  }

  function showModelSettings() {
    loadModelConfig();
    const config = modelConfig;
    openDialog('配置自己的模型', `
      <p>填写学员自己的 OpenAI 兼容接口。浏览器会直接向这个地址发送对话。</p>
      <form id="tutor-model-form" class="tutor-model-form" data-tutor-course="${esc(content.id)}">
        <div class="form-group"><label class="input-label" for="tutor-model-url">接口地址</label>
          <input class="form-input" id="tutor-model-url" name="baseUrl" type="url" maxlength="2048" required autocomplete="off"
            placeholder="http://127.0.0.1:11434/v1" value="${esc(config?.baseUrl)}">
          <p class="field-hint">填写兼容 API 的基础地址，例如本机 Ollama 的 http://127.0.0.1:11434/v1。</p></div>
        <div class="form-group"><label class="input-label" for="tutor-model-name">模型名称</label>
          <input class="form-input" id="tutor-model-name" name="model" maxlength="200" required autocomplete="off"
            placeholder="qwen2.5:7b" value="${esc(config?.model)}"></div>
        <div class="form-group"><label class="input-label" for="tutor-model-key">API 密钥（按需）</label>
          <input class="form-input" id="tutor-model-key" name="key" type="password" maxlength="4096" autocomplete="off"
            placeholder="本机 Ollama 通常可以留空" value="${esc(config?.key)}">
          <label class="tutor-model-remember"><input type="checkbox" name="remember" id="tutor-model-remember" ${rememberKey ? 'checked' : ''}>在此浏览器记住密钥</label>
          <p class="field-hint">默认仅在当前标签页会话保留密钥。接口地址和模型名称保存在当前浏览器。</p></div>
        <p class="tutor-model-status" role="status" aria-live="polite"></p>
      </form>`, `
        ${config ? '<button type="button" class="button ghost" data-tutor-action="clear-model">清除配置</button>' : ''}
        <button type="button" class="button secondary" data-tutor-action="test-model">测试连接</button>
        <button type="submit" class="button primary" form="tutor-model-form">保存配置</button>`);
  }

  function modelError(error) {
    return ({
      config: '请检查接口地址和模型名称。接口地址须为 HTTPS 或本机 HTTP。',
      connection: '无法连接模型。请检查模型服务和跨域许可（CORS），确认它允许当前网站访问。',
      authentication: '模型服务拒绝了验证。请检查 API 密钥。',
      provider: '模型服务返回错误。请检查模型名称和服务状态。',
      response: '回复格式不符合要求。请选支持结构化 JSON 的 OpenAI 兼容模型。',
      timeout: '模型响应超时，可以再试一次。'
    })[error?.code] || '暂时没有收到模型回复，请再试一次。';
  }

  function readModelForm(form) {
    return provider.normalizeConfig({
      baseUrl: form.elements.baseUrl.value,
      model: form.elements.model.value,
      key: form.elements.key.value
    });
  }

  function setModelConfig(config, remember) {
    if (config) {
      const {baseUrl, model, key} = config;
      localStorage.setItem(modelStorageKey, JSON.stringify({baseUrl, model, ...(remember && key ? {key} : {})}));
      if (key && !remember) window.sessionStorage.setItem(modelStorageKey, key);
      else window.sessionStorage.removeItem(modelStorageKey);
    } else {
      localStorage.removeItem(modelStorageKey);
      window.sessionStorage.removeItem(modelStorageKey);
    }
    pending?.controller.abort();
    pending = null;
    modelConfig = config;
    rememberKey = Boolean(remember && config?.key);
    modelAnswered = false;
    requestError = '';
    if (isCurrent()) {
      refreshOutgoing();
      updateComposer();
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      savedLocally = true;
    } catch {
      savedLocally = false;
    }
  }

  function samePhaseAttempts(phase) {
    const attempts = [];
    for (let index = state.messages.length - 1; index >= 0 && attempts.length < 4; index -= 1) {
      const message = state.messages[index];
      if (message.role !== 'user') continue;
      if (message.phase !== phase) break;
      attempts.unshift(message.text);
    }
    return attempts;
  }

  function resumeAcceptedAnswer() {
    if (state.phase !== 'transfer-check') return;
    const latestAnswer = state.messages.findLast(message => message.role === 'user');
    if (!latestAnswer) return;
    const reply = chat.reply(state.phase, latestAnswer.text);
    if (chat.modelNextPhase(state.phase, latestAnswer.text, false, reply) !== 'guided') return;
    state.messages = [...state.messages, {role: 'assistant', source: 'lesson', text: reply.text}].slice(-transcriptLimit);
    state.phase = reply.phase;
    state.actions = reply.actions;
    save();
  }

  function messageMarkup(message) {
    const label = message.role === 'user' ? '你'
      : ({model: 'AI 教练 · 模型回复', lesson: '课程讲解'})[message.source] || '启程教练';
    return `<article class="tutor-message" data-role="${message.role}" aria-label="${label}">
      ${message.role === 'assistant' ? avatar() : ''}
      <div class="tutor-message-content">
        <div class="tutor-message-name">${label}</div>
        ${message.role === 'assistant' ? answerPreview(message.text) : `<p class="tutor-user-text">${esc(message.text)}</p>`}
      </div>
    </article>`;
  }

  function outgoingMarkup() {
    if (!state.outbox) return '';
    const user = messageMarkup({role: 'user', text: state.outbox});
    const model = pending
      ? `<article class="tutor-message" data-role="assistant">
          ${avatar()}<div class="tutor-message-content"><div class="tutor-message-name">AI 教练</div>
          <div class="tutor-pending-text output-preview" data-tutor-stream>${pending.partial ? esc(pending.partial) : '<span class="tutor-thinking" role="status">正在思考<span aria-hidden="true">…</span></span>'}</div></div>
        </article>`
      : `<div class="tutor-send-failure">
          <p role="status">${esc(requestError || '这条消息的回复尚未完成。')}</p>
          <button type="button" class="tutor-reply" data-tutor-action="retry-message">重试</button>
          <button type="button" class="tutor-reply" data-tutor-action="edit-message">编辑消息</button>
        </div>`;
    return user + model;
  }

  function refreshOutgoing() {
    const outgoing = select('[data-tutor-outgoing]');
    if (outgoing) outgoing.innerHTML = outgoingMarkup();
  }

  function repliesMarkup() {
    return state.actions.map((action, index) =>
      `<button type="button" class="tutor-reply" data-tutor-reply="${index}">${esc(action.label)}</button>`).join('');
  }

  const inputHint = () => chat.inputHint(state.phase);

  function currentLesson() {
    const position = chat.position(state.phase);
    if (position) return `讲解 ${position.current}/${position.total} · ${position.label}`;
    return stages[chat.progress(state.phase)]?.title || '已完成';
  }

  function progressMarkup() {
    const completed = chat.progress(state.phase);
    return `<span>课程进度</span><strong>${completed} / ${stages.length}</strong>
      <progress value="${completed}" max="${stages.length}" aria-label="已完成的课程环节"></progress>`;
  }

  function stagesMarkup() {
    const completed = chat.progress(state.phase);
    return stages.map((stage, index) => {
      const status = index < completed ? 'done' : index === completed ? 'current' : 'pending';
      const label = {done: '已完成', current: '进行中', pending: '待开始'}[status];
      return `<li data-status="${status}" ${status === 'current' ? 'aria-current="step"' : ''}>
        <span class="tutor-stage-marker" aria-hidden="true">${status === 'done' ? icon('check') : ''}</span>
        <div><strong>${esc(stage.title)}</strong><p>${esc(stage.description)}</p></div>
        <small aria-label="${label}">${label}</small>
      </li>`;
    }).join('');
  }

  function scrollToLatest(startOfReply = false) {
    const thread = main.querySelector('.tutor-thread');
    const latest = thread?.querySelector('.tutor-message:last-of-type');
    if (!latest) return;
    if (startOfReply && latest.offsetHeight + 55 > thread.clientHeight) {
      thread.scrollTop += latest.getBoundingClientRect().top - thread.getBoundingClientRect().top - 12;
    } else {
      thread.scrollTop = thread.scrollHeight;
    }
  }

  function render() {
    loadModelConfig();
    resumeAcceptedAnswer();
    const expanded = !window.matchMedia?.('(max-width: 900px)').matches;
    main.innerHTML = `<div class="tutor-page">
      <div class="tutor-chat-layout">
        <section class="tutor-chat" aria-labelledby="tutor-title">
          <header class="tutor-chat-header">
            ${avatar()}
            <div class="tutor-chat-label"><h1 id="tutor-title">${esc(content.chatTitle || content.title)}</h1><p data-tutor-mode>${esc(modeLabel())}</p></div>
            <div class="tutor-chat-actions">
              <button type="button" class="tutor-model-button" data-tutor-action="configure-model">${modelConfig ? '模型设置' : '配置模型'}</button>
              <a class="tutor-back" href="#/route">返回课程</a>
            </div>
          </header>
          <div class="tutor-thread" tabindex="0" aria-label="课程对话">
            <div class="tutor-thread-inner">
              <div role="log" aria-label="消息" aria-relevant="additions" data-tutor-log>${state.messages.map(messageMarkup).join('')}</div>
              <div class="tutor-outgoing" data-tutor-outgoing>${outgoingMarkup()}</div>
            </div>
          </div>
          <form class="tutor-composer">
            <div class="tutor-replies" role="group" aria-label="建议回复">${repliesMarkup()}</div>
            <div class="tutor-input-row">
              <textarea id="tutor-input" rows="2" maxlength="${messageLimit}" aria-label="发消息给启程教练" placeholder="${esc(inputHint())}"></textarea>
              <button type="submit" class="button primary tutor-send" aria-label="发送消息">发送 ${icon('arrow')}</button>
            </div>
            <p class="tutor-input-help" role="status">${savedLocally ? 'Enter 发送 · Shift + Enter 换行' : '浏览器未能保存这段对话。'}</p>
          </form>
        </section>
        <aside class="tutor-sidebar" aria-label="课程信息">
          <details class="tutor-outline" ${expanded ? 'open' : ''}>
            <summary><span>课程大纲</span><span class="tutor-current-lesson">${esc(currentLesson())}</span></summary>
            <div class="tutor-progress">${progressMarkup()}</div>
            <ol class="tutor-stages">${stagesMarkup()}</ol>
            <button type="button" class="tutor-restart" data-tutor-action="restart">重新开始</button>
          </details>
        </aside>
      </div>
    </div>`;
    updateComposer();
    if (state.outbox || state.messages.length > 1) scrollToLatest(!state.outbox);
  }

  function updateComposer() {
    const editor = field();
    if (!editor) return;
    select('[data-tutor-mode]').textContent = modeLabel();
    const waiting = Boolean(pending);
    const local = !modelConfig;
    select('.tutor-model-button').textContent = local ? '配置模型' : '模型设置';
    select('.tutor-send').disabled = Boolean(waiting) || local || Boolean(state.outbox);
    editor.readOnly = local;
    editor.placeholder = local ? '连接模型后即可自由提问…' : inputHint();
    const phase = state.phase;
    select('.tutor-replies').querySelectorAll('button').forEach(button => {
      const action = state.actions[Number(button.dataset.tutorReply)];
      button.disabled = Boolean(waiting) || Boolean(state.outbox) || (local && !isLessonAction(action.value, phase, chat.reply(phase, action.value)));
    });
    const retry = select('[data-tutor-action="retry-message"]');
    if (retry) retry.disabled = local;
    select('.tutor-input-help').textContent = local ? '点「配置模型」后即可提问和练习。' : (savedLocally
        ? 'Enter 发送 · Shift + Enter 换行' : '浏览器未能保存这段对话。');
    select('.tutor-composer').setAttribute('aria-busy', String(Boolean(pending)));
  }

  function modelHistory(phase) {
    const messages = content.slug === 'meeting'
      ? state.messages : state.messages.filter(message => message.phase === phase);
    return messages.slice(-8).map(({role, text}) => ({role, text: text.slice(0, 1800)}));
  }

  function appendTurn(text, reply, fromSuggestion) {
    const messages = [
      {role: 'user', phase: state.phase, text},
      {role: 'assistant', phase: reply.lesson ? state.phase : reply.phase, source: reply.source, text: reply.text}
    ];
    if (reply.lesson) messages.push({role: 'assistant', phase: reply.phase, source: 'lesson', text: reply.lesson});
    state.messages = [...state.messages, ...messages].slice(-transcriptLimit);
    state.phase = reply.phase;
    state.actions = reply.actions;
    delete state.outbox;
    save();

    if (!isCurrent()) return;
    const log = select('[data-tutor-log]');
    if (!log) return;
    refreshOutgoing();
    log.insertAdjacentHTML('beforeend', messages.map(messageMarkup).join(''));
    while (log.children.length > transcriptLimit) log.firstElementChild.remove();
    main.querySelector('.tutor-replies').innerHTML = repliesMarkup();
    main.querySelector('.tutor-current-lesson').textContent = currentLesson();
    main.querySelector('.tutor-progress').innerHTML = progressMarkup();
    main.querySelector('.tutor-stages').innerHTML = stagesMarkup();
    updateComposer();
    if (fromSuggestion) {
      const focusTarget = main.querySelector('.tutor-reply') || main.querySelector('.tutor-thread');
      focusTarget.focus({preventScroll: true});
    } else if (matchMedia('(pointer: fine)').matches) {
      field().focus({preventScroll: true});
    }
    scrollToLatest(true);
  }

  function isLessonAction(text, phase, scripted) {
    return scripted.phase !== phase && !chat.isAssessment(phase) && chat.phaseActions(phase).some(action => action.value === text);
  }

  async function send(value, fromSuggestion = false, retry = false) {
    const text = value.trim();
    if (!text || text.length > messageLimit || pending || (state.outbox && !retry)) return;
    requestError = '';
    const phase = state.phase;
    const attempts = samePhaseAttempts(phase);
    const scripted = chat.reply(phase, text, attempts);
    if (fromSuggestion && isLessonAction(text, phase, scripted)) {
      appendTurn(text, {...scripted, source: 'lesson'}, fromSuggestion);
      return;
    }
    if (!modelConfig) return;
    if (scripted.feedback) {
      if (!fromSuggestion && !retry && field().value.trim() === text) field().value = '';
      appendTurn(text, {
        ...scripted, text: scripted.feedback, source: 'lesson', lesson: chat.phaseIntro(scripted.phase)
      }, fromSuggestion);
      return;
    }
    const request = {controller: new AbortController(), partial: ''};
    pending = request;
    state.outbox = text;
    save();
    const editor = field();
    if (!fromSuggestion && !retry && editor.value.trim() === text) editor.value = '';
    refreshOutgoing();
    updateComposer();
    scrollToLatest();
    try {
      const model = await provider.reply(modelConfig, {
        courseId: content.id, phase, message: text, history: modelHistory(phase)
      }, {
        signal: request.controller.signal,
        onDelta(partial) {
          if (pending !== request) return;
          request.partial = partial;
          const output = select('[data-tutor-stream]');
          if (!isCurrent() || !output) return;
          const thread = select('.tutor-thread');
          const follow = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60;
          output.textContent = partial;
          if (follow) scrollToLatest();
        }
      });
      if (pending !== request) return;
      modelAnswered = true;
      pending = null;
      const nextPhase = chat.modelNextPhase(phase, text, model.advance, scripted, attempts);
      const advanced = nextPhase !== phase;
      let reply = {
        text: model.text,
        source: 'model',
        phase: nextPhase,
        actions: scripted.phase === state.phase ? scripted.actions : chat.phaseActions(state.phase)
      };
      if (advanced) {
        const activity = model.artifact ? chat.phaseAfterArtifact(nextPhase) : '';
        const usesReference = !activity && Boolean(chat.artifactContext(phase));
        if (activity) {
          reply.text += '\n\n' + model.artifact;
          reply.lesson = activity;
        } else if (usesReference) {
          reply.lesson = '这次没有生成完整的待办表。\n\n' + chat.phaseIntro(nextPhase);
        } else {
          reply.lesson = scripted.phase === nextPhase ? scripted.text : chat.phaseIntro(nextPhase);
        }
        reply.actions = chat.phaseActions(nextPhase);
      } else if (state.phase === 'transfer-check' && model.advance && scripted.phase === state.phase) {
        reply.lesson = scripted.text;
      }
      appendTurn(text, reply, fromSuggestion);
    } catch (error) {
      if (pending !== request) return;
      pending = null;
      modelAnswered = false;
      requestError = modelError(error) + ' 消息已保留。';
      if (isCurrent()) {
        refreshOutgoing();
        updateComposer();
      }
    }
  }

  main.addEventListener('submit', event => {
    if (!isCurrent() || !event.target.matches('.tutor-composer')) return;
    event.preventDefault();
    send(field().value);
  });

  main.addEventListener('keydown', event => {
    if (!isCurrent() || event.target.id !== 'tutor-input' || event.key !== 'Enter' || event.shiftKey ||
        event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    send(event.target.value);
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id !== 'tutor-model-form' || form.dataset.tutorCourse !== content.id) return;
    event.preventDefault();
    const config = readModelForm(form);
    const status = form.querySelector('.tutor-model-status');
    if (!config) {
      status.textContent = modelError({code: 'config'});
      return;
    }
    try {
      setModelConfig(config, form.elements.remember.checked);
      closeDialog();
    } catch {
      status.textContent = '浏览器无法保存模型配置。';
    }
  });

  document.addEventListener('click', async event => {
    const modelAction = event.target.closest('[data-tutor-action="configure-model"], [data-tutor-action="test-model"], [data-tutor-action="clear-model"]');
    const action = modelAction?.dataset.tutorAction;
    if (action === 'configure-model' || action === 'test-model' || action === 'clear-model') {
      if (action === 'configure-model') {
        if (isCurrent() || (content.slug === 'meeting' && location.hash === '#/settings')) showModelSettings();
        return;
      }
      const form = document.getElementById('tutor-model-form');
      if (!form || form.dataset.tutorCourse !== content.id) return;
      const status = form.querySelector('.tutor-model-status');
      if (action === 'clear-model') {
        try {
          setModelConfig(null, false);
          closeDialog();
        } catch {
          status.textContent = '浏览器未能清除模型配置。';
        }
        return;
      }
      if (!form.reportValidity()) return;
      const config = readModelForm(form);
      if (!config) {
        status.textContent = modelError({code: 'config'});
        return;
      }
      modelAction.disabled = true;
      status.textContent = '正在向模型发送测试消息…';
      try {
        const result = await provider.testConnection(config);
        status.textContent = '连接成功，' + result.model + ' 已回复。';
      } catch (error) {
        status.textContent = modelError(error);
      } finally {
        modelAction.disabled = false;
      }
      return;
    }
    if (!isCurrent()) return;
    const reply = event.target.closest('[data-tutor-reply]');
    if (reply) {
      const action = state.actions[Number(reply.dataset.tutorReply)];
      if (action) send(action.value, true);
      return;
    }
    if (event.target.closest('[data-tutor-action="retry-message"]') && state.outbox) {
      send(state.outbox, false, true);
      return;
    }
    if (event.target.closest('[data-tutor-action="edit-message"]') && state.outbox && !pending) {
      const editor = field();
      editor.value = [state.outbox, editor.value].filter(Boolean).join('\n').slice(0, messageLimit);
      delete state.outbox;
      requestError = '';
      save();
      refreshOutgoing();
      updateComposer();
      editor.focus({preventScroll: true});
      return;
    }
    if (event.target.closest('[data-tutor-action="restart"]')) {
      openDialog('重新开始这节课？', '<p>重新开始会清空这段陪练对话。</p>',
        '<button type="button" class="button secondary" data-action="close-dialog">继续当前对话</button><button type="button" class="button primary" data-tutor-action="confirm-restart">从第一句开始</button>');
    }
    if (event.target.closest('[data-tutor-action="confirm-restart"]')) {
      closeDialog();
      pending?.controller.abort();
      pending = null;
      requestError = '';
      state = initialState();
      save();
      render();
      main.querySelector('.tutor-thread')?.focus({preventScroll: true});
    }
  });

  return {
    href, render,
    status: () => chat.progress(state.phase) === stages.length ? '回顾课程'
      : state.messages.some(message => message.role === 'user') || state.outbox ? '继续上课' : '开始上课'
  };
};
