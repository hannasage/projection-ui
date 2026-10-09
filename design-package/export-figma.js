// Read-only source export. Run through use_figma with the two required skills.
const page = await figma.getNodeByIdAsync('54:2');
if (!page || page.type !== 'PAGE') throw new Error('The approved Components page is unavailable.');
await figma.setCurrentPageAsync(page);
const fields = [
  'x', 'y', 'width', 'height', 'rotation', 'visible', 'locked', 'opacity', 'blendMode',
  'fills', 'strokes', 'strokeWeight', 'strokeAlign', 'dashPattern', 'effects',
  'cornerRadius', 'cornerSmoothing', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
  'layoutMode', 'layoutWrap', 'primaryAxisSizingMode', 'counterAxisSizingMode',
  'primaryAxisAlignItems', 'counterAxisAlignItems', 'counterAxisAlignContent',
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing', 'counterAxisSpacing',
  'layoutAlign', 'layoutGrow', 'layoutPositioning', 'layoutSizingHorizontal', 'layoutSizingVertical',
  'clipsContent', 'constraints', 'vectorPaths', 'arcData', 'pointCount', 'innerRadius',
  'characters', 'fontName', 'fontSize', 'fontWeight', 'textAlignHorizontal', 'textAlignVertical',
  'textAutoResize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'paragraphIndent',
  'textCase', 'textDecoration', 'textStyleId', 'fillStyleId', 'strokeStyleId', 'effectStyleId',
  'boundVariables', 'explicitVariableModes', 'componentPropertyReferences',
];
function plain(value) {
  if (typeof value === 'symbol' || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
async function readNode(node) {
  const item = { id: node.id, type: node.type, name: node.name, properties: {} };
  for (const key of fields) {
    if (!(key in node)) continue;
    const value = plain(node[key]);
    if (value !== undefined) item.properties[key] = value;
  }
  if (node.type === 'TEXT') {
    item.segments = node.getStyledTextSegments(['fontName', 'fontSize', 'fills', 'lineHeight', 'letterSpacing', 'textCase', 'textDecoration']);
  }
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') item.description = node.description;
  if (node.type === 'COMPONENT_SET' || (node.type === 'COMPONENT' && node.parent?.type !== 'COMPONENT_SET')) {
    item.componentPropertyDefinitions = plain(node.componentPropertyDefinitions);
  }
  if (node.type === 'INSTANCE') {
    const main = await node.getMainComponentAsync();
    item.mainComponentId = main?.id;
    item.componentProperties = plain(node.componentProperties);
  }
  if ('children' in node) item.children = await Promise.all(node.children.map(readNode));
  return item;
}
const collections = (await figma.variables.getLocalVariableCollectionsAsync()).map(collection => ({
  id: collection.id, name: collection.name, modes: plain(collection.modes),
  defaultModeId: collection.defaultModeId, hiddenFromPublishing: collection.hiddenFromPublishing,
}));
const variables = (await figma.variables.getLocalVariablesAsync()).map(variable => ({
  id: variable.id, name: variable.name, variableCollectionId: variable.variableCollectionId,
  resolvedType: variable.resolvedType, scopes: plain(variable.scopes), codeSyntax: plain(variable.codeSyntax),
  description: variable.description, hiddenFromPublishing: variable.hiddenFromPublishing,
  valuesByMode: plain(variable.valuesByMode),
}));
const styles = [];
for (const style of [...await figma.getLocalTextStylesAsync(), ...await figma.getLocalPaintStylesAsync(), ...await figma.getLocalEffectStylesAsync()]) {
  const item = { id: style.id, type: style.type, name: style.name, description: style.description, properties: {} };
  for (const key of ['fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'paragraphIndent', 'textCase', 'textDecoration', 'paints', 'effects']) {
    if (key in style) item.properties[key] = plain(style[key]);
  }
  styles.push(item);
}
const snapshot = { schemaVersion: 1, source: { fileKey: figma.fileKey, pageId: page.id, pageName: page.name }, collections, variables, styles, nodes: await Promise.all(page.children.map(readNode)) };
const serialized = JSON.stringify(snapshot);
// The caller prepends the existing lz-string implementation for transport only.
const compressed = LZString.compressToBase64(serialized);
const chunkSize = 16000;
const chunkIndex = 0;
return { source: snapshot.source, collections: collections.length, variables: variables.length, styles: styles.length, bytes: serialized.length, compressedBytes: compressed.length, chunkIndex, chunks: Math.ceil(compressed.length / chunkSize), data: compressed.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize) };
