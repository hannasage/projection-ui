// Helpers for the tests of scripts/release.mjs and tools/*.mjs.
// A test builds a temporary git repository and a temporary folder with a fake `npm` and a fake `gh`. The fakes go first on PATH.
// They log each call and never reach a real registry or a real remote. The only remote is a bare repository in a temporary folder.
// Every child process gets a scrubbed environment: no token, no real HOME, no inherited git or npm settings.
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pinHash } from '../../tools/lib/workflow.mjs';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const temps = [];

export function tempDir(prefix = 'projection-tools-') {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  temps.push(dir);
  return dir;
}

/**
 * Runs a function with one environment variable set to a value (or removed, when the value is undefined), and then puts the
 * variable back as it was. A variable that was not set is deleted again. Assigning undefined to process.env would store the
 * text "undefined", which broke os.tmpdir() on a CI runner where TMPDIR is not set.
 */
export function withEnv(name, value, fn) {
  const had = Object.hasOwn(process.env, name);
  const saved = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  const restore = () => {
    if (had) process.env[name] = saved;
    else delete process.env[name];
  };
  let result;
  try {
    result = fn();
  } catch (error) {
    restore();
    throw error;
  }
  if (result instanceof Promise) return result.finally(restore);
  restore();
  return result;
}

export function cleanup() {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/** The only variables a test child process may see, plus the extra ones a test passes. */
export function scrubbed(extra = {}, pathPrefix = '') {
  const home = tempDir('projection-home-');
  return {
    PATH: pathPrefix ? `${pathPrefix}${delimiter}${process.env.PATH ?? ''}` : (process.env.PATH ?? ''),
    HOME: home,
    LANG: 'C.UTF-8',
    ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
    ...extra,
  };
}

/** Runs git and returns trimmed standard output. A failure throws, so a broken setup stops the test early. */
export function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: scrubbed() });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

/** A package folder with one commit. `name` is the package name its package.json carries. */
export function makeRepo({ branch = 'main', name = '@hannasage/projection-ui' } = {}) {
  const dir = tempDir();
  git(dir, 'init', '-q', '-b', branch);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '0.0.0' }));
  writeFileSync(join(dir, '.gitignore'), 'node_modules\ndist\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}

/** A repository with a local bare remote, pushed. Returns { work, origin }. */
export function makeRepoWithRemote(options = {}) {
  const work = makeRepo(options);
  const origin = join(tempDir(), 'origin.git');
  mkdirSync(origin);
  git(origin, 'init', '-q', '--bare');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', '-u', 'origin', git(work, 'symbolic-ref', '--short', 'HEAD'));
  return { work, origin };
}

const FAKE_NPM = `#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'fixtures');
const read = (name) => { try { return readFileSync(join(dir, name), 'utf8'); } catch { return null; } };
// Test switches come from the process environment or from fixtures/flags.json. The release script scrubs the environment of its installs, so the file is the sure way.
const flags = JSON.parse(read('flags.json') ?? '{}');
const F = (name) => process.env[name] ?? flags[name];
appendFileSync(join(here, '..', 'calls.log'), JSON.stringify({ tool: 'npm', args, cwd: process.cwd(), tokenSeen: Boolean(process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN), home: process.env.HOME, cache: process.env.npm_config_cache, logs: process.env.npm_config_logs_dir, globalconfig: process.env.npm_config_globalconfig, userconfig: process.env.npm_config_userconfig, envNames: Object.keys(process.env) }) + '\\n');
const [command, ...rest] = args;
if (['login', 'adduser', 'whoami', 'deprecate', 'dist-tag', 'unpublish', 'token'].includes(command) || (command === 'publish' && !rest.includes('--dry-run'))) {
  console.error('FAKE NPM: ' + command + ' is never allowed in a test');
  process.exit(99);
}
if (command === 'run') {
  if (F('FAKE_FAIL_RUN') === rest[0]) {
    console.error(F('FAKE_FAIL_MESSAGE') ?? rest[0] + ': 1 error found');
    process.exit(Number(F('FAKE_FAIL_CODE') ?? 1));
  }
  if (F('FAKE_DIRTY_RUN') === rest[0]) writeFileSync('stray-file.txt', 'left behind\\n');
  if (F('FAKE_HANG_RUN') === rest[0]) { await new Promise((resolve) => setTimeout(resolve, 8000)); }
  console.log(rest[0] + ' ok');
  process.exit(0);
}
if (command === 'ci') {
  if (F('FAKE_FAIL_RUN') === 'ci') process.exit(1);
  process.exit(0);
}
if (command === 'init') { writeFileSync('package.json', JSON.stringify({ name: 'temp', version: '1.0.0' })); process.exit(0); }
if (command === 'view') {
  const field = rest[1];
  if (field === 'dist-tags') {
    if (F('FAKE_VIEW_FAIL')) { console.error('npm error network socket hang up'); process.exit(1); }
    if (F('FAKE_VIEW_E404_TEXT')) { console.error('npm error network the mirror said E404 once'); process.exit(1); }
    const text = read('dist-tags.json');
    if (text === null) { console.error('npm error code E404'); process.exit(1); }
    console.log(text);
    process.exit(0);
  }
  if (field === 'dist.integrity') { const value = F('FAKE_VIEW_INTEGRITY') ?? 'sha512-FAKEINTEGRITY'; console.log(JSON.stringify(F('FAKE_VIEW_INTEGRITY_OBJECT') ? { 'dist.integrity': value } : value)); process.exit(0); }
  if (field === 'deprecated') { if (F('FAKE_DEPRECATED_FAIL')) { console.error('npm error network socket hang up'); process.exit(1); } const text = read('deprecated.txt'); if (text) console.log(text); process.exit(0); }
  process.exit(0);
}
if (command === 'install') {
  const spec = rest.find((arg) => arg.startsWith('@') );
  const at = spec.lastIndexOf('@');
  const name = spec.slice(0, at);
  const tag = spec.slice(at + 1);
  const tags = JSON.parse(read('dist-tags.json') ?? '{}');
  const folder = join(process.cwd(), 'node_modules', ...name.split('/'));
  const exportsMap = JSON.parse(read('exports.json') ?? '{}');
  const files = [];
  const walk = (value) => { if (typeof value === 'string') files.push(value); else if (value) Object.values(value).forEach(walk); };
  const installedExports = JSON.parse(JSON.stringify(exportsMap));
  if (F('FAKE_DROP_ENTRY')) delete installedExports[F('FAKE_DROP_ENTRY')];
  if (F('FAKE_ADD_ENTRY')) installedExports[F('FAKE_ADD_ENTRY')] = './dist/extra.js';
  for (const [key, value] of Object.entries(exportsMap)) {
    const targets = []; const collect = (v, k) => { if (typeof v === 'string') targets.push([k, v]); else Object.entries(v).forEach(([c, x]) => collect(x, c)); };
    collect(value, 'default');
    for (const [condition, file] of targets) {
      if (file === F('FAKE_OMIT_FILE')) continue;
      const path = join(folder, file);
      mkdirSync(dirname(path), { recursive: true });
      let body = file.endsWith('.css') ? ':root {}\\n' : file.endsWith('.cjs') ? 'exports.a = 1;\\n' : 'export const a = 1;\\nexport const b = 2;\\n';
      if (condition === 'types') body = 'export {};\\n';
      if (file === F('FAKE_EMPTY_EXPORT')) body = 'export {};\\n';
      if (F('FAKE_READ_OUTSIDE') && file === './dist/index.js') body = 'import { readFileSync } from \\'node:fs\\';\\nreadFileSync(' + JSON.stringify(F('FAKE_READ_OUTSIDE')) + ', \\'utf8\\');\\nexport const a = 1;\\n';
      writeFileSync(path, body);
    }
  }
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ name, version: F('FAKE_INSTALLED_VERSION') ?? tags[tag] ?? '0.0.0', type: 'module', exports: installedExports }));
  writeFileSync(join(process.cwd(), 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { ['node_modules/' + name]: { version: F('FAKE_INSTALLED_VERSION') ?? tags[tag] ?? '0.0.0', integrity: F('FAKE_INSTALLED_INTEGRITY') ?? 'sha512-FAKEINTEGRITY' } } }));
  process.exit(0);
}
if (command === 'publish') {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const tagIndex = rest.indexOf('--tag');
  const tag = tagIndex >= 0 ? rest[tagIndex + 1] : 'latest';
  const notices = [
    'package: ' + manifest.name + '@' + manifest.version,
    'package size: ' + (F('FAKE_SIZE') ?? '137 kB'),
    'total files: ' + (F('FAKE_FILES') ?? 7),
    'Publishing to https://registry.npmjs.org/ with tag ' + tag + ' and public access (dry-run)',
  ];
  for (const line of notices) console.error('npm notice ' + line);
  console.log('+ ' + manifest.name + '@' + manifest.version);
  process.exit(0);
}
process.exit(0);
`;

const FAKE_GH = `#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';
const args = process.argv.slice(2);
let stdin = '';
try { stdin = readFileSync(0, 'utf8'); } catch { stdin = ''; }
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
appendFileSync(join(here, '..', 'calls.log'), JSON.stringify({ tool: 'gh', args, cwd: process.cwd(), stdin, tokenSeen: Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN) }) + '\\n');
const ghFlags = (() => { try { return JSON.parse(readFileSync(join(here, '..', 'fixtures', 'flags.json'), 'utf8')); } catch { return {}; } })();
if (args[0] === 'api' && args[1] === 'user') { if (ghFlags.FAKE_GH_NO_USER) { console.error('gh: not logged in'); process.exit(1); } if (ghFlags.FAKE_GH_FORBIDDEN) { console.error('gh: Resource not accessible by integration (HTTP 403)'); process.exit(1); } if (ghFlags.FAKE_GH_HTTP403_ONLY) { console.error('gh: forbidden (HTTP 403)'); process.exit(1); } if (ghFlags.FAKE_GH_SERVER_ERROR) { console.error('gh: Internal Server Error (HTTP 500)'); process.exit(1); } console.log(ghFlags.FAKE_GH_LOGIN ?? 'test-user'); process.exit(0); }
if (ghFlags.FAKE_GH_HANG) { await new Promise((resolve) => setTimeout(resolve, 8000)); }
if (ghFlags.FAKE_GH_FAIL_URL) { console.log('https://github.com/example/repo/pull/7'); console.error('gh: post-create step failed'); process.exit(1); }
if (ghFlags.FAKE_GH_FAIL) { console.error('gh: could not create the pull request'); process.exit(1); }
if (ghFlags.FAKE_GH_NO_URL) { console.log('Created, but no address printed'); process.exit(0); }
console.log('Creating pull request');
console.log('https://github.com/example/repo/pull/1');
`;

/** A folder with a fake npm and a fake gh, a folder of fixtures, and a call log. */
export function makeFakeBin() {
  const root = tempDir('projection-fakebin-');
  const bin = join(root, 'bin');
  const fixtures = join(root, 'fixtures');
  mkdirSync(bin);
  mkdirSync(fixtures);
  const log = join(root, 'calls.log');
  writeFileSync(log, '');
  for (const [name, source] of [['npm', FAKE_NPM], ['gh', FAKE_GH]]) {
    const file = join(bin, name);
    writeFileSync(file, source);
    chmodSync(file, 0o755);
  }
  writeFileSync(join(bin, 'package.json'), JSON.stringify({ type: 'module' }));
  const calls = () => readFileSync(log, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line));
  return {
    bin, fixtures, log, calls,
    passNames: ['FAKE_LOG', 'FAKE_DIR', 'FAKE_FAIL_RUN', 'FAKE_FAIL_MESSAGE', 'FAKE_FAIL_CODE', 'FAKE_DIRTY_RUN', 'FAKE_SIZE', 'FAKE_FILES', 'FAKE_DROP_ENTRY', 'FAKE_OMIT_FILE', 'FAKE_EMPTY_EXPORT', 'FAKE_INSTALLED_VERSION', 'FAKE_GH_FAIL', 'FAKE_GH_NO_URL'],
    env(extra = {}) {
      writeFileSync(join(fixtures, 'flags.json'), JSON.stringify(Object.fromEntries(Object.entries(extra).filter(([name]) => name.startsWith('FAKE_')))));
      return scrubbed(Object.fromEntries(Object.entries(extra).filter(([name]) => !name.startsWith('FAKE_'))), bin);
    },
    lines: (tool) => calls().filter((call) => call.tool === tool).map((call) => call.args.join(' ')),
  };
}

/** The first version line that the real scripts/release-channel.mjs accepts, with its channel. The fixtures follow the repository's current rules. */
export async function currentLine() {
  const { releaseChannel } = await import(pathToFileURL(join(repoRoot, 'scripts/release-channel.mjs')).href);
  for (const version of ['1.0.0-beta.0', '0.2.0-next.2']) {
    try { return { version, npmTag: releaseChannel(version) }; } catch { /* try the next */ }
  }
  throw new Error('no known release line is accepted by scripts/release-channel.mjs');
}

const GATE_NAMES = ['tokens:check', 'typecheck', 'lint', 'test', 'build', 'build:docs', 'test:docs', 'test:artifact'];

/**
 * The text of a publish workflow whose push trigger lists the given tag filters and whose verify job runs the gates.
 * Options switch single steps off or change the jobs, so a test can break one promise at a time.
 */
export function workflowText(filters, { skip = [], stepIf = {}, stepContinue = {}, verifyIf = null, verifyContinue = null, publishNeeds = 'verify', publishEnvironment = 'npm-publish', publishIf = null, publishStepEnv = false, publishExtraUses = null, oddIf = null, skipCiOnly = false } = {}) {
  const step = (command, name = command) => {
    let text = `      - run: ${command}`;
    if (stepIf[name] !== undefined) text += `\n        if: ${stepIf[name]}`;
    if (stepContinue[name] !== undefined) text += `\n        continue-on-error: ${stepContinue[name]}`;
    if (oddIf !== null && oddIf === name) text = `      -   run: ${command}\n            if: false`;
    return text;
  };
  const gates = GATE_NAMES.filter((name) => !skip.includes(name)).map((name) => step(`npm run ${name}`, name)).join('\n');
  const ciOnly = skipCiOnly ? '' : `\n${['npx playwright install --with-deps chromium', 'npm run test:storybook', 'npm run test:storybook-tools', 'npm run test:docs-themes'].map((command) => step(command)).join('\n')}`;
  const verifyHead = ['  verify:', '    runs-on: ubuntu-latest', ...(verifyIf !== null ? [`    if: ${verifyIf}`] : []), ...(verifyContinue !== null ? [`    continue-on-error: ${verifyContinue}`] : [])].join('\n');
  const needs = publishNeeds === null ? '' : `    needs: ${publishNeeds}\n`;
  const environment = publishEnvironment === null ? '' : `    environment: ${publishEnvironment}\n`;
  const publishIfLine = publishIf === null ? '' : `    if: ${publishIf}\n`;
  const extraUses = publishExtraUses === null ? '' : `      - uses: ${publishExtraUses}\n`;
  const stepEnv = publishStepEnv ? '        env:\n          X: y\n' : '';
  return `name: publish
on:
  push:
    # comment
    tags: [${filters.map((filter) => `'${filter}'`).join(', ')}]
permissions:
  contents: read
jobs:
${verifyHead}
    steps:
      - uses: actions/checkout@abc # v4
${step('npm ci', 'ci')}
${step('node scripts/verify-release.mjs', 'verifier')}
${gates}${ciOnly}
  publish:
${needs}${environment}${publishIfLine}    steps:
${extraUses}      - run: node scripts/verify-release.mjs --publish
${stepEnv}`;
}

export function snapshot(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const info = statSync(path);
      if (info.isDirectory()) walk(path);
      else out.push(`${path.slice(root.length)}:${info.size}:${info.mtimeMs}`);
    }
  };
  walk(root);
  return out.join('\n');
}

/** A work repository on the release branch with a local bare `origin`, plus the release script copied in. */
export async function makeReleaseRepo({ configEdit = null } = {}) {
  const fake = makeFakeBin();
  const base = tempDir('projection-release-');
  const origin = join(base, 'origin.git');
  const work = join(base, 'work');
  mkdirSync(origin);
  mkdirSync(work);
  const real = JSON.parse(readFileSync(join(repoRoot, 'release.config.json'), 'utf8'));
  const line = await currentLine();
  const config = { ...real, version: line.version, npmTag: line.npmTag, expectedFileCount: 7, maxPackageBytes: 200000 };
  // The fixture copies the three pinned scripts byte for byte, so their pins are the pins of the real files.
  const pinOf = (path, bytes) => ({ path, sha256: pinHash(path, bytes).hash });
  config.workflow = { ...config.workflow, pins: [
    pinOf('.github/workflows/publish.yml', Buffer.from(workflowText(filtersFor(config.version)))),
    ...['scripts/verify-release.mjs', 'scripts/publish-design-release.mjs', 'scripts/release-channel.mjs'].map((path) => pinOf(path, readFileSync(join(repoRoot, path)))),
  ] };
  if (configEdit) configEdit(config);
  const branch = config.releaseBranch;
  git(origin, 'init', '-q', '--bare', '-b', branch);
  git(work, 'init', '-q', '-b', branch);
  const put = (path, text) => { mkdirSync(dirname(join(work, path)), { recursive: true }); writeFileSync(join(work, path), text); };
  const exportsMap = {
    '.': { types: './dist/index.d.ts', import: './dist/index.js', require: './dist/index.cjs' },
    './core': { types: './dist/core.d.ts', import: './dist/core.js', require: './dist/core.cjs' },
    './tokens': './dist/tokens/theme.css',
    './styles': { types: './dist/styles.d.ts', default: './dist/tokens/scoped.css' },
  };
  const scripts = Object.fromEntries([...config.gates, ...config.ciOnlyGates.filter((entry) => !('command' in entry)).map((entry) => entry.name)].map((name) => [name, 'node -e 0']));
  put('package.json', JSON.stringify({ name: config.package, version: config.version, type: 'module', scripts, exports: exportsMap, files: ['dist'] }, null, 2));
  put('package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/react': { version: '19.2.5' }, 'node_modules/react-dom': { version: '19.2.5' } } }) + '\n');
  put('release.config.json', `${JSON.stringify(config, null, 2)}\n`);
  for (const file of ['scripts/release.mjs', 'scripts/release-channel.mjs', 'scripts/verify-release.mjs', 'scripts/publish-design-release.mjs', 'tools/lib/text.mjs', 'tools/lib/env.mjs', 'tools/lib/workflow.mjs', 'tools/lib/zip.mjs', 'tools/lib/run.mjs', 'tools/lib/supervise.mjs', 'docs-site/lib/versions.mjs']) {
    mkdirSync(dirname(join(work, file)), { recursive: true });
    copyFileSync(join(repoRoot, file), join(work, file));
  }
  const core = config.version.split('-')[0];
  put('.github/workflows/publish.yml', workflowText(filtersFor(config.version)));
  put('CHANGELOG.md', `# Changelog\n\n## ${config.version} test entry\n`);
  put('README.md', '# Package\n\nThe version is on the registry.\n');
  put('docs/releases.md', 'Release notes.\n');
  put('docs-site/app/page.tsx', 'export default 1;\n');
  put('docs-site/components/a.tsx', 'export default 2;\n');
  put('.gitignore', 'node_modules\ndist\ndocs-site/out\n');
  const scene = { source: 'test', nodes: [] };
  put(config.designKit.scene, JSON.stringify(scene, null, 2));
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'first');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', '-u', 'origin', branch);
  // Build output that is ignored by git, as a docs build would leave it.
  const { createHash } = await import('node:crypto');
  const { createZip } = await import(pathToFileURL(join(repoRoot, 'scripts/build-design-package.mjs')).href);
  const kitName = config.designKit.name.replace('{version}', config.version);
  const sceneHash = createHash('sha256').update(JSON.stringify(scene)).digest('hex');
  const tokens = { themes: { dark: { bg: '#000' } } };
  const codeText = `// importer\nconst scene = ${JSON.stringify(scene)};\nconst tokens = ${JSON.stringify(tokens)};\nimportProjectionDesign(figma, scene, tokens, ${JSON.stringify(config.version)}).then(() => {});\n`;
  const kitData = (name) => (name === 'design-manifest.json' ? JSON.stringify({ version: config.version, design: { sceneSha256: sceneHash }, tokens }) : name === 'tokens.json' ? JSON.stringify(tokens, null, 2) : name === 'plugin/code.js' ? codeText : `file ${name}`);
  const zip = createZip(config.designKit.entries.map((name) => ({ name, data: kitData(name) })));
  put(`${config.designKit.dir}/${kitName}`, '');
  writeFileSync(join(work, config.designKit.dir, kitName), zip);
  put(`${config.designKit.dir}/${config.designKit.metadata}`, JSON.stringify({ version: config.version, filename: kitName, bytes: zip.length, sha256: createHash('sha256').update(zip).digest('hex'), sceneSha256: sceneHash }));
  put(config.docsEdition.builtRelease, JSON.stringify({ name: config.package, version: config.version }));
  put(config.docsEdition.builtVersions, JSON.stringify({ current: core, packageVersion: config.version }));
  put(config.docsEdition.builtChangelog, readFileSync(join(work, config.docsEdition.changelog), 'utf8'));
  writeFileSync(join(fake.fixtures, 'dist-tags.json'), JSON.stringify({ latest: '0.1.5' }));
  writeFileSync(join(fake.fixtures, 'exports.json'), JSON.stringify(exportsMap));
  const script = join(work, 'scripts', 'release.mjs');
  const env = (extra = {}) => fake.env(extra);
  return {
    work, origin, fake, script, config, kitName, line, zip, kitData,
    env,
    setRegistry(tags) { writeFileSync(join(fake.fixtures, 'dist-tags.json'), JSON.stringify(tags)); },
    publishedTags() { return { latest: '0.1.5', [config.npmTag]: config.version }; },
    run: (args, extraEnv = {}) => {
      writeFlags(fake, extraEnv);
      return spawnSync(process.execPath, [script, ...args], { cwd: work, env: env(extraEnv), encoding: 'utf8', input: '' });
    },
    /** Runs the script with a real pseudo terminal on standard input, through python3, so process.stdin.isTTY is true. */
    runTTY(args, extraEnv = {}) {
      writeFlags(fake, extraEnv);
      const code = 'import pty,sys,os\nstatus=pty.spawn(sys.argv[1:])\nsys.exit(os.waitstatus_to_exitcode(status))';
      return spawnSync('python3', ['-c', code, process.execPath, script, ...args], { cwd: work, env: env(extraEnv), encoding: 'utf8' });
    },
  };
}

function writeFlags(fake, extraEnv) {
  const flags = Object.fromEntries(Object.entries(extraEnv).filter(([name]) => name.startsWith('FAKE_')));
  writeFileSync(join(fake.fixtures, 'flags.json'), JSON.stringify(flags));
}

/** The tag filters a publish workflow needs for a version. */
/** Writes the pin of a workflow text into release.config.json of a work tree, as a person would after reviewing the file. */
export function pinWorkflow(work, text) {
  pinFile(work, '.github/workflows/publish.yml', text);
}

/** Moves the pin of one pinned file to the given content, as a person would after reviewing the file. */
export function pinFile(work, path, text) {
  const file = join(work, 'release.config.json');
  const config = JSON.parse(readFileSync(file, 'utf8'));
  config.workflow.pins.find((pin) => pin.path === path).sha256 = pinHash(path, Buffer.from(text)).hash;
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

export function filtersFor(version) {
  const core = version.split('-')[0];
  return version.includes('-') ? [`v${core}`, `v${core}-${version.split('-')[1].split('.')[0]}.*`] : [`v${core}`];
}

export function runNode(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], { cwd: options.cwd ?? repoRoot, env: options.env ?? scrubbed(), encoding: 'utf8', input: options.input ?? '' });
}
