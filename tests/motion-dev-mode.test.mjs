// The development check behind the flavor-churn warning, read from source. It must warn outside a production build, and it must
// default to warning when the build defines neither process.env.NODE_ENV nor import.meta.env.DEV.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/motion/devMode.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { developmentFrom, isDevelopment } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const missing = () => { throw new ReferenceError('process is not defined'); };

test('NODE_ENV decides when the build defines it', () => {
  assert.equal(developmentFrom({ nodeEnv: () => 'production', metaDev: () => true }), false);
  assert.equal(developmentFrom({ nodeEnv: () => 'development', metaDev: () => false }), true);
  assert.equal(developmentFrom({ nodeEnv: () => 'test', metaDev: () => undefined }), true);
});

test('with no process, import.meta.env.DEV decides, and with neither the default is to warn', () => {
  assert.equal(developmentFrom({ nodeEnv: missing, metaDev: () => false }), false);
  assert.equal(developmentFrom({ nodeEnv: missing, metaDev: () => true }), true);
  assert.equal(developmentFrom({ nodeEnv: missing, metaDev: () => undefined }), true);
  assert.equal(developmentFrom({ nodeEnv: () => undefined, metaDev: () => undefined }), true);
  assert.equal(developmentFrom({ nodeEnv: missing, metaDev: missing }), true);
});

test('isDevelopment() warns where process is undefined, and not under a production NODE_ENV', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'process');
  let withoutProcess;
  try {
    Object.defineProperty(globalThis, 'process', { configurable: true, writable: true, value: undefined });
    withoutProcess = isDevelopment();
  } finally {
    Object.defineProperty(globalThis, 'process', saved);
  }
  assert.equal(withoutProcess, true, 'no process and no import.meta.env: warn');
  const before = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.equal(isDevelopment(), false, 'a production build stays silent');
  } finally {
    if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before;
  }
});
