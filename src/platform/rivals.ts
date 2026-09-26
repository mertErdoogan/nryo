import { hashString } from '../lib/rng';
import type { GameMeta } from './types';

export interface LeaderboardEntry {
  name: string;
  score: number;
  isPlayer: boolean;
}

const BOT_NAMES = [
  'NovaFox', 'PixelPete', 'Zippy', 'ByteBandit', 'LunaLoop', 'TurboTia', 'QuasarQ', 'MangoMax',
  'EchoEmi', 'Glitchy', 'RookRiley', 'BlazeBo', 'Sprocket', 'KikoKat', 'VexVolt', 'OrbitOli',
  'DashDee', 'Mochi', 'NimbusNia', 'JinxJett', 'PogoPia', 'ComboKai', 'FizzFinn', 'ArcadeAce',
];

type RivalMeta = Pick<GameMeta, 'id' | 'medals' | 'score'>;

/** Position on the medal scale: 0 = bronze, 1 = silver, 2 = gold. Bots spread around it. */
const BOT_POSITIONS = [-1.2, -0.7, -0.25, 0.2, 0.7, 1.2, 1.7, 2.2, 2.9];

function valueAt(meta: RivalMeta, t: number): number {
  const { bronze, silver, gold } = meta.medals;
  if (t <= 0) {
    // Below bronze: shrink towards zero (or grow, when lower is better).
    return meta.score.lowerIsBetter ? bronze * (1 - t * 0.35) : bronze * (1 + t * 0.4);
  }
  if (t <= 1) return bronze + (silver - bronze) * t;
  if (t <= 2) return silver + (gold - silver) * (t - 1);
  const over = gold + (gold - silver) * (t - 2);
  return meta.score.lowerIsBetter ? Math.max(gold * 0.55, over) : over;
}

/**
 * A deterministic board of clearly-labelled AI rivals for a game, with the
 * player's best merged in. It gives every game a "beat the next name" target
 * without needing a server — and without pretending the bots are people.
 */
export function getLeaderboard(meta: RivalMeta, playerBest: number | null, playerName: string): LeaderboardEntry[] {
  const seed = hashString(meta.id);
  const names = [...BOT_NAMES]
    .map((n, i) => ({ n, k: hashString(`${n}:${seed}:${i}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, BOT_POSITIONS.length)
    .map((x) => x.n);

  const precise = meta.score.format === 'time' || meta.score.format === 'ms';
  const bots: LeaderboardEntry[] = BOT_POSITIONS.map((t, i) => {
    const jitter = 1 + (((hashString(`${meta.id}:${i}`) % 1000) / 1000) * 0.1 - 0.05);
    const raw = Math.max(1, valueAt(meta, t) * jitter);
    return { name: names[i]!, score: precise ? Math.round(raw) : Math.max(1, Math.round(raw)), isPlayer: false };
  });
  const entries = playerBest === null ? bots : [...bots, { name: playerName, score: playerBest, isPlayer: true }];
  return entries.sort((a, b) => (meta.score.lowerIsBetter ? a.score - b.score : b.score - a.score));
}

/** The closest bot ahead of the player, if any. */
export function nextRival(board: LeaderboardEntry[]): LeaderboardEntry | null {
  const idx = board.findIndex((e) => e.isPlayer);
  if (idx === -1) return board[board.length - 1] ?? null;
  return idx > 0 ? board[idx - 1]! : null;
}
