/**
 * Central domain model for the platform. Games, services and UI all speak in
 * these types; persisted shapes are validated against schemas in the services.
 */
import type { ComponentType } from 'react';
import type { ScoreFormat } from '../lib/format';

export type GameCategory =
  | 'hyper-casual'
  | 'arcade'
  | 'action'
  | 'racing'
  | 'puzzle'
  | 'brain'
  | 'word'
  | 'memory'
  | 'strategy'
  | 'reflex'
  | 'physics'
  | 'endless'
  | 'versus';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Orientation = 'portrait' | 'landscape' | 'any';

/** 0 = none, 1 = bronze, 2 = silver, 3 = gold. */
export type MedalTier = 0 | 1 | 2 | 3;

export interface MedalThresholds {
  bronze: number;
  silver: number;
  gold: number;
}

export interface ScoreConfig {
  /** What the number means, e.g. "Blocks", "Distance", "Avg. reaction". */
  label: string;
  format: ScoreFormat;
  /** True for times/strokes where a smaller score is better. */
  lowerIsBetter?: boolean;
}

export interface GameControls {
  /** Keyboard (and mouse) description for desktop. */
  desktop: string;
  /** Touch description for phones and tablets. */
  touch: string;
}

export interface GameTheme {
  /** Card gradient start/end. */
  from: string;
  to: string;
  /** Highlight used inside the game UI. */
  accent: string;
}

/**
 * Static, lightweight game description. Every game ships one in `meta.ts`.
 * The catalog loads all metas eagerly (they are tiny); the playable code is
 * loaded lazily only when the game is opened.
 */
export interface GameMeta {
  /** URL slug and storage namespace. Kebab-case, unique, never change once shipped. */
  id: string;
  title: string;
  /** Short hook shown on cards (≤ 60 chars). */
  tagline: string;
  /** One or two sentences for the game page and SEO. */
  description: string;
  /** 1–3 bullet points shown on the ready screen. */
  howToPlay: string[];
  /** First entry is the primary category. */
  categories: GameCategory[];
  tags: string[];
  difficulty: Difficulty;
  controls: GameControls;
  score: ScoreConfig;
  medals: MedalThresholds;
  theme: GameTheme;
  /** Typical round length, e.g. "30s", "1–3 min". */
  sessionLength: string;
  orientation: Orientation;
  /** True if the game stores unfinished rounds that can be continued later. */
  resumable?: boolean;
  /** Real-time games auto-pause when the tab is hidden or the window loses focus. */
  realtime: boolean;
  /** Whether the game may be chosen as a daily challenge (default true). */
  dailyEligible?: boolean;
  /** Curated base popularity 0–100 used by the ranking model. */
  popularity: number;
  /** Release date YYYY-MM-DD (drives the "New" filter). */
  addedAt: string;
}

/** A catalog entry: meta plus resolved assets and a lazy loader. */
export interface GameEntry extends GameMeta {
  thumbnail: string;
  load: () => Promise<GameModule>;
}

export type PlayMode = 'normal' | 'daily';

export interface ResultStat {
  label: string;
  value: string;
}

export interface GameResult {
  score: number;
  /** For games with a win condition (solved puzzle, beat the AI…). */
  won?: boolean;
  /** Extra lines for the results screen, e.g. accuracy, max combo. */
  stats?: ResultStat[];
}

export interface SaveSummary {
  /** Human readable, e.g. "Hole 4 of 9 · 12 strokes". */
  label: string;
  /** 0–1 completion estimate for the progress bar. */
  progress: number;
}

/** Envelope for an unfinished round, stored per game. */
export interface GameSaveState<T = unknown> {
  gameId: string;
  version: number;
  updatedAt: number;
  summary: SaveSummary;
  data: T;
}

export type SoundName =
  | 'click'
  | 'tap'
  | 'score'
  | 'coin'
  | 'hit'
  | 'miss'
  | 'jump'
  | 'shoot'
  | 'explode'
  | 'powerup'
  | 'perfect'
  | 'gameover'
  | 'win'
  | 'levelup'
  | 'achievement'
  | 'tick'
  | 'swap'
  | 'error';

/** The API a game receives from the platform shell. */
export interface GameApi<S = unknown, P = unknown> {
  readonly meta: GameMeta;
  readonly mode: PlayMode;
  /** Deterministic in daily mode; random otherwise. */
  readonly seed: number;
  /** Daily challenge target, when playing the daily challenge. */
  readonly target: number | null;
  /** Personal best before this round started. */
  readonly best: number | null;
  /** Saved unfinished round to continue from, if the player chose "Continue". */
  readonly resume: S | null;
  /** Long-lived per-game data (unlocked levels, ghosts, idle progress…). */
  readonly progress: P | null;
  setScore(score: number): void;
  /** Ends the round. Only the first call per round is honoured. */
  gameOver(result: GameResult): void;
  save(data: S, summary: SaveSummary): void;
  clearSave(): void;
  saveProgress(data: P): void;
  sfx(name: SoundName): void;
  haptic(pattern: number | number[]): void;
}

export interface GameProps<S = unknown, P = unknown> {
  api: GameApi<S, P>;
  /** True while the pause overlay is shown. Loops and timers must stop. */
  paused: boolean;
}

export interface VersionedSpec<T> {
  version: number;
  is(value: unknown): value is T;
  /** Upgrade older data; return null to discard it. */
  migrate?(fromVersion: number, data: unknown): T | null;
}

/** What a game's lazily-loaded `index.tsx` default-exports. */
export interface GameModule<S = unknown, P = unknown> {
  Component: ComponentType<GameProps<S, P>>;
  save?: VersionedSpec<S>;
  progress?: VersionedSpec<P>;
}

export interface GameStats {
  plays: number;
  best: number | null;
  last: number | null;
  /** Sum of all round scores (points-based games only). */
  totalScore: number;
  wins: number;
  medal: MedalTier;
  firstPlayedAt: number;
  lastPlayedAt: number;
  timePlayedMs: number;
}

export interface RecentEntry {
  id: string;
  at: number;
}

export interface FavoriteEntry {
  id: string;
  at: number;
}

export interface PlayerState {
  /** Anonymous local identity. Not an account — just a namespace for local data. */
  id: string;
  createdAt: number;
  nickname: string;
  avatar: string;
  accent: string;
  xp: number;
  rounds: number;
  totalPoints: number;
  wins: number;
  /** Number of times a personal best was improved. */
  recordsBroken: number;
  daysPlayed: number;
  lastDay: string | null;
}

export interface Settings {
  sound: boolean;
  volume: number;
  haptics: boolean;
  motion: 'system' | 'reduce' | 'full';
}

export interface DailyChallenge {
  date: string;
  gameId: string;
  target: number;
  seed: number;
}

export interface DailyRecord {
  gameId: string;
  target: number;
  best: number | null;
  attempts: number;
  completedAt: number | null;
}

export interface DailyState {
  records: Record<string, DailyRecord>;
  streak: number;
  bestStreak: number;
  lastCompleted: string | null;
  totalCompleted: number;
}

export interface ProgressSnapshot {
  player: PlayerState;
  level: number;
  stats: Record<string, GameStats>;
  favorites: number;
  daily: DailyState;
  games: readonly GameMeta[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
  /** Hidden achievements show "???" until unlocked. */
  secret?: boolean;
  check(snapshot: ProgressSnapshot): boolean;
  /** Optional progress for the UI: [current, goal]. */
  progress?(snapshot: ProgressSnapshot): [number, number];
}

export interface XpLine {
  label: string;
  xp: number;
}

export interface RoundOutcome {
  gameId: string;
  mode: PlayMode;
  score: number;
  won: boolean;
  stats: ResultStat[];
  previousBest: number | null;
  best: number;
  isNewBest: boolean;
  medal: MedalTier;
  newMedal: MedalTier;
  xp: XpLine[];
  xpTotal: number;
  levelBefore: number;
  levelAfter: number;
  achievements: Achievement[];
  daily: { target: number; completed: boolean; firstCompletion: boolean; streak: number } | null;
}

export type AnalyticsEventName =
  | 'app_opened'
  | 'game_viewed'
  | 'game_started'
  | 'game_resumed'
  | 'game_completed'
  | 'game_restarted'
  | 'game_abandoned'
  | 'game_crashed'
  | 'game_favorited'
  | 'game_unfavorited'
  | 'achievement_unlocked'
  | 'level_up'
  | 'daily_challenge_started'
  | 'daily_challenge_completed'
  | 'search_performed'
  | 'recommendation_clicked'
  | 'progress_exported'
  | 'progress_imported'
  | 'progress_reset';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  at: number;
  props: AnalyticsProps;
}
