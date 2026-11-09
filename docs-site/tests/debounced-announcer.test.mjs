import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { createAnnouncer, ANNOUNCE_DELAY_MS } from '../lib/debounced-announcer.ts';

function setup(initial = 'start') {
  mock.timers.enable({ apis: ['setTimeout'] });
  const heard = [];
  const announcer = createAnnouncer(text => heard.push(text), initial);
  return { heard, announcer };
}

test('the announcer waits about 600 ms after the last change', () => {
  const { heard, announcer } = setup();
  assert.equal(ANNOUNCE_DELAY_MS, 600);
  announcer.schedule('one');
  mock.timers.tick(599);
  assert.deepEqual(heard, []);
  mock.timers.tick(1);
  assert.deepEqual(heard, ['one']);
  mock.timers.reset();
});

test('a burst of changes announces only the last one', () => {
  const { heard, announcer } = setup();
  announcer.schedule('a');
  mock.timers.tick(400);
  announcer.schedule('b');
  mock.timers.tick(400);
  announcer.schedule('c');
  mock.timers.tick(599);
  assert.deepEqual(heard, []);
  mock.timers.tick(1);
  assert.deepEqual(heard, ['c']);
  mock.timers.reset();
});

test('flush announces at once and drops a waiting change', () => {
  const { heard, announcer } = setup();
  announcer.schedule('slow');
  announcer.flush('now');
  assert.deepEqual(heard, ['now']);
  mock.timers.tick(5000);
  assert.deepEqual(heard, ['now']);
  mock.timers.reset();
});

test('the same text is never announced twice in a row', () => {
  const { heard, announcer } = setup('same');
  announcer.schedule('same');
  mock.timers.tick(5000);
  assert.deepEqual(heard, []);
  announcer.flush('next');
  announcer.schedule('next');
  mock.timers.tick(5000);
  assert.deepEqual(heard, ['next']);
  mock.timers.reset();
});

test('cancel drops a waiting change', () => {
  const { heard, announcer } = setup();
  announcer.schedule('lost');
  announcer.cancel();
  mock.timers.tick(5000);
  assert.deepEqual(heard, []);
  mock.timers.reset();
});
