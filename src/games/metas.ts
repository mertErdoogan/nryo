import type { GameMeta } from '../platform/types';

/**
 * Every `src/games/<id>/meta.ts` is discovered automatically — adding a game
 * never requires editing a central list. Metas are tiny and loaded eagerly.
 */
const modules = import.meta.glob<{ default: GameMeta }>('./*/meta.ts', { eager: true });

export const GAME_METAS: readonly GameMeta[] = Object.entries(modules)
  .map(([path, mod]) => {
    const folder = path.split('/')[1];
    const meta = mod.default;
    if (meta.id !== folder) {
      throw new Error(`Game meta id "${meta.id}" must match its folder name "${folder}".`);
    }
    return meta;
  })
  .sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id));
