import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { THEME_PRESETS, PROJECTION_FLAT_THEME, COASTAL_DAY_FLAT_THEME, UI_FOUNDATIONS, RADIUS_SCALE } from '../src/foundations.ts';
import { validateScene } from '../design-package/importer.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path));
const hash = content => createHash('sha256').update(content).digest('hex');

export function requiresDesignPackage(version, previous, visualChange, explicitMinor = false) {
  const parse = value => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/.exec(value);
    if (!match) throw new Error(`Invalid release version ${value}.`);
    return { major: +match[1], minor: +match[2], patch: +match[3], prerelease: match[4] };
  };
  const current = parse(version);
  const prior = parse(previous);
  if (!visualChange) return false;
  if (current.major === 0) return current.minor > prior.minor || (current.minor === prior.minor && current.patch === prior.patch && current.prerelease !== prior.prerelease);
  return current.major > prior.major || (explicitMinor && current.minor > prior.minor);
}

const categoriesForContract = {
  Card: ['Cards'], Badge: ['Badges'], Button: ['Buttons'], ButtonGroup: ['Buttons'], Input: ['Inputs'], Select: ['Selects'], Textarea: ['Text Areas'], Toggle: ['Toggles'], Slider: ['Sliders'], Modal: ['Dialogs / Modals'], Skeleton: ['Spinner Loaders'], Toast: ['Toasts'], ToastContainer: ['Toasts'], DataTable: ['Tables'], AreaChart: ['Charts & Data Viz'], BarChart: ['Charts & Data Viz'], LineChart: ['Charts & Data Viz'], DonutChart: ['Charts & Data Viz'], Container: ['Grids & Bento'], Stack: ['Grids & Bento'], Prose: ['Lists'], LinkButton: ['Links'], Separator: [], VisuallyHidden: [], ProjectionGlow: [], Avatar: ['Avatars'], Checkbox: ['Checkboxes'], RadioGroup: ['Radio Groups'], Tabs: ['Tabs'], Accordion: ['Accordions'], Alert: ['Alerts'], Notification: ['Notifications'], Progress: ['Progress'], Spinner: ['Spinner Loaders'], Tooltip: ['Tooltips'], Carousel: ['Carousels'], Surface: ['Cards'], GradientBackground: [], GradientText: [], ThemeProvider: [], Sortable: [],
};

export function createDesignManifest(scene) {
  const pkg = json('package.json');
  const contracts = json('docs/component-contracts.json');
  const sets = [];
  function visit(node) {
    if (node.type === 'COMPONENT_SET') sets.push({ name: node.name, sourceNodeId: node.id, variants: (node.children ?? []).map(child => child.name) });
    for (const child of node.children ?? []) visit(child);
  }
  scene.nodes.forEach(visit);
  const categoryLabel = name => name.split('/').slice(1).join('/').trim() || name;
  const categories = sets.map(set => ({ ...set, label: categoryLabel(set.name), generatedVariants: set.variants.flatMap(name => [`${name}, Appearance=Modern`, `${name}, Appearance=Flat`]) }));
  const normalize = value => value.toLowerCase().replace(/[^a-z\d]/g, '');
  const runtimeContracts = Object.entries(contracts).map(([name, [required, optional]]) => ({
    name, required, optional,
    designCategories: categories.filter(category => (categoriesForContract[name] ?? []).some(label => normalize(category.label) === normalize(label) || normalize(category.label).endsWith(normalize(label)))).map(category => category.name),
  }));
  return {
    schemaVersion: 1, name: 'Projection UI editable design kit', version: pkg.version, license: pkg.license,
    design: { format: 'Figma development plugin', source: scene.source, sceneSha256: hash(JSON.stringify(scene)), staticOnly: true },
    tokens: { themes: { dark: THEME_PRESETS.projection, light: THEME_PRESETS['coastal-day'], darkFlat: PROJECTION_FLAT_THEME, lightFlat: COASTAL_DAY_FLAT_THEME }, foundations: UI_FOUNDATIONS, radius: RADIUS_SCALE },
    coverage: { claim: 'Editable design mockups. React behavior and property parity are not implied.', categories, runtimeWithoutDesignCategory: runtimeContracts.filter(item => item.designCategories.length === 0).map(item => item.name) },
    runtimeContracts,
    releaseCadence: { alpha: 'Include a matching design kit with every minor visual release and each visual prerelease revision.', production: 'Include a matching design kit with every major visual release. Include one with a minor visual release when that release specifies it.' },
    fonts: ['Syne', 'IBM Plex Sans', 'IBM Plex Mono'],
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  const names = new Set();
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!file.name || file.name.startsWith('/') || file.name.includes('\\') || file.name.split('/').some(part => !part || part === '..') || names.has(file.name)) throw new Error('Use a unique relative archive path.');
    names.add(file.name);
    const name = Buffer.from(file.name);
    const data = Buffer.from(file.data);
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(8, 10); entry.writeUInt16LE(33, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(compressed.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export function buildDesignPackage(outputDirectory = resolve(root, 'release-artifacts')) {
  const scene = json('design-package/figma-scene.json');
  const inventory = validateScene(scene);
  const manifest = createDesignManifest(scene);
  const importer = read('design-package/importer.mjs').toString().replace(/^export /gm, '');
  const code = `${importer}\nconst scene = ${JSON.stringify(scene)};\nconst tokens = ${JSON.stringify(manifest.tokens)};\nimportProjectionDesign(figma, scene, tokens, ${JSON.stringify(manifest.version)}).then(result => figma.closePlugin(\`Imported \${result.inventory.sets} editable component sets.\`)).catch(error => figma.closePlugin(error.message));\n`;
  const pluginManifest = { name: `Projection UI ${manifest.version} editable kit`, api: '1.0.0', main: 'code.js', editorType: ['figma'], documentAccess: 'dynamic-page', networkAccess: { allowedDomains: ['none'] } };
  const files = [
    { name: 'README.md', data: read('design-package/README.md') },
    { name: 'LICENSE', data: read('LICENSE') },
    { name: 'design-manifest.json', data: JSON.stringify(manifest, null, 2) },
    { name: 'tokens.json', data: JSON.stringify(manifest.tokens, null, 2) },
    { name: 'source/figma-scene.json', data: JSON.stringify(scene) },
    { name: 'plugin/manifest.template.json', data: JSON.stringify(pluginManifest, null, 2) },
    { name: 'plugin/code.js', data: code },
  ];
  const archive = createZip(files);
  mkdirSync(outputDirectory, { recursive: true });
  const filename = `projection-ui-design-${manifest.version}.zip`;
  writeFileSync(resolve(outputDirectory, filename), archive);
  const metadata = { version: manifest.version, filename, bytes: archive.length, sha256: hash(archive), inventory, sceneSha256: manifest.design.sceneSha256 };
  writeFileSync(resolve(outputDirectory, 'design-package.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--out' || !args[1])) throw new Error('Use node scripts/build-design-package.mjs [--out DIRECTORY].');
  console.log(JSON.stringify(buildDesignPackage(args[1] ? resolve(args[1]) : undefined)));
}
