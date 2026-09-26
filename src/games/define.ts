import type { GameMeta, GameModule } from '../platform/types';

/** Identity helpers that give game authors full type checking. */
export const defineMeta = (meta: GameMeta): GameMeta => meta;

export const defineGame = <S = unknown, P = unknown>(module: GameModule<S, P>): GameModule =>
  module as unknown as GameModule;
