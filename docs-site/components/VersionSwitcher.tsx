'use client';
import { usePathname, useRouter } from 'next/navigation';
import { docsVersions, versionDestination, versionFromPath } from '@/lib/versions.mjs';

export function VersionSwitcher({ pages }: { pages: Record<string, string[]> }) {
  const pathname = usePathname();
  const router = useRouter();
  return <label className="flex flex-col gap-2 p-3 text-sm">
    Documentation version
    <select aria-label="Documentation version" value={versionFromPath(pathname)}
      className="min-h-11 w-full rounded-md border border-fd-border bg-fd-background px-3 text-fd-foreground"
      onChange={event => router.push(versionDestination(pathname, event.target.value, pages))}>
      {docsVersions.map(version => <option key={version.id} value={version.id}>{version.label}</option>)}
    </select>
  </label>;
}
