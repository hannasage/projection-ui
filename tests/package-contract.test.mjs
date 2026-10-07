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
  execFileSync(process.execPath, [join(repository, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: repository,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });
  const [packed] = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary]));
  assert.ok(packed.filename, 'npm pack must return a tarball');
  mkdirSync(fixture);
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'projection-ui-contract-consumer', private: true, type: 'module' }));
  npm(['install', '--prefix', fixture, '--offline', '--ignore-scripts', '--legacy-peer-deps', '--package-lock=false', '--no-audit', '--no-fund', join(temporary, packed.filename)]);

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
    assert.deepEqual(Object.keys(api).sort(), expectedExports);
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

test('README and guide TSX examples compile against the installed tarball', () => {
  const examples = join(fixture, 'examples');
  mkdirSync(examples);
  const guides = ['README.md', ...readdirSync(join(repository, 'docs')).filter(name => name.endsWith('.md')).sort().map(name => `docs/${name}`)];
  let count = 0;
  for (const guide of guides) {
    const markdown = readFileSync(join(repository, guide), 'utf8');
    const blocks = [...markdown.matchAll(/```tsx\r?\n([\s\S]*?)\r?\n```/g)];
    if (guide === 'README.md') assert.ok(blocks.length >= 2, 'README must include its overview and quick-start examples');
    for (const [index, block] of blocks.entries()) {
      writeFileSync(join(examples, `${guide.replaceAll('/', '-').replace(/\.md$/, '')}-${index + 1}.tsx`), `${block[1]}\n`);
      count += 1;
    }
  }
  assert.ok(count >= 2, 'documentation examples must not be an empty compile');
  // Match the stylesheet asset declaration documented in docs/compatibility.md.
  writeFileSync(join(examples, 'assets.d.ts'), `declare module '${packageName}/tokens'\n`);
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
