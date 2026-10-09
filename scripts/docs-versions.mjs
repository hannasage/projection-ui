import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function legacyDocuments(archiveDirectory) {
  const directory = archiveDirectory instanceof URL ? fileURLToPath(archiveDirectory) : archiveDirectory;
  const archive = JSON.parse(readFileSync(join(directory, 'archive.json'), 'utf8'));
  assert.equal(archive.version, '0.1.5');
  for (const file of archive.files) {
    const bytes = readFileSync(join(directory, 'sources', file.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Legacy source changed: ${file.path}`);
  }
  const manifest = JSON.parse(readFileSync(join(directory, 'sources/package.json'), 'utf8'));
  assert.equal(manifest.version, archive.version);
  const readme = readFileSync(join(directory, 'sources/README.md'), 'utf8');
  const sections = new Map([...readme.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(match => [match[1], match[2].trim().replace(/\n---\s*$/, '')]));
  const take = name => {
    assert.ok(sections.has(name), `Missing original README section: ${name}`);
    return sections.get(name);
  };
  const source = `https://github.com/hannasage/projection-ui/blob/${archive.gitHead}`;
  const records = [
    { slug: 'index', title: 'Projection UI 0.1.5', mdx: `This archive documents the published stable version. Its reference and examples come from the original release source.\n\nInstall the stable version with:\n\n\`\`\`bash\nnpm install @hannasage/projection-ui@0.1.5\n\`\`\`\n\nRead the [installation guide](/docs/0.1.5/installation/), [theme guide](/docs/0.1.5/theming/), [component reference](/docs/0.1.5/components/), and [original examples](/docs/0.1.5/examples/).\n\nRead the [complete original README](/archives/0.1.5/sources/README.md) or the [release source](${archive.source}).\n\nThe current alpha documentation lives at [/docs/](/docs/).` },
    { slug: 'installation', title: 'Installation', mdx: take('Installation').replace('npm install @hannasage/projection-ui\n', 'npm install @hannasage/projection-ui@0.1.5\n') },
    { slug: 'theming', title: 'Theming', mdx: `## Quick start\n\n${take('Quick start')}\n\n## Dynamic theming\n\n${take('Dynamic theming')}` },
    { slug: 'components', title: 'Component reference', mdx: `${take('Component reference')}\n\n## Source reference\n\nRead the [original exports](${source}/src/components/index.ts) and [theme types](${source}/src/theme.ts).` },
    { slug: 'toasts', title: 'Toast usage', mdx: take('Toast usage') },
    { slug: 'examples', title: 'Original examples', mdx: `These links open the original React examples. They do not run the current alpha components.\n\n${archive.files.filter(file => file.path.endsWith('.stories.tsx')).map(file => `- [${file.path.replace('stories/', '')}](${source}/${file.path})`).join('\n')}\n\nDownload the [archived source manifest](/archives/0.1.5/archive.json).` },
  ];
  return records.map(record => ({ ...record, markdown: `# ${record.title}\n\n${record.mdx}\n` }));
}
