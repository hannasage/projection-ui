import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cleanup, git, tempDir, makeFakeBin, makeRepoWithRemote, makeReleaseRepo, repoRoot, runNode, snapshot } from './helpers/tools-support.mjs';

afterEach(cleanup);

const manifest = JSON.parse(readFileSync(join(repoRoot, 'tools/manifest.json'), 'utf8'));
const { SAFETY } = await import(pathToFileURL(join(repoRoot, 'scripts/release.mjs')).href);
const CLASSES = ['read-only', 'local-write', 'remote-write', 'human-only'];
const entry = (name) => manifest.tools.find((tool) => tool.name === name);
const FORBIDDEN = /^(login|adduser|whoami|deprecate|dist-tag|unpublish|token)\b|^publish(?!.*--dry-run)/;

describe('tools/manifest.json shape', () => {
  it('has a schema number and a list of tools', () => {
    assert.equal(manifest.schema, 1);
    assert.ok(manifest.tools.length > 0);
  });

  it('gives every entry a name, a description, arguments, an output shape, a safety class, and a writes text', () => {
    for (const tool of manifest.tools) {
      assert.ok(tool.description.length > 10, tool.name);
      assert.ok(Array.isArray(tool.arguments), tool.name);
      for (const argument of tool.arguments) {
        assert.match(argument.name, /^(--[a-z-]+|<[a-z-]+>)$/, tool.name);
        assert.ok(['flag', 'string', 'path'].includes(argument.type), `${tool.name} ${argument.name}`);
        assert.equal(typeof argument.required, 'boolean');
        assert.ok(argument.description.length > 0);
      }
      assert.ok(tool.output.length > 10, tool.name);
      assert.ok(CLASSES.includes(tool.safety_class), tool.name);
      assert.ok(tool.writes.length > 0, tool.name);
      assert.ok(Array.isArray(tool.writesPaths), tool.name);
      assert.equal(typeof tool.destructive, 'boolean', tool.name);
      if (tool.safety_class === 'read-only' || tool.safety_class === 'human-only') assert.deepEqual(tool.writesPaths, [], tool.name);
    }
    assert.equal(new Set(manifest.tools.map((tool) => tool.name)).size, manifest.tools.length);
  });

  it('lists only files that exist, and every tools/*.mjs file', () => {
    for (const tool of manifest.tools) assert.ok(existsSync(join(repoRoot, tool.script)), tool.script);
    const listed = new Set(manifest.tools.map((tool) => tool.script));
    for (const file of readdirSync(join(repoRoot, 'tools')).filter((name) => name.endsWith('.mjs'))) assert.ok(listed.has(`tools/${file}`), file);
  });

  it('lists every release subcommand once, with the class the script declares', () => {
    for (const [subcommand, safety] of Object.entries(SAFETY)) {
      assert.equal(entry(`release ${subcommand}`)?.safety_class, safety, subcommand);
      assert.equal(entry(`release ${subcommand}`)?.subcommand, subcommand);
    }
    assert.equal(manifest.tools.filter((tool) => tool.script === 'scripts/release.mjs').length, Object.keys(SAFETY).length);
  });

  it('puts tag, publish, and retire in the human-only class, and names the state file where the script writes it', () => {
    for (const name of ['release tag', 'release publish', 'release retire']) assert.equal(entry(name).safety_class, 'human-only', name);
    for (const name of ['release preflight', 'release gates', 'release dry-run', 'release verify']) {
      assert.equal(entry(name).safety_class, 'local-write', name);
      assert.match(entry(name).writes, /release-state\.json/, name);
    }
    assert.match(entry('release preflight').writes, /git fetch/);
    assert.match(entry('gates').writes, /node_modules/);
  });
});

describe('the force flag in the manifest (C3)', () => {
  it('lists --force only on the commands where it does something', () => {
    for (const tool of manifest.tools.filter((entry) => entry.script === 'scripts/release.mjs')) {
      const listed = tool.arguments.some((argument) => argument.name === '--force');
      assert.equal(listed, ['preflight', 'gates', 'dry-run', 'verify'].includes(tool.subcommand), tool.name);
    }
  });
});


// ---- The shared exposure check, ported from the factory manifest test (its COPY-START to COPY-END block). ----
const EXPOSURE_VALUES = ['expose', 'hidden'];
const SAFETY_CLASS_NAMES = ['read-only', 'local-write', 'remote-write', 'human-only'];
const MAX_TOOLS = 1000;
const TOP_KEYS = ['schema', 'version', 'project', 'description', 'safety_classes', 'exit_codes', 'exposure_default', 'mcp_exposure', 'tools', 'held_back'];

/** True when the path names a regular file (not a link) whose real path is inside the root. */
function isRegularFileInside(root, script) {
  if (typeof script !== 'string' || script === '' || isAbsolute(script) || script.split('/').includes('..')) return false;
  try {
    const path = join(root, script);
    if (!lstatSync(path).isFile()) return false;
    const real = realpathSync(path);
    return real.startsWith(`${realpathSync(root)}${sep}`);
  } catch {
    return false;
  }
}

/** Problems with the exposure field. An empty list means the manifest is sound. It never throws on a malformed manifest. */
function exposureProblems(candidate, root = repoRoot) {
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(candidate) || !Array.isArray(candidate.tools) || candidate.tools.length === 0) return ['the manifest needs a non-empty tools list'];
  if (candidate.tools.length > MAX_TOOLS) return [`the manifest has more than ${MAX_TOOLS} tools`];
  const problems = [];
  for (const key of Object.keys(candidate)) if (!TOP_KEYS.includes(key)) problems.push(`unknown top-level key ${key}`);
  if ('exposure_default' in candidate && candidate.exposure_default !== 'hidden') problems.push('exposure_default must be hidden');
  const names = [];
  candidate.tools.forEach((tool, index) => {
    const name = isObject(tool) ? tool.name : undefined;
    if (typeof name !== 'string' || name.trim() === '') problems.push(`tool #${index}: needs a name`);
    else names.push(name);
  });
  const fold = (name) => name.replace(/\p{Cf}/gu, '').normalize('NFKC').trim().toLowerCase();
  const folded = names.map(fold);
  for (const name of [...new Set(folded.filter((entry) => folded.filter((other) => other === entry).length > 1))].sort()) problems.push(`${name}: the name appears more than once`);
  const held = 'held_back' in candidate ? candidate.held_back : [];
  const heldNames = [];
  if (!Array.isArray(held)) problems.push('held_back must be a list');
  else {
    for (const item of held) {
      if (isObject(item) && typeof item.tool === 'string') {
        heldNames.push(item.tool);
        if (!names.includes(item.tool)) problems.push(`held_back names ${item.tool}, which is not a tool`);
      } else problems.push('held_back entries need a tool name');
    }
  }
  for (const tool of candidate.tools) {
    const name = isObject(tool) ? tool.name : undefined;
    if (typeof name !== 'string' || name.trim() === '') continue;
    const exposed = tool.mcp_exposure === 'expose';
    if ('mcp_exposure' in tool && !(typeof tool.mcp_exposure === 'string' && EXPOSURE_VALUES.includes(tool.mcp_exposure))) problems.push(`${name}: mcp_exposure must be expose or hidden`);
    const safety = tool.safety_class;
    if (!SAFETY_CLASS_NAMES.includes(safety)) problems.push(`${name}: safety_class must be one of ${SAFETY_CLASS_NAMES.join(', ')}`);
    if (safety === 'human-only' && exposed) problems.push(`${name}: a human-only tool must be hidden`);
    if ('destructive' in tool && typeof tool.destructive !== 'boolean') problems.push(`${name}: destructive must be true or false`);
    else if (tool.destructive === true && exposed) problems.push(`${name}: a destructive tool must be hidden`);
    else if (exposed && tool.destructive !== false) problems.push(`${name}: an exposed tool must say destructive: false`);
    if (exposed) {
      if (safety !== 'read-only') problems.push(`${name}: an exposed tool must be read-only`);
      if (!Array.isArray(tool.writesPaths) || tool.writesPaths.length !== 0) problems.push(`${name}: an exposed tool must have writesPaths: []`);
      if (!isRegularFileInside(root, tool.script)) problems.push(`${name}: an exposed tool needs a script file that exists as a regular file inside the repository`);
      for (const argument of Array.isArray(tool.arguments) ? tool.arguments : []) {
        const pathLike = argument?.type === 'path' || /^<.*(tree|dir|path|file).*>$/i.test(String(argument?.name)) || /^--(dir|path|file|tree|out)\b/.test(String(argument?.name));
        if (pathLike && argument.agent_settable !== false && argument.validated !== true) problems.push(`${name}: an exposed tool's path argument ${argument.name} must be agent_settable false or validated`);
      }
    }
    if (heldNames.includes(name) && exposed) problems.push(`${name}: a held-back tool must be hidden`);
  }
  return problems;
}

/** The one loader. It lists a tool only when the whole manifest passes exposureProblems and the tool says exactly "expose". */
function exposedTools(candidate) {
  if (exposureProblems(candidate).length > 0) return [];
  return candidate.tools.filter((tool) => tool.mcp_exposure === 'expose');
}

describe('MCP exposure', () => {
  const make = (...tools) => ({
    tools: tools.map(([name, safety_class, mcp_exposure]) => ({ name, safety_class, destructive: false, script: 'tools/gates.mjs', writesPaths: [], ...(mcp_exposure === undefined ? {} : { mcp_exposure }) })),
  });

  it('the real manifest passes the shared check and says hidden is the default', () => {
    assert.deepEqual(exposureProblems(manifest), []);
    assert.equal(manifest.exposure_default, 'hidden');
    assert.deepEqual(Object.keys(manifest.mcp_exposure).sort(), ['expose', 'hidden']);
  });

  it('gives every tool a destructive flag and an exposure value', () => {
    for (const tool of manifest.tools) {
      assert.equal(typeof tool.destructive, 'boolean', tool.name);
      assert.ok(['expose', 'hidden'].includes(tool.mcp_exposure), tool.name);
    }
  });

  it('exposes only status, claims, and tree-clean', () => {
    assert.deepEqual(exposedTools(manifest).map((tool) => tool.name).sort(), ['release claims', 'release status', 'tree-clean']);
    for (const tool of exposedTools(manifest)) {
      assert.equal(tool.safety_class, 'read-only');
      assert.deepEqual(tool.writesPaths, []);
      assert.equal(tool.destructive, false);
    }
  });

  it('hides preflight, verify, gates, dry-run, pr-open, tag, publish, and retire', () => {
    for (const name of ['release preflight', 'release verify', 'gates', 'release gates', 'release dry-run', 'pr-open', 'release tag', 'release publish', 'release retire']) assert.equal(entry(name).mcp_exposure, 'hidden', name);
    for (const tool of manifest.tools) if (tool.safety_class !== 'read-only' || tool.destructive === true) assert.equal(tool.mcp_exposure, 'hidden', tool.name);
  });

  it('marks gates destructive, like release gates, because npm ci replaces node_modules', () => {
    assert.equal(entry('gates').destructive, true);
    assert.equal(entry('release gates').destructive, true);
  });

  it('fails an exposed tool whose path argument an agent can set', () => {
    const open = make(['a', 'read-only', 'expose']);
    open.tools[0].arguments = [{ name: '<tree>', type: 'path', agent_settable: true }];
    assert.match(exposureProblems(open).join(), /a: an exposed tool's path argument <tree> must be agent_settable false or validated/);
    assert.deepEqual(exposedTools(open), []);
    open.tools[0].arguments = [{ name: '--dir', type: 'string' }];
    assert.match(exposureProblems(open).join(), /path argument --dir/);
    open.tools[0].arguments = [{ name: '--dir', type: 'string', agent_settable: false }, { name: '<tree>', type: 'path', agent_settable: true, validated: true }];
    assert.deepEqual(exposureProblems(open), []);
  });

  it('fails a manifest that exposes a human-only tool, and then exposes nothing', () => {
    const broken = make(['a', 'read-only', 'expose'], ['b', 'human-only', 'expose']);
    assert.match(exposureProblems(broken).join(), /b: a human-only tool must be hidden/);
    assert.deepEqual(exposedTools(broken), []);
  });

  it('fails an exposed tool that is destructive or does not say destructive false', () => {
    const destructive = make(['a', 'read-only', 'expose']);
    destructive.tools[0].destructive = true;
    assert.match(exposureProblems(destructive).join(), /a destructive tool must be hidden/);
    const silent = make(['a', 'read-only', 'expose']);
    delete silent.tools[0].destructive;
    assert.match(exposureProblems(silent).join(), /must say destructive: false/);
    assert.deepEqual(exposedTools(destructive), []);
    assert.deepEqual(exposedTools(silent), []);
  });

  it('fails an exposed tool that is remote-write or local-write', () => {
    for (const safety of ['remote-write', 'local-write']) {
      const broken = make(['a', safety, 'expose']);
      assert.match(exposureProblems(broken).join(), /must be read-only/, safety);
      assert.deepEqual(exposedTools(broken), []);
    }
  });

  it('fails an exposed tool with writesPaths or with a script that does not exist', () => {
    const writes = make(['a', 'read-only', 'expose']);
    writes.tools[0].writesPaths = ['x'];
    assert.match(exposureProblems(writes).join(), /writesPaths/);
    assert.deepEqual(exposedTools(writes), []);
    const missing = make(['a', 'read-only', 'expose']);
    missing.tools[0].script = 'tools/nope.mjs';
    assert.match(exposureProblems(missing).join(), /script file that exists/);
    for (const script of ['tools', '../outside.mjs', '/etc/hosts']) {
      const odd = make(['a', 'read-only', 'expose']);
      odd.tools[0].script = script;
      assert.match(exposureProblems(odd).join(), /regular file inside the repository/, script);
    }
    assert.deepEqual(exposedTools(missing), []);
  });

  it('fails an unknown top-level key, such as a misspelled held_back', () => {
    const broken = { ...make(['a', 'read-only', 'expose']), held_bak: [{ tool: 'a' }] };
    assert.match(exposureProblems(broken).join(), /unknown top-level key held_bak/);
    assert.deepEqual(exposedTools(broken), []);
  });

  it('compares names after trimming and lowercasing, and fails a null held_back', () => {
    assert.match(exposureProblems(make(['Gates', 'read-only', 'expose'], [' gates ', 'read-only', 'hidden'])).join(), /appears more than once/);
    const broken = { ...make(['a', 'read-only', 'expose']), held_back: null };
    assert.match(exposureProblems(broken).join(), /held_back must be a list/);
    assert.deepEqual(exposedTools(broken), []);
  });

  it('folds names with NFKC and drops invisible characters before the duplicate check', () => {
    assert.match(exposureProblems(make(['gates', 'read-only', 'expose'], ['gat\u200Bes', 'read-only', 'hidden'])).join(), /appears more than once/);
    assert.match(exposureProblems(make(['gates', 'read-only', 'expose'], ['\uFF47\uFF41\uFF54\uFF45\uFF53', 'read-only', 'hidden'])).join(), /appears more than once/);
  });

  it('fails an exposed script that is a link to a file outside the repository', () => {
    const root = tempDir('projection-exposure-');
    const outside = join(tempDir('projection-exposure-out-'), 'x.mjs');
    writeFileSync(outside, 'x');
    mkdirSync(join(root, 'tools'));
    symlinkSync(outside, join(root, 'tools', 'link.mjs'));
    writeFileSync(join(root, 'tools', 'real.mjs'), 'x');
    const link = make(['a', 'read-only', 'expose']);
    link.tools[0].script = 'tools/link.mjs';
    assert.match(exposureProblems(link, root).join(), /regular file inside the repository/);
    const real = make(['a', 'read-only', 'expose']);
    real.tools[0].script = 'tools/real.mjs';
    assert.deepEqual(exposureProblems(real, root), []);
  });

  it('gives every release entry the class that the script itself declares', () => {
    for (const tool of manifest.tools.filter((entry) => entry.script === 'scripts/release.mjs')) assert.equal(tool.safety_class, SAFETY[tool.subcommand], tool.name);
    for (const tool of manifest.tools) assert.ok(isRegularFileInside(repoRoot, tool.script), tool.script);
  });

  it('treats a missing field as hidden', () => {
    const gap = make(['a', 'read-only', 'expose'], ['b', 'read-only', undefined]);
    assert.deepEqual(exposureProblems(gap), []);
    assert.deepEqual(exposedTools(gap).map((tool) => tool.name), ['a']);
  });

  it('exposes nothing from a broken manifest', () => {
    const good = make(['a', 'read-only', 'expose']);
    assert.equal(exposedTools(good).length, 1);
    for (const broken of [
      { ...good, exposure_default: 'expose' },
      { tools: [...good.tools, ...good.tools] },
      { tools: [{ ...good.tools[0], mcp_exposure: 'maybe' }] },
      { tools: [{ ...good.tools[0], safety_class: 'root' }] },
      { ...good, held_back: [{ tool: 'a' }] },
      { ...good, held_back: [{ tool: 'missing' }] },
      { tools: [] },
      null,
      'text',
      { tools: [null] },
    ]) assert.deepEqual(exposedTools(broken), [], JSON.stringify(broken));
  });

  it('says in the manifest what the exposed tools do on the network and on disk', () => {
    assert.match(entry('release status').writes, /network reads only/i);
    assert.match(entry('tree-clean').writes, /git ls-remote/);
    assert.match(entry('tree-clean').writes, /network read/);
    assert.match(entry('release claims').writes, /^Nothing/);
  });
});

describe('release status writes nothing (B)', () => {
  it('leaves the repository and a fake HOME unchanged, and sends npm to a throwaway cache and log folder', async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    const fakeHome = tempDir('projection-status-home-');
    mkdirSync(join(fakeHome, '.npm'));
    writeFileSync(join(fakeHome, '.npm', 'marker'), 'x');
    const homeBefore = snapshot(fakeHome);
    const workBefore = snapshot(repo.work);
    const result = repo.run(['status'], { HOME: fakeHome });
    assert.equal(result.status, 0, result.stdout);
    assert.equal(snapshot(fakeHome), homeBefore);
    assert.equal(snapshot(repo.work), workBefore);
    const calls = repo.fake.calls().filter((call) => call.tool === 'npm');
    assert.ok(calls.length > 0);
    for (const call of calls) {
      assert.ok(call.args.includes('--no-update-notifier') && call.args.includes('--loglevel'), call.args.join(' '));
      assert.ok(call.cache && !call.cache.startsWith(fakeHome), `cache ${call.cache} is outside the real HOME`);
      assert.ok(call.logs && !call.logs.startsWith(fakeHome));
      assert.equal(existsSync(call.cache), false, 'the throwaway cache is removed');
    }
  });

  it('reports the tag phase as unknown, with the remote error first, when the remote cannot be read', async () => {
    const repo = await makeReleaseRepo();
    assert.equal(repo.run(['preflight']).status, 0);
    git(repo.work, 'remote', 'set-url', 'origin', join(repo.work, '..', 'gone.git'));
    const body = JSON.parse(repo.run(['status', '--json']).stdout);
    const tag = body.phases.find((phase) => phase.name === 'tag');
    assert.equal(tag.state, 'unknown');
    assert.match(tag.note, /^could not read the remote tags: /);
  });
});

describe('the declared class matches what each subcommand does', () => {
  const publishedRepo = async () => {
    const repo = await makeReleaseRepo();
    repo.setRegistry(repo.publishedTags());
    return repo;
  };
  const noTags = (repo) => assert.equal(git(repo.work, 'tag', '--list'), '');

  for (const subcommand of Object.keys(SAFETY).filter((name) => SAFETY[name] === 'read-only')) {
    it(`read-only ${subcommand} changes no file in the repository or its git folder`, async () => {
      const repo = await publishedRepo();
      const before = snapshot(repo.work);
      const result = repo.run([subcommand]);
      assert.ok([0, 1].includes(result.status), `${subcommand} exited ${result.status}: ${result.stdout}`);
      assert.equal(snapshot(repo.work), before);
      assert.notEqual(before, '');
      for (const line of repo.fake.lines('npm')) assert.doesNotMatch(line, FORBIDDEN, line);
    });
  }

  for (const subcommand of Object.keys(SAFETY).filter((name) => SAFETY[name] === 'human-only')) {
    it(`human-only ${subcommand} changes nothing and runs no registry write or tag, with or without a terminal`, async () => {
      const repo = await publishedRepo();
      repo.setRegistry({ latest: '0.1.5' });
      const workBefore = snapshot(repo.work);
      const originBefore = snapshot(repo.origin);
      const plain = repo.run([subcommand]);
      const terminal = repo.runTTY([subcommand]);
      assert.ok([0, 2].includes(plain.status));
      assert.ok([0, 1].includes(terminal.status));
      if (subcommand !== 'retire') assert.equal(plain.status, 2);
      assert.equal(snapshot(repo.work), workBefore);
      assert.equal(snapshot(repo.origin), originBefore);
      noTags(repo);
      assert.equal(git(repo.origin, 'tag', '--list'), '');
      for (const line of repo.fake.lines('npm')) assert.doesNotMatch(line, FORBIDDEN, line);
    });
  }

  for (const subcommand of ['preflight', 'gates', 'dry-run', 'verify']) {
    it(`local-write ${subcommand} writes the state file it declares`, async () => {
      const repo = await publishedRepo();
      const file = join(repo.work, '.git', 'release-state.json');
      assert.equal(existsSync(file), false);
      const result = repo.run([subcommand]);
      assert.equal(result.status, 0, result.stdout);
      assert.ok(existsSync(file));
      assert.equal(SAFETY[subcommand], 'local-write');
    });
  }

  it('remote-write pr-open calls gh pr create, and read-only tree-clean changes no file', () => {
    const fake = makeFakeBin();
    const { work } = makeRepoWithRemote();
    const body = join(work, 'body.md');
    writeFileSync(body, '> [!NOTE]\nA change.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n');
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'body');
    git(work, 'push', '-q');
    const before = snapshot(work);
    const clean = runNode(join(repoRoot, 'tools/tree-clean.mjs'), [work], { env: fake.env() });
    assert.equal(clean.status, 0, clean.stdout);
    assert.equal(snapshot(work).replace(/\.git\/index:[^\n]*\n?/, ''), before.replace(/\.git\/index:[^\n]*\n?/, ''));
    assert.equal(entry('tree-clean').safety_class, 'read-only');
    const opened = runNode(join(repoRoot, 'tools/pr-open.mjs'), ['--title', 'x', '--body-file', body, '--base', 'main', '--dir', work], { env: fake.env() });
    assert.equal(opened.status, 0);
    assert.ok(fake.lines('gh').some((line) => line.startsWith('pr create')));
    assert.equal(entry('pr-open').safety_class, 'remote-write');
  });
});
