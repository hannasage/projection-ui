import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageName = '@hannasage/projection-ui';
const temporary = mkdtempSync(join(tmpdir(), 'projection-ui-contract-'));
const fixture = join(temporary, 'consumer');
const manifest = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8'));
const expectedExports = [
  'AreaChart', 'Badge', 'BarChart', 'Button', 'ButtonGroup', 'Card', 'DataTable',
  'DonutChart', 'Input', 'LineChart', 'Modal', 'RADIUS_SCALE', 'Select', 'Skeleton',
  'Slider', 'SortableItem', 'SortableList', 'Textarea', 'ThemeProvider',
  'ToastContainer', 'Toggle', 'arrayMove', 'useToastStore',
].sort();
const variables = [
  'bg', 'surface', 'border', 'text', 'muted', 'primary', 'primary-fg', 'danger',
  'font', 'radius-sm', 'radius-md', 'radius-lg', 'radius-full',
];
let consumerRequire;
let esm;
let cjs;
let archive;

function npm(args) {
  const executable = process.env.npm_execpath;
  return execFileSync(executable ? process.execPath : 'npm', executable ? [executable, ...args] : args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });
}

function compile(configuration) {
  return spawnSync(process.execPath, [join(repository, 'node_modules/typescript/bin/tsc'), '-p', configuration, '--noEmit'], {
    cwd: fixture,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

after(() => rmSync(temporary, { recursive: true, force: true }));

before(async () => {
  if (!process.env.PROJECTION_UI_TARBALL) execFileSync(process.execPath, [join(repository, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: repository,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });
  if (process.env.PROJECTION_UI_TARBALL) archive = resolve(process.env.PROJECTION_UI_TARBALL);
  else {
    const [packed] = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary]));
    assert.ok(packed.filename, 'npm pack must return a tarball');
    archive = join(temporary, packed.filename);
  }
  mkdirSync(fixture);
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'projection-ui-contract-consumer', private: true, type: 'module' }));
  npm(['install', '--prefix', fixture, '--offline', '--ignore-scripts', '--legacy-peer-deps', '--package-lock=false', '--no-audit', '--no-fund', archive]);

  // The consumer supplies existing peers. Its library comes only from the tarball.
  for (const dependency of [...Object.keys(manifest.peerDependencies), '@types']) {
    const target = join(fixture, 'node_modules', dependency);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(join(repository, 'node_modules', dependency), target, 'junction');
  }
  consumerRequire = createRequire(join(fixture, 'package.json'));
  cjs = consumerRequire(packageName);
  const consumerModule = join(fixture, 'esm-consumer.mjs');
  writeFileSync(consumerModule, `export * from '${packageName}'\n`);
  esm = await import(pathToFileURL(consumerModule).href);
});

for (const format of ['ESM', 'CommonJS']) {
  test(`${format} exposes the documented public runtime API`, () => {
    const api = format === 'ESM' ? esm : cjs;
    for (const name of expectedExports) assert.ok(name in api, `${format} preserves ${name}`);
    for (const name of expectedExports.filter(name => name !== 'RADIUS_SCALE')) {
      assert.equal(typeof api[name], 'function', `${format} ${name} must be callable`);
    }
    const input = ['first', 'second', 'third'];
    assert.deepEqual(api.arrayMove(input, 0, 2), ['second', 'third', 'first']);
    assert.deepEqual(input, ['first', 'second', 'third']);
  });
}

test('the installed package supplies its stylesheet and declaration targets', () => {
  const installed = join(fixture, 'node_modules', '@hannasage', 'projection-ui');
  const published = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  assert.equal(published.name, packageName);
  assert.equal(published.version, manifest.version);
  for (const target of [published.main, published.module, published.types, published.exports['./tokens']]) {
    assert.ok(readFileSync(join(installed, target)).length, `${target} must exist in the tarball`);
  }
  assert.equal(published.exports['.'].types, published.types);
  const css = readFileSync(consumerRequire.resolve(`${packageName}/tokens`), 'utf8');
  for (const variable of variables) assert.match(css, new RegExp(`--ui-${variable}\\s*:`));
  for (const [role, value] of Object.entries(esm.RADIUS_SCALE.soft)) {
    assert.match(css, new RegExp(`--ui-radius-${role}\\s*:\\s*${value}`));
  }
});

test('additive foundations preserve the legacy default theme and radius values', () => {
  assert.equal(esm.DEFAULT_THEME.primary, '#C9F53A');
  assert.equal(esm.DEFAULT_THEME.font, "'IBM Plex Mono', monospace");
  assert.equal(esm.DEFAULT_THEME.radius, 'soft');
  assert.deepEqual(esm.RADIUS_SCALE.soft, { sm: '4px', md: '6px', lg: '10px', full: '9999px' });
  assert.ok(esm.UI_FOUNDATIONS.space.md);
  assert.ok(esm.UI_FOUNDATIONS.motion.fast);
});

test('every JavaScript, CSS, and declaration entry exists; client boundaries stay explicit', () => {
  const installed = join(fixture, 'node_modules', '@hannasage', 'projection-ui');
  for (const [entry, target] of Object.entries(manifest.exports)) {
    const paths = typeof target === 'string' ? [target] : Object.values(target);
    for (const path of paths) assert.ok(readFileSync(join(installed, path)).length, `${entry}: ${path} is packed`);
    if (typeof target !== 'string') assert.equal(Object.keys(target)[0], 'types', `${entry} resolves types first`);
    if (target.import && entry !== './foundations') assert.match(readFileSync(join(installed, target.import), 'utf8'), /^['"]use client['"]/);
  }
  assert.doesNotMatch(readFileSync(join(installed, manifest.exports['./foundations'].import), 'utf8'), /['"]use client['"]/);
  assert.ok(readdirSync(installed).includes('LICENSE'), 'license accompanies the candidate');
});

test('a default npm install still supplies the legacy root feature peers', () => {
  const clean = join(temporary, 'default-install');
  mkdirSync(clean);
  writeFileSync(join(clean, 'package.json'), JSON.stringify({name:'projection-default-install',private:true}));
  // No peer bypass or dependency symlinks: this exercises npm's normal installation.
  npm(['install', '--prefix', clean, '--legacy-peer-deps=false', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund', archive, 'react@19.2.5', 'react-dom@19.2.5']);
  const require = createRequire(join(clean, 'package.json'));
  const api = require(packageName);
  for (const name of expectedExports) assert.ok(name in api, `Fresh install preserves ${name}`);
  for (const name of ['recharts','zustand','@dnd-kit/core','@dnd-kit/sortable','@dnd-kit/utilities']) assert.ok(require.resolve(name), `${name} is supplied by the normal required peer install`);
});

test('feature entries share component and store identities with the legacy root', async () => {
  const entry = join(fixture, 'feature-entries.mjs');
  writeFileSync(entry, ['core','charts','sortable','toast','foundations'].map(name => `export * as ${name} from '${packageName}/${name}'`).join('\n'));
  const features = await import(pathToFileURL(entry).href);
  for (const name of Object.keys(features)) {
    const commonjs = consumerRequire(`${packageName}/${name}`);
    for (const [member, value] of Object.entries(features[name])) assert.equal(value, esm[member], `${name}/${member} shares the ESM root identity`);
    for (const [member, value] of Object.entries(commonjs)) assert.equal(value, cjs[member], `${name}/${member} shares the CommonJS root identity`);
  }
  for (const file of execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n').filter(file=>file.endsWith('.d.ts'))) {
    assert.doesNotMatch(execFileSync('tar',['-xOzf',archive,file],{encoding:'utf8'}), /(?:from\s+['"]|import\(['"])[^'"\n]*node_modules/, `${file} must resolve public peers rather than local build paths`);
  }
});

test('both module formats render the documented theme and component composition', () => {
  const { createElement } = consumerRequire('react');
  const { renderToStaticMarkup } = consumerRequire('react-dom/server');
  const theme = {
    bg: '#07090C', surface: '#0D1117', border: '#1B2535', text: '#DDE3EE',
    muted: '#8396AB', primary: '#C9F53A', primaryFg: '#07090C', danger: '#FF5252',
    font: 'monospace', radius: 'soft',
  };
  for (const api of [esm, cjs]) {
    const html = renderToStaticMarkup(createElement(api.ThemeProvider, { theme },
      createElement(api.Card, { as: 'article', border: 'accent' },
        createElement(api.Badge, { dot: false }, 'Selected work'),
        createElement(api.Button, { type: 'button', variant: 'primary' }, 'Explore'))));
    assert.match(html, /<article/);
    assert.match(html, /Selected work/);
    assert.match(html, /<button[^>]*type="button"[^>]*>Explore<\/button>/);
    assert.match(html, /--ui-primary:#C9F53A/);
  }
});

test('the decorative glow renders without content, input, or browser-only dependencies', () => {
  const { createElement } = consumerRequire('react');
  const { renderToStaticMarkup } = consumerRequire('react-dom/server');
  for (const api of [esm, cjs, consumerRequire(`${packageName}/core`)]) {
    assert.equal(typeof api.ProjectionGlow, 'function');
    const html = renderToStaticMarkup(createElement(api.ProjectionGlow, {
      color: '#123456', intensity: 'subtle', motion: 'reveal', className: 'consumer-glow',
      style: { height: '12rem', pointerEvents: 'auto' },
    }));
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /ui-projection-glow consumer-glow/);
    assert.match(html, /data-intensity="subtle"/);
    assert.match(html, /data-motion="reveal"/);
    assert.match(html, /--ui-glow-color:#123456/);
    assert.match(html, /height:12rem/);
    assert.match(html, /pointer-events:none/);
    assert.doesNotMatch(html, /<(?:button|input|h[1-6]|a)\b|tabindex=|on[a-z]+=/i);
    const still = renderToStaticMarkup(createElement(api.ProjectionGlow));
    assert.match(still, /data-motion="none"/);
    assert.match(still, /--ui-glow-color:var\(--ui-primary\)/);
  }
});

test('README and guide TSX examples compile against the installed tarball', () => {
  const examples = join(fixture, 'examples');
  mkdirSync(examples);
  function walk(folder) { return readdirSync(join(repository, folder), {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(`${folder}/${entry.name}`) : /\.(md|mdx)$/.test(entry.name) ? [`${folder}/${entry.name}`] : []) }
  const guides = ['README.md', ...walk('docs').sort()];
  let count = 0;
  for (const guide of guides) {
    const markdown = readFileSync(join(repository, guide), 'utf8');
    const blocks = [...markdown.matchAll(/```tsx\r?\n([\s\S]*?)\r?\n```/g)];
    if (guide === 'README.md') assert.ok(blocks.length >= 2, 'README must include its overview and quick-start examples');
    for (const [index, block] of blocks.entries()) {
      writeFileSync(join(examples, `${guide.replaceAll('/', '-').replace(/\.mdx?$/, '')}-${index + 1}.tsx`), `${block[1]}\n`);
      count += 1;
    }
  }
  assert.ok(count >= 2, 'documentation examples must not be an empty compile');
  // Match the stylesheet asset declaration documented in docs/compatibility.md.
  writeFileSync(join(examples, 'assets.d.ts'), ['tokens','styles','reset'].map(name => `declare module '${packageName}/${name}'`).join('\n'));
  const configuration = join(fixture, 'tsconfig.json');
  writeFileSync(configuration, JSON.stringify({
    compilerOptions: { target: 'ES2020', lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, noEmit: true },
    include: ['examples/**/*.tsx', 'examples/**/*.d.ts'],
  }, null, 2));
  const result = compile(configuration);
  assert.ifError(result.error);
  assert.equal(result.status, 0, `Documented examples must compile from package exports:\n${result.stdout}${result.stderr}`);

  // Prove that the same fixture rejects a stale public prop contract.
  writeFileSync(join(examples, 'invalid-api.tsx'), `import { Button } from '${packageName}'\nexport const invalid = <Button variant="not-a-public-variant" />\n`);
  const invalid = compile(configuration);
  assert.ifError(invalid.error);
  assert.notEqual(invalid.status, 0, 'the compiler must reject an undocumented Button variant');
  assert.match(invalid.stdout + invalid.stderr, /not-a-public-variant/);
});
