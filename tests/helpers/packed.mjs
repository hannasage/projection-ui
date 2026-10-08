import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const packageName = '@hannasage/projection-ui';
export function run(command, args, cwd = repository, timeout = 180_000) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout });
}
export function packFixture(label, peers) {
  const temporary = mkdtempSync(join(tmpdir(), `projection-ui-${label}-`));
  run(process.execPath, [join(repository, 'node_modules/vite/bin/vite.js'), 'build']);
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary]));
  const fixture = join(temporary, 'consumer');
  mkdirSync(fixture);
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'projection-ui-consumer', private: true, type: 'module' }));
  run('npm', ['install', '--prefix', fixture, '--offline', '--ignore-scripts', '--legacy-peer-deps', '--package-lock=false', '--no-audit', '--no-fund', join(temporary, packed.filename)]);
  for (const dependency of peers) {
    const target = join(fixture, 'node_modules', dependency);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(join(repository, 'node_modules', dependency), target, 'junction');
  }
  return { temporary, fixture, installed: join(fixture, 'node_modules', '@hannasage/projection-ui'), packed };
}
