import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { packFixture, repository } from '../tests/helpers/packed.mjs';
import { componentDocuments, transformGuide } from './docs-content.mjs';
import { legacyDocuments } from './docs-versions.mjs';
import { docsVersions } from '../docs-site/lib/versions.mjs';
import { buildDesignPackage } from './build-design-package.mjs';

const site = join(repository, 'docs-site');
const packed = packFixture('docs', ['@types']);
function run(command, args, cwd = repository, env = process.env) {
  const result = spawnSync(command, args, {cwd, env, stdio:'inherit', timeout:300_000});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Docs command failed: ${command}, status ${result.status}`);
}
try {
  const manifest = JSON.parse(readFileSync(join(packed.installed, 'package.json'), 'utf8'));
  const expected = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8'));
  assert.equal(manifest.name, expected.name);
  assert.equal(manifest.version, expected.version);
  assert.ok(docsVersions[0].label.startsWith(manifest.version), 'The version selector must identify the packed candidate');
  run(process.execPath, ['scripts/build-storybook.mjs'], repository, {...process.env,PROJECTION_UI_PACKAGE_DIR:packed.installed,PROJECTION_UI_TYPING_DIR:packed.temporary});
  run('npm', ['ci','--ignore-scripts','--legacy-peer-deps=false','--no-audit','--no-fund'], site);
  run('npm', ['install','--no-save','--package-lock=false','--ignore-scripts','--legacy-peer-deps=false','--no-audit','--no-fund',join(packed.temporary,packed.packed.filename)], site);
  const installed = JSON.parse(readFileSync(join(site,'node_modules/@hannasage/projection-ui/package.json'),'utf8'));
  assert.equal(installed.version, manifest.version);
  const entries = Object.values(JSON.parse(readFileSync(join(repository,'storybook-static/index.json'),'utf8')).entries);
  const guides = readdirSync(join(repository,'docs/pages')).filter(file => file.endsWith('.mdx')).map(file => transformGuide(readFileSync(join(repository,'docs/pages',file),'utf8'), `docs/pages/${file}`, entries));
  assert.equal(guides.length, 8);
  const contracts = JSON.parse(readFileSync(join(repository,'docs/component-contracts.json'),'utf8'));
  const components = componentDocuments(contracts,entries,manifest);
  assert.equal(components.length,Object.keys(contracts).length);
  assert.ok(components.length > 0, 'Component contracts must not be empty');
  const records = [...guides,...components];
  const examples = join(packed.fixture,'documentation-examples');
  mkdirSync(examples);
  let exampleCount = 0;
  for (const text of [readFileSync(join(repository,'README.md'),'utf8'), ...records.map(record=>record.mdx)]) {
    for (const block of text.matchAll(/```tsx\r?\n([\s\S]*?)\r?\n```/g)) writeFileSync(join(examples,`example-${++exampleCount}.tsx`),block[1]+'\n');
  }
  assert.ok(exampleCount >= 2, 'Packed documentation compilation must not be empty');
  writeFileSync(join(examples,'assets.d.ts'),['tokens','styles','reset'].map(entry=>`declare module '${manifest.name}/${entry}'`).join('\n'));
  writeFileSync(join(examples,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2020',lib:['ES2020','DOM','DOM.Iterable'],module:'ESNext',moduleResolution:'bundler',jsx:'react-jsx',strict:true,skipLibCheck:true,noEmit:true},include:['*.tsx','*.d.ts']}));
  run(process.execPath,[join(repository,'node_modules/typescript/bin/tsc'),'-p',join(examples,'tsconfig.json'),'--noEmit']);
  for (const record of records) {
    const path = join(site,'content/docs',record.slug+'.mdx');
    mkdirSync(join(path,'..'),{recursive:true});
    writeFileSync(path, `---\ntitle: ${JSON.stringify(record.title)}\ndescription: ${JSON.stringify(`Projection UI ${manifest.version}`)}\n---\n\n${record.mdx}`);
    const markdown = join(site,'public/markdown',record.slug+'.md');
    mkdirSync(join(markdown,'..'),{recursive:true});
    writeFileSync(markdown,record.markdown);
  }
  writeFileSync(join(site,'content/docs/meta.json'),JSON.stringify({pages:['index','installation','theming','tokens','accessibility','migration','releases','community','components']},null,2));
  writeFileSync(join(site,'content/docs/components/meta.json'),JSON.stringify({title:'Components',pages:components.map(page=>page.slug.split('/')[1])},null,2));
  const legacy = legacyDocuments(join(repository, 'docs/archive/0.1.5'));
  for (const record of legacy) {
    const path = join(site, 'content/versions/0.1.5', record.slug + '.mdx');
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `---\ntitle: ${JSON.stringify(record.title)}\ndescription: "Projection UI 0.1.5 archive"\n---\n\n${record.mdx}\n`);
    const markdown = join(site, 'public/archives/0.1.5/markdown', record.slug + '.md');
    mkdirSync(join(markdown, '..'), { recursive: true });
    writeFileSync(markdown, record.markdown);
  }
  writeFileSync(join(site, 'content/versions/0.1.5/meta.json'), JSON.stringify({ pages: legacy.map(record => record.slug) }, null, 2));
  cpSync(join(repository, 'docs/archive/0.1.5'), join(site, 'public/archives/0.1.5'), { recursive: true });
  writeFileSync(join(site, 'public/archives/0.1.5/llms.txt'), '# Projection UI 0.1.5\n\n' + legacy.map(record => `- [${record.title}](https://projectionui.dev/archives/0.1.5/markdown/${record.slug}.md)`).join('\n') + '\n');
  writeFileSync(join(site, 'public/archives/0.1.5/llms-full.txt'), legacy.map(record => record.markdown).join('\n\n'));
  writeFileSync(join(site, 'public/docs-versions.json'), JSON.stringify({ current: manifest.version, versions: docsVersions }, null, 2) + '\n');
  writeFileSync(join(site,'public/llms.txt'),`# Projection UI\n\nReact component and token documentation for ${manifest.version}.\n\n`+records.map(record=>`- [${record.title}](https://projectionui.dev/markdown/${record.slug}.md)`).join('\n')+'\n');
  writeFileSync(join(site,'public/llms-full.txt'),records.map(record=>record.markdown).join('\n\n'));
  writeFileSync(join(site,'public/release.json'),JSON.stringify({name:manifest.name,version:manifest.version,integrity:packed.packed.integrity},null,2)+'\n');
  cpSync(join(repository, 'CHANGELOG.md'), join(site, 'public/changelog.md'));
  cpSync(join(repository,'storybook-static'),join(site,'public/examples'),{recursive:true});
  const {PROJECTION_THEME:theme, COASTAL_DAY_THEME:lightTheme} = await import(pathToFileURL(join(packed.installed,'dist/foundations.js')).href);
  mkdirSync(join(site,'.generated'),{recursive:true});
  const readerTheme = (selector, values) => `${selector} { --color-fd-background: ${values.bg}; --color-fd-foreground: ${values.text}; --color-fd-primary: ${values.primary}; --color-fd-primary-foreground: ${values.primaryFg}; --color-fd-muted: ${values.surface}; --color-fd-muted-foreground: ${values.muted}; --color-fd-border: ${values.border}; --color-fd-popover: ${values.surface}; --color-fd-popover-foreground: ${values.text}; --color-fd-card: ${values.surface}; --color-fd-card-foreground: ${values.text}; --color-fd-secondary: ${values.surface}; --color-fd-secondary-foreground: ${values.text}; --color-fd-accent: ${values.border}; --color-fd-accent-foreground: ${values.text}; --color-fd-ring: ${values.primary}; }\n`;
  writeFileSync(join(site,'.generated/theme.css'), readerTheme(':root',lightTheme)+readerTheme('.dark',theme));
  const designPackage = buildDesignPackage(join(site, 'public/downloads'));
  assert.equal(designPackage.version, manifest.version, 'The design package must match the packed candidate');
  run('npm',['run','build'],site,{...process.env,NEXT_TELEMETRY_DISABLED:'1'});
  run('npm',['run','typecheck'],site);
  run('npm',['run','lint'],site);
  run('npm',['run','test'],site);
} finally { rmSync(packed.temporary,{recursive:true,force:true}); }
