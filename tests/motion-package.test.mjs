// Packed-package checks for the ./motion entry: its shape, its flavors and their measured springs, its import graph,
// its server render, and its size. Browser behaviour is in motion-rendered.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { after, before, test } from 'node:test';
import { build } from 'vite';
import { packFixture, packageName, repository } from './helpers/packed.mjs';
import { measureSpring, springLine } from './helpers/measure-spring.mjs';

const manifest = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8'));
let packed, installed, motion, root, core, foundations, armature, React, server;
let loads = 0;

async function load(specifier) {
  const file = join(packed.fixture, `load-${loads++}.mjs`);
  writeFileSync(file, `export * from ${JSON.stringify(specifier)}\n`);
  return import(pathToFileURL(file).href);
}

before(async () => {
  packed = packFixture('motion-package', ['armature', '@types', 'typescript']);
  installed = packed.installed;
  motion = await load(`${packageName}/motion`);
  root = await load(packageName);
  core = await load(`${packageName}/core`);
  foundations = await load(`${packageName}/foundations`);
  armature = await load('@hannasage/armature');
  const require = createRequire(join(packed.fixture, 'package.json'));
  React = require('react');
  server = require('react-dom/server');
});
after(() => { if (packed) rmSync(packed.temporary, { recursive: true, force: true }); });

const seconds = value => Number.parseFloat(value) * (String(value).endsWith('ms') ? 0.001 : 1);
const flavors = () => ({ projection: motion.projection, projectionGlide: motion.projectionGlide });

test('./motion is ESM only: types and import, no require, a client boundary, and no CommonJS file', () => {
  assert.deepEqual(manifest.exports['./motion'], { types: './dist/src/motion.d.ts', import: './dist/motion.js' });
  assert.match(readFileSync(join(installed, 'dist/motion.js'), 'utf8'), /^['"]use client['"]/);
  assert.equal(existsSync(join(installed, 'dist/motion.cjs')), false, 'no CommonJS build of ./motion');
  const require = createRequire(join(packed.fixture, 'package.json'));
  assert.throws(() => require(`${packageName}/motion`), error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED', 'a require of ./motion fails with a clear export error');
  assert.equal(typeof require(`${packageName}/core`).Button, 'function', 'the rest of the package keeps CommonJS');
});

test('the public ./motion surface is small: the flavors, MotionProvider, and useMotionFlavor', () => {
  assert.deepEqual(Object.keys(motion).sort(), ['MotionProvider', 'projection', 'projectionGlide', 'useMotionFlavor']);
});

function graph(entry) {
  const seen = new Set();
  const bare = new Set();
  const walk = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const [, specifier] of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|require\(\s*)["']([^"']+)["']/g)) {
      if (specifier.startsWith('.')) walk(join(dirname(file), specifier));
      else bare.add(specifier);
    }
  };
  walk(join(installed, entry));
  return [...bare];
}

test('./core loads no Armature, and ./motion reaches Armature only through its public entries', () => {
  for (const entry of ['dist/core.js', 'dist/core.cjs', 'dist/index.js', 'dist/index.cjs']) {
    assert.deepEqual(graph(entry).filter(name => name.startsWith('@hannasage/armature')), [], `${entry} imports no Armature module`);
  }
  const published = JSON.parse(readFileSync(join(packed.fixture, 'node_modules/@hannasage/armature/package.json'), 'utf8'));
  const publicEntries = Object.keys(published.exports).map(key => key === '.' ? '@hannasage/armature' : `@hannasage/armature/${key.slice(2)}`);
  const reached = graph('dist/motion.js').filter(name => name.startsWith('@hannasage/armature'));
  assert.ok(reached.length > 0, './motion uses Armature');
  for (const name of reached) assert.ok(publicEntries.includes(name), `${name} is a public Armature entry`);
  assert.equal(published.version, '1.0.0-beta.1', 'the installed Armature is the pinned beta');
});

test('the public ./motion declarations reach no Armature type, and MotionFlavor accepts only the two flavors', () => {
  const declarations = new Set();
  const bare = new Set();
  const walk = file => {
    if (declarations.has(file)) return;
    declarations.add(file);
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g)) {
      if (specifier.startsWith('.')) walk(join(dirname(file), specifier.replace(/\.js$/, '') + '.d.ts'));
      else bare.add(specifier);
    }
  };
  walk(join(installed, 'dist/src/motion.d.ts'));
  assert.deepEqual([...bare].filter(name => name.includes('armature')), [], 'no public declaration imports Armature');
  for (const file of declarations) assert.doesNotMatch(readFileSync(file, 'utf8'), /armature/i, `${file} names no Armature type`);
  writeFileSync(join(packed.fixture, 'flavor-types.tsx'), [
    `import { MotionProvider, projection, projectionGlide, useMotionFlavor, type MotionFlavor, type MotionProviderProps } from '${packageName}/motion'`,
    `const both: MotionFlavor[] = [projection, projectionGlide]`,
    `const name: string = useMotionFlavor().name`,
    `const props: MotionProviderProps = { flavor: projectionGlide }`,
    `// @ts-expect-error A hand-made object is not a flavor.`,
    `const made: MotionFlavor = { name: 'projection', prefix: 'pui' }`,
    `// @ts-expect-error The flavor prop takes only the two exported flavors.`,
    `export const wrong = <MotionProvider flavor={{ name: 'projection-glide', prefix: 'pui' }} />`,
    `export { both, name, props, made }`,
  ].join('\n'));
  const config = join(packed.fixture, 'tsconfig-flavor.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: { target: 'ES2020', lib: ['ES2020', 'DOM'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: false }, files: ['flavor-types.tsx'] }));
  execFileSync(process.execPath, [join(repository, 'node_modules/typescript/bin/tsc'), '-p', config], { cwd: packed.fixture, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
});

test('Button declares its ref, so a consumer passes one with no cast, inside a MotionProvider or not', () => {
  writeFileSync(join(packed.fixture, 'button-ref.tsx'), [
    `import { createRef } from 'react'`,
    `import { Button, type ButtonProps } from '${packageName}/core'`,
    `import { MotionProvider } from '${packageName}/motion'`,
    `const ref = createRef<HTMLButtonElement>()`,
    `const props: ButtonProps = { ref, variant: 'primary' }`,
    `export const plain = <Button ref={ref}>Go</Button>`,
    `export const moving = <MotionProvider><Button ref={node => { void node?.focus }}>Go</Button></MotionProvider>`,
    `export { props }`,
  ].join('\n'));
  const config = join(packed.fixture, 'tsconfig-ref.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: { target: 'ES2020', lib: ['ES2020', 'DOM'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: false }, files: ['button-ref.tsx'] }));
  execFileSync(process.execPath, [join(repository, 'node_modules/typescript/bin/tsc'), '-p', config], { cwd: packed.fixture, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
});

test('both flavors follow the beta.1 contract: frozen, prefix pui, followers and lens.rest', () => {
  for (const [name, flavor] of Object.entries(flavors())) {
    assert.ok(Object.isFrozen(flavor) && Object.isFrozen(flavor.springs) && Object.isFrozen(flavor.lens), `${name} is frozen at every level`);
    assert.doesNotThrow(() => armature.validateFlavor(flavor), `${name} is a valid Armature flavor`);
    assert.equal(flavor.prefix, 'pui');
    assert.ok('followers' in flavor && !('follower' in flavor), `${name} uses followers`);
    assert.ok('rest' in flavor.lens && !('pixelRest' in flavor.lens), `${name} uses lens.rest`);
    assert.equal(flavor.followers.thumb.var, 'thumb');
    assert.equal(flavor.surface.specular, false);
    assert.equal(flavor.surface.glow, false);
  }
  assert.equal(motion.projection.name, 'projection');
  assert.equal(motion.projectionGlide.name, 'projection-glide');
});

test('spring numbers come from UI_FOUNDATIONS.motion and the Armature solver, never typed into the flavor', () => {
  const tokens = foundations.UI_FOUNDATIONS.motion;
  const { mechanical, settle } = motion.projection.springs;
  const { glide } = motion.projectionGlide.springs;
  assert.equal(mechanical.stiffness, Number(tokens['mechanical-stiffness']));
  assert.equal(mechanical.damping, Number(tokens['mechanical-damping']));
  assert.equal(settle.stiffness, Number(tokens['settle-stiffness']));
  assert.equal(settle.damping, armature.criticalDamping(settle.stiffness), 'settle is critically damped');
  assert.deepEqual(motion.projectionGlide.springs.settle, settle, 'Glide shares settle for exits');
  assert.equal(glide.damping, armature.criticalDamping(glide.stiffness), 'glide is critically damped');
  assert.ok(glide.stiffness < mechanical.stiffness, 'glide is softer than mechanical');
  const measuredGlide = measureSpring(glide);
  assert.equal(measuredGlide.overshoot, 0, 'glide never bounces');
  assert.ok(Math.abs(measuredGlide.settleSeconds - seconds(tokens['glide-settle'])) < 0.005, `glide settles at the token time: ${measuredGlide.settleSeconds}`);
  assert.ok(measuredGlide.settleSeconds > measureSpring(mechanical).settleSeconds, 'glide settles later than mechanical');
  const depth = flavor => Math.abs(1 - flavor.surface.defaults.pressScale);
  assert.ok(depth(motion.projectionGlide) < depth(motion.projection), 'the Glide press is shallower');
  assert.ok(Math.abs(1 - motion.projectionGlide.surface.feels.grab.pressScale) < Math.abs(1 - motion.projection.surface.feels.grab.pressScale), 'the Glide grab is shallower');
  for (const flavor of Object.values(flavors())) assert.equal(flavor.surface.springKeys.press, flavor.followers.thumb.springKey);
  // Indicators never bounce: Mechanical moves its lens on the critically damped settle spring, and Glide on its own glide spring.
  assert.deepEqual({ ...motion.projection.lens.springKeys }, { x: 'settle', width: 'settle' });
  assert.deepEqual({ ...motion.projectionGlide.lens.springKeys }, { x: 'glide', width: 'glide' });
});

test('docs/motion.md prints the numbers the solver measures', t => {
  const page = readFileSync(join(repository, 'docs/motion.md'), 'utf8');
  for (const [name, flavor] of Object.entries(flavors())) {
    for (const [key, config] of Object.entries(flavor.springs)) {
      const line = springLine(key, config);
      t.diagnostic(`${name} ${line}`);
      assert.ok(page.includes(line), `docs/motion.md is missing: ${line}`);
    }
  }
});

test('docs/motion.md gives the install command at the pinned version and the rules a consumer needs', () => {
  const page = readFileSync(join(repository, 'docs/motion.md'), 'utf8');
  assert.ok(page.includes(`npm install @hannasage/armature@${manifest.peerDependencies['@hannasage/armature']}`), 'the install command pins the peer version');
  assert.match(page, /import `\.\/core` as ESM/);
  assert.match(page, /read-only[^\n]*Setting them changes nothing/);
  assert.match(page, /## Why clip-path/);
  assert.match(page, /A value set from code jumps/);
  assert.match(page, /per-component `flavor` prop/);
  assert.match(page, /module scope/);
  assert.match(page, /No provider turns motion off/);
  assert.match(page, /Firefox and WebKit/);
  assert.doesNotMatch(page, /\bplan\b/i, 'the page cites no plan a reader cannot see');
  assert.match(page, /Where `process` is undefined/, 'the page says what the warning does without process');
  const stability = page.slice(page.indexOf('## Stability'));
  assert.match(stability, /Firefox and WebKit[^\n]*not run in CI/, 'the stability section names the browser gap');
});

function poisoned(render) {
  const touched = [];
  const names = ['window', 'document', 'matchMedia'];
  const saved = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { touched.push(name); throw new Error(`the server render touched ${name}`); } });
  try { return { html: render(), touched }; } finally {
    names.forEach((name, index) => { if (saved[index]) Object.defineProperty(globalThis, name, saved[index]); else delete globalThis[name]; });
  }
}

function surfaces(api) {
  const h = React.createElement;
  const noop = () => {};
  return h(api.ThemeProvider, { theme: foundations.DEFAULT_THEME },
    h(api.Button, { type: 'button' }, 'Press'),
    h(api.Toggle, { label: 'On', checked: true, onChange: noop }),
    h(api.Toggle, { label: 'Off', checked: false, onChange: noop }),
    h(api.Toggle, { label: 'Small', size: 'sm', checked: true, onChange: noop }),
    h(api.Slider, { label: 'Level', value: 40, onChange: noop }),
    h(api.ButtonGroup, { 'aria-label': 'Chips', value: 'b', onChange: noop, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }),
    h(api.ButtonGroup, { 'aria-label': 'Segments', variant: 'segmented', value: 'a', onChange: noop, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }),
    h(api.Tabs, { label: 'Sections', items: [{ value: 'one', label: 'One', content: 'First' }, { value: 'two', label: 'Two', content: 'Second' }] }));
}

test('a server render with window, document, and matchMedia poisoned shows every surface at rest', () => {
  for (const [label, api] of [['root', root], ['core', core]]) {
    for (const flavor of Object.values(flavors())) {
      const { html, touched } = poisoned(() => server.renderToString(React.createElement(motion.MotionProvider, { flavor }, surfaces(api))));
      assert.deepEqual(touched, [], `${label}: no browser global is read`);
      assert.match(html, /scale:var\(--pui-press, 1\)/, `${label}: the Button rests at scale 1`);
      assert.match(html, /translate:calc\(var\(--pui-thumb, 1\) \* 16px\) 0/, `${label}: a checked Toggle rests on the checked side`);
      assert.match(html, /translate:calc\(var\(--pui-thumb, 0\) \* 16px\) 0/, `${label}: an unchecked Toggle rests on the unchecked side`);
      assert.match(html, /translate:calc\(var\(--pui-thumb, 1\) \* 13px\) 0/, `${label}: the small Toggle travels 13 px`);
      assert.equal((html.match(/class="ui-lens"/g) ?? []).length, 3, `${label}: each lens surface draws one hidden indicator`);
      assert.equal((html.match(/<style[^>]*data-href="pui-motion"/g) ?? []).length, 1, `${label}: one copy of the motion stylesheet, however many surfaces render`);
      assert.equal((html.match(/data-pui-motion/g) ?? []).length >= 3, true);
      assert.doesNotMatch(html, /\sdata-pui-lens="/, `${label}: the lens is not ready on the server, so the static active style shows`);
      assert.doesNotMatch(html, /transform\s*:/i, `${label}: no moving part writes transform`);
    }
  }
});

test('without a MotionProvider the components render their static markup with no motion variables', () => {
  const { html, touched } = poisoned(() => server.renderToString(surfaces(core)));
  assert.deepEqual(touched, []);
  assert.doesNotMatch(html, /--pui-|data-pui|ui-lens/);
  assert.doesNotMatch(html, /transform\s*:/i, 'the static Toggle and Slider use individual properties too');
});

test('the built ./motion leaves the development check to the consumer build: process.env.NODE_ENV stays, and no import.meta.env value is baked in', () => {
  const text = readFileSync(join(installed, 'dist/motion.js'), 'utf8').split('\n').filter(line => !/^\s*(?:\/\*\*|\*|\/\/)/.test(line)).join('\n');
  assert.match(text, /process\.env\.NODE_ENV/, 'the consumer bundler can replace NODE_ENV');
  assert.match(text, /import\.meta/, 'import.meta stays for the consumer bundler to read');
  assert.doesNotMatch(text, /"?DEV"?\s*:\s*(?:true|false)|"?MODE"?\s*:\s*"production"/, 'no build-time environment object is baked in');
});

test('Glide runs the same components: the server markup does not depend on the flavor, and no code branches on its name', () => {
  const render = flavor => server.renderToString(React.createElement(motion.MotionProvider, { flavor }, surfaces(core)));
  assert.equal(render(motion.projectionGlide), render(motion.projection));
  const text = file => readFileSync(join(installed, 'dist', file), 'utf8');
  assert.equal((text('motion.js').match(/projection-glide/g) ?? []).length, 1, 'the Glide name appears once, as data');
  assert.doesNotMatch(text('motion.js'), /\.name\s*===|===\s*["']projection/, 'no comparison with a flavor name');
});

test('useMotionFlavor reads the provider and defaults to Mechanical', () => {
  const Probe = () => React.createElement('output', null, motion.useMotionFlavor().name);
  assert.equal(server.renderToStaticMarkup(React.createElement(Probe)), '<output>projection</output>');
  assert.equal(server.renderToStaticMarkup(React.createElement(motion.MotionProvider, { flavor: motion.projectionGlide }, React.createElement(Probe))), '<output>projection-glide</output>');
  assert.equal(server.renderToStaticMarkup(React.createElement(motion.MotionProvider, null, React.createElement(Probe))), '<output>projection</output>');
});

// The ./motion cost in an app: the gzip size of core plus motion, less core alone. 8,050 bytes is the agreed cap.
const MOTION_GZIP_CAP = 8_050;
test('./motion adds at most 8,050 bytes, minified with whitespace removed and gzipped, to an app that uses ./core', async t => {
  const bundle = async (name, source) => {
    const entry = join(packed.fixture, `${name}.mjs`);
    writeFileSync(entry, source);
    const result = await build({ configFile: false, root: packed.fixture, logLevel: 'silent', build: { write: false, minify: true, rollupOptions: { input: entry, preserveEntrySignatures: 'strict', external: ['react', 'react-dom', 'react/jsx-runtime'] } } });
    const chunks = (Array.isArray(result) ? result : [result]).flatMap(output => output.output).filter(chunk => chunk.type === 'chunk');
    // Library mode keeps the whitespace of an ES build. App mode removes it, as a consumer's production build does.
    // The check looks for an indented statement, so the line breaks inside the components' CSS strings do not count.
    for (const chunk of chunks) assert.doesNotMatch(chunk.code, /\n[ \t]+(?:const|let|return|function) /, `${name}: the measured code has no indented statement`);
    return chunks.reduce((sum, chunk) => ({ raw: sum.raw + Buffer.byteLength(chunk.code), gzip: sum.gzip + gzipSync(chunk.code).length }), { raw: 0, gzip: 0 });
  };
  const onlyCore = await bundle('size-core', `export * from '${packageName}/core'\n`);
  const withMotion = await bundle('size-motion', `export * from '${packageName}/core'\nexport * from '${packageName}/motion'\n`);
  const cost = { raw: withMotion.raw - onlyCore.raw, gzip: withMotion.gzip - onlyCore.gzip };
  t.diagnostic(`./motion added to ./core in an app build: ${cost.raw} bytes minified with whitespace removed, ${cost.gzip} bytes gzipped (core alone: ${onlyCore.raw} and ${onlyCore.gzip})`);
  assert.ok(cost.raw > 0 && cost.gzip > 0, 'the measurement ran');
  assert.ok(cost.gzip <= MOTION_GZIP_CAP, `./motion costs ${cost.gzip} bytes gzipped, over the cap of ${MOTION_GZIP_CAP}`);
});
