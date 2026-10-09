import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve, sep } from 'node:path';
import ts from 'typescript';

test('Storybook types resolve before generated dist files exist', () => {
  const configuration = ts.readConfigFile('tsconfig.node.json', ts.sys.readFile);
  assert.equal(configuration.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(configuration.config, ts.sys, process.cwd());
  const host = ts.createCompilerHost(parsed.options);
  const fileExists = host.fileExists;
  const output = resolve('dist') + sep;
  host.fileExists = path => !resolve(path).startsWith(output) && fileExists(path);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  }));
  assert.ok(program.getSourceFiles().every(file => !resolve(file.fileName).startsWith(output)));
});
