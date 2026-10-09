'use client';
import { useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { versionFromPath } from '@/lib/versions.mjs';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { staticClient } from 'fumadocs-core/search/client/orama-static';
import { SearchDialog, SearchDialogClose, SearchDialogContent, SearchDialogHeader, SearchDialogIcon, SearchDialogInput, SearchDialogList, SearchDialogOverlay, type SharedProps } from 'fumadocs-ui/components/dialog/search';

export default function DocumentSearch(props: SharedProps) {
  const [attempt, setAttempt] = useState(0);
  const version = versionFromPath(usePathname());
  const endpoint = version === '0.1.5' ? '/api/search-0.1.5' : '/api/search';
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const dependencies = useMemo(() => [attempt, version], [attempt, version]);
  const client = useMemo(() => staticClient({ from: attempt ? `${endpoint}?retry=${attempt}` : endpoint }), [attempt, endpoint]);
  const { search, setSearch, query } = useDocsSearch({ client }, dependencies);
  return <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
    <SearchDialogOverlay />
    <SearchDialogContent onOpenAutoFocus={() => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }} onCloseAutoFocus={event => {
      if (opener.current?.isConnected) {
        event.preventDefault();
        opener.current.focus({ preventScroll: true });
      }
    }}>
      <SearchDialogHeader><SearchDialogIcon /><SearchDialogInput ref={input} /><SearchDialogClose>Close</SearchDialogClose></SearchDialogHeader>
      {query.error && !query.isLoading ? <div className="search-error" role="alert">
        <p>Search could not load. Try again or use the guide navigation.</p>
        <button type="button" onClick={() => { setAttempt(value => value + 1); input.current?.focus(); }}>Retry search</button>
      </div> : null}
      <SearchDialogList items={!query.error && query.data !== 'empty' ? query.data : null} />
    </SearchDialogContent>
  </SearchDialog>;
}
