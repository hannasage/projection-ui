import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { cpSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packFixture, repository, run } from './helpers/packed.mjs';

let packed;
before(() => { packed = packFixture('frameworks', ['react', 'react-dom', '@types', 'typescript', 'next']); });
after(() => { if (packed) rmSync(packed.temporary, {recursive:true,force:true}); });

test('core executes without loading managed feature runtimes', async () => {
  const require = createRequire(join(packed.fixture, 'package.json'));
  const core = require('@hannasage/projection-ui/core');
  assert.equal(typeof core.Button, 'function');
  for (const dependency of ['recharts','zustand','@dnd-kit/core']) {
    assert.ok(require.resolve(dependency), `${dependency} is installed by the package`);
    assert.ok(!Object.keys(require.cache).some(path=>path.includes(`/node_modules/${dependency}/`)), `${dependency} is not loaded by core`);
  }
  writeFileSync(join(packed.fixture, 'esm.mjs'), `export * from '@hannasage/projection-ui/core'`);
  assert.equal(typeof (await import(pathToFileURL(join(packed.fixture, 'esm.mjs')).href)).Button, 'function');
});
test('declarations resolve under bundler and NodeNext through the isolated core entry', () => {
  writeFileSync(join(packed.fixture, 'consumer.tsx'), `import { Button, ThemeProvider, type UITheme } from '@hannasage/projection-ui/core'\nimport { DEFAULT_THEME } from '@hannasage/projection-ui/foundations'\nconst theme: UITheme = DEFAULT_THEME\nexport const app = <ThemeProvider theme={theme}><Button>Continue</Button></ThemeProvider>\n`);
  writeFileSync(join(packed.fixture, 'consumer.cts'), `import { Button, type ButtonProps } from '@hannasage/projection-ui/core'\nconst props: ButtonProps = {variant:'primary'}\nexport const button = Button\nexport {props}\n`);
  for (const mode of ['bundler','NodeNext']) {
    const config = join(packed.fixture, `tsconfig-${mode}.json`);
    writeFileSync(config, JSON.stringify({ compilerOptions: {target:'ES2020',lib:['ES2020','DOM','DOM.Iterable'],module:mode==='bundler'?'ESNext':'NodeNext',moduleResolution:mode,jsx:'react-jsx',strict:true,noEmit:true,skipLibCheck:false},files:mode==='NodeNext'?['consumer.tsx','consumer.cts']:['consumer.tsx'] }));
    run(process.execPath, [join(repository, 'node_modules/typescript/bin/tsc'), '-p', config], packed.fixture);
  }
});
test('Vite builds the real packed React-only entry without chart, sortable, or store imports', () => {
  cpSync(join(repository, 'tests/fixtures/vite/main.tsx'), join(packed.fixture, 'main.tsx'));
  writeFileSync(join(packed.fixture, 'index.html'), '<div id="root"></div><script type="module" src="/main.tsx"></script>');
  writeFileSync(join(packed.fixture, 'vite.config.mjs'), `export default {build:{minify:false},plugins:[{name:'core-import-graph',generateBundle(){this.emitFile({type:'asset',fileName:'core-modules.json',source:JSON.stringify([...this.getModuleIds()])})}}]}`);
  run(process.execPath, [join(repository, 'node_modules/vite/bin/vite.js'), 'build', '--config', join(packed.fixture, 'vite.config.mjs')], packed.fixture);
  const modules=JSON.parse(readFileSync(join(packed.fixture,'dist/core-modules.json'),'utf8'));
  assert.ok(modules.some(path=>path.includes('/projection-ui/dist/core.js')));
  assert.ok(!modules.some(path=>/\/node_modules\/(?:recharts|zustand|@dnd-kit)\//.test(path)), 'core import graph excludes feature runtimes');
  assert.ok(readFileSync(join(packed.fixture, 'dist/index.html'), 'utf8').includes('assets/'));
});
test('Next App Router builds both server and client components from the packed package', () => {
  cpSync(join(repository, 'tests/fixtures/next/app'), join(packed.fixture, 'app'), {recursive:true});
  writeFileSync(join(packed.fixture, 'next.config.mjs'), 'export default { experimental: { cpus: 1 }, devIndicators: false }\n');
  writeFileSync(join(packed.fixture, 'tsconfig.json'), JSON.stringify({compilerOptions:{target:'ES2020',lib:['DOM','DOM.Iterable','ESNext'],strict:true,module:'ESNext',moduleResolution:'bundler',jsx:'react-jsx',esModuleInterop:true,skipLibCheck:true,noEmit:true},include:['app/**/*.tsx','next-env.d.ts']}));
  const manifest = JSON.parse(readFileSync(join(packed.fixture, 'package.json')));
  manifest.dependencies = {'@hannasage/projection-ui': 'file:../' + packed.packed.filename, next:'16.4.0', react:'19.2.5', 'react-dom':'19.2.5'};
  writeFileSync(join(packed.fixture, 'package.json'), JSON.stringify(manifest));
  // The framework sees one intentionally created lockfile, never another workspace's.
  writeFileSync(join(packed.fixture, 'package-lock.json'), JSON.stringify({name:manifest.name,version:'1.0.0',lockfileVersion:3,packages:{'':{name:manifest.name,version:'1.0.0',dependencies:manifest.dependencies}}}));
  mkdirSync(join(packed.fixture, '.next'), {recursive:true});
  run(process.execPath, [join(packed.fixture, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], packed.fixture, 240_000);
  assert.ok(readFileSync(join(packed.fixture, '.next/server/app/index.html'), 'utf8').includes('Next packed server page'));
});
