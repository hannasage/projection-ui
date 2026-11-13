// Real-browser motion checks for ./motion against the packed package.
// Every value is read from the rendered page with getComputedStyle, frame by frame, never from source.
// The same cases run with the Mechanical flavor and the Glide flavor, and the component code does not change between them.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium, firefox, webkit } from '@playwright/test';
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
  // With ?legacymq, matchMedia returns a list with only addListener and removeListener, as older Safari does.
  if (new URLSearchParams(location.search).has('legacymq')) {
    const real = window.matchMedia.bind(window);
    let count = 0;
    window.__legacyListeners = () => count;
    window.matchMedia = query => {
      const list = real(query);
      const wrapped = new Map();
      return {
        get matches() { return list.matches; },
        media: list.media,
        addListener(listener) { if (wrapped.has(listener)) return; const relay = () => listener({ matches: list.matches, media: list.media }); wrapped.set(listener, relay); list.addEventListener('change', relay); count += 1; },
        removeListener(listener) { const relay = wrapped.get(listener); if (!relay) return; list.removeEventListener('change', relay); wrapped.delete(listener); count -= 1; },
      };
    };
  }
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
  // Wait until frames arrive at a steady rate: a new WebKit page can hold its first frames for a moment, which would starve a sample.
  await page.evaluate(() => new Promise(resolve => {
    let last = performance.now();
    let steady = 0;
    const frame = now => { steady = now - last < 50 ? steady + 1 : 0; last = now; if (steady >= 5) resolve(); else requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }));
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
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
      assert.ok(strictlyBetween(back, 0, 1).length >= 3, 'Space animates the thumb: a key change of the Toggle moves on the spring');
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
      assert.ok(onlyRest(values(await keyed), [1]), 'arrow keys show no grab motion');
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
        const beyond = run.filter(value => value > Math.max(start.x, end.x) + PX || value < Math.min(start.x, end.x) - PX);
        assert.deepEqual(beyond, [], 'the indicator does not bounce past the option');
        near(run.at(-1), end.x, 0.5, 'lands on the new option');
        const width = await page.evaluate(selector => Number.parseFloat(getComputedStyle(document.querySelector(selector)).getPropertyValue('--pui-lens-w')), group);
        near(width, end.w, 0.5, 'the width lands on the new option');
        assert.equal(await page.locator(`${group} > .ui-lens`).evaluate(node => getComputedStyle(node).transform), 'none', 'the indicator never writes transform');
        assert.equal(await page.locator(`${group} > .ui-lens`).evaluate(node => getComputedStyle(node).opacity), '1', 'the indicator shows once ready');
      } finally { await page.close(); }
    });

    test(`Lens (${label}): arrow keys jump with no travel`, async () => {
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

  test('Lens: an option that resizes inside a container of fixed size moves the lens with it', async () => {
    const page = await open(key);
    try {
      await page.locator(option(TABS, 3)).click();
      await page.waitForTimeout(600);
      const width = () => page.locator(TABS).evaluate(node => node.getBoundingClientRect().width);
      const before = await width();
      const lens = () => page.locator(TABS).evaluate(node => ['--pui-lens-x', '--pui-lens-w'].map(name => Number.parseFloat(getComputedStyle(node).getPropertyValue(name))));
      // A wider first tab pushes the active third tab right. The tab list keeps its width, so only the options resize.
      await page.locator(option(TABS, 1)).evaluate(node => { node.style.width = '160px'; });
      await page.waitForTimeout(600);
      assert.equal(await width(), before, 'the tab list did not resize');
      const moved = await box(page, TABS, 'Third');
      assert.ok(moved.x > 160, 'the active tab moved');
      near((await lens())[0], moved.x, 0.5, 'the lens follows the active tab');
      // The active tab itself grows.
      await page.locator(option(TABS, 3)).evaluate(node => { node.style.width = '150px'; });
      await page.waitForTimeout(600);
      assert.equal(await width(), before, 'the tab list still did not resize');
      const grown = await box(page, TABS, 'Third');
      const [x, w] = await lens();
      near(x, grown.x, 0.5, 'x stays on the active tab');
      near(w, grown.w, 0.5, 'the width follows the active tab');
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

  test('forced colors: each indicator draws in Highlight, and the active segment text in HighlightText', async () => {
    const page = await open(key);
    try {
      await page.emulateMedia({ forcedColors: 'active' });
      await page.waitForTimeout(400); // the colour fades finish
      const system = await page.evaluate(() => Object.fromEntries(['Highlight', 'HighlightText', 'Canvas'].map(name => {
        const probe = document.createElement('div');
        probe.style.cssText = `background-color: ${name}; forced-color-adjust: none`;
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return [name, value];
      })));
      assert.notEqual(system.Highlight, system.Canvas, 'Highlight differs from the page background');
      for (const group of [TABS, MODE, SEGMENT]) {
        const lens = await page.locator(`${group} > .ui-lens`).evaluate(node => [getComputedStyle(node).backgroundColor, getComputedStyle(node).opacity]);
        assert.deepEqual(lens, [system.Highlight, '1'], `${group}: the indicator shows in Highlight`);
      }
      for (const group of [MODE, SEGMENT]) {
        const color = await page.locator(`${group} > [aria-checked=true]`).evaluate(node => getComputedStyle(node).color);
        assert.equal(color, system.HighlightText, `${group}: the active option text reads on Highlight`);
      }
    } finally { await page.close(); }
  });

  test('reduced motion: the colour fades of every motion surface are off, without help from the token stylesheet', async () => {
    const page = await open(key, 'reduce');
    try {
      // The token stylesheet turns transitions off inside a theme. The motion stylesheet must do it alone, so every other sheet is off.
      const disabled = await page.evaluate(() => [...document.styleSheets].filter(sheet => !sheet.ownerNode?.textContent?.includes('.ui-lens')).map(sheet => { sheet.disabled = true; return 1; }).length);
      assert.ok(disabled > 0, 'the token stylesheet is off');
      for (const selector of [BUTTON, option(TABS, 1), option(MODE, 1), option(SEGMENT, 1), THUMB]) {
        const durations = await page.locator(selector).evaluate(node => getComputedStyle(node).transitionDuration.split(',').map(value => value.trim()));
        assert.ok(durations.every(value => value === '0s'), `${selector} has no transition: ${durations}`);
      }
    } finally { await page.close(); }
  });

  test('the motion stylesheet is shared: one copy in the document, however many surfaces render', async () => {
    const page = await open(key);
    try {
      const copies = await page.evaluate(() => [...document.querySelectorAll('style')].filter(node => node.textContent.includes('.ui-lens')).length);
      assert.equal(copies, 1);
      assert.ok(await page.locator('[role=radiogroup]').count() >= 3, 'several lens surfaces render');
    } finally { await page.close(); }
  });

  test('reduced motion turned on mid-move snaps every surface to rest', async () => {
    const page = await open(key);
    try {
      const lensCase = (group, to) => ({ read: { selector: group, property: '--pui-lens-x' }, action: { selector: option(group, to), type: 'click' }, group, to, tolerance: PX });
      const cases = [
        { read: { selector: TOGGLE, property: '--pui-thumb' }, action: { selector: `${TOGGLE} input`, type: 'click' }, from: 0, to: 1, rest: 1, tolerance: 1e-3 },
        { read: { selector: BUTTON, property: 'scale', fallback: 1 }, action: { selector: BUTTON, type: 'pointerdown' }, from: 1, to: flavor.press, rest: 1, tolerance: 1e-3 },
        { read: { selector: SLIDER, property: '--pui-press', fallback: 1 }, action: { selector: SLIDER, type: 'pointerdown' }, from: 1, to: flavor.grab, rest: 1, tolerance: 1e-3 },
        lensCase(MODE, 2), lensCase(SEGMENT, 3), lensCase(TABS, 3),
      ];
      for (const item of cases) {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => { window.__flipAt = null; });
        await page.waitForTimeout(500);
        const target = item.to;
        if (item.group) item.from = (await box(page, item.group, await page.locator(option(item.group, 1)).textContent())).x;
        const running = page.evaluate(options => window.__sample(options).then(run => ({ ...run, start: performance.now() - run.values.at(-1).t })), { read: item.read, ms: 500, actions: [{ at: 0, ...item.action }] });
        await page.waitForTimeout(40);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const run = await running;
        const flip = await page.evaluate(() => window.__flipAt);
        assert.ok(flip, 'the setting changed during the run');
        // A lens target is measured after the change: the active option turns bold, so the options can shift.
        if (item.group) item.to = item.rest = (await box(page, item.group, await page.locator(option(item.group, target)).textContent())).x;
        const beforeFlip = run.values.filter(sample => run.start + sample.t < flip).map(sample => sample.v);
        const afterFlip = run.values.filter(sample => run.start + sample.t > flip + 20).map(sample => sample.v);
        // The move must be under way when the setting changes, or the check after it would pass with no motion at all.
        assert.ok(strictlyBetween(beforeFlip, item.from, item.to, item.tolerance).length > 0, `${item.read.selector} is in flight before the switch: ${beforeFlip.slice(0, 6)}`);
        assert.ok(afterFlip.length > 0 && onlyRest(afterFlip, [item.rest], item.tolerance), `${item.read.selector} rests on ${item.rest} once reduced motion is on: ${afterFlip.slice(0, 4)}`);
        for (const selector of [BUTTON, SLIDER]) await page.evaluate(selector => document.querySelector(selector)?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), selector);
        if (item.group) await page.locator(option(item.group, 1)).click();
        if (item.read.selector === TOGGLE) await page.locator(`${TOGGLE} input`).click();
      }
    } finally { await page.close(); }
  });
});

// The overlays: a toast, a dialog with its backdrop, and a tooltip. Each one enters on a follower that goes from 0 to 1.
// Leaving is not animated: a dismissed toast, a closed dialog, and a hidden tooltip leave the page at once.
const PUSH = '[data-testid=push-toast]';
const TOAST = '[role=log] > .ui-toast';
const OPEN = '[data-testid=open-modal]';
const DIALOG = '[role=dialog]';
const INNER = '[role=dialog] [role=dialog]';
const BACKDROP = '.ui-modal-backdrop';
const TRIGGER = '[data-testid=tip-trigger]';
const TIP = '[role=tooltip]';
const nthToast = n => `${TOAST}:nth-of-type(${n})`;
const enterOf = selector => ({ selector, property: '--pui-enter', absent: 0 });
const dialogOf = selector => ({ selector, property: '--pui-dialog', absent: 0 });
const backdropOf = selector => ({ selector, property: '--pui-backdrop', absent: 0 });
const OVERLAY_FLAVORS = {
  mechanical: { enterBounces: true, backdropBounces: true },
  glide: { enterBounces: false, backdropBounces: false },
};
function bounces(list, expected, label) {
  if (expected) assert.ok(Math.max(...list) > 1.01, `${label} overshoots a little: ${Math.max(...list)}`);
  else assert.ok(Math.max(...list) <= 1 + 1e-3, `${label} does not overshoot: ${Math.max(...list)}`);
}
const focusedLabel = page => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.textContent);

for (const [key, flavor] of Object.entries(OVERLAY_FLAVORS)) describe(`${key} flavor: overlays`, () => {
  test('Toast enter: a pushed toast rises in from rest to rest, read from the page, and never writes transform', async () => {
    const page = await open(key);
    try {
      const enter = values(await sample(page, { read: enterOf(nthToast(1)), ms: 800, actions: [{ at: 0, selector: PUSH, type: 'click' }] }));
      assert.equal(enter[0], 0, 'no toast before the push');
      assert.ok(strictlyBetween(enter, 0, 1).length >= 3, `the toast is seen in flight: ${enter.slice(0, 8)}`);
      near(enter.at(-1), 1, 1e-3, 'the toast rests at 1');
      bounces(enter, flavor.enterBounces, 'the toast enter');
      const rise = values(await sample(page, { read: { selector: nthToast(2), property: 'translate', part: 1, fallback: 0, absent: 8 }, ms: 800, actions: [{ at: 0, selector: PUSH, type: 'click' }] }));
      assert.ok(strictlyBetween(rise, 0, 8, PX).length >= 2, `the rendered toast rises: ${rise.slice(0, 8)}`);
      near(rise.at(-1), 0, PX, 'the rendered toast rests in place');
      const fade = values(await sample(page, { read: { selector: nthToast(3), property: 'opacity', absent: 0 }, ms: 800, actions: [{ at: 0, selector: PUSH, type: 'click' }] }));
      assert.ok(strictlyBetween(fade, 0, 1).length >= 2, `the rendered toast fades in: ${fade.slice(0, 8)}`);
      assert.ok(Math.max(...fade) <= 1 && fade.at(-1) === 1, 'the rendered opacity never passes 1 and rests at 1');
      const transforms = await page.locator(TOAST).evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
      assert.deepEqual(transforms, ['none', 'none', 'none'], 'no toast writes transform');
      assert.deepEqual(await page.locator('[role=log]').evaluate(node => [node.getAttribute('aria-live'), node.getAttribute('aria-atomic')]), ['polite', 'false'], 'the live region keeps its roles');
      assert.equal(await page.locator(`${TOAST}[aria-hidden]`).count(), 0, 'an entering toast is not hidden from screen readers');
      assert.match(await page.locator('[role=log]').textContent(), /Saved 1.*Saved 2.*Saved 3/, 'every message is in the live region');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('Toast enter: a second toast during the first enter leaves the first in flight, with its speed kept', async () => {
    const page = await open(key);
    try {
      const run = await sample(page, { read: enterOf(nthToast(1)), ms: 900, actions: [{ at: 0, selector: PUSH, type: 'click' }, { at: 80, selector: PUSH, type: 'click' }] });
      const list = values(run);
      const turn = run.marks[1];
      const atTurn = list[turn - 1];
      assert.ok(atTurn > 0.02 && atTurn < 0.98, `the second push lands while the first toast is in flight: ${atTurn} in ${list.slice(0, turn + 2)}`);
      assert.ok(list[turn] >= atTurn - 1e-3, `the first toast does not restart: ${list[turn]} after ${atTurn}`);
      assert.ok(Math.max(...list.slice(turn, turn + 3)) > atTurn, 'the first toast keeps moving forward: its speed carried over');
      near(list.at(-1), 1, 1e-3, 'the first toast rests at 1');
      assert.equal(await page.locator(TOAST).count(), 2);
    } finally { await page.close(); }
  });

  test('Toast: the dismiss button works from the keyboard, and a dismissed toast leaves the page at once', async () => {
    const page = await open(key);
    try {
      await page.locator(PUSH).click();
      await page.waitForTimeout(400);
      await page.locator(`${TOAST} button[aria-label=Dismiss]`).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(TOAST).count(), 0, 'Enter on Dismiss removes the toast');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('Modal enter: the dialog and the backdrop spring in from rest to rest, and focus lands on the primary action at once', async () => {
    const page = await open(key);
    try {
      // A script click does not move focus, as a real pointer click does, so the opener takes focus first.
      const first = await page.evaluate(selectors => new Promise(resolve => {
        document.querySelector(selectors.open).focus();
        document.querySelector(selectors.open).click();
        requestAnimationFrame(() => resolve([document.activeElement?.textContent, Number.parseFloat(getComputedStyle(document.querySelector(selectors.dialog)).getPropertyValue('--pui-dialog'))]));
      }), { open: OPEN, dialog: DIALOG });
      assert.equal(first[0], 'Confirm', 'focus is on the primary action at the first frame');
      assert.ok(first[1] >= 0 && first[1] < 0.9, `the dialog is still entering at the first frame: ${first[1]}`);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator(DIALOG).count(), 0, 'Escape closes the dialog at once');
      assert.equal(await focusedLabel(page), 'open-modal', 'focus returns to the opener');
      const dialog = values(await sample(page, { read: dialogOf(DIALOG), ms: 900, actions: [{ at: 0, selector: OPEN, type: 'click' }] }));
      assert.ok(strictlyBetween(dialog, 0, 1).length >= 3, `the dialog is seen in flight: ${dialog.slice(0, 8)}`);
      near(dialog.at(-1), 1, 1e-3, 'the dialog rests at 1');
      assert.ok(Math.max(...dialog) <= 1 + 1e-3, `a large surface does not bounce: ${Math.max(...dialog)}`);
      await page.keyboard.press('Escape');
      const backdrop = values(await sample(page, { read: backdropOf(BACKDROP), ms: 900, actions: [{ at: 0, selector: OPEN, type: 'click' }] }));
      assert.ok(strictlyBetween(backdrop, 0, 1).length >= 3, `the backdrop is seen in flight: ${backdrop.slice(0, 8)}`);
      near(backdrop.at(-1), 1, 1e-3, 'the backdrop rests at 1');
      bounces(backdrop, flavor.backdropBounces, 'the backdrop');
      await page.keyboard.press('Escape');
      const scale = values(await sample(page, { read: { selector: DIALOG, property: 'scale', fallback: 1, absent: 0.96 }, ms: 900, actions: [{ at: 0, selector: OPEN, type: 'click' }] }));
      assert.ok(strictlyBetween(scale, 0.96, 1).length >= 2, `the rendered dialog grows to its size: ${scale.slice(0, 8)}`);
      near(scale.at(-1), 1, 1e-3, 'the rendered dialog rests at scale 1');
      assert.equal(await page.locator(DIALOG).evaluate(node => getComputedStyle(node).transform), 'none', 'the dialog never writes transform');
      assert.equal(await page.locator(BACKDROP).evaluate(node => getComputedStyle(node).opacity), '1', 'the rendered backdrop rests at full opacity');
      assert.equal(await page.locator(DIALOG).evaluate(node => getComputedStyle(node).opacity), '1', 'the rendered dialog rests at full opacity');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('Modal: opening from the keyboard moves the same as a click', async () => {
    const page = await open(key);
    try {
      await page.locator(OPEN).focus();
      const keyed = sample(page, { read: dialogOf(DIALOG), ms: 900 });
      await page.keyboard.press('Enter');
      const run = values(await keyed);
      assert.ok(strictlyBetween(run, 0, 1).length >= 3, `the dialog enters after Enter on its opener: ${run.slice(0, 8)}`);
      near(run.at(-1), 1, 1e-3, 'the dialog rests at 1');
    } finally { await page.close(); }
  });

  test('Modal: a nested dialog enters on its own while the outer one rests, and the focus trap and return are unchanged', async () => {
    const page = await open(key);
    try {
      await page.locator(OPEN).click();
      await page.waitForTimeout(600);
      const nestedButton = `${DIALOG} button[aria-label="Open nested"]`;
      // A dispatched click does not move focus, as a real pointer click does, so the action takes focus first.
      await page.locator(nestedButton).focus();
      const inner = values(await sample(page, { read: dialogOf(INNER), ms: 900, actions: [{ at: 0, selector: nestedButton, type: 'click' }] }));
      assert.ok(strictlyBetween(inner, 0, 1).length >= 3, `the nested dialog is seen in flight: ${inner.slice(0, 8)}`);
      near(inner.at(-1), 1, 1e-3, 'the nested dialog rests at 1');
      assert.equal(await focusedLabel(page), 'Inner confirm', 'focus moves into the nested dialog');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(selector => document.querySelector(selector).contains(document.activeElement), INNER), true, 'Tab stays inside the nested dialog');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator(INNER).count(), 0, 'Escape closes only the nested dialog');
      assert.equal(await focusedLabel(page), 'Open nested', 'focus returns to the action that opened it');
      const outer = values(await sample(page, { read: dialogOf(DIALOG), ms: 500, actions: [{ at: 0, selector: nestedButton, type: 'click' }] }));
      assert.ok(onlyRest(outer, [1]), `the outer dialog stays at rest while the nested one enters: ${outer.slice(0, 8)}`);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator(DIALOG).count(), 0, 'both dialogs are closed');
      assert.equal(await focusedLabel(page), 'open-modal', 'focus returns to the first opener');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('Tooltip: a pointer hover shows it with an enter motion, centred over its trigger, with no transform', async () => {
    const page = await open(key);
    try {
      const tip = values(await sample(page, { read: enterOf(TIP), ms: 700, actions: [{ at: 0, selector: TRIGGER, type: 'mouseover' }] }));
      assert.equal(tip[0], 0, 'no tooltip before the hover');
      assert.ok(strictlyBetween(tip, 0, 1).length >= 2, `the tooltip is seen in flight: ${tip.slice(0, 8)}`);
      near(tip.at(-1), 1, 1e-3, 'the tooltip rests at 1');
      bounces(tip, flavor.enterBounces, 'the tooltip enter');
      const [tipBox, triggerBox] = await page.evaluate(([tip, trigger]) => [tip, trigger].map(selector => document.querySelector(selector).getBoundingClientRect().toJSON()), [TIP, TRIGGER]);
      near(tipBox.x + tipBox.width / 2, triggerBox.x + triggerBox.width / 2, 0.5, 'the rendered tooltip is centred over its trigger');
      assert.ok(tipBox.y + tipBox.height <= triggerBox.y, 'the rendered tooltip sits above its trigger');
      assert.equal(await page.locator(TIP).evaluate(node => getComputedStyle(node).transform), 'none', 'the tooltip never writes transform');
      const id = await page.locator(TIP).getAttribute('id');
      assert.equal(await page.locator(TRIGGER).getAttribute('aria-describedby'), id, 'the trigger is described by the tooltip');
      await page.evaluate(selector => document.querySelector(selector).dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })), TRIGGER);
      assert.equal(await page.locator(TIP).count(), 0, 'a pointer leave hides it at once');
      assert.equal(await page.locator(TRIGGER).getAttribute('aria-describedby'), null, 'the description is gone with it');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('Tooltip: a keyboard focus shows it at rest with no motion, and Escape hides it at once', async () => {
    const page = await open(key);
    try {
      const run = values(await sample(page, { read: enterOf(TIP), ms: 400, actions: [{ at: 0, selector: TRIGGER, type: 'focus' }] }));
      assert.ok(onlyRest(run, [0, 1]) && run.at(-1) === 1, `a focus shows the tooltip at rest: ${run.slice(0, 8)}`);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator(TIP).count(), 0, 'Escape hides it at once');
      assert.equal(await page.locator(TRIGGER).getAttribute('aria-describedby'), null);
    } finally { await page.close(); }
  });

  test('reduced motion: the toast, the dialog, its backdrop, and a hovered tooltip appear at rest', async () => {
    const page = await open(key, 'reduce');
    try {
      const cases = [
        [enterOf(nthToast(1)), { selector: PUSH, type: 'click' }],
        [dialogOf(DIALOG), { selector: OPEN, type: 'click' }],
        [backdropOf(BACKDROP), null],
        [enterOf(TIP), { selector: TRIGGER, type: 'mouseover' }],
      ];
      for (const [read, action] of cases) {
        const run = values(await sample(page, { read, ms: 300, actions: action ? [{ at: 0, ...action }] : [] }));
        assert.ok(onlyRest(run, [0, 1]) && run.at(-1) === 1, `${read.selector} appears at rest: ${run.slice(0, 8)}`);
        if (read.selector === BACKDROP) await page.keyboard.press('Escape');
      }
    } finally { await page.close(); }
  });

  test('reduced motion turned on mid-move snaps the toast, the dialog, and the tooltip to rest', async () => {
    const page = await open(key);
    try {
      const cases = [
        { read: enterOf(nthToast(1)), action: { selector: PUSH, type: 'click' } },
        { read: dialogOf(DIALOG), action: { selector: OPEN, type: 'click' }, reset: () => page.keyboard.press('Escape') },
        { read: enterOf(TIP), action: { selector: TRIGGER, type: 'mouseover' }, reset: () => page.evaluate(selector => document.querySelector(selector).dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })), TRIGGER) },
      ];
      for (const item of cases) {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => { window.__flipAt = null; });
        await page.waitForTimeout(300);
        const running = page.evaluate(options => window.__sample(options).then(run => ({ ...run, start: performance.now() - run.values.at(-1).t })), { read: item.read, ms: 500, actions: [{ at: 0, ...item.action }] });
        await page.waitForTimeout(40);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const run = await running;
        const flip = await page.evaluate(() => window.__flipAt);
        assert.ok(flip, 'the setting changed during the run');
        const beforeFlip = run.values.filter(sample => run.start + sample.t < flip).map(sample => sample.v);
        const afterFlip = run.values.filter(sample => run.start + sample.t > flip + 20).map(sample => sample.v);
        assert.ok(strictlyBetween(beforeFlip, 0, 1).length > 0, `${item.read.selector} is in flight before the switch: ${beforeFlip.slice(0, 6)}`);
        assert.ok(afterFlip.length > 0 && onlyRest(afterFlip, [1]), `${item.read.selector} rests at 1 once reduced motion is on: ${afterFlip.slice(0, 4)}`);
        await item.reset?.();
      }
    } finally { await page.close(); }
  });

  test('forced colors: the toast, the dialog, and the tooltip rest fully visible after they enter', async () => {
    const page = await open(key);
    try {
      await page.emulateMedia({ forcedColors: 'active' });
      await page.locator(PUSH).click();
      await page.evaluate(selector => document.querySelector(selector).dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })), TRIGGER);
      await page.waitForTimeout(700);
      for (const selector of [TOAST, TIP]) assert.equal(await page.locator(selector).evaluate(node => getComputedStyle(node).opacity), '1', `${selector} rests visible`);
      await page.locator(OPEN).click();
      await page.waitForTimeout(700);
      for (const selector of [DIALOG, BACKDROP]) assert.equal(await page.locator(selector).evaluate(node => getComputedStyle(node).opacity), '1', `${selector} rests visible`);
    } finally { await page.close(); }
  });
});

describe('overlay environments', () => {
  test('without a MotionProvider: the toast, the dialog, and the tooltip keep their static markup and write no motion variable', async () => {
    const page = await open('mechanical', 'no-preference', '&provider=none');
    try {
      await page.locator(PUSH).click();
      assert.equal(await page.locator(TOAST).evaluate(node => [getComputedStyle(node).getPropertyValue('--pui-enter'), getComputedStyle(node).animationName].join('|')), '|ui-toast-in', 'the toast keeps its CSS enter');
      await page.evaluate(selector => document.querySelector(selector).dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })), TRIGGER);
      assert.equal(await page.locator(TIP).evaluate(node => getComputedStyle(node).getPropertyValue('--pui-enter')), '', 'the tooltip writes no motion variable');
      await page.locator(OPEN).click();
      assert.equal(await page.locator(BACKDROP).count(), 0, 'no separate backdrop layer');
      assert.equal(await page.locator(DIALOG).evaluate(node => getComputedStyle(node).getPropertyValue('--pui-dialog')), '', 'the dialog writes no motion variable');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('React StrictMode: the toast and the dialog enter once and rest at 1, and an unmount leaves no listener', async () => {
    const page = await open('mechanical', 'no-preference', '&strict');
    try {
      const toast = values(await sample(page, { read: enterOf(nthToast(1)), ms: 800, actions: [{ at: 0, selector: PUSH, type: 'click' }] }));
      assert.ok(strictlyBetween(toast, 0, 1).length >= 3, 'the toast is seen in flight');
      near(toast.at(-1), 1, 1e-3, 'the toast rests at 1');
      const dialog = values(await sample(page, { read: dialogOf(DIALOG), ms: 900, actions: [{ at: 0, selector: OPEN, type: 'click' }] }));
      assert.ok(strictlyBetween(dialog, 0, 1).length >= 3, 'the dialog is seen in flight');
      near(dialog.at(-1), 1, 1e-3, 'the dialog rests at 1');
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.__unmount());
      assert.deepEqual(await leftListeners(page), ['change'], 'only the fixture\'s own reduced-motion listener is left');
      assert.deepEqual(page.errors, []);
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

  test('without a MotionProvider: a checked Toggle thumb rests on the checked side, a hovered Slider thumb grows, and the Button ref is set', async () => {
    const page = await open('mechanical', 'no-preference', '&provider=none');
    try {
      assert.equal(await page.locator('[data-pui-motion], .ui-lens').count(), 0, 'no motion markup');
      await page.locator(`${TOGGLE} input`).click();
      await page.waitForTimeout(400);
      const thumb = await page.locator(THUMB).evaluate(node => [getComputedStyle(node).translate, getComputedStyle(node).transform]);
      assert.deepEqual(thumb, ['16px', 'none'], 'the static thumb moved the md travel with translate');
      const resting = await thumbHeight(page);
      const input = await page.locator(SLIDER).boundingBox();
      const fraction = await page.locator(SLIDER).evaluate(node => (Number(node.value) - Number(node.min)) / (Number(node.max) - Number(node.min)));
      await page.mouse.move(input.x + 8 + (input.width - 16) * fraction, input.y + input.height / 2);
      await page.waitForTimeout(300);
      const hovered = await thumbHeight(page);
      assert.ok(resting >= 12, `the resting thumb is drawn: ${resting} rows`);
      assert.ok(hovered / resting > 1.07, `the hovered WebKit thumb grows: ${hovered} rows against ${resting}`);
      assert.equal(await page.evaluate(selector => window.__pressRef?.current === document.querySelector(selector), BUTTON), true, 'the ref points at the button');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('React StrictMode: the double mount leaves one working controller each, and an unmount leaves no listener', async () => {
    const page = await open('mechanical', 'no-preference', '&strict');
    try {
      const press = values(await sample(page, { read: { selector: BUTTON, property: 'scale', fallback: 1 }, ms: 500, actions: [{ at: 0, selector: BUTTON, type: 'pointerdown' }, { at: 200, selector: BUTTON, type: 'pointerup' }] }));
      near(Math.min(...press), FLAVORS.mechanical.press, 0.006, 'the press reaches the flavor scale once, not twice');
      near(press.at(-1), 1, 1e-3, 'the press returns to rest');
      const thumb = values(await sample(page, { read: { selector: TOGGLE, property: '--pui-thumb' }, ms: 800, actions: [{ at: 0, selector: `${TOGGLE} input`, type: 'click' }] }));
      assert.ok(strictlyBetween(thumb, 0, 1).length >= 3, 'the thumb is seen in flight');
      near(thumb.at(-1), 1, 1e-3, 'the thumb rests on the checked side');
      const start = await box(page, TABS, 'First');
      const lens = values(await sample(page, { read: { selector: TABS, property: '--pui-lens-x' }, ms: 800, actions: [{ at: 0, selector: option(TABS, 3), type: 'click' }] }));
      const end = await box(page, TABS, 'Third');
      assert.ok(strictlyBetween(lens, start.x, end.x, PX).length >= 2, 'the lens travels');
      near(lens.at(-1), end.x, 0.5, 'the lens lands');
      assert.equal(await page.evaluate(selector => window.__pressRef?.current === document.querySelector(selector), BUTTON), true, 'the ref points at the button inside the provider');
      await page.evaluate(() => window.__unmount());
      assert.deepEqual(await leftListeners(page), ['change'], 'only the fixture\'s own reduced-motion listener is left');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('a nested provider sets the flavor of its subtree; swapping its flavor warns once', async () => {
    const page = await open('mechanical', 'no-preference', '&nested');
    const warnings = [];
    page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    try {
      assert.equal(await page.getByTestId('flavor').textContent(), 'projection');
      assert.equal(await page.getByTestId('nested-flavor').textContent(), 'projection-glide');
      const read = selector => ({ selector, property: 'scale', fallback: 1 });
      const pressAt = selector => [{ at: 0, selector, type: 'pointerdown' }, { at: 300, selector, type: 'pointerup' }];
      const outer = values(await sample(page, { read: read(BUTTON), ms: 700, actions: pressAt(BUTTON) }));
      const inner = values(await sample(page, { read: read('[data-testid=nested-press]'), ms: 700, actions: pressAt('[data-testid=nested-press]') }));
      near(Math.min(...outer), FLAVORS.mechanical.press, 0.006, 'the outer button presses as Mechanical');
      near(Math.min(...inner), FLAVORS.glide.press, 0.003, 'the inner button presses as Glide');
      assert.deepEqual(warnings, [], 'no warning while the flavor keeps its identity');
      await page.getByTestId('swap-flavor').click();
      await page.getByTestId('swap-flavor').click();
      await page.waitForTimeout(100);
      assert.equal(warnings.length, 1, `one warning for the provider: ${warnings}`);
      assert.match(warnings[0], /MotionProvider: the flavor changed between renders/);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  // Turns reduced motion on while the Tabs lens travels to the third tab, and returns the lens values after the switch and the target.
  async function flipDuringTabsTravel(page) {
    await page.evaluate(() => { window.__flipAt = null; });
    const running = page.evaluate(options => window.__sample(options).then(run => ({ ...run, start: performance.now() - run.values.at(-1).t })), { read: { selector: TABS, property: '--pui-lens-x' }, ms: 500, actions: [{ at: 0, selector: option(TABS, 3), type: 'click' }] });
    await page.waitForTimeout(40);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const run = await running;
    const flip = await page.evaluate(() => window.__flipAt);
    assert.ok(flip, 'the setting changed during the run');
    const target = (await box(page, TABS, 'Third')).x;
    const start = (await box(page, TABS, 'First')).x;
    const beforeFlip = run.values.filter(sample => run.start + sample.t < flip).map(sample => sample.v);
    assert.ok(strictlyBetween(beforeFlip, start, target, PX).length > 0, `the lens is in flight before the switch: ${beforeFlip.slice(0, 6)}`);
    return { target, afterFlip: run.values.filter(sample => run.start + sample.t > flip + 20).map(sample => sample.v) };
  }

  test('reduced motion turned on mid-move: a controller that throws while it stops does not keep the others moving', async () => {
    const page = await open('mechanical');
    try {
      // The Button registered first. Its stop re-attaches pointer listeners, so a throwing addEventListener makes that stop throw.
      await page.locator(BUTTON).evaluate(node => { node.addEventListener = () => { throw new Error('a sabotaged controller'); }; });
      const { target, afterFlip } = await flipDuringTabsTravel(page);
      assert.ok(afterFlip.length > 0 && onlyRest(afterFlip, [target], PX), `the Tabs lens rests on ${target} once reduced motion is on: ${afterFlip.slice(0, 4)}`);
      assert.ok(page.errors.some(text => text.includes('a sabotaged controller')), `the failure is reported: ${page.errors}`);
    } finally { await page.close(); }
  });

  test('with a media query list that has only addListener, as in older Safari, a reduced-motion change still stops the motion, and an unmount removes the listener', async () => {
    const page = await open('mechanical', 'no-preference', '&legacymq');
    try {
      assert.equal(await page.evaluate(() => typeof window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener), 'undefined', 'the stub has no addEventListener');
      const { target, afterFlip } = await flipDuringTabsTravel(page);
      assert.ok(afterFlip.length > 0 && onlyRest(afterFlip, [target], PX), `the Tabs lens rests on ${target} once reduced motion is on: ${afterFlip.slice(0, 4)}`);
      await page.evaluate(() => window.__unmount());
      assert.equal(await page.evaluate(() => window.__legacyListeners()), 1, 'only the fixture\'s own listener is left');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test('hydration of the server markup logs no error, and motion runs after it', async () => {
    const page = await open('mechanical', 'no-preference', '&hydrate');
    try {
      const thumb = values(await sample(page, { read: { selector: TOGGLE, property: '--pui-thumb' }, ms: 800, actions: [{ at: 0, selector: `${TOGGLE} input`, type: 'click' }] }));
      assert.ok(strictlyBetween(thumb, 0, 1).length >= 3, 'the thumb is seen in flight after hydration');
      assert.equal(await page.evaluate(() => document.querySelectorAll('style[data-href="pui-motion"]').length), 1, 'one motion stylesheet after hydration');
      assert.deepEqual(page.errors, [], 'no hydration error');
    } finally { await page.close(); }
  });
});

// The same Slider grab and Toggle checks in Firefox and WebKit. They run where Playwright has the browser installed, as in the
// gate image. CI installs Chromium only, so there they are skipped with that reason.
for (const [name, type] of [['firefox', firefox], ['webkit', webkit]]) describe(name, () => {
  const installed = existsSync(type.executablePath());
  const skip = installed ? false : `${name} is not installed here (CI installs Chromium only)`;
  let other;
  before(async () => { if (installed) other = await type.launch({ headless: true }); });
  after(async () => { await other?.close(); });

  test(`${name}: a pointer grab scales the rendered Slider thumb, and the release rests at 1`, { skip }, async () => {
    const page = await open('mechanical', 'no-preference', '', other);
    try {
      const grab = { selector: SLIDER, property: '--pui-press', fallback: 1 };
      const held = values(await sample(page, { read: grab, ms: 500, actions: [{ at: 0, selector: SLIDER, type: 'pointerdown' }] }));
      assert.ok(strictlyBetween(held, 1, FLAVORS.mechanical.grab).length > 0, `the grab is seen in flight: ${held.slice(0, 8)}`);
      near(held.at(-1), FLAVORS.mechanical.grab, 0.005, 'the grab rests on the flavor scale');
      const grabbed = await thumbHeight(page);
      const released = values(await sample(page, { read: grab, ms: 600, actions: [{ at: 0, selector: SLIDER, type: 'pointerup' }] }));
      near(released.at(-1), 1, 1e-3, 'the release rests at 1');
      const resting = await thumbHeight(page);
      assert.ok(resting >= 12, `the resting thumb is drawn: ${resting} rows`);
      assert.ok(grabbed / resting > 1.07, `the rendered thumb grows while grabbed: ${grabbed} rows against ${resting}`);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test(`${name}: the Toggle thumb springs in flight and rests on the checked side`, { skip }, async () => {
    const page = await open('mechanical', 'no-preference', '', other);
    try {
      const run = values(await sample(page, { read: { selector: TOGGLE, property: '--pui-thumb' }, ms: 800, actions: [{ at: 0, selector: `${TOGGLE} input`, type: 'click' }] }));
      assert.ok(strictlyBetween(run, 0, 1).length >= 3, 'the thumb is seen in flight');
      near(run.at(-1), 1, 1e-3, 'rests on the checked side');
      const travel = await page.locator(THUMB).evaluate(node => Number.parseFloat(getComputedStyle(node).translate));
      near(travel, 16, 0.05, 'the rendered thumb moved the md travel');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
});
