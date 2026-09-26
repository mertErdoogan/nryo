import type { Achievement, GameCategory, ProgressSnapshot } from './types';

const playedCount = (s: ProgressSnapshot) => Object.values(s.stats).filter((g) => g.plays > 0).length;
const medalCount = (s: ProgressSnapshot, tier: 1 | 2 | 3) =>
  Object.values(s.stats).filter((g) => g.medal >= tier).length;
const timeHours = (s: ProgressSnapshot) =>
  Object.values(s.stats).reduce((sum, g) => sum + g.timePlayedMs, 0) / 3_600_000;

function gamesIn(s: ProgressSnapshot, cats: GameCategory[]) {
  return s.games.filter((g) => g.categories.some((c) => cats.includes(c)));
}
const medalsIn = (s: ProgressSnapshot, cats: GameCategory[]) =>
  gamesIn(s, cats).filter((g) => (s.stats[g.id]?.medal ?? 0) >= 1).length;
const winsIn = (s: ProgressSnapshot, cats: GameCategory[]) =>
  gamesIn(s, cats).filter((g) => (s.stats[g.id]?.wins ?? 0) >= 1).length;

function categoriesTried(s: ProgressSnapshot): [number, number] {
  const all = new Set(s.games.flatMap((g) => g.categories));
  const tried = new Set(s.games.filter((g) => (s.stats[g.id]?.plays ?? 0) > 0).flatMap((g) => g.categories));
  return [tried.size, all.size];
}

type Def = Omit<Achievement, 'check'> & { goal: number; value: (s: ProgressSnapshot) => number };

const count = (def: Def): Achievement => ({
  id: def.id,
  title: def.title,
  description: def.description,
  icon: def.icon,
  xp: def.xp,
  secret: def.secret,
  check: (s) => def.value(s) >= def.goal,
  progress: (s) => [Math.min(def.goal, def.value(s)), def.goal],
});

const BRAINY: GameCategory[] = ['brain', 'word', 'puzzle', 'memory'];
const ACTION: GameCategory[] = ['action', 'arcade', 'reflex', 'racing'];
const TACTICAL: GameCategory[] = ['strategy', 'versus'];

export const ACHIEVEMENTS: readonly Achievement[] = [
  count({ id: 'first-round', title: 'Press Start', description: 'Finish your first round.', icon: '🎮', xp: 20, goal: 1, value: (s) => s.player.rounds }),
  count({ id: 'rounds-10', title: 'Warming Up', description: 'Play 10 rounds.', icon: '🔁', xp: 30, goal: 10, value: (s) => s.player.rounds }),
  count({ id: 'rounds-50', title: 'Arcade Regular', description: 'Play 50 rounds.', icon: '🕹️', xp: 75, goal: 50, value: (s) => s.player.rounds }),
  count({ id: 'rounds-200', title: 'Arcade Legend', description: 'Play 200 rounds.', icon: '💯', xp: 150, goal: 200, value: (s) => s.player.rounds }),
  count({ id: 'explorer-5', title: 'Explorer', description: 'Try 5 different games.', icon: '🧭', xp: 40, goal: 5, value: playedCount }),
  count({ id: 'explorer-15', title: 'Globetrotter', description: 'Try 15 different games.', icon: '🗺️', xp: 80, goal: 15, value: playedCount }),
  {
    id: 'explorer-all',
    title: 'Completionist',
    description: 'Try every game in the arcade.',
    icon: '🌌',
    xp: 250,
    check: (s) => s.games.length > 0 && playedCount(s) >= s.games.length,
    progress: (s) => [playedCount(s), s.games.length],
  },
  {
    id: 'categories-all',
    title: 'Well Rounded',
    description: 'Play a game from every category.',
    icon: '🌈',
    xp: 100,
    check: (s) => {
      const [tried, all] = categoriesTried(s);
      return all > 0 && tried >= all;
    },
    progress: categoriesTried,
  },
  count({ id: 'record-1', title: 'Personal Best', description: 'Beat one of your own records.', icon: '📈', xp: 30, goal: 1, value: (s) => s.player.recordsBroken }),
  count({ id: 'record-10', title: 'Always Improving', description: 'Beat your own records 10 times.', icon: '🚀', xp: 70, goal: 10, value: (s) => s.player.recordsBroken }),
  count({ id: 'wins-3', title: 'Winner', description: 'Win 3 rounds.', icon: '🏅', xp: 40, goal: 3, value: (s) => s.player.wins }),
  count({ id: 'wins-25', title: 'Champion', description: 'Win 25 rounds.', icon: '🏆', xp: 100, goal: 25, value: (s) => s.player.wins }),
  count({ id: 'medal-1', title: 'On the Podium', description: 'Earn your first medal.', icon: '🥉', xp: 30, goal: 1, value: (s) => medalCount(s, 1) }),
  count({ id: 'silver-3', title: 'Silver Lining', description: 'Earn silver or better in 3 games.', icon: '🥈', xp: 60, goal: 3, value: (s) => medalCount(s, 2) }),
  count({ id: 'gold-1', title: 'Gold Rush', description: 'Earn a gold medal.', icon: '🥇', xp: 60, goal: 1, value: (s) => medalCount(s, 3) }),
  count({ id: 'gold-5', title: 'Golden Touch', description: 'Earn gold in 5 games.', icon: '👑', xp: 120, goal: 5, value: (s) => medalCount(s, 3) }),
  count({ id: 'gold-15', title: 'Hall of Fame', description: 'Earn gold in 15 games.', icon: '💎', xp: 300, goal: 15, value: (s) => medalCount(s, 3) }),
  count({ id: 'brainiac', title: 'Big Brain', description: 'Earn medals in 5 brain, word, puzzle or memory games.', icon: '🧠', xp: 80, goal: 5, value: (s) => medalsIn(s, BRAINY) }),
  count({ id: 'action-hero', title: 'Action Hero', description: 'Earn medals in 5 action, arcade, reflex or racing games.', icon: '💥', xp: 80, goal: 5, value: (s) => medalsIn(s, ACTION) }),
  count({ id: 'tactician', title: 'Tactician', description: 'Win at least once in 3 strategy or versus games.', icon: '♟️', xp: 80, goal: 3, value: (s) => winsIn(s, TACTICAL) }),
  count({ id: 'level-5', title: 'Rising Star', description: 'Reach level 5.', icon: '⭐', xp: 50, goal: 5, value: (s) => s.level }),
  count({ id: 'level-10', title: 'Seasoned Player', description: 'Reach level 10.', icon: '🌟', xp: 100, goal: 10, value: (s) => s.level }),
  count({ id: 'level-20', title: 'Arcade Master', description: 'Reach level 20.', icon: '✨', xp: 200, goal: 20, value: (s) => s.level }),
  count({ id: 'daily-1', title: 'Daily Player', description: 'Complete a daily challenge.', icon: '📅', xp: 50, goal: 1, value: (s) => s.daily.totalCompleted }),
  count({ id: 'daily-streak-3', title: 'Hot Streak', description: 'Complete daily challenges 3 days in a row.', icon: '🔥', xp: 75, goal: 3, value: (s) => s.daily.bestStreak }),
  count({ id: 'daily-streak-7', title: 'Unstoppable', description: 'Keep a 7-day daily challenge streak.', icon: '☄️', xp: 150, goal: 7, value: (s) => s.daily.bestStreak }),
  count({ id: 'daily-10', title: 'Challenge Collector', description: 'Complete 10 daily challenges.', icon: '🗓️', xp: 120, goal: 10, value: (s) => s.daily.totalCompleted }),
  count({ id: 'favorite-1', title: 'Found a Favorite', description: 'Add a game to your favorites.', icon: '❤️', xp: 15, goal: 1, value: (s) => s.favorites }),
  count({ id: 'points-1k', title: 'Point Collector', description: 'Score 1,000 points in total.', icon: '🪙', xp: 25, goal: 1_000, value: (s) => s.player.totalPoints }),
  count({ id: 'points-25k', title: 'High Roller', description: 'Score 25,000 points in total.', icon: '💰', xp: 75, goal: 25_000, value: (s) => s.player.totalPoints }),
  count({ id: 'points-250k', title: 'Jackpot', description: 'Score 250,000 points in total.', icon: '🏦', xp: 150, goal: 250_000, value: (s) => s.player.totalPoints }),
  count({ id: 'days-3', title: 'Regular', description: 'Play on 3 different days.', icon: '☀️', xp: 40, goal: 3, value: (s) => s.player.daysPlayed }),
  count({ id: 'days-10', title: 'Devoted', description: 'Play on 10 different days.', icon: '🌙', xp: 100, goal: 10, value: (s) => s.player.daysPlayed }),
  count({ id: 'hour-1', title: 'In the Zone', description: 'Play for a total of one hour.', icon: '⏱️', xp: 60, goal: 1, value: timeHours }),
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const getAchievement = (id: string) => byId.get(id);

/** Achievements whose condition holds now but that are not yet unlocked. */
export function findNewlyUnlocked(snapshot: ProgressSnapshot, unlocked: Record<string, number>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => unlocked[a.id] === undefined && a.check(snapshot));
}
