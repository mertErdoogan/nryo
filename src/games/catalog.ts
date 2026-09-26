import type { GameEntry, GameModule } from '../platform/types';
import { GAME_METAS } from './metas';

const thumbnails = import.meta.glob<string>('./*/thumb.svg', { eager: true, query: '?url', import: 'default' });
const loaders = import.meta.glob<{ default: GameModule }>('./*/index.tsx');

function folderOf(path: string): string {
  return path.split('/')[1] ?? '';
}

const thumbById = new Map(Object.entries(thumbnails).map(([p, url]) => [folderOf(p), url]));
const loaderById = new Map(Object.entries(loaders).map(([p, load]) => [folderOf(p), load]));

/** The full catalog: static metadata plus a lazy loader for the playable code. */
export const GAMES: readonly GameEntry[] = GAME_METAS.map((meta) => {
  const load = loaderById.get(meta.id);
  if (!load) throw new Error(`Game "${meta.id}" is missing index.tsx`);
  return {
    ...meta,
    thumbnail: thumbById.get(meta.id) ?? '',
    load: () => load().then((m) => m.default),
  };
});

const byId = new Map(GAMES.map((g) => [g.id, g]));

export function getGame(id: string): GameEntry | undefined {
  return byId.get(id);
}
