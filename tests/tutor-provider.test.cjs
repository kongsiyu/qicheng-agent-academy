'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeConfig, reply, testConnection } = require('../tutor-provider.js');
const catalog = require('../tutor-catalog.js');

const config = { baseUrl: 'http://127.0.0.1:11434/v1/', model: 'qwen3:4b' };
const input = { courseId: 'meeting-tutor', phase: 'comprehension', message: '根据 D02 标为待确认。', history: [] };
const completion = content => Response.json({ choices: [{ message: { content } }] });
const modelReply = value => completion(JSON.stringify(value));
const event = delta => `data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\r\n\r\n`;

function eventStream(wire) {
  const bytes = new TextEncoder().encode(wire);
  let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) controller.close();
      else {
        const end = Math.min(offset + (offset % 5 || 1), bytes.length);
        controller.enqueue(bytes.slice(offset, end));
        offset = end;
      }
    }
  }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

test('loads course-specific materials and supports every new course progression', async () => {
  const newCourses = catalog.filter(course => course.slug !== 'meeting');
  assert.equal(newCourses.length, 10);
  assert.equal(new Set(catalog.map(course => course.id)).size, catalog.length);
  for (const course of newCourses) {
    const {chat} = course;
    let phase = 'intro';
    for (let step = 1; step <= 5; step += 1) {
      assert.equal(chat.position(phase).current, step);
      phase = chat.reply(phase, chat.phaseActions(phase)[0].value).phase;
    }
    for (const [index, exercise] of ['check', 'guided', 'review', 'independent'].entries()) {
      assert.equal(phase, exercise);
      assert.equal(chat.progress(phase), index);
      const message = '这是我根据本题材料写的答案。';
      const result = await reply(config, {courseId: course.id, phase, message, history: []}, {
        fetch: async (_url, init) => {
          const system = JSON.parse(init.body).messages[0].content;
          assert.ok(system.includes(course.title));
          assert.ok(system.includes(chat.phaseIntro(phase)));
          assert.match(system, /教练判断依据/);
          assert.doesNotMatch(chat.phaseIntro(phase), /教练判断依据/);
          return modelReply({text: '已核对本题答案。', advance: true, artifact: ''});
        }
      });
      assert.equal(chat.modelNextPhase(phase, '我明白了', true, chat.reply(phase, '我明白了')), phase);
      assert.equal(chat.modelNextPhase(phase, '给个提示', true, chat.reply(phase, '给个提示')), phase);
      phase = chat.modelNextPhase(phase, message, result.advance, chat.reply(phase, message));
    }
    assert.equal(phase, 'complete');
    assert.equal(chat.progress(phase), 4);
  }
});

test('requires an explicitly configured model and validates endpoint normalization', () => {
  assert.deepEqual(normalizeConfig({ ...config, key: '  local-key  ' }), {
    baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3:4b', key: 'local-key'
  });
  assert.deepEqual(normalizeConfig({ baseUrl: 'https://example.com/v1/chat/completions/', model: ' sample-model ' }), {
    baseUrl: 'https://example.com/v1', model: 'sample-model', key: ''
  });
  assert.ok(normalizeConfig({ ...config, baseUrl: 'http://[::1]:9090/v1' }));
  for (const baseUrl of [
    'http://example.com/v1', 'file:///opt/models/', 'https://name:pass@example.com/v1',
    'https://example.com/v1?token=fixture-key', 'https://example.com/v1#section'
  ]) assert.equal(normalizeConfig({ ...config, baseUrl }), null);
  assert.equal(normalizeConfig({ ...config, model: ' ' }), null);
  assert.equal(normalizeConfig(null), null);
});

test('tests the requested model with a small real chat request and no transcript', async () => {
  const settings = { baseUrl: 'https://example.com/v1/chat/completions', model: 'sample-model', key: 'fixture-key' };
  const result = await testConnection(settings, { fetch: async (url, init) => {
    assert.equal(url, 'https://example.com/v1/chat/completions');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer fixture-key');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.equal(init.referrerPolicy, 'no-referrer');
    const request = JSON.parse(init.body);
    assert.equal(request.model, 'sample-model');
    assert.equal(request.max_tokens, 32);
    assert.equal(request.stream, false);
    assert.deepEqual(request.messages, [{ role: 'user', content: '请只回复 OK。' }]);
    return completion('OK');
  } });
  assert.deepEqual(result, { model: 'sample-model' });
});

test('sends authored context and bounded history and restricts advancement to course phases', async () => {
  const calls = [];
  const options = { fetch: async (url, init) => {
    calls.push({ url, init });
    return modelReply({ text: '  找到了原文依据。  ', advance: true });
  } };
  const history = [{ role: 'assistant', text: '先看 D02。' }, { role: 'user', text: '看过了。' }];
  assert.deepEqual(await reply(config, { ...input, history }, options), { text: '找到了原文依据。', advance: true });
  const { url, init } = calls[0];
  assert.equal(url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(init.headers.Authorization, undefined);
  const request = JSON.parse(init.body);
  assert.equal(request.stream, false);
  assert.equal(request.response_format.type, 'json_schema');
  assert.deepEqual(request.response_format.json_schema.schema.required, ['text', 'advance', 'artifact']);
  assert.match(request.messages[0].content, /D02/);
  assert.match(request.messages[0].content, /advance 布尔值/);
  assert.deepEqual(request.messages.slice(1), [
    { role: 'assistant', content: '先看 D02。' },
    { role: 'user', content: '看过了。' },
    { role: 'user', content: input.message + '\n/no_think' }
  ]);
  assert.deepEqual(await reply(config, { ...input, phase: 'complete' }, options), { text: '找到了原文依据。', advance: false });
});

test('uses JSON object mode if the model explicitly rejects JSON schema', async () => {
  const formats = [];
  const result = await reply(config, input, { fetch: async (_url, init) => {
    const format = JSON.parse(init.body).response_format;
    formats.push(format.type);
    if (format.type === 'json_schema') return Response.json({ error: { message: 'response_format json_schema is unsupported' } }, { status: 400 });
    return completion('```json\n{"text":"再核对一处。","advance":false}\n```');
  } });
  assert.deepEqual(formats, ['json_schema', 'json_object']);
  assert.deepEqual(result, { text: '再核对一处。', advance: false });
});

test('streams cumulative decoded feedback through arbitrary byte and JSON escape boundaries', { timeout: 2000 }, async () => {
  const fragments = [
    '{"advance":true,"artifact":"internal draft \\"text\\": text","te',
    'xt":"  看到了', 'D02：\\', 'n请\\"核对', '\\"。\\uD83D', '\\uDE00', '"}'
  ];
  let resolveRemainder;
  const remainder = new Promise(resolve => { resolveRemainder = resolve; });
  const updates = [];
  const result = await reply(config, input, {
    onDelta(text) {
      updates.push(text);
      resolveRemainder();
    },
    fetch: async (_url, init) => {
      assert.equal(JSON.parse(init.body).stream, true);
      const first = eventStream(': heartbeat\r\n\r\n' + event({ reasoning_content: 'private model reasoning' }) +
        fragments.slice(0, 2).map(content => event({ content })).join('')).body.getReader();
      const rest = eventStream(fragments.slice(2).map(content => event({ content })).join('') +
        'data: [DONE]\r\n\r\n').body.getReader();
      let firstComplete = false;
      return new Response(new ReadableStream({
        async pull(controller) {
          if (!firstComplete) {
            const { value, done } = await first.read();
            if (!done) {
              controller.enqueue(value);
              return;
            }
            firstComplete = true;
            await remainder;
          }
          const { value, done } = await rest.read();
          if (done) controller.close();
          else controller.enqueue(value);
        }
      }), { headers: { 'Content-Type': 'text/event-stream' } });
    }
  });
  assert.deepEqual(updates, ['看到了', '看到了D02：', '看到了D02：\n请"核对', '看到了D02：\n请"核对"。', '看到了D02：\n请"核对"。😀']);
  assert.deepEqual(result, { text: '看到了D02：\n请"核对"。😀', advance: true });
});

test('validates the completed SSE response and accepts buffered JSON when streaming is ignored', async () => {
  const updates = [];
  const onDelta = text => updates.push(text);
  await assert.rejects(reply(config, input, { onDelta, fetch: () => eventStream(event({ content: '{"text":"只生成了一部分' })) }), { code: 'response' });
  assert.deepEqual(updates, ['只生成了一部分']);
  updates.length = 0;
  const result = await reply(config, input, { onDelta, fetch: () => modelReply({ text: '一次返回完整内容。', advance: false }) });
  assert.deepEqual(result, { text: '一次返回完整内容。', advance: false });
  assert.deepEqual(updates, []);
});

test('retries buffered output if the provider rejects streaming', async () => {
  const modes = [];
  const result = await reply(config, input, {
    onDelta: () => assert.fail('buffered reply should not emit updates'),
    fetch: async (_url, init) => {
      const { stream, response_format } = JSON.parse(init.body);
      modes.push([stream, response_format.type]);
      if (stream) return Response.json({ error: { param: 'stream', message: 'Streaming is unsupported' } }, { status: 400 });
      if (response_format.type === 'json_schema') return Response.json({ error: { param: 'response_format' } }, { status: 422 });
      return modelReply({ text: '已核对原文。', advance: true });
    }
  });
  assert.deepEqual(modes, [[true, 'json_schema'], [false, 'json_schema'], [false, 'json_object']]);
  assert.deepEqual(result, { text: '已核对原文。', advance: true });
});

test('returns a completed practice table in a generation phase only', async () => {
  const artifact = '| 依据 |\n| --- |\n| N01 |\n| N02 |\n| N03 |';
  const options = { fetch: async () => modelReply({ text: '请对照原文。', advance: true, artifact }) };
  assert.deepEqual(await reply(config, { ...input, phase: 'independent' }, options), { text: '请对照原文。', advance: true, artifact });
  assert.deepEqual(await reply(config, input, options), { text: '请对照原文。', advance: true });
  let calls = 0;
  const withRepair = { onDelta: () => assert.fail('buffered reply should not emit updates'), fetch: async (_url, init) => {
    calls += 1;
    const request = JSON.parse(init.body);
    if (request.response_format.json_schema.name === 'tutor_reply') {
      assert.equal(request.stream, true);
      return modelReply({ text: '请对照原文。', advance: true, artifact: '' });
    }
    assert.equal(request.stream, false);
    return modelReply({ artifact });
  } };
  assert.deepEqual(await reply(config, { ...input, phase: 'independent' }, withRepair), { text: '请对照原文。', advance: true, artifact });
  assert.equal(calls, 2);
});

test('prevents malformed local requests from reaching the provider', async () => {
  const options = { fetch: () => assert.fail('unexpected provider call') };
  for (const invalid of [
    { ...input, phase: 'unavailable' }, { ...input, courseId: 'unknown' }, { ...input, message: ' ' },
    { ...input, message: 'x'.repeat(1201) }, { ...input, history: [{ role: 'system', text: '示例' }] },
    { ...input, history: Array.from({ length: 13 }, () => ({ role: 'user', text: '短消息' })) },
    { ...input, history: Array.from({ length: 5 }, () => ({ role: 'user', text: 'x'.repeat(4000) })) }
  ]) await assert.rejects(reply(config, invalid, options), { code: 'request' });
  await assert.rejects(reply(null, input, options), { code: 'config' });
});

test('limits provider response size and gives controlled errors for network and provider failures', async () => {
  const cloud = { ...config, baseUrl: 'https://example.com/v1', key: 'fixture-key' };
  const fixtures = [
    ['authentication', () => new Response('fixture-key unauthorized', { status: 401 })],
    ['provider', () => new Response('fixture-key unavailable', { status: 500 })],
    ['response', () => modelReply({ text: '回复', advance: 'true' })],
    ['response', () => completion('x'.repeat(132000))],
    ['connection', () => { throw new Error('fixture-key blocked'); }]
  ];
  for (const [code, fixture] of fixtures) {
    await assert.rejects(reply(cloud, input, { fetch: fixture }), error => {
      assert.equal(error.code, code);
      assert.doesNotMatch(error.message, /fixture-key/);
      return true;
    });
  }
});

test('labels a user cancellation separately from connection failures', async () => {
  const controller = new AbortController();
  const promise = reply(config, input, { signal: controller.signal, fetch: (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }) });
  controller.abort();
  await assert.rejects(promise, { code: 'cancelled' });
});
