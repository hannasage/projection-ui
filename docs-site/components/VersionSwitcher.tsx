'use client';
import { usePathname, useRouter } from 'next/navigation';
import { docsVersions, versionDestination, versionFromPath } from '@/lib/versions.mjs';

export function VersionSwitcher({ pages }: { pages: Record<string, string[]> }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = docsVersions.find(version => version.id === versionFromPath(pathname))!;
  return <label className="flex flex-col gap-2 p-3 text-sm">
    <span className="flex items-center justify-between gap-2">Documentation version
      <span aria-label="Documentation status" className="rounded-full border border-fd-primary/30 bg-fd-primary/10 px-2 py-0.5 text-xs font-medium text-fd-foreground">{current.status}</span>
    </span>
    <select aria-label="Documentation version" value={current.id}
      className="min-h-11 w-full rounded-md border border-fd-border bg-fd-background px-3 text-fd-foreground"
      onChange={event => router.push(versionDestination(pathname, event.target.value, pages))}>
      {docsVersions.map(version => <option key={version.id} value={version.id}>{version.label}</option>)}
    </select>
  </label>;
}
