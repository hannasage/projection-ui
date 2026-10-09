import { createFromSource } from 'fumadocs-core/search/server';
import { legacySource } from '@/lib/source';
export const dynamic = 'force-static';
export const { staticGET: GET } = createFromSource(legacySource);
