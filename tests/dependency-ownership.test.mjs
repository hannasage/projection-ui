import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const managed={'@dnd-kit/core':'^6.3.1','@dnd-kit/sortable':'^10.0.0','@dnd-kit/utilities':'^3.2.2',recharts:'^3.8.1',zustand:'^5.0.13','react-is':'^19.2.6'};
test('the package owns feature runtimes, leaving only host React peers',()=>{
  assert.deepEqual(manifest.peerDependencies,{react:'>=19.0.0','react-dom':'>=19.0.0'});
  for(const [name,version] of Object.entries(managed)) {
    assert.equal(manifest.dependencies?.[name],version,`${name} installs with the package`);
    assert.equal(manifest.devDependencies[name],undefined,`${name} has one ownership declaration`);
  }
  assert.equal(manifest.bundleDependencies,undefined);
});
