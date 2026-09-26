import { useState } from 'react';
import { createRng, type Rng } from '../lib/rng';

/** A stable seeded RNG for the lifetime of a game round. */
export function useSeededRng(seed: number): Rng {
  return useState(() => createRng(seed))[0];
}
