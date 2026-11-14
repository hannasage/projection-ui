import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const managed={'@dnd-kit/core':'^6.3.1','@dnd-kit/sortable':'^10.0.0','@dnd-kit/utilities':'^3.2.2',recharts:'^3.8.1',zustand:'^5.0.13','react-is':'^19.2.6'};
const ARMATURE='@hannasage/armature';
test('the package owns feature runtimes, leaving host React peers and the optional motion engine peer',()=>{
  assert.deepEqual(manifest.peerDependencies,{react:'>=19.0.0','react-dom':'>=19.0.0',[ARMATURE]:'1.0.0-beta.1'});
  assert.deepEqual(manifest.peerDependenciesMeta,{[ARMATURE]:{optional:true}},'only the motion engine peer is optional');
  for(const [name,version] of Object.entries(managed)) {
    assert.equal(manifest.dependencies?.[name],version,`${name} installs with the package`);
    assert.equal(manifest.devDependencies[name],undefined,`${name} has one ownership declaration`);
  }
  assert.equal(manifest.bundleDependencies,undefined);
});
test('Armature is an optional peer and a devDependency, both pinned to the same exact beta, and installed once',()=>{
  assert.equal(manifest.dependencies[ARMATURE],undefined,'installing the package does not install the motion engine');
  for(const [field,value] of [['peerDependencies',manifest.peerDependencies[ARMATURE]],['devDependencies',manifest.devDependencies[ARMATURE]]]) {
    assert.equal(value,'1.0.0-beta.1',`${field} pins the beta`);
    assert.match(value,/^\d+\.\d+\.\d+-beta\.\d+$/,`${field}: no caret, tilde, or range`);
  }
  const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.packages[''].peerDependencies?.[ARMATURE],'1.0.0-beta.1','the lockfile root records the peer');
  assert.equal(lock.packages[''].devDependencies?.[ARMATURE],'1.0.0-beta.1','the lockfile root records the devDependency');
  assert.equal(lock.packages[''].dependencies?.[ARMATURE],undefined);
  assert.equal(lock.packages[`node_modules/${ARMATURE}`].version,'1.0.0-beta.1');
  assert.equal(lock.packages[`node_modules/${ARMATURE}`].dev,true,'the lockfile marks the copy as development only');
  assert.equal(Object.keys(lock.packages).filter(path=>path.endsWith(`node_modules/${ARMATURE}`)).length,1,'one installed copy');
});
