/** Select a registry channel without authorizing a release or its source line. */
export function releaseChannel(version) {
  if (typeof version !== 'string') throw new Error('Unsupported release version.');
  if (/^0\.1\.(?:0|[1-9]\d*)$/.test(version)) return 'legacy';
  if (/^0\.2\.0-next\.(?:0|[1-9]\d*)$/.test(version)) return 'next';
  if (/^0\.2\.(?:0|[1-9]\d*)$/.test(version)) return 'latest';
  throw new Error(`Unsupported release version ${version}.`);
}
