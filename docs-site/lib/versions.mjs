export const docsVersions = [
  { id: 'current', label: '0.2.0', status: 'Alpha', baseUrl: '/docs' },
  { id: '0.1.5', label: '0.1.5', status: 'Stable', baseUrl: '/docs/0.1.5' },
];

export function editionForPackage(version) {
  const line = /^(\d+\.\d+)\.\d+(?:-[\da-z.-]+)?$/i.exec(version)?.[1];
  const edition = docsVersions.find(item => item.id === 'current' && item.label.startsWith(`${line}.`));
  if (!edition) throw new Error(`No current docs edition for package ${version}`);
  return edition;
}

export function versionFromPath(pathname) {
  return pathname === '/docs/0.1.5' || pathname.startsWith('/docs/0.1.5/') ? '0.1.5' : 'current';
}

export function versionDestination(pathname, target, pages) {
  const current = docsVersions.find(version => version.id === versionFromPath(pathname));
  const destination = docsVersions.find(version => version.id === target) ?? docsVersions[0];
  const slug = pathname.slice(current.baseUrl.length).replace(/^\/+|\/+$/g, '');
  const retained = pages[destination.id]?.includes(slug) ? slug : '';
  return `${destination.baseUrl}/${retained ? retained + '/' : ''}`;
}
