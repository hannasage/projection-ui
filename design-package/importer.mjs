const supported = new Set(['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'TEXT', 'RECTANGLE', 'ELLIPSE', 'LINE', 'VECTOR', 'POLYGON', 'STAR']);

export function refineImportedPresentation(page) {
  const sets = page.children.filter(node => node.type === 'COMPONENT_SET');
  const columns = new Map();
  for (const set of sets) {
    if (!columns.has(set.x)) columns.set(set.x, []);
    columns.get(set.x).push(set);
    for (const flat of set.children.filter(component => component.name.includes('Appearance=Flat'))) {
      for (const node of flat.findAll()) if (['Light source behind glass', 'Projected lower edge', 'Active projected edge'].includes(node.name)) node.visible = false;
    }
  }
  let x = Math.min(...columns.keys());
  for (const [, column] of [...columns].sort(([left], [right]) => left - right)) {
    const width = Math.max(...column.map(set => set.width));
    let bottom = -Infinity;
    for (const set of column.sort((left, right) => left.y - right.y)) {
      set.x = x;
      if (set.y < bottom) set.y = bottom + 64;
      bottom = set.y + set.height;
    }
    x += width + 64;
  }
}

export function validateScene(scene) {
  if (scene.schemaVersion !== 1) throw new Error('Unsupported design scene version.');
  const nodes = new Map();
  const inventory = { components: 0, sets: 0, instances: 0, text: 0, unsupported: [] };
  function visit(node) {
    if (nodes.has(node.id)) throw new Error(`Duplicate source node ${node.id}.`);
    nodes.set(node.id, node);
    if (!supported.has(node.type)) inventory.unsupported.push(node.type);
    if (node.type === 'COMPONENT') inventory.components++;
    if (node.type === 'COMPONENT_SET') inventory.sets++;
    if (node.type === 'INSTANCE') inventory.instances++;
    if (node.type === 'TEXT') inventory.text++;
    for (const paint of [...(node.properties?.fills ?? []), ...(node.properties?.strokes ?? [])]) {
      if (!['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND'].includes(paint.type)) throw new Error(`Unsupported ${paint.type} paint on ${node.id}.`);
    }
    for (const child of node.children ?? []) visit(child);
  }
  for (const node of scene.nodes) visit(node);
  if (inventory.unsupported.length) throw new Error(`Unsupported nodes: ${inventory.unsupported.join(', ')}.`);
  for (const node of nodes.values()) {
    if (node.type === 'INSTANCE' && nodes.get(node.mainComponentId)?.type !== 'COMPONENT') throw new Error(`The source component ${node.mainComponentId} is missing.`);
  }
  const collections = new Set(scene.collections.map(item => item.id));
  const variables = new Set(scene.variables.map(item => item.id));
  function aliases(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'VARIABLE_ALIAS' && !variables.has(value.id)) throw new Error(`The source variable ${value.id} is missing.`);
    for (const child of Object.values(value)) aliases(child);
  }
  for (const variable of scene.variables) {
    if (!collections.has(variable.variableCollectionId)) throw new Error(`The source collection ${variable.variableCollectionId} is missing.`);
    const collection = scene.collections.find(item => item.id === variable.variableCollectionId);
    if (Object.keys(variable.valuesByMode).some(modeId => !collection.modes.some(mode => mode.modeId === modeId))) throw new Error(`A mode for variable ${variable.id} is missing.`);
    aliases(variable.valuesByMode);
  }
  for (const collection of scene.collections) if (!collection.modes.some(mode => mode.modeId === collection.defaultModeId)) throw new Error(`The default mode for collection ${collection.id} is missing.`);
  for (const node of nodes.values()) {
    aliases(node.properties);
    for (const [name, definition] of Object.entries(node.componentPropertyDefinitions ?? {})) {
      if (!['VARIANT', 'TEXT', 'BOOLEAN', 'INSTANCE_SWAP'].includes(definition.type)) throw new Error(`Unsupported component property ${name}.`);
      if (definition.type === 'INSTANCE_SWAP' && nodes.get(definition.defaultValue)?.type !== 'COMPONENT') throw new Error(`The default component ${definition.defaultValue} is missing.`);
    }
  }
  for (const style of scene.styles) {
    if (!['TEXT', 'PAINT', 'EFFECT'].includes(style.type)) throw new Error(`Unsupported style ${style.type}.`);
    aliases(style.properties);
    for (const paint of style.properties.paints ?? []) if (!['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND'].includes(paint.type)) throw new Error(`Unsupported ${paint.type} paint in style ${style.id}.`);
  }
  return inventory;
}

export async function importProjectionDesign(figma, scene, tokens, version) {
  const inventory = validateScene(scene);
  const pageName = `Projection UI ${version} · Editable kit`;
  if (figma.root.children.some(page => page.name === pageName)) throw new Error(`${pageName} already exists. This importer preserves the existing page and your edits.`);
  const sourceNodes = new Map();
  const sourceLight = new Map();
  const fonts = new Map();
  const visit = (node, inheritedLight = false) => {
    const modes = Object.entries(node.properties.explicitVariableModes ?? {});
    const explicitNames = modes.map(([collectionId, modeId]) => scene.collections.find(collection => collection.id === collectionId)?.modes.find(mode => mode.modeId === modeId)?.name ?? '');
    const isLight = /Theme=Light(?:,|$)/i.test(node.name) || explicitNames.some(name => /light|coastal/i.test(name)) || (inheritedLight && !/Theme=Dark(?:,|$)/i.test(node.name));
    sourceNodes.set(node.id, node);
    sourceLight.set(node.id, isLight);
    if (node.type === 'TEXT') {
      for (const segment of node.segments ?? []) fonts.set(JSON.stringify(segment.fontName), segment.fontName);
      if (node.properties.fontName) fonts.set(JSON.stringify(node.properties.fontName), node.properties.fontName);
    }
    for (const child of node.children ?? []) visit(child, isLight);
  };
  scene.nodes.forEach(node => visit(node));
  for (const style of scene.styles) if (style.type === 'TEXT') fonts.set(JSON.stringify(style.properties.fontName), style.properties.fontName);
  const availableFonts = await figma.listAvailableFontsAsync();
  for (const font of fonts.values()) {
    if (!availableFonts.some(item => item.fontName.family === font.family && item.fontName.style === font.style)) throw new Error(`Install the ${font.family} ${font.style} font before importing.`);
    await figma.loadFontAsync(font);
  }
  const createdNodeIds = [];
  const createdVariableIds = [];
  const createdCollectionIds = [];
  const createdStyleIds = [];
  const page = figma.createPage();
  page.name = pageName;
  createdNodeIds.push(page.id);
  await figma.setCurrentPageAsync(page);
  const collections = new Map();
  const modes = new Map();
  const variables = new Map();
  const coreVariables = new Map();
  const styles = new Map();
  const nodes = new Map();
  const propertyNames = new Map();
  for (const original of scene.collections) {
    const collection = figma.variables.createVariableCollection(`${version}/${original.name}`);
    collections.set(original.id, collection);
    createdCollectionIds.push(collection.id);
    const sourceModes = [...original.modes].sort((a, b) => Number(b.modeId === original.defaultModeId) - Number(a.modeId === original.defaultModeId));
    collection.renameMode(collection.defaultModeId, sourceModes[0].name);
    for (const [index, mode] of sourceModes.entries()) modes.set(mode.modeId, index === 0 ? collection.defaultModeId : collection.addMode(mode.name));
    collection.hiddenFromPublishing = original.hiddenFromPublishing;
  }
  for (const original of scene.variables) {
    const variable = figma.variables.createVariable(original.name, collections.get(original.variableCollectionId), original.resolvedType);
    variables.set(original.id, variable);
    createdVariableIds.push(variable.id);
    variable.scopes = original.scopes;
    variable.description = original.description ?? '';
    variable.hiddenFromPublishing = original.hiddenFromPublishing;
    for (const [platform, syntax] of Object.entries(original.codeSyntax ?? {})) variable.setVariableCodeSyntax(platform, syntax);
  }
  const remap = value => {
    if (Array.isArray(value)) return value.map(remap);
    if (!value || typeof value !== 'object') return value;
    if (value.type === 'VARIABLE_ALIAS') {
      const variable = coreVariables.get(value.id) ?? variables.get(value.id);
      if (!variable) throw new Error(`Unresolved variable ${value.id}.`);
      return { type: 'VARIABLE_ALIAS', id: variable.id };
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, remap(child)]));
  };
  for (const original of scene.variables) for (const [mode, value] of Object.entries(original.valuesByMode)) variables.get(original.id).setValueForMode(modes.get(mode), remap(value));

  const roles = { bg: 'bg', background: 'bg', surface: 'surface', border: 'border', text: 'text', muted: 'muted', primary: 'primary', 'primary-fg': 'primaryFg', primaryFg: 'primaryFg', danger: 'danger', success: 'success', warning: 'warning', cyan: 'cyan', violet: 'violet', pink: 'pink', amber: 'amber', mint: 'mint', partner: 'partner', 'gradient-start': 'primary', 'gradient-end': 'partner' };
  const color = hex => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255, a: 1 });
  const originalVariables = new Map(scene.variables.map(variable => [variable.id, variable]));
  function resolveOriginal(variable, requestedMode, visited = new Set()) {
    if (visited.has(variable.id)) throw new Error(`Circular variable alias ${variable.id}.`);
    visited.add(variable.id);
    const collection = scene.collections.find(item => item.id === variable.variableCollectionId);
    const mode = collection.modes.find(item => item.name === requestedMode)?.modeId ?? collection.defaultModeId;
    const value = variable.valuesByMode[mode];
    return value?.type === 'VARIABLE_ALIAS' ? resolveOriginal(originalVariables.get(value.id), requestedMode, visited) : value;
  }
  const baseCollection = scene.collections.find(collection => collection.name === 'Pass 2 / Base') ?? scene.collections.find(collection => collection.modes.some(mode => mode.name === 'Dark') && collection.modes.some(mode => mode.name === 'Light'));
  const oldPalettes = { dark: {}, light: {} };
  for (const variable of scene.variables) if (variable.variableCollectionId === baseCollection?.id) {
    const role = roles[variable.name.split('/').at(-1)];
    if (role) for (const [key, mode] of [['dark', 'Dark'], ['light', 'Light']]) oldPalettes[key][role] = resolveOriginal(variable, mode);
  }
  function normalizeColor(value, isLight, gradient = false) {
    if (Array.isArray(value)) return value.map(child => normalizeColor(child, isLight, gradient));
    if (!value || typeof value !== 'object') return value;
    if (['r', 'g', 'b'].every(key => typeof value[key] === 'number')) {
      const mode = isLight ? 'light' : 'dark';
      const order = gradient ? ['primary', 'partner', 'bg', 'surface', 'text', 'muted', 'border'] : ['primary', 'bg', 'surface', 'text', 'muted', 'border'];
      const role = order.find(role => {
        const prior = oldPalettes[mode][role];
        return prior && ['r', 'g', 'b'].every(channel => Math.abs(value[channel] - prior[channel]) < 0.00001);
      });
      if (role) return { ...value, ...Object.fromEntries(Object.entries(color(tokens.themes[mode][role])).filter(([key]) => key !== 'a')) };
      return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeColor(child, isLight, gradient || key === 'gradientStops')]));
  }
  const themeCollections = {};
  for (const [appearance, darkKey, lightKey] of [['Modern', 'dark', 'light'], ['Flat', 'darkFlat', 'lightFlat']]) {
    const collection = figma.variables.createVariableCollection(`${version}/Core ${appearance}`);
    createdCollectionIds.push(collection.id);
    collection.renameMode(collection.defaultModeId, 'Dark');
    const lightModeId = collection.addMode('Light');
    const roleVariables = {};
    for (const role of [...new Set(Object.values(roles))]) {
      const darkValue = tokens.themes[darkKey][role];
      const lightValue = tokens.themes[lightKey][role];
      if (!darkValue || !lightValue) continue;
      const variable = figma.variables.createVariable(`color/${role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, collection, 'COLOR');
      variable.scopes = role === 'border' ? ['STROKE_COLOR'] : ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR', 'EFFECT_COLOR'];
      variable.setVariableCodeSyntax('WEB', `var(--ui-${role === 'partner' ? 'accent-end' : role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)})`);
      variable.setValueForMode(collection.defaultModeId, color(darkValue));
      variable.setValueForMode(lightModeId, color(lightValue));
      roleVariables[role] = variable;
      createdVariableIds.push(variable.id);
    }
    themeCollections[appearance] = { collection, darkModeId: collection.defaultModeId, lightModeId, variables: roleVariables };
  }
  for (const original of scene.variables) {
    const role = roles[original.name.split('/').at(-1)];
    if (original.resolvedType === 'COLOR' && role && themeCollections.Modern.variables[role]) coreVariables.set(original.id, themeCollections.Modern.variables[role]);
  }
  for (const original of scene.styles) {
    const factory = { TEXT: 'createTextStyle', PAINT: 'createPaintStyle', EFFECT: 'createEffectStyle' }[original.type];
    if (!factory) throw new Error(`Unsupported style ${original.type}.`);
    const style = figma[factory]();
    style.name = `${version}/${original.name}`;
    style.description = original.description ?? '';
    Object.assign(style, remap(normalizeColor(original.properties, /Light|Coastal|Fernwood/.test(original.name))));
    styles.set(original.id, style);
    createdStyleIds.push(style.id);
  }

  function themeMode(node, original) {
    const explicit = original.properties.explicitVariableModes ?? {};
    let isLight = sourceLight.get(original.id) ?? false;
    for (const [collectionId, modeId] of Object.entries(explicit)) {
      const collection = collections.get(collectionId);
      if (collection) node.setExplicitVariableModeForCollection(collection, modes.get(modeId));
      const oldCollection = scene.collections.find(item => item.id === collectionId);
      if (/light|coastal/i.test(oldCollection?.modes.find(mode => mode.modeId === modeId)?.name ?? '')) isLight = true;
    }
    if (isLight || node.type === 'COMPONENT') node.setExplicitVariableModeForCollection(themeCollections.Modern.collection, isLight ? themeCollections.Modern.lightModeId : themeCollections.Modern.darkModeId);
  }
  const ignored = new Set(['width', 'height', 'fontWeight', 'boundVariables', 'explicitVariableModes', 'componentPropertyReferences', 'textStyleId', 'fillStyleId', 'strokeStyleId', 'effectStyleId', 'layoutSizingHorizontal', 'layoutSizingVertical']);
  // Native instance descendants inherit transforms and layout from their main
  // component. Rewriting even the same x/y value is a forbidden override.
  const inheritedGeometry = new Set(['x', 'y', 'width', 'height', 'rotation', 'relativeTransform', 'constraints', 'layoutMode', 'layoutWrap', 'primaryAxisSizingMode', 'counterAxisSizingMode', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'counterAxisAlignContent', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing', 'counterAxisSpacing', 'layoutAlign', 'layoutGrow', 'layoutPositioning', 'layoutSizingHorizontal', 'layoutSizingVertical', 'clipsContent', 'vectorPaths', 'vectorNetwork', 'arcData', 'pointCount', 'innerRadius', 'textAutoResize']);
  function restoreSizing(node, original) {
    for (const key of ['layoutSizingHorizontal', 'layoutSizingVertical']) if (original.properties[key] && key in node) node[key] = original.properties[key];
  }
  async function apply(node, original, instanceDescendant = false) {
    const properties = original.properties;
    if (!instanceDescendant) node.name = original.name;
    if (node.type === 'TEXT') {
      const font = properties.fontName ?? original.segments?.[0]?.fontName;
      if (font) { await figma.loadFontAsync(font); node.fontName = font; }
      node.characters = properties.characters ?? '';
    }
    if (!instanceDescendant && 'layoutMode' in node && properties.layoutMode !== undefined) node.layoutMode = properties.layoutMode;
    if (!instanceDescendant && 'resize' in node) node.resize(Math.max(0.01, properties.width ?? node.width), Math.max(node.type === 'LINE' ? 0 : 0.01, properties.height ?? node.height));
    for (const [key, value] of Object.entries(properties)) {
      if (ignored.has(key) || (instanceDescendant && inheritedGeometry.has(key)) || key === 'characters' || key === 'layoutMode' || key === 'fontName') continue;
      if (!(key in node)) throw new Error(`${original.type} does not support ${key}.`);
      node[key] = remap(normalizeColor(value, sourceLight.get(original.id) ?? false, key === 'gradientStops'));
    }
    for (const key of ['textStyleId', 'fillStyleId', 'strokeStyleId', 'effectStyleId']) {
      if (properties[key] && styles.has(properties[key])) {
        const method = `set${key[0].toUpperCase()}${key.slice(1)}Async`;
        if (typeof node[method] === 'function') await node[method](styles.get(properties[key]).id);
        else node[key] = styles.get(properties[key]).id;
      }
    }
    if (node.type === 'TEXT') for (const segment of original.segments ?? []) {
      for (const [key, method] of Object.entries({ fontName: 'setRangeFontName', fontSize: 'setRangeFontSize', fills: 'setRangeFills', lineHeight: 'setRangeLineHeight', letterSpacing: 'setRangeLetterSpacing', textCase: 'setRangeTextCase', textDecoration: 'setRangeTextDecoration' })) {
        if (segment[key] !== undefined && segment.end > segment.start) node[method](segment.start, segment.end, remap(normalizeColor(segment[key], sourceLight.get(original.id) ?? false)));
      }
    }
    for (const [field, alias] of Object.entries(properties.boundVariables ?? {})) {
      if (instanceDescendant && inheritedGeometry.has(field)) continue;
      if (['fills', 'strokes', 'effects', 'layoutGrids', 'textRangeFills', 'componentProperties'].includes(field)) continue;
      const aliases = Array.isArray(alias) ? alias : [alias];
      if (aliases.length > 1 && new Set(aliases.map(item => item.id)).size > 1) throw new Error(`Mixed range variable ${field} on ${original.id} requires a separate importer.`);
      const variable = coreVariables.get(aliases[0]?.id) ?? variables.get(aliases[0]?.id);
      if (variable) node.setBoundVariable(field, variable);
    }
    themeMode(node, original);
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') node.description = original.description ?? '';
  }
  for (const original of sourceNodes.values()) if (original.type === 'COMPONENT') {
    const component = figma.createComponent();
    nodes.set(original.id, component);
    createdNodeIds.push(component.id);
  }
  const done = new Set();
  const building = new Set();
  async function build(original, parent) {
    if (done.has(original.id)) {
      const node = nodes.get(original.id);
      if (node.parent !== parent) parent.appendChild(node);
      return node;
    }
    if (building.has(original.id)) throw new Error(`Circular component dependency ${original.id}.`);
    building.add(original.id);
    let node = nodes.get(original.id);
    if (original.type === 'COMPONENT_SET') {
      const variants = [];
      for (const child of original.children ?? []) variants.push(await build(child, parent));
      node = figma.combineAsVariants(variants, parent);
    } else if (original.type === 'INSTANCE') {
      const mainOriginal = sourceNodes.get(original.mainComponentId);
      if (!done.has(mainOriginal.id)) await build(mainOriginal, page);
      const main = nodes.get(mainOriginal.id);
      node = main.createInstance();
    } else if (!node) {
      const factory = { FRAME: 'createFrame', GROUP: 'createFrame', TEXT: 'createText', RECTANGLE: 'createRectangle', ELLIPSE: 'createEllipse', LINE: 'createLine', VECTOR: 'createVector', POLYGON: 'createPolygon', STAR: 'createStar' }[original.type];
      node = figma[factory]();
    }
    if (!nodes.has(original.id)) createdNodeIds.push(node.id);
    nodes.set(original.id, node);
    if (node.type === 'TEXT') {
      await figma.loadFontAsync(node.fontName);
      const font = original.properties.fontName ?? original.segments?.[0]?.fontName;
      if (font) { await figma.loadFontAsync(font); node.fontName = font; }
    }
    parent.appendChild(node);
    await apply(node, original);
    if (!['INSTANCE', 'COMPONENT_SET'].includes(original.type)) for (const child of original.children ?? []) await build(child, node);
    const definitions = original.componentPropertyDefinitions ?? {};
    for (const [name, definition] of Object.entries(definitions)) {
      if (definition.type === 'VARIANT') { propertyNames.set(name, name); continue; }
      const defaultValue = definition.type === 'INSTANCE_SWAP' ? nodes.get(definition.defaultValue)?.id : definition.defaultValue;
      if (defaultValue === undefined) throw new Error(`Unresolved component property ${name}.`);
      propertyNames.set(name, node.addComponentProperty(name.split('#')[0], definition.type, defaultValue));
    }
    // Finish the master layout before an instance can inherit its sizing.
    restoreSizing(node, original);
    building.delete(original.id);
    done.add(original.id);
    return node;
  }
  for (const original of scene.nodes) await build(original, page);
  function patchInstance(node, original) {
    if (original.componentProperties) {
      const values = Object.fromEntries(Object.entries(original.componentProperties).map(([name, property]) => [propertyNames.get(name) ?? name, property.type === 'INSTANCE_SWAP' ? nodes.get(property.value)?.id ?? property.value : property.value]));
      node.setProperties(values);
    }
  }
  for (const original of sourceNodes.values()) {
    const node = nodes.get(original.id);
    if (!node) continue;
    if (original.type === 'INSTANCE') patchInstance(node, original);
    if (original.properties.componentPropertyReferences) node.componentPropertyReferences = Object.fromEntries(Object.entries(original.properties.componentPropertyReferences).map(([key, name]) => [key, propertyNames.get(name) ?? name]));
    restoreSizing(node, original);
  }
  // Preserve variable bindings in native nested instances without detaching them.
  async function applyInstanceChildren(node, original) {
    for (const [index, child] of (original.children ?? []).entries()) {
      const masterId = nodes.get(child.id.split(';').at(-1))?.id;
      const matchingName = node.children?.filter(candidate => candidate.name === child.name && candidate.type === child.type) ?? [];
      const indexed = node.children?.[index];
      const target = node.children?.find(candidate => masterId && candidate.id.endsWith(`;${masterId}`))
        ?? (matchingName.length === 1 ? matchingName[0] : undefined)
        ?? (indexed?.type === child.type && indexed?.name === child.name ? indexed : undefined);
      if (!target) throw new Error(`Instance child ${child.id} is missing.`);
      await apply(target, child, true);
      createdNodeIds.push(target.id);
      if (child.type === 'INSTANCE') patchInstance(target, child);
      if (child.children) await applyInstanceChildren(target, child);
    }
  }
  for (const original of sourceNodes.values()) if (original.type === 'INSTANCE' && nodes.has(original.id)) await applyInstanceChildren(nodes.get(original.id), original);
  const modernToFlat = new Map(Object.entries(themeCollections.Modern.variables).map(([role, variable]) => [variable.id, themeCollections.Flat.variables[role]]));
  function flatValue(value) {
    if (Array.isArray(value)) return value.map(flatValue);
    if (!value || typeof value !== 'object') return value;
    if (value.type === 'VARIABLE_ALIAS' && modernToFlat.has(value.id)) return { type: 'VARIABLE_ALIAS', id: modernToFlat.get(value.id).id };
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, flatValue(child)]));
  }
  let flatVariants = 0;
  for (const original of sourceNodes.values()) if (original.type === 'COMPONENT_SET') {
    const set = nodes.get(original.id);
    const originals = [...set.children];
    const flatOffset = set.width + 32;
    for (const component of originals) {
      component.name = `${component.name}, Appearance=Modern`;
      const flat = component.clone();
      set.appendChild(flat);
      flat.name = flat.name.replace('Appearance=Modern', 'Appearance=Flat');
      const isLight = /Theme=Light(?:,|$)/i.test(flat.name);
      flat.setExplicitVariableModeForCollection(themeCollections.Flat.collection, isLight ? themeCollections.Flat.lightModeId : themeCollections.Flat.darkModeId);
      const descendants = [flat, ...flat.findAll()];
      for (const child of descendants) {
        createdNodeIds.push(child.id);
        if ('effects' in child) child.effects = [];
        for (const property of ['fills', 'strokes']) if (property in child && Array.isArray(child[property])) {
          child[property] = child[property].map(paint => {
            const mapped = flatValue(paint);
            if (!paint.type.startsWith('GRADIENT')) return mapped;
            const stop = mapped.gradientStops[0];
            return { type: 'SOLID', color: { r: stop.color.r, g: stop.color.g, b: stop.color.b }, opacity: mapped.opacity ?? stop.color.a ?? 1, ...(stop.boundVariables ? { boundVariables: stop.boundVariables } : {}) };
          });
        }
        for (const [field, alias] of Object.entries(child.boundVariables ?? {})) {
          if (alias && !Array.isArray(alias) && modernToFlat.has(alias.id)) child.setBoundVariable(field, modernToFlat.get(alias.id));
        }
      }
      flat.x = component.x + flatOffset;
      flat.y = component.y;
      flatVariants++;
    }
    const right = Math.max(...set.children.map(child => child.x + child.width));
    const bottom = Math.max(...set.children.map(child => child.y + child.height));
    set.resize(right + 24, bottom + 24);
  }
  refineImportedPresentation(page);
  page.selection = [];
  return { pageId: page.id, pageName, createdNodeIds: [...new Set(createdNodeIds)], createdVariableIds, createdCollectionIds, createdStyleIds, inventory: { ...inventory, flatVariants }, coreCollections: Object.fromEntries(Object.entries(themeCollections).map(([name, item]) => [name, { id: item.collection.id, darkModeId: item.darkModeId, lightModeId: item.lightModeId }])) };
}
