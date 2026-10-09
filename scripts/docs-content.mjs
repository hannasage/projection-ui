import { dirname, posix } from 'node:path';

const kebab = value => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
export function transformGuide(content, path, entries) {
  const heading = content.match(/^# (.+)$/m);
  const title = heading?.[1];
  if (!title) throw new Error(`${path} needs a heading`);
  const aliases = new Map([...content.matchAll(/import \* as (\w+) from ['"]([^'"]+)['"]/g)].map(match => [match[1], './' + posix.normalize(posix.join(dirname(path), match[2])) + '.tsx']));
  const slug = path.endsWith('Introduction.mdx') ? 'index' : kebab(path.split('/').pop().replace('.mdx', ''));
  const mdx = content.slice(heading.index + heading[0].length)
    .replace(/<Canvas of=\{(\w+)\.(\w+)\} \/>/g, (_, alias, name) => {
      const story = entries.find(entry => entry.type === 'story' && entry.importPath === aliases.get(alias) && entry.id.split('--')[1] === kebab(name));
      if (!story) throw new Error(`Unresolved example ${alias}.${name} in ${path}`);
      return `<Example id="${story.id}" title="${story.title.split('/').pop()}: ${story.name}" />`;
    }).replace(/href="\.\/\?path=\/docs\/guides-([\w-]+)--docs" target="_top"/g, (_, guide) => `href="/docs/${guide === 'introduction' ? '' : guide}/"`).trim() + '\n';
  return { title, slug, mdx, markdown: `# ${title}\n\n` + plain(mdx) };
}
export function plain(mdx) {
  return mdx.replace(/<Example id="([^"]+)" title="([^"]+)" \/>/g, (_, id, title) => `[${title}](/examples/?path=/story/${id})`)
    .replace(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '[$2]($1)');
}
export function componentDocuments(contracts, entries, manifest) {
  return Object.entries(contracts).map(([name, [required, options]]) => {
    if (typeof required !== 'string' || typeof options !== 'string') throw new Error(`${name} needs required and optional prop contracts`);
    const examples = entries.filter(entry => entry.type === 'story' && entry.title.split('/').pop() === name);
    if (!examples.length) throw new Error(`${name} has no packed example`);
    const peers = ['react','react-dom'].map(peer => {
      const range = manifest?.peerDependencies?.[peer];
      if (!range) throw new Error(`${name} needs the packed ${peer} requirement`);
      return `\`${peer} ${range}\``;
    }).join(', ');
    const names = ['AreaChart','BarChart','LineChart','DonutChart'].includes(name) ? ['recharts','react-is'] : name.startsWith('Sortable') ? ['@dnd-kit/core','@dnd-kit/sortable','@dnd-kit/utilities'] : name === 'ToastContainer' ? ['zustand'] : [];
    const dependencies = names.map(dependency => {
      const range = manifest?.dependencies?.[dependency];
      if (!range) throw new Error(`${name} needs the packed ${dependency} runtime dependency`);
      return `\`${dependency} ${range}\``;
    }).join(', ');
    const runtime = dependencies ? `Package runtime dependencies: ${dependencies}.\nWhen you install Projection UI, npm installs these dependencies automatically.\n` : '';
    const mdx = `## Component contract\n\n| Required props | Options and defaults |\n| --- | --- |\n| ${required} | ${options} |\n\nShared application peers: ${peers}.\nYour application supplies React 19 and React DOM 19.\n${runtime}\n\nRead the [full component reference](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for supported values and interaction behavior.\n\n## Examples\n\n` + examples.map(entry => `<Example id="${entry.id}" title="${name}: ${entry.name}" />`).join('\n\n') + '\n';
    return { title:name, slug:`components/${kebab(name)}`, mdx, markdown:`# ${name}\n\n${plain(mdx)}` };
  });
}
