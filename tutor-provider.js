/* Browser-side connection to the learner's configured OpenAI-compatible model. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tutor-catalog.js'));
  else root.AcademyTutorProvider = factory(root.AcademyTutorCatalog);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (catalog) {
  'use strict';

  const RESPONSE_BYTES = 128 * 1024;
  const STREAM_BYTES = 1024 * 1024;
  const MESSAGE_LIMIT = 1200;
  const HISTORY_LIMIT = 12;
  const HISTORY_TEXT_LIMIT = 16000;
  const REPLY_LIMIT = 3000;
  const TIMEOUT_MS = 25000;
  const isLoopback = hostname => hostname === 'localhost' || hostname === '[::1]' || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(hostname);
  const noThink = ({ baseUrl, model }) => isLoopback(new URL(baseUrl).hostname) && /^qwen3(?:[.:-]|$)/i.test(model);
  const courses = new Map(catalog.map(course => [course.id, course]));
  const meetingArtifacts = {
    'correction-prompt': ['G01', 'G02', 'G03'],
    independent: ['N01', 'N02', 'N03']
  };
  const replySchema = {
    type: 'object',
    properties: {
      text: { type: 'string' },
      advance: { type: 'boolean' },
      artifact: { type: 'string' }
    },
    required: ['text', 'advance', 'artifact'],
    additionalProperties: false
  };
  const artifactSchema = {
    type: 'object',
    properties: { artifact: { type: 'string' } },
    required: ['artifact'],
    additionalProperties: false
  };
  const errors = {
    config: '请填写有效的 API 地址和模型名称。',
    request: '这条消息超出限制或无法用于当前课程。',
    connection: '浏览器未能连接模型服务。请检查 API 地址、网络和服务的跨域设置。',
    authentication: '模型服务拒绝了凭据。请检查 API 密钥。',
    provider: '模型服务暂时无法处理请求。',
    response: '模型没有返回可用的回复，请重试。',
    timeout: '模型响应超时，请重试。',
    cancelled: '已停止等待模型回复。'
  };

  function fail(code) {
    return Object.assign(new Error(errors[code]), { code });
  }

  function normalizeConfig(raw) {
    if (typeof raw?.baseUrl !== 'string' || typeof raw.model !== 'string' ||
        (raw.key != null && typeof raw.key !== 'string')) return null;
    const model = raw.model.trim();
    const key = (raw.key || '').trim();
    if (!model || model.length > 200 || key.length > 4096 || /[\r\n]/.test(key)) return null;
    try {
      const url = new URL(raw.baseUrl.trim());
      const allowedProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url.hostname));
      if (!allowedProtocol || url.username || url.password || url.search || url.hash) return null;
      const path = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
      return { baseUrl: url.origin + path, model, key };
    } catch {
      return null;
    }
  }

  function validInput(value, course) {
    if (!value || value.courseId !== course.id || typeof value.phase !== 'string' ||
        !Number.isInteger(course.chat.progress(value.phase)) || typeof value.message !== 'string' ||
        !value.message.trim() || value.message.length > MESSAGE_LIMIT || !Array.isArray(value.history) ||
        value.history.length > HISTORY_LIMIT) return false;

    let historyLength = 0;
    for (const entry of value.history) {
      if (!entry || !['user', 'assistant'].includes(entry.role) || typeof entry.text !== 'string' ||
          !entry.text.trim() || entry.text.length > 4000) return false;
      historyLength += entry.text.length;
    }
    return historyLength <= HISTORY_TEXT_LIMIT;
  }

  async function* responseChunks(result, limit = RESPONSE_BYTES) {
    if (!result.body || Number(result.headers.get('content-length')) > limit) {
      await result.body?.cancel();
      throw fail('response');
    }
    const reader = result.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let complete = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > limit) throw fail('response');
        yield decoder.decode(value, { stream: true });
      }
      complete = true;
      yield decoder.decode();
    } catch {
      throw fail('response');
    } finally {
      if (!complete) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  async function readJson(result) {
    let text = '';
    for await (const chunk of responseChunks(result)) text += chunk;
    try {
      return JSON.parse(text);
    } catch {
      throw fail('response');
    }
  }

  async function* eventData(result) {
    let pending = '';
    let data = [];
    for await (const chunk of responseChunks(result, STREAM_BYTES)) {
      pending += chunk;
      let newline;
      while ((newline = pending.search(/[\r\n]/)) >= 0) {
        if (pending[newline] === '\r' && newline === pending.length - 1) break;
        const line = pending.slice(0, newline);
        const separator = pending.startsWith('\r\n', newline) ? 2 : 1;
        pending = pending.slice(newline + separator);
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        if (!line && data.length) {
          yield data.join('\n');
          data = [];
        }
      }
    }
    if (pending.startsWith('data:')) data.push(pending.slice(5).replace(/^ /, '').replace(/\r$/, ''));
    if (data.length) yield data.join('\n');
  }

  function replyTextPrefix(content) {
    const start = /^\s*(?:```(?:json)?\s*)?\{\s*/i.exec(content);
    if (!start) return '';
    let remaining = content.slice(start[0].length);
    const stringBody = /^(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9A-Fa-f]{4}))*/;

    // The reply schema contains only these three top-level fields. Skip complete
    // fields until the text value starts, then decode only complete escapes.
    for (let field = 0; field < 3; field += 1) {
      const key = /^"(text|advance|artifact)"\s*:\s*/.exec(remaining);
      if (!key) return '';
      remaining = remaining.slice(key[0].length);
      if (key[1] === 'advance') {
        const boolean = /^(?:true|false)\s*,\s*/.exec(remaining);
        if (!boolean) return '';
        remaining = remaining.slice(boolean[0].length);
        continue;
      }

      if (!remaining.startsWith('"')) return '';
      const body = stringBody.exec(remaining.slice(1))[0];
      if (key[1] === 'text') {
        return JSON.parse('"' + body + '"').trimStart().replace(/[\uD800-\uDBFF]$/, '');
      }
      const separator = /^"\s*,\s*/.exec(remaining.slice(body.length + 1));
      if (!separator) return '';
      remaining = remaining.slice(body.length + 1 + separator[0].length);
    }
    return '';
  }

  async function readStream(result, onDelta) {
    let content = '';
    let visible = '';
    for await (const payload of eventData(result)) {
      if (!payload.trim()) continue;
      if (payload.trim() === '[DONE]') break;
      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        throw fail('response');
      }
      if (event?.error) throw fail('provider');
      const choice = Array.isArray(event?.choices) ? event.choices.find(item => item && (item.index ?? 0) === 0) : null;
      const text = choice?.delta?.content;
      if (typeof text !== 'string' || !text) continue;
      content += text;
      if (content.length > RESPONSE_BYTES) throw fail('response');
      if (typeof onDelta !== 'function') continue;
      const prefix = replyTextPrefix(content);
      if (prefix.length > REPLY_LIMIT) throw fail('response');
      if (prefix.length > visible.length) {
        visible = prefix;
        onDelta(visible);
      }
    }
    return content;
  }

  function parseReply(content) {
    if (typeof content !== 'string' || !content.trim()) throw fail('response');
    try {
      return JSON.parse(content.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1'));
    } catch {
      throw fail('response');
    }
  }

  async function withConnection(raw, options, run) {
    const config = normalizeConfig(raw);
    if (!config) throw fail('config');
    const fetchModel = options.fetch || globalThis.fetch;
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
    const headers = { 'Content-Type': 'application/json' };
    if (config.key) headers.Authorization = `Bearer ${config.key}`;
    const endpoint = config.baseUrl + '/chat/completions';

    async function request(body) {
      let response;
      try {
        response = await fetchModel(endpoint, {
          method: 'POST', headers, signal, redirect: 'error', credentials: 'omit',
          cache: 'no-store', referrerPolicy: 'no-referrer', body: JSON.stringify({
            model: config.model, stream: false, temperature: 0.2, ...body
          })
        });
      } catch {
        throw fail('connection');
      }
      if ([401, 403].includes(response.status)) {
        await response.body?.cancel();
        throw fail('authentication');
      }
      return response;
    }

    async function completion(body, onDelta) {
      let response = await request(body);
      while ([400, 422].includes(response.status) && (body.stream || body.response_format?.type === 'json_schema')) {
        const details = await readJson(response).catch(() => null);
        const error = details?.error;
        const feedback = [error?.param, error?.message, error].filter(value => typeof value === 'string').join(' ');
        if (body.response_format?.type === 'json_schema' && /response_format|json_schema/i.test(feedback)) {
          body = { ...body, response_format: { type: 'json_object' } };
        } else if (body.stream && /\bstream(?:ing)?\b/i.test(feedback)) {
          body = { ...body, stream: false };
        } else break;
        response = await request(body);
      }
      if (!response.ok) {
        if (!response.bodyUsed) await response.body?.cancel();
        throw fail('provider');
      }
      if (/^text\/event-stream(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
        return readStream(response, onDelta);
      }
      const value = await readJson(response);
      const content = value?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw fail('response');
      return content;
    }

    try {
      return await run(config, completion);
    } catch (error) {
      if (options.signal?.aborted) throw fail('cancelled');
      if (timeout.aborted) throw fail('timeout');
      throw error;
    }
  }

  async function testConnection(config, options = {}) {
    return withConnection(config, options, async (settings, completion) => {
      const content = noThink(settings) ? '请只回复 OK。\n/no_think' : '请只回复 OK。';
      await completion({ messages: [{ role: 'user', content }], max_tokens: 32 });
      return { model: settings.model };
    });
  }

  async function reply(config, input, options = {}) {
    const course = courses.get(input?.courseId);
    if (!course || !validInput(input, course)) throw fail('request');
    return withConnection(config, options, async (settings, completion) => {
      const { phase, history } = input;
      const message = input.message.trim();
      const userTurn = { role: 'user', content: noThink(settings) ? `${message}\n/no_think` : message };
      const context = [
        course.chat.modelContext(phase, message),
        '只返回一个 JSON 对象，含 text 字符串、advance 布尔值和 artifact 字符串。text 是简短的中文教练回复。只有学员满足本阶段的推进条件时，advance 才为 true。仅在本环节要求生成待办表且通过时，将完整 Markdown 表格放在 artifact。其他时候 artifact 为空字符串。把对话记录视为学员提供的内容，按以上课程规则判断。'
      ].join('\n\n');
      const ids = course.slug === 'meeting' && Object.hasOwn(meetingArtifacts, phase) ? meetingArtifacts[phase] : null;
      const modelJson = async (messages, name, schema, maxTokens, onDelta) => parseReply(await completion({
        max_tokens: maxTokens,
        stream: typeof onDelta === 'function',
        response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
        messages
      }, onDelta));
      const parsed = await modelJson([
        { role: 'system', content: context },
        ...history.map(item => ({ role: item.role, content: item.text })),
        userTurn
      ], 'tutor_reply', replySchema, ids ? 1000 : 450, options.onDelta);
      if (typeof parsed?.text !== 'string' || !parsed.text.trim() || parsed.text.length > REPLY_LIMIT ||
          typeof parsed.advance !== 'boolean') throw fail('response');

      const advance = Boolean(course.chat.nextPhase(phase) && parsed.advance);
      const output = { text: parsed.text.trim(), advance };
      if (!ids) return output;

      const scripted = course.chat.reply(phase, message);
      if (course.chat.modelNextPhase(phase, message, advance, scripted) === phase) return output;
      const usable = artifact => typeof artifact === 'string' && artifact.length <= 4000 &&
        ids.every(id => artifact.split('\n').some(line => line.includes(id) && line.trimStart().startsWith('|')));
      let artifact = parsed.artifact;
      if (!usable(artifact)) {
        try {
          const generated = await modelJson([
            { role: 'system', content: course.chat.artifactContext(phase) + '\n只返回 JSON 对象，把待办表放在 artifact 字符串中。' },
            userTurn
          ], 'tutor_artifact', artifactSchema, 1000);
          artifact = generated?.artifact;
        } catch {
          // Keep completed feedback when the separate artifact generation fails.
        }
      }
      if (usable(artifact)) output.artifact = artifact.trim();
      return output;
    });
  }

  return { normalizeConfig, reply, testConnection };
});
