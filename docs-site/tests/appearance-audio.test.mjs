import test from 'node:test';
import assert from 'node:assert/strict';
import { AppearanceAudio } from '../lib/appearance-audio.ts';

const modern = ['/sounds/modern-blip.mp3', '/sounds/modern-treasure.mp3'];
const flat = ['/sounds/flat-chip.mp3', '/sounds/flat-pop.mp3'];
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture(state = 'running', random = () => .25) {
  const statuses = [], sources = [], gains = [], pending = [], fetches = [], decodes = [];
  const parameter = () => ({ value: 0, calls: [], cancelScheduledValues(...args) { this.calls.push(args); }, setTargetAtTime(...args) { this.calls.push(args); } });
  const response = asset => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(asset).buffer });
  const context = {
    state, currentTime: 10, destination: {}, closed: false,
    createGain() { const node = { gain: parameter(), connect() {}, disconnect() { this.disconnected = true; } }; gains.push(node); return node; },
    createBufferSource() { const node = { buffer: null, starts: [], stops: [], connect() {}, disconnect() { this.disconnected = true; }, start(time) { assert.equal(typeof this.onended, 'function'); this.starts.push(time); }, stop(time) { assert.equal(this.stops.length, 0); this.stops.push(time); } }; sources.push(node); return node; },
    async decodeAudioData(bytes) { const asset = new TextDecoder().decode(bytes); decodes.push(asset); return context.decode ? context.decode(asset) : { asset, duration: .35 }; },
    resume() { const wait = deferred(); pending.push({ resolve: () => { context.state = 'running'; wait.resolve(); }, reject: wait.reject }); return wait.promise; },
    close() { this.closed = true; return Promise.resolve(); },
  };
  const fetchAudio = async asset => { fetches.push(asset); return context.fetch ? context.fetch(asset) : response(asset); };
  const audio = new AppearanceAudio(() => context, status => statuses.push(status), { fetch: fetchAudio, random });
  return { audio, context, sources, gains, pending, statuses, fetches, decodes, response };
}

test('plays supplied decoded samples at conservative gain; Flat fades Modern within 20ms', async () => {
  const f = fixture();
  assert.equal(await f.audio.play('modern'), true);
  assert.equal(f.sources.length, 1); assert.ok(modern.includes(f.sources[0].buffer.asset));
  assert.equal(f.gains[0].gain.value, .4);
  assert.equal(await f.audio.play('flat', true), true);
  assert.ok(flat.includes(f.sources[1].buffer.asset));
  assert.equal(f.sources[0].stops[0], 10.02);
  assert.deepEqual(f.gains[0].gain.calls.at(-1), [0, 10, .004]);
});
test('all four pair combinations occur in each bag without boundary repeats; four buffers cached', async () => {
  const f = fixture(), pairs = [];
  for (let cycle = 0; cycle < 16; cycle++) { await f.audio.play('modern', true); const a = f.sources.at(-1).buffer.asset; await f.audio.play('flat', true); pairs.push(a + '|' + f.sources.at(-1).buffer.asset); }
  for (let i = 0; i < pairs.length; i += 4) assert.equal(new Set(pairs.slice(i, i + 4)).size, 4);
  for (let i = 1; i < pairs.length; i++) assert.notEqual(pairs[i], pairs[i - 1]);
  assert.equal(f.fetches.length, 4); assert.equal(f.decodes.length, 4);
});
test('random selection varies the first pair', async () => {
  const selected = [];
  for (const random of [() => 0, () => .99]) { const f = fixture('running', random); await f.audio.play('modern'); await f.audio.play('flat'); selected.push(f.sources.map(source => source.buffer.asset).join('|')); }
  assert.notEqual(selected[0], selected[1]);
});
test('consecutive actual playback never repeats an asset, including same-style enable clicks', async () => {
  const f = fixture();
  for (const cue of ['modern', 'modern', 'modern', 'flat', 'flat', 'flat', 'modern', 'modern', 'flat', 'modern', 'flat']) assert.equal(await f.audio.play(cue, true), true);
  for (let i = 1; i < f.sources.length; i++) assert.notEqual(f.sources[i].buffer.asset, f.sources[i - 1].buffer.asset);
});
test('blocked load neither fetches nor resumes nor queues a later cue', async () => {
  const f = fixture('suspended');
  assert.equal(await f.audio.play('modern'), false); assert.deepEqual(f.statuses, ['blocked']);
  assert.equal(f.pending.length, 0); assert.equal(f.fetches.length, 0); assert.equal(f.sources.length, 0);
});
test('Flat wins over a late Modern resume', async () => {
  const f = fixture('suspended'), old = f.audio.play('modern', true), winner = f.audio.play('flat', true);
  f.pending[1].resolve(); assert.equal(await winner, true);
  f.pending[0].resolve(); assert.equal(await old, false);
  assert.equal(f.sources.length, 1); assert.ok(flat.includes(f.sources[0].buffer.asset));
});
test('rejected stale resume cannot stop the winner or change its status', async () => {
  const f = fixture('suspended'), old = f.audio.play('modern', true), winner = f.audio.play('flat', true);
  f.pending[1].resolve(); await winner; f.pending[0].reject(new Error('Blocked'));
  assert.equal(await old, false); assert.equal(f.sources[0].stops.length, 0); assert.deepEqual(f.statuses, ['ready']);
});
for (const stage of ['fetch', 'decode']) for (const reject of [false, true]) test('Flat wins over pending Modern ' + stage + (reject ? ' rejection' : ' completion'), async () => {
  const f = fixture(), wait = deferred();
  if (stage === 'fetch') f.context.fetch = asset => modern.includes(asset) ? wait.promise : f.response(asset);
  else f.context.decode = asset => modern.includes(asset) ? wait.promise : { asset };
  const old = f.audio.play('modern', true); await flush();
  assert.equal(await f.audio.play('flat', true), true);
  if (reject) wait.reject(new Error('Failed sample'));
  else wait.resolve(stage === 'fetch' ? f.response(modern[0]) : { asset: modern[0] });
  assert.equal(await old, false); assert.equal(f.sources.length, 1); assert.ok(flat.includes(f.sources[0].buffer.asset));
  assert.equal(f.sources[0].stops.length, 0); assert.deepEqual(f.statuses, ['ready']);
});
test('shared pending decode is cached; only the latest intent starts', async () => {
  const f = fixture(), wait = deferred(); f.context.decode = () => wait.promise;
  const old = f.audio.play('modern', true); await flush(); const winner = f.audio.play('modern', true); await flush();
  assert.equal(f.decodes.length, 1); wait.resolve({ asset: f.fetches[0] });
  assert.equal(await old, false); assert.equal(await winner, true); assert.equal(f.sources.length, 1);
});
test('stop and dispose invalidate pending sample loads', async () => {
  for (const dispose of [false, true]) { const f = fixture(), wait = deferred(); f.context.decode = () => wait.promise;
    const playing = f.audio.play('modern', true); await flush(); if (dispose) f.audio.dispose(); else f.audio.stop();
    wait.resolve({ asset: f.fetches[0] }); assert.equal(await playing, false); assert.equal(f.sources.length, 0); assert.equal(f.context.closed, dispose);
  }
});
test('ended samples disconnect all nodes; later stop is safe', async () => {
  const f = fixture(); await f.audio.play('flat'); f.sources[0].onended(); f.audio.stop(); f.audio.dispose();
  assert.equal(f.sources[0].disconnected, true); assert.equal(f.gains[0].disconnected, true); assert.equal(f.sources[0].stops.length, 0);
});
test('failed fetch, HTTP status, or decoding report unavailable without starting', async () => {
  for (const failure of ['fetch', 'http', 'decode']) { const f = fixture();
    if (failure === 'fetch') f.context.fetch = () => Promise.reject(new Error('Offline'));
    if (failure === 'http') f.context.fetch = () => ({ ok: false });
    if (failure === 'decode') f.context.decode = () => Promise.reject(new Error('Bad audio'));
    assert.equal(await f.audio.play('modern', true), false); assert.deepEqual(f.statuses, ['unavailable']); assert.equal(f.sources.length, 0);
  }
});
test('unsupported audio and rejected current resumes fail safely', async () => {
  const statuses = [], audio = new AppearanceAudio(() => { throw new Error('Unsupported'); }, status => statuses.push(status));
  assert.equal(await audio.play('modern'), false); assert.deepEqual(statuses, ['unavailable']);
  const f = fixture('suspended'), playing = f.audio.play('modern', true); f.pending[0].reject(new Error('Blocked'));
  assert.equal(await playing, false); assert.deepEqual(f.statuses, ['blocked']);
});
test('start failure releases nodes and reports unavailable without escaping', async () => {
  const f = fixture(), create = f.context.createBufferSource.bind(f.context);
  f.context.createBufferSource = () => { const source = create(); source.start = () => { throw new Error('Cannot start'); }; source.stop = () => { throw new Error('Unstarted'); }; return source; };
  assert.equal(await f.audio.play('modern', true), false);
  assert.deepEqual(f.statuses, ['unavailable']);
  assert.equal(f.sources[0].disconnected, true); assert.equal(f.gains[0].disconnected, true);
});
test('allocation failure releases the partially created output', async () => {
  const f = fixture(); f.context.createBufferSource = () => { throw new Error('No source available'); };
  assert.equal(await f.audio.play('modern', true), false);
  assert.deepEqual(f.statuses, ['unavailable']); assert.equal(f.gains[0].disconnected, true);
});
test('failed samples can retry without consuming playback history, then reuse the decoded buffer', async () => {
  const f = fixture(); f.context.fetch = () => ({ ok: false });
  assert.equal(await f.audio.play('modern', true), false);
  const requested = f.fetches[0]; delete f.context.fetch;
  assert.equal(await f.audio.play('modern', true), true);
  assert.equal(f.sources[0].buffer.asset, requested);
  const decoded = f.sources[0].buffer;
  for (let i = 0; i < 8; i++) await f.audio.play('modern', true);
  assert.equal(f.sources.find((source, index) => index > 0 && source.buffer.asset === requested).buffer, decoded);
});
test('Flat stops audible Modern before its own asset finishes loading', async () => {
  const f = fixture(), wait = deferred(); await f.audio.play('modern', true);
  f.context.fetch = () => wait.promise;
  const playing = f.audio.play('flat', true);
  assert.equal(f.sources[0].stops[0], 10.02);
  f.audio.stop(); f.audio.stop();
  wait.resolve(f.response(flat[0]));
  assert.equal(await playing, false); assert.equal(f.sources.length, 1);
});
test('stop or dispose invalidates pending resume, and disposed engines cannot restart', async () => {
  for (const dispose of [false, true]) {
    const f = fixture('suspended'), playing = f.audio.play('modern', true);
    if (dispose) f.audio.dispose(); else f.audio.stop();
    f.pending[0].resolve(); assert.equal(await playing, false);
    assert.equal(f.fetches.length, 0); assert.equal(f.sources.length, 0);
    if (dispose) assert.equal(await f.audio.play('modern', true), false);
  }
});
test('a context suspended during sample loading stays blocked without an automatic resume', async () => {
  const f = fixture(), wait = deferred(); f.context.decode = () => wait.promise;
  const playing = f.audio.play('modern', true); await flush(); f.context.state = 'suspended';
  wait.resolve({ asset: f.fetches[0] });
  assert.equal(await playing, false); assert.deepEqual(f.statuses, ['blocked']);
  assert.equal(f.pending.length, 0); assert.equal(f.sources.length, 0);
});
