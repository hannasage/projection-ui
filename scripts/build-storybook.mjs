import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { packFixture, repository } from '../tests/helpers/packed.mjs';

const packed = packFixture('storybook', ['react', 'react-dom', 'recharts', 'zustand', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', '@types']);
try {
  const manifest = JSON.parse(readFileSync(join(packed.installed, 'package.json'), 'utf8'));
  const paths = {};
  const assets = [];
  for (const [name, target] of Object.entries(manifest.exports)) {
    const specifier = manifest.name + (name === '.' ? '' : name.slice(1));
    if (typeof target === 'string') assets.push(`declare module '${specifier}'`);
    else paths[specifier] = [join(packed.installed, target.types)];
  }
  const typing = join(packed.temporary, 'typing');
  mkdirSync(typing);
  writeFileSync(join(typing, 'assets.d.ts'), assets.join('\n'));
  writeFileSync(join(typing, 'tsconfig.json'), JSON.stringify({
    extends: join(repository, 'tsconfig.app.json'),
    compilerOptions: { paths, rootDir: repository },
    include: [join(repository, 'stories/**/*.tsx'), join(repository, '.storybook/**/*.ts'), join(typing, 'assets.d.ts')],
  }, null, 2));
  const environment = { ...process.env, PROJECTION_UI_PACKAGE_DIR: packed.installed };
  const development = process.argv.includes('--dev');
  for (const args of [[join(repository, 'node_modules/typescript/bin/tsc'), '-p', join(typing, 'tsconfig.json'), '--noEmit'], [join(repository, 'node_modules/storybook/bin/index.cjs'), development ? 'dev' : 'build', '--disable-telemetry', ...(development ? ['-p','6006'] : [])]]) {
    const result = spawnSync(process.execPath, args, { cwd: repository, env: environment, stdio: 'inherit', timeout: development ? undefined : 240_000 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Storybook gate failed with status ${result.status}`);
  }
} finally { rmSync(packed.temporary, {recursive:true,force:true}); }
