import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { repository } from './packed.mjs';

const ts = createRequire(join(repository, 'package.json'))('typescript');

// Fails with a readable message when an actual export list differs from the snapshot.
export function compareExports(actual, expected, label) {
  const missing = expected.filter(name => !actual.includes(name));
  const added = actual.filter(name => !expected.includes(name));
  assert.deepEqual({ missing, added }, { missing: [], added: [] }, `${label}: exports differ from the snapshot`);
}

// Reads the declaration file a package entry ships and returns every export name (types included),
// plus the required fields of UITheme and the literal members of UIRadius when the entry exports them.
export function declarationExports(declarationFile) {
  if (!existsSync(declarationFile)) throw new Error(`declaration file is missing: ${declarationFile}`);
  const program = ts.createProgram([declarationFile], {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX, skipLibCheck: true, noEmit: true, types: [],
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(declarationFile);
  const symbol = checker.getSymbolAtLocation(source);
  if (!source || !symbol) throw new Error(`declaration file is not a module: ${declarationFile}`);
  const exported = checker.getExportsOfModule(symbol);
  const names = exported.map(item => item.getName()).sort();
  const find = name => exported.find(item => item.getName() === name);
  let themeFields = null;
  let radius = null;
  const theme = find('UITheme');
  if (theme) {
    const type = checker.getDeclaredTypeOfSymbol(theme.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(theme) : theme);
    themeFields = checker.getPropertiesOfType(type)
      .filter(property => !(property.flags & ts.SymbolFlags.Optional))
      .map(property => `${property.getName()}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(property, source))}`)
      .sort();
  }
  const unit = find('UIRadius');
  if (unit) {
    const type = checker.getDeclaredTypeOfSymbol(unit.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(unit) : unit);
    radius = type.isUnion() ? type.types.map(member => String(member.value)).sort() : [checker.typeToString(type)];
  }
  return { names, themeFields, radius };
}
