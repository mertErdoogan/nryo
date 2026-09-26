import type { GameMeta, GameModule, SkinDef, UpgradeDef } from '../platform/types';

/** Identity helpers that give game authors full type checking. */
export const defineMeta = (meta: GameMeta): GameMeta => meta;

export const defineGame = <S = unknown, P = unknown>(module: GameModule<S, P>): GameModule =>
  module as unknown as GameModule;

/** Shorthand for a shop upgrade. */
export const upgrade = (
  id: string,
  name: string,
  icon: string,
  description: string,
  maxLevel: number,
  baseCost: number,
  growth?: number,
): UpgradeDef => ({ id, name, icon, description, maxLevel, baseCost, ...(growth ? { growth } : {}) });

/** Shorthand for a shop skin: colours are primary, secondary, accent. */
export const skin = (
  id: string,
  name: string,
  price: number,
  colors: [string, string, string],
  extra: Partial<Pick<SkinDef, 'icon' | 'perk' | 'adUnlock'>> = {},
): SkinDef => ({ id, name, price, colors, ...extra });
