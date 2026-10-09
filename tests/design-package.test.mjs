import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDesignManifest, requiresDesignPackage, createZip } from '../scripts/build-design-package.mjs';
import { importProjectionDesign, validateScene } from '../design-package/importer.mjs';
import { THEME_PRESETS, PROJECTION_FLAT_THEME, COASTAL_DAY_FLAT_THEME } from '../src/foundations.ts';

test('visual releases carry a design package under the agreed alpha and stable cadence', () => {
  assert.equal(requiresDesignPackage('0.2.0-next.2', '0.1.5', true), true);
  assert.equal(requiresDesignPackage('0.2.0-next.2', '0.2.0-next.1', true), true);
  assert.equal(requiresDesignPackage('0.2.1-next.0', '0.2.0-next.2', true), false);
  assert.equal(requiresDesignPackage('2.0.0', '1.4.0', true), true);
  assert.equal(requiresDesignPackage('1.5.0', '1.4.0', true), false);
  assert.equal(requiresDesignPackage('1.5.0', '1.4.0', true, true), true);
  assert.equal(requiresDesignPackage('2.0.0', '1.4.0', false), false);
});

test('the release manifest derives the core palettes and complete runtime inventory from source', () => {
  const scene = JSON.parse(readFileSync(new URL('../design-package/figma-scene.json', import.meta.url)));
  const manifest = createDesignManifest(scene);
  assert.equal(manifest.version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
  assert.deepEqual(manifest.tokens.themes.dark, THEME_PRESETS.projection);
  assert.deepEqual(manifest.tokens.themes.light, THEME_PRESETS['coastal-day']);
  assert.deepEqual(manifest.tokens.themes.darkFlat, PROJECTION_FLAT_THEME);
  assert.deepEqual(manifest.tokens.themes.lightFlat, COASTAL_DAY_FLAT_THEME);
  assert.deepEqual(manifest.runtimeContracts.map(item => item.name), Object.keys(JSON.parse(readFileSync(new URL('../docs/component-contracts.json', import.meta.url)))));
  assert.equal(manifest.coverage.claim, 'Editable design mockups. React behavior and property parity are not implied.');
  assert.ok(manifest.coverage.categories.length > 0);
  assert.ok(manifest.coverage.categories.every(item => item.variants.length > 0));
  assert.equal(manifest.design.source.fileKey, 'R0bfa3bbauoeworjxj4VTb');
});

test('the importer refuses incomplete external dependencies and unsupported paints before edits', () => {
  const basic = { schemaVersion: 1, collections: [], variables: [], styles: [], nodes: [] };
  assert.throws(() => validateScene({ ...basic, nodes: [{ id: '1', type: 'INSTANCE', mainComponentId: 'missing', properties: {} }] }), /component.*missing/);
  assert.throws(() => validateScene({ ...basic, nodes: [{ id: '1', type: 'RECTANGLE', properties: { fills: [{ type: 'IMAGE', imageHash: 'missing' }] } }] }), /IMAGE/);
  assert.throws(() => validateScene({ ...basic, variables: [{ id: 'v', variableCollectionId: 'missing', valuesByMode: {} }] }), /collection.*missing/);
});

test('the approved design scene contains editable native geometry and valid references', () => {
  const scene = JSON.parse(readFileSync(new URL('../design-package/figma-scene.json', import.meta.url)));
  const inventory = validateScene(scene);
  assert.ok(inventory.components > 0);
  assert.ok(inventory.text > 0);
  assert.ok(inventory.sets > 0);
  assert.equal(inventory.unsupported.length, 0);
});

test('the distribution ZIP is deterministic, portable, and rejects traversal paths', () => {
  const files = [{ name: 'README.md', data: Buffer.from('Projection UI') }, { name: 'plugin/code.js', data: Buffer.from('const editable = true;') }];
  assert.deepEqual(createZip(files), createZip(files));
  const archive = createZip(files);
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);
  assert.throws(() => createZip([{ name: '../outside', data: Buffer.from('x') }]), /relative archive path/);
});

function mockFigma(scene, { restrictInstanceGeometry = false } = {}) {
  let sequence = 0;
  const collections = [];
  const variables = [];
  const fonts = [];
  const figma = { root: { children: [] }, collections, localVariables: variables, loadedFonts: fonts };
  const properties = { x: 0, y: 0, width: 100, height: 40, fills: [], strokes: [], effects: [], opacity: 1, visible: true, locked: false, rotation: 0, layoutMode: 'NONE', layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', characters: '', fontName: { family: 'IBM Plex Sans', style: 'Regular' }, fontSize: 14, componentPropertyReferences: null, boundVariables: {} };
  const availableFonts = new Map([[JSON.stringify(properties.fontName), properties.fontName]]);
  if (scene) {
    const record = node => {
      for (const [key, value] of Object.entries(node.properties)) if (!(key in properties)) properties[key] = value;
      if (node.type === 'TEXT') for (const font of [node.properties.fontName, ...(node.segments ?? []).map(segment => segment.fontName)].filter(Boolean)) availableFonts.set(JSON.stringify(font), font);
      node.children?.forEach(record);
    };
    scene.nodes.forEach(record);
    for (const style of scene.styles) if (style.type === 'TEXT') availableFonts.set(JSON.stringify(style.properties.fontName), style.properties.fontName);
  }
  function make(type) {
    const node = { ...structuredClone(properties), id: `new:${++sequence}`, type, name: type, children: [], parent: undefined, explicitVariableModes: {}, componentPropertyDefinitions: {},
      appendChild(child) { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child); this.children.push(child); child.parent = this; },
      resize(width, height) { if (restrictInstanceGeometry && insideInstance(this)) throw new Error('Instance descendant geometry is inherited.'); this.width = width; this.height = height; this.layoutSizingHorizontal = 'FIXED'; this.layoutSizingVertical = 'FIXED'; },
      setExplicitVariableModeForCollection(collection, modeId) { this.explicitVariableModes[collection.id] = modeId; },
      setBoundVariable(field, variable) { this.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: variable.id }; },
      addComponentProperty(name, propertyType, value) { const key = `${name}#new:${++sequence}`; this.componentPropertyDefinitions[key] = { type: propertyType, defaultValue: value }; return key; },
      setProperties(values) { this.componentProperties = values; },
      findAll() { return this.children.flatMap(child => [child, ...child.findAll()]); },
      clone() { const copy = make(this.type); for (const [key, value] of Object.entries(this)) if (!['id', 'parent', 'children'].includes(key) && typeof value !== 'function') copy[key] = structuredClone(value); this.children.forEach(child => copy.appendChild(child.clone())); return copy; },
      createInstance() { const copy = this.clone(); copy.type = 'INSTANCE'; copy.mainComponent = this; return copy; },
    };
    if (restrictInstanceGeometry) for (const key of ['x', 'y', 'rotation', 'constraints', 'layoutMode', 'layoutSizingHorizontal', 'layoutSizingVertical', 'layoutAlign', 'layoutGrow', 'layoutPositioning']) if (key in node) {
      let current = node[key];
      Object.defineProperty(node, key, { enumerable: true, get: () => current, set(value) { if (insideInstance(node)) throw new Error(`This property cannot be overridden in an instance: ${key}.`); current = value; } });
    }
    for (const method of ['setRangeFontName', 'setRangeFontSize', 'setRangeFills', 'setRangeLineHeight', 'setRangeLetterSpacing', 'setRangeTextCase', 'setRangeTextDecoration']) node[method] = () => {};
    return node;
  }
  function insideInstance(node) { for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'INSTANCE') return true; return false; }
  for (const type of ['Frame', 'Component', 'Text', 'Rectangle', 'Ellipse', 'Line', 'Vector', 'Polygon', 'Star']) figma[`create${type}`] = () => make(type.toUpperCase());
  figma.createPage = () => { const page = make('PAGE'); figma.root.children.push(page); return page; };
  figma.setCurrentPageAsync = async page => { figma.currentPage = page; };
  figma.listAvailableFontsAsync = async () => [...availableFonts.values()].map(fontName => ({ fontName }));
  figma.loadFontAsync = async font => { fonts.push(font); };
  figma.combineAsVariants = (children, parent) => { const set = make('COMPONENT_SET'); parent.appendChild(set); children.forEach(child => set.appendChild(child)); return set; };
  for (const type of ['Text', 'Paint', 'Effect']) figma[`create${type}Style`] = () => ({ id: `style:${++sequence}`, type: type.toUpperCase() });
  figma.variables = {
    createVariableCollection(name) { const collection = { id: `collection:${++sequence}`, name, defaultModeId: `mode:${++sequence}`, modes: [], renameMode(modeId, modeName) { const existing = this.modes.find(mode => mode.modeId === modeId); if (existing) existing.name = modeName; else this.modes.push({ modeId, name: modeName }); }, addMode(modeName) { const modeId = `mode:${++sequence}`; this.modes.push({ modeId, name: modeName }); return modeId; } }; collections.push(collection); return collection; },
    createVariable(name, collection, resolvedType) { const variable = { id: `variable:${++sequence}`, name, variableCollectionId: collection.id, resolvedType, valuesByMode: {}, scopes: [], codeSyntax: {}, setValueForMode(modeId, value) { this.valuesByMode[modeId] = value; }, setVariableCodeSyntax(platform, syntax) { this.codeSyntax[platform] = syntax; } }; variables.push(variable); return variable; },
  };
  return figma;
}

function smallScene() {
  const variant = theme => ({ id: `button:${theme}`, type: 'COMPONENT', name: `Theme=${theme}`, properties: { width: 120, height: 40, fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.9, b: 0.2 }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'primary' } } }] }, children: [{ id: `label:${theme}`, type: 'TEXT', name: 'Label', properties: { width: 80, height: 20, fontName: { family: 'IBM Plex Sans', style: 'Regular' }, characters: 'Continue', componentPropertyReferences: { characters: 'Label#source' } }, segments: [] }] });
  return { schemaVersion: 1, source: { fileKey: 'test' }, collections: [{ id: 'colors', name: 'Colors', defaultModeId: 'dark', modes: [{ modeId: 'dark', name: 'Dark' }, { modeId: 'light', name: 'Light' }] }], variables: [{ id: 'primary', name: 'color/primary', variableCollectionId: 'colors', resolvedType: 'COLOR', scopes: ['ALL_FILLS'], valuesByMode: { dark: { r: 0.5, g: 0.9, b: 0.2 }, light: { r: 0.5, g: 0.9, b: 0.2 } } }], styles: [], nodes: [{ id: 'buttons', type: 'COMPONENT_SET', name: 'Projection/Buttons', properties: { width: 300, height: 120 }, componentPropertyDefinitions: { 'Label#source': { type: 'TEXT', defaultValue: 'Continue' }, Theme: { type: 'VARIANT', defaultValue: 'Dark' } }, children: [variant('Dark'), variant('Light')] }, { id: 'example', type: 'INSTANCE', name: 'Example', properties: { width: 120, height: 40 }, mainComponentId: 'button:Light', componentProperties: { Theme: { type: 'VARIANT', value: 'Light' }, 'Label#source': { type: 'TEXT', value: 'Next' } }, children: [{ id: 'instance-label', type: 'TEXT', name: 'Label', properties: { fontName: { family: 'IBM Plex Sans', style: 'Regular' }, characters: 'Next', width: 80, height: 20 }, segments: [] }] }] };
}

test('native import preserves component sets, text properties, instances, and theme bindings', async () => {
  const figma = mockFigma();
  const result = await importProjectionDesign(figma, smallScene(), { themes: { dark: THEME_PRESETS.projection, light: THEME_PRESETS['coastal-day'], darkFlat: PROJECTION_FLAT_THEME, lightFlat: COASTAL_DAY_FLAT_THEME } }, '0.2.0-next.2');
  const set = figma.currentPage.children.find(node => node.type === 'COMPONENT_SET');
  assert.equal(set.children.length, 4);
  assert.deepEqual(set.children.map(node => node.name), ['Theme=Dark, Appearance=Modern', 'Theme=Light, Appearance=Modern', 'Theme=Dark, Appearance=Flat', 'Theme=Light, Appearance=Flat']);
  assert.equal(result.inventory.flatVariants, 2);
  const modernPrimary = figma.localVariables.find(variable => variable.name === 'color/primary' && variable.variableCollectionId === result.coreCollections.Modern.id);
  const flatPrimary = figma.localVariables.find(variable => variable.name === 'color/primary' && variable.variableCollectionId === result.coreCollections.Flat.id);
  assert.equal(set.children[0].fills[0].boundVariables.color.id, modernPrimary.id);
  assert.equal(set.children[2].fills[0].boundVariables.color.id, flatPrimary.id);
  const instance = figma.currentPage.children.find(node => node.type === 'INSTANCE');
  assert.equal(instance.mainComponent.parent, set, 'creating instances must not remove the main component from its set');
  assert.ok(Object.keys(instance.componentProperties).some(key => key.startsWith('Label#new:')));
  assert.ok(result.createdNodeIds.includes(instance.children[0].id));
  await assert.rejects(() => importProjectionDesign(figma, smallScene(), { themes: {} }, '0.2.0-next.2'), /already exists/);
  assert.equal(figma.root.children.length, 1);
});

test('missing fonts stop native import before creating any page or variables', async () => {
  const figma = mockFigma();
  figma.listAvailableFontsAsync = async () => [];
  await assert.rejects(() => importProjectionDesign(figma, smallScene(), { themes: {} }, '0.2.0-next.2'), /Install the IBM Plex Sans Regular font/);
  assert.equal(figma.root.children.length, 0);
  assert.equal(figma.collections.length, 0);
});

test('the complete approved scene replays with current gradients, editable variants, and accurate coverage', async () => {
  const scene = JSON.parse(readFileSync(new URL('../design-package/figma-scene.json', import.meta.url)));
  const manifest = createDesignManifest(scene);
  const figma = mockFigma(scene, { restrictInstanceGeometry: true });
  const result = await importProjectionDesign(figma, scene, manifest.tokens, manifest.version);
  assert.equal(result.inventory.sets, 49);
  assert.equal(result.inventory.components, 98);
  assert.equal(result.inventory.flatVariants, 98);
  const sets = figma.currentPage.children.filter(node => node.type === 'COMPONENT_SET');
  assert.equal(sets.length, 49);
  assert.ok(sets.every(set => set.children.length === 4));
  const lightAvatarBoard = figma.currentPage.findAll().find(node => node.name === 'Avatars · Light');
  const avatarLabel = lightAvatarBoard.findAll().find(node => node.type === 'TEXT' && node.name === 'HS');
  assert.equal(avatarLabel.layoutSizingHorizontal, 'HUG', 'nested instance text must retain its source horizontal sizing');
  assert.equal(avatarLabel.layoutSizingVertical, 'HUG', 'nested instance text must retain its source vertical sizing');
  const profiles = sets.find(set => set.name === 'Round 2/Profiles');
  const modernLight = profiles.children.find(child => child.name === 'Theme=Light, Appearance=Modern');
  const modernDark = profiles.children.find(child => child.name === 'Theme=Dark, Appearance=Modern');
  const source = component => component.findAll().find(node => node.name === 'Light source behind glass');
  const primaryLight = source(modernLight).fills[0].gradientStops[0].color;
  const partnerDark = source(modernDark).fills[0].gradientStops[1].color;
  assert.ok(Math.abs(primaryLight.r - 0) < 0.00001);
  assert.ok(Math.abs(primaryLight.b - 1) < 0.00001);
  assert.ok(Math.abs(partnerDark.r - 161 / 255) < 0.00001);
  assert.ok(Math.abs(partnerDark.b - 91 / 255) < 0.00001);
  assert.ok(profiles.children.filter(child => child.name.includes('Appearance=Flat')).every(component => [component, ...component.findAll()].every(node => node.effects.length === 0 && !node.fills.some(paint => paint.type.startsWith('GRADIENT')))));
  assert.ok(manifest.runtimeContracts.find(contract => contract.name === 'Card').designCategories.includes('Round 2/Cards'));
  assert.ok(manifest.coverage.runtimeWithoutDesignCategory.includes('ThemeProvider'));
  const partner = figma.localVariables.find(variable => variable.variableCollectionId === result.coreCollections.Modern.id && variable.name === 'color/partner');
  assert.equal(partner.codeSyntax.WEB, 'var(--ui-accent-end)');
});
