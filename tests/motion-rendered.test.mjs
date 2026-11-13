// Real-browser motion checks for ./motion against the packed package.
// Every value is read from the rendered page with getComputedStyle, frame by frame, never from source.
// The same cases run with the Mechanical flavor and the Glide flavor, and the component code does not change between them.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { repository, packFixture } from './helpers/packed.mjs';

let packed, server, browser, url;
// Runs before the app. With ?bare it removes matchMedia and ResizeObserver, as in jsdom. It always records every live event listener,
// so a test can count the listeners left on detached elements after an unmount.
const PAGE_SETUP = `(() => {
  if (new URLSearchParams(location.search).has('bare')) {
    delete window.ResizeObserver;
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true });
  }
  const live = [];
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const capture = options => typeof options === 'boolean' ? options : Boolean(options && options.capture);
  const index = (target, type, listener, options) => live.findIndex(r => r.target === target && r.type === type && r.listener === listener && r.capture === capture(options));
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (listener && index(this, type, listener, options) < 0) live.push({ target: this, type, listener, capture: capture(options) });
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    const at = index(this, type, listener, options);
    if (at >= 0) live.splice(at, 1);
    return remove.call(this, type, listener, options);
  };
  window.__listeners = () => live.map(r => ({ type: r.type, detached: r.target instanceof Node && !r.target.isConnected, media: typeof MediaQueryList === 'function' && r.target instanceof MediaQueryList }));
})();`;
before(async () => {
  packed = packFixture('motion-rendered', ['armature']);
  writeFileSync(join(packed.fixture, 'index.html'), `<!doctype html><html lang="en"><title>Motion fixture</title><script>${PAGE_SETUP}</script><div id="root"></div><script type="module" src="/main.tsx"></script></html>`);
  writeFileSync(join(packed.fixture, 'main.tsx'), readFileSync(join(repository, 'tests/fixtures/motion/main.tsx')));
  server = await createServer({ configFile: false, root: packed.fixture, logLevel: 'error', server: { port: 0, host: '127.0.0.1', fs: { allow: [packed.fixture, repository] } } });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); if (packed) rmSync(packed.temporary, { recursive: true, force: true }); });

const BUTTON = '[data-testid=press]';
const TOGGLE = '.ui-toggle';
const THUMB = '.ui-toggle-thumb';
const SLIDER = '.ui-slider-track';
const MODE = '[role=radiogroup][aria-label=Mode]';
const SEGMENT = '[role=radiogroup][aria-label=Segment]';
const WRAPPED = '[role=radiogroup][aria-label=Wrapped]';
const TABS = '[role=tablist]';
const option = (group, label) => `${group} > button:nth-of-type(${label})`;

// Opens the fixture. `query` adds options such as `&strict`. `page.errors` collects every console error and page error.
async function open(flavor, reducedMotion = 'no-preference', query = '', on = browser) {
  const page = await on.newPage();
  page.errors = [];
  page.on('console', message => { if (message.type() === 'error') page.errors.push(message.text()); });
  page.on('pageerror', error => page.errors.push(String(error)));
  await page.emulateMedia({ reducedMotion });
  await page.goto(`${url}/?flavor=${flavor}${query}`);
  await page.getByRole('heading', { name: 'Motion fixture' }).waitFor();
  if (!query.includes('provider=none')) await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('data-pui-lens') === 'ready', TABS, { timeout: 5000 });
  return page;
}
// Listeners still registered on a detached element or on a media query list. React itself leaves an `invalid` listener on each
// input it rendered, so that type is not counted.
const leftListeners = page => page.evaluate(() => window.__listeners().filter(listener => (listener.detached && listener.type !== 'invalid') || listener.media).map(listener => listener.type));
const sample = (page, options) => page.evaluate(options => window.__sample(options), options);
const box = (page, group, label) => page.evaluate(([group, label]) => window.__box(group, label), [group, label]);
const values = run => run.values.map(sample => sample.v);
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} is not within ${tolerance} of ${expected}`);
// The lens writes pixels with two decimals, so pixel checks pass PX as the tolerance. Scales and fractions keep 1e-3.
const PX = 0.01;
const strictlyBetween = (list, a, b, tolerance = 1e-3) => list.filter(value => value > Math.min(a, b) + tolerance && value < Math.max(a, b) - tolerance);
const onlyRest = (list, rests, tolerance = 1e-3) => list.every(value => rests.some(rest => Math.abs(value - rest) < tolerance));
// The rendered height of the slider thumb, in screenshot pixels: Chromium gives no computed style for ::-webkit-slider-thumb,
// so the test counts the rows of a one-pixel column through the thumb centre that differ from the page background.
async function thumbHeight(page) {
  const input = await page.locator(SLIDER).boundingBox();
  const fraction = await page.locator(SLIDER).evaluate(node => (Number(node.value) - Number(node.min)) / (Number(node.max) - Number(node.min)));
  const x = Math.round(input.x + 8 + (input.width - 16) * fraction);
  const clip = { x, y: Math.round(input.y + input.height / 2 - 16), width: 1, height: 32 };
  const png = (await page.screenshot({ clip, animations: 'allow' })).toString('base64');
  return page.evaluate(async source => {
    const image = new Image();
    image.src = `data:image/png;base64,${source}`;
    await image.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    const at = row => [...data.slice(row * image.width * 4, row * image.width * 4 + 3)];
    const background = at(0);
    let rows = 0;
    for (let row = 0; row < image.height; row++) if (at(row).some((channel, index) => Math.abs(channel - background[index]) > 60)) rows += 1;
    return rows / (image.height / 32);
  }, png);
}
const largestStep = list => list.slice(1).reduce((largest, value, index) => Math.max(largest, Math.abs(value - list[index])), 0);

const FLAVORS = {
  mechanical: { name: 'projection', press: 0.97, grab: 1.15, bounces: true },
  glide: { name: 'projection-glide', press: 0.985, grab: 1.1, bounces: false },
};

for (const [key, flavor] of Object.entries(FLAVORS)) describe(`${key} flavor`, () => {
  test('the provider reports the chosen flavor', async () => {
    const page = await open(key);
    try { assert.equal(await page.getByTestId('flavor').textContent(), flavor.name); } finally { await page.close(); }
  });

  test('Button press: rest, in flight, rest, and a second press retargets with no jump', async () => {
    const page = await open(key);
    try {
      const scale = { selector: BUTTON, property: 'scale', fallback: 1 };
      const press = await sample(page, { read: scale, ms: 700, actions: [{ at: 0, selector: BUTTON, type: 'pointerdown' }, { at: 300, selector: BUTTON, type: 'pointerup' }] });
      const pressed = values(press);
      assert.equal(pressed[0], 1, 'starts at rest');
      assert.ok(strictlyBetween(pressed, 1, flavor.press).length > 0, 'shows values between rest and the press scale');
      near(Math.min(...pressed), flavor.press, 0.006, 'presses to the flavor scale');
      near(pressed.at(-1), 1, 1e-3, 'returns to rest');
      const again = values(await sample(page, { read: scale, ms: 700, actions: [{ at: 0, selector: BUTTON, type: 'pointerdown' }, { at: 50, selector: BUTTON, type: 'pointerup' }, { at: 90, selector: BUTTON, type: 'pointerdown' }, { at: 250, selector: BUTTON, type: 'pointerup' }] }));
      assert.ok(largestStep(again) < (1 - flavor.press) * 0.75, `a press during the release moves on from the current value: largest step ${largestStep(again)}`);
      near(again.at(-1), 1, 1e-3, 'rests after the second release');
    } finally { await page.close(); }
  });

  test('Button: keyboard activation and a disabled button show no press motion', async () => {
    const page = await open(key);
    try {
      await page.locator(BUTTON).focus();
      const keyed = sample(page, { read: { selector: BUTTON, property: 'scale', fallback: 1 }, ms: 400 });
      await page.keyboard.press('Enter');
      assert.ok(onlyRest(values(await keyed), [1]), 'Enter does not scale the button');
      assert.equal(await page.getByTestId('presses').textContent(), '1', 'Enter still activates the button');
      const disabled = await sample(page, { read: { selector: '[data-testid=disabled-press]', property: 'scale', fallback: 1 }, ms: 400, actions: [{ at: 0, selector: '[data-testid=disabled-press]', type: 'pointerdown' }] });
      assert.ok(onlyRest(values(disabled), [1]), 'a disabled button does not press');
    } finally { await page.close(); }
  });

  test('Toggle thumb: mount at rest, then rest, in flight, rest on a click and on Space', async () => {
    const page = await open(key);
    try {
      const thumb = { selector: TOGGLE, property: '--pui-thumb' };
      const mounted = await sample(page, { read: thumb, ms: 200 });
      assert.ok(onlyRest(values(mounted), [0]), 'no motion on mount');
      const run = values(await sample(page, { read: thumb, ms: 800, actions: [{ at: 0, selector: `${TOGGLE} input`, type: 'click' }] }));
      assert.ok(strictlyBetween(run, 0, 1).length >= 3, 'the thumb is seen in flight');
      near(run.at(-1), 1, 1e-3, 'rests on the checked side');
      if (flavor.bounces) assert.ok(Math.max(...run) > 1.01, `Mechanical overshoots a little: ${Math.max(...run)}`);
      else assert.ok(Math.max(...run) <= 1 + 1e-3, `Glide does not overshoot: ${Math.max(...run)}`);
      const travel = await page.locator(THUMB).evaluate(node => Number.parseFloat(getComputedStyle(node).translate));
      near(travel, 16, 0.05, 'the rendered thumb moved the md travel');
      assert.equal(await page.locator(THUMB).evaluate(node => getComputedStyle(node).transform), 'none', 'the thumb never writes transform');
      await page.locator(`${TOGGLE} input`).focus();
      const keyed = sample(page, { read: thumb, ms: 800 });
      await page.keyboard.press('Space');
      const back = values(await keyed);
      assert.ok(strictlyBetween(back, 0, 1).length >= 3, 'Space animates the thumb (D10)');
      near(back.at(-1), 0, 1e-3, 'rests on the unchecked side');
    } finally { await page.close(); }
  });

  test('Toggle double click: the second change retargets in flight and keeps its speed', async () => {
    const page = await open(key);
    try {
      const run = await sample(page, { read: { selector: TOGGLE, property: '--pui-thumb' }, ms: 900, actions: [{ at: 0, selector: `${TOGGLE} input`, type: 'click' }, { at: 70, selector: `${TOGGLE} input`, type: 'click' }] });
      const list = values(run);
      const turn = run.marks[1];
      const atTurn = list[turn - 1];
      assert.ok(atTurn > 0.05 && atTurn < 0.95, `the second click lands in flight: ${atTurn}`);
      assert.ok(Math.max(...list.slice(turn, turn + 3)) > atTurn, 'the thumb keeps moving forward for a moment: its speed carried over');
      assert.ok(largestStep(list) < 0.35, `no jump at the turn: largest step ${largestStep(list)}`);
      near(list.at(-1), 0, 1e-3, 'lands back at the original state');
    } finally { await page.close(); }
  });

  test('Slider: a pointer grab scales the thumb; keys and drag snap; the native input still works', async () => {
    const page = await open(key);
    try {
      const grab = { selector: SLIDER, property: '--pui-press', fallback: 1 };
      const held = values(await sample(page, { read: grab, ms: 500, actions: [{ at: 0, selector: SLIDER, type: 'pointerdown' }] }));
      assert.ok(strictlyBetween(held, 1, flavor.grab).length > 0, 'the grab is seen in flight');
      near(held.at(-1), flavor.grab, 0.005, 'the grab rests on the flavor scale');
      const grabbed = await thumbHeight(page);
      const released = values(await sample(page, { read: grab, ms: 600, actions: [{ at: 0, selector: SLIDER, type: 'pointerup' }] }));
      near(released.at(-1), 1, 1e-3, 'the release rests at 1');
      const resting = await thumbHeight(page);
      assert.ok(resting >= 12, `the resting thumb is drawn: ${resting} rows`);
      assert.ok(grabbed / resting > 1 + (flavor.grab - 1) / 2, `the rendered WebKit thumb grows while grabbed: ${grabbed} rows against ${resting}`);
      await page.locator(SLIDER).focus();
      const before = Number(await page.locator(SLIDER).inputValue());
      const keyed = sample(page, { read: grab, ms: 300 });
      await page.keyboard.press('ArrowRight');
      assert.ok(onlyRest(values(await keyed), [1]), 'arrow keys show no motion (D10)');
      assert.equal(Number(await page.locator(SLIDER).inputValue()), before + 1, 'the arrow key steps the value at once');
      const bounds = await page.locator(SLIDER).boundingBox();
      await page.mouse.click(bounds.x + bounds.width * 0.9, bounds.y + bounds.height / 2);
      assert.ok(Number(await page.locator(SLIDER).inputValue()) > 80, 'a pointer click on the track still sets the native value');
    } finally { await page.close(); }
  });

  for (const [label, group, from, to] of [['chip', MODE, 1, 2], ['segmented', SEGMENT, 1, 3], ['tabs', TABS, 1, 3]]) {
    test(`Lens (${label}): a click travels from the current option to the next`, async () => {
      const page = await open(key);
      try {
        const start = await box(page, group, await page.locator(option(group, from)).textContent());
        const run = values(await sample(page, { read: { selector: group, property: '--pui-lens-x' }, ms: 800, actions: [{ at: 0, selector: option(group, to), type: 'click' }] }));
        // Measured after the change: the active option turns bold, so the options can shift.
        const end = await box(page, group, await page.locator(option(group, to)).textContent());
        near(run[0], start.x, 0.5, 'starts on the selected option');
        assert.ok(strictlyBetween(run, start.x, end.x, PX).length >= 2, 'the indicator is seen in flight');
        near(run.at(-1), end.x, 0.5, 'lands on the new option');
        const width = await page.evaluate(selector => Number.parseFloat(getComputedStyle(document.querySelector(selector)).getPropertyValue('--pui-lens-w')), group);
        near(width, end.w, 0.5, 'the width lands on the new option');
        assert.equal(await page.locator(`${group} > .ui-lens`).evaluate(node => getComputedStyle(node).transform), 'none', 'the indicator never writes transform');
        assert.equal(await page.locator(`${group} > .ui-lens`).evaluate(node => getComputedStyle(node).opacity), '1', 'the indicator shows once ready');
      } finally { await page.close(); }
    });

    test(`Lens (${label}): arrow keys jump with no travel (D15)`, async () => {
      const page = await open(key);
      try {
        const start = await box(page, group, await page.locator(option(group, 1)).textContent());
        const run = values(await sample(page, { read: { selector: group, property: '--pui-lens-x' }, ms: 400, actions: [{ at: 0, selector: option(group, 1), type: 'keydown', key: 'ArrowRight' }] }));
        const end = await box(page, group, await page.locator(option(group, 2)).textContent());
        assert.equal(strictlyBetween(run, start.x, end.x, PX).length, 0, 'no value between the two options');
        near(run.at(-1), end.x, 0.5, 'jumps to the next option');
        const last = await page.locator(`${group} > button:not([disabled])`).last().textContent();
        const home = values(await sample(page, { read: { selector: group, property: '--pui-lens-x' }, ms: 300, actions: [{ at: 0, selector: option(group, 2), type: 'keydown', key: 'End' }] }));
        const lastBox = await box(page, group, last);
        near(home.at(-1), lastBox.x, 0.5, 'End jumps to the last enabled option');
        assert.equal(strictlyBetween(home, end.x, lastBox.x, PX).length, 0, 'End shows no travel');
      } finally { await page.close(); }
    });
  }

  // Real key presses (keydown, then keyup) from the keyboard. Enter and Space activate the focused option; arrows and End move to another.
  for (const [label, group, focus, pressed, to] of [['chip', MODE, 2, 'Enter', 2], ['segmented', SEGMENT, 3, 'Space', 3], ['tabs', TABS, 3, 'Enter', 3], ['tabs', TABS, 2, 'Space', 2], ['segmented', SEGMENT, 1, 'ArrowRight', 2], ['tabs', TABS, 1, 'End', 3]]) {
    test(`Lens (${label}): ${pressed} from the keyboard jumps with no travel`, async () => {
      const page = await open(key);
      try {
        const start = await box(page, group, await page.locator(option(group, 1)).textContent());
        await page.locator(option(group, focus)).focus();
        const running = sample(page, { read: { selector: group, property: '--pui-lens-x' }, ms: 400 });
        await page.keyboard.press(pressed);
        const run = values(await running);
        const end = await box(page, group, await page.locator(option(group, to)).textContent());
        assert.ok(end.x > start.x + 1, 'the selection moved');
        assert.equal(strictlyBetween(run, start.x, end.x, PX).length, 0, `no value between the two options: ${run.slice(0, 6)}`);
        near(run.at(-1), end.x, 0.5, 'lands on the activated option');
      } finally { await page.close(); }
    });
  }

  test('Lens: a key that changes nothing does not make the next change jump', async () => {
    const page = await open(key);
    try {
      await page.locator(option(MODE, 1)).focus();
      await page.keyboard.press('Home');
      const start = await box(page, MODE, 'Day');
      const run = values(await sample(page, { read: { selector: MODE, property: '--pui-lens-x' }, ms: 700, actions: [{ at: 0, selector: '[data-testid=set-week]', type: 'click' }] }));
      const end = await box(page, MODE, 'Week');
      assert.ok(strictlyBetween(run, start.x, end.x, PX).length >= 2, `a change from outside travels: ${run.slice(0, 6)}`);
      near(run.at(-1), end.x, 0.5, 'lands on the new option');
    } finally { await page.close(); }
  });

  test('Lens: a second click mid-travel retargets with no jump, a disabled option is never a target, and no selection hides it', async () => {
    const page = await open(key);
    try {
      const run = values(await sample(page, { read: { selector: MODE, property: '--pui-lens-x' }, ms: 900, actions: [{ at: 0, selector: option(MODE, 2), type: 'click' }, { at: 60, selector: option(MODE, 4), type: 'click' }] }));
      const week = await box(page, MODE, 'Week');
      const month = await box(page, MODE, 'Month');
      assert.ok(largestStep(run) < (month.x - 0) * 0.5, `no jump at the retarget: largest step ${largestStep(run)}`);
      near(run.at(-1), month.x, 0.5, 'lands on the second choice');
      const still = values(await sample(page, { read: { selector: MODE, property: '--pui-lens-x' }, ms: 300, actions: [{ at: 0, selector: option(MODE, 3), type: 'click' }] }));
      assert.ok(onlyRest(still, [month.x], PX), 'a click on a disabled option does not move the indicator');
      assert.ok(week.x < month.x);
      await page.locator(option(MODE, 4)).click();
      await page.waitForFunction(selector => !document.querySelector(selector).hasAttribute('data-pui-lens'), MODE);
      assert.equal(await page.locator(`${MODE} > .ui-lens`).evaluate(node => getComputedStyle(node).opacity), '0', 'with no selection the indicator hides');
    } finally { await page.close(); }
  });

  test('Lens: a resize refits onto the active option, and a move across wrapped rows lands on the option', async () => {
    const page = await open(key);
    try {
      await page.locator(option(SEGMENT, 3)).click();
      await page.waitForTimeout(600);
      // Widen the first option: the active third option moves right and the group grows, so its resize observer refits.
      await page.locator(option(SEGMENT, 1)).evaluate(node => { node.style.width = '140px'; });
      await page.waitForTimeout(200);
      const refit = await box(page, SEGMENT, 'Three');
      assert.ok(refit.x > 140, 'the active option moved');
      near(await page.locator(SEGMENT).evaluate(node => Number.parseFloat(getComputedStyle(node).getPropertyValue('--pui-lens-x'))), refit.x, 0.5, 'refit lands on the active option');
      const target = await box(page, WRAPPED, 'epsilon');
      assert.ok(target.y > 0, 'epsilon wraps onto a later row');
      await page.locator(WRAPPED).getByRole('radio', { name: 'epsilon' }).click();
      await page.waitForTimeout(700);
      const lens = await page.locator(WRAPPED).evaluate(node => ['--pui-lens-x', '--pui-lens-y'].map(name => Number.parseFloat(getComputedStyle(node).getPropertyValue(name))));
      near(lens[0], target.x, 0.5, 'x lands on the wrapped option');
      near(lens[1], target.y, 0.5, 'y lands on the wrapped row');
    } finally { await page.close(); }
  });

  test('reduced motion: every surface shows no value between rest and rest', async () => {
    const page = await open(key, 'reduce');
    try {
      const press = values(await sample(page, { read: { selector: BUTTON, property: 'scale', fallback: 1 }, ms: 300, actions: [{ at: 0, selector: BUTTON, type: 'pointerdown' }] }));
      assert.ok(onlyRest(press, [1]), 'no press motion');
      const thumb = values(await sample(page, { read: { selector: TOGGLE, property: '--pui-thumb' }, ms: 300, actions: [{ at: 0, selector: `${TOGGLE} input`, type: 'click' }] }));
      assert.ok(onlyRest(thumb, [0, 1]) && thumb.at(-1) === 1, 'the thumb snaps to the target');
      const grab = values(await sample(page, { read: { selector: SLIDER, property: '--pui-press', fallback: 1 }, ms: 300, actions: [{ at: 0, selector: SLIDER, type: 'pointerdown' }] }));
      assert.ok(onlyRest(grab, [1]), 'no grab motion');
      for (const [group, to] of [[MODE, 2], [SEGMENT, 3], [TABS, 3]]) {
        const from = await box(page, group, await page.locator(option(group, 1)).textContent());
        const lens = values(await sample(page, { read: { selector: group, property: '--pui-lens-x' }, ms: 300, actions: [{ at: 0, selector: option(group, to), type: 'click' }] }));
        const end = await box(page, group, await page.locator(option(group, to)).textContent());
        assert.ok(onlyRest(lens, [from.x, end.x], PX), `${group}: the indicator jumps`);
      }
    } finally { await page.close(); }
  });

  test('reduced motion turned on mid-move snaps every surface to rest', async () => {
    const page = await open(key);
    try {
      for (const [read, actions, rest] of [
        [{ selector: TOGGLE, property: '--pui-thumb' }, [{ at: 0, selector: `${TOGGLE} input`, type: 'click' }], 1],
        [{ selector: BUTTON, property: 'scale', fallback: 1 }, [{ at: 0, selector: BUTTON, type: 'pointerdown' }], 1],
        [{ selector: MODE, property: '--pui-lens-x' }, [{ at: 0, selector: option(MODE, 2), type: 'click' }], null],
      ]) {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => { window.__flipAt = null; });
        await page.waitForTimeout(500);
        const running = page.evaluate(options => window.__sample(options).then(run => ({ ...run, start: performance.now() - run.values.at(-1).t })), { read, ms: 500, actions });
        await page.waitForTimeout(40);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const run = await running;
        const target = rest ?? (await box(page, MODE, 'Week')).x;
        const flip = await page.evaluate(() => window.__flipAt);
        assert.ok(flip, 'the setting changed during the run');
        const afterFlip = run.values.filter(sample => run.start + sample.t > flip + 20).map(sample => sample.v);
        assert.ok(afterFlip.length > 0 && onlyRest(afterFlip, [target], rest === null ? PX : 1e-3), `${read.selector} rests on ${target} once reduced motion is on: ${afterFlip.slice(0, 4)}`);
        await page.evaluate(selector => document.querySelector(selector)?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), BUTTON);
        if (read.selector === MODE) await page.locator(option(MODE, 1)).click();
        if (read.selector === TOGGLE) await page.locator(`${TOGGLE} input`).click();
      }
    } finally { await page.close(); }
  });
});

describe('environments', () => {
  test('with no matchMedia and no ResizeObserver, as in jsdom: no console error, motion still runs, and an unmount leaves no listener', async () => {
    const page = await open('mechanical', 'no-preference', '&bare');
    try {
      assert.deepEqual(await page.evaluate(() => [typeof window.matchMedia, typeof window.ResizeObserver]), ['undefined', 'undefined']);
      const press = values(await sample(page, { read: { selector: BUTTON, property: 'scale', fallback: 1 }, ms: 400, actions: [{ at: 0, selector: BUTTON, type: 'pointerdown' }, { at: 150, selector: BUTTON, type: 'pointerup' }] }));
      assert.ok(strictlyBetween(press, 1, FLAVORS.mechanical.press).length > 0, 'the press still moves');
      const thumb = values(await sample(page, { read: { selector: TOGGLE, property: '--pui-thumb' }, ms: 500, actions: [{ at: 0, selector: `${TOGGLE} input`, type: 'click' }] }));
      assert.ok(strictlyBetween(thumb, 0, 1).length > 0, 'the thumb still moves');
      await page.evaluate(() => window.__unmount());
      assert.deepEqual(await leftListeners(page), [], 'every controller removed its listeners');
      assert.deepEqual(page.errors, [], 'nothing logged an error');
    } finally { await page.close(); }
  });
});
