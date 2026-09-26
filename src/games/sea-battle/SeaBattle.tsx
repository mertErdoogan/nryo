import type { CSSProperties } from 'react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Banner, DomStage, Hint, Stat, StatBar, createContinueGate, useSeededRng } from '../../engine';
import type { GameProps } from '../../platform/types';
import { FLEET, N, aiPick, allSunk, fire, halo, isSunk, placeFleet, type Ship, type Shot } from './logic';
import styles from './SeaBattle.module.css';

const LEVELS = [
  { name: 'Cadet', ai: 0, mult: 1 },
  { name: 'Captain', ai: 1, mult: 1.5 },
  { name: 'Admiral', ai: 2, mult: 2.2 },
] as const;

export function SeaBattle({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const [shipColor] = lo.skin.colors;
  const [level, setLevel] = useState<number | null>(null);
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const g = useRef({
    mine: placeFleet(rng),
    enemy: placeFleet(rng),
    myShots: new Map<number, Shot>(),
    aiShots: new Map<number, Shot>(),
    radar: new Set<number>(),
    radars: 1 + lo.level('radar'),
    turn: 'me' as 'me' | 'ai',
    shots: 0,
    started: false,
    over: false,
  }).current;
  const [radarMode, setRadarMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const continueGate = useRef(createContinueGate(api)).current;

  const markSunk = (ship: Ship, map: Map<number, Shot>) => {
    for (const c of ship.cells) map.set(c, 'sunk');
    for (const h of halo(ship)) if (!map.has(h)) map.set(h, 'miss');
  };

  const finish = (won: boolean) => {
    const lv = LEVELS[level ?? 0]!;
    const alive = g.mine.reduce((sum, s) => sum + s.cells.length - s.hits.size, 0);
    if (!won) {
      api.sfx('gameover');
      continueGate(
        () => {
          // Reinforcements: your biggest sunk ship is repaired.
          const sunk = g.mine.filter(isSunk).sort((a, b) => b.cells.length - a.cells.length)[0];
          if (sunk) {
            sunk.hits.clear();
            for (const c of sunk.cells) g.aiShots.delete(c);
          }
          g.turn = 'me';
          setBanner({ key: Date.now(), text: 'Reinforcements arrived!', sub: 'One ship repaired' });
          redraw();
        },
        () => {
          g.over = true;
          const sunkEnemy = g.enemy.filter(isSunk).length;
          api.gameOver({
            score: sunkEnemy * 100,
            won: false,
            stats: [{ label: 'Ships sunk', value: `${sunkEnemy}/5` }],
          });
        },
      );
      return;
    }
    g.over = true;
    const score = Math.round((1000 + Math.max(0, 100 - g.shots) * 8 + alive * 20) * lv.mult);
    api.sfx('win');
    api.gameOver({
      score,
      won: true,
      stats: [
        { label: 'Shots fired', value: String(g.shots) },
        { label: 'Accuracy', value: `${Math.round((17 / Math.max(17, g.shots)) * 100)}%` },
        { label: 'Level', value: lv.name },
      ],
    });
  };

  // bot turn
  useEffect(() => {
    if (level === null || g.turn !== 'ai' || paused || g.over) return;
    const t = setTimeout(() => {
      const remaining = g.mine.filter((s) => !isSunk(s)).map((s) => s.cells.length);
      const cell = aiPick(g.aiShots, remaining, LEVELS[level]!.ai, rng);
      const result = fire(g.mine, cell);
      g.aiShots.set(cell, result);
      if (result === 'sunk') {
        markSunk(
          g.mine.find((s) => s.cells.includes(cell))!,
          g.aiShots,
        );
        api.sfx('explode');
        api.haptic([60, 30, 60]);
      } else api.sfx(result === 'hit' ? 'hit' : 'miss');
      if (allSunk(g.mine)) finish(false);
      else if (result === 'miss') g.turn = 'me';
      redraw();
    }, 650);
    return () => clearTimeout(t);
  });

  const shoot = (cell: number) => {
    if (paused || g.turn !== 'me' || g.over || level === null) return;
    if (radarMode) {
      const x = cell % N;
      const y = Math.floor(cell / N);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (x + dx >= 0 && y + dy >= 0 && x + dx < N && y + dy < N) g.radar.add((y + dy) * N + x + dx);
      g.radars = Math.max(0, g.radars - 1);
      setRadarMode(false);
      api.sfx('powerup');
      redraw();
      return;
    }
    if (g.myShots.has(cell)) return;
    g.started = true;
    g.shots += 1;
    const result = fire(g.enemy, cell);
    g.myShots.set(cell, result);
    if (result === 'sunk') {
      markSunk(
        g.enemy.find((s) => s.cells.includes(cell))!,
        g.myShots,
      );
      setBanner({ key: Date.now(), text: 'Ship sunk!' });
      api.sfx('explode');
      api.addCoins(1);
      api.setScore(g.enemy.filter(isSunk).length * 100);
    } else api.sfx(result === 'hit' ? 'hit' : 'miss');
    if (allSunk(g.enemy)) finish(true);
    else if (result === 'miss') g.turn = 'ai';
    redraw();
  };

  const radarClick = async () => {
    if (g.turn !== 'me' || busy) return;
    if (radarMode) {
      setRadarMode(false);
      return;
    }
    if (g.radars > 0) {
      setRadarMode(true);
      return;
    }
    setBusy(true);
    const ok = await api.watchAd('A radar scan');
    setBusy(false);
    if (ok) {
      g.radars += 1;
      setRadarMode(true);
    }
  };

  const shuffle = () => {
    if (g.started) return;
    g.mine = placeFleet(rng);
    api.sfx('swap');
    redraw();
  };

  if (level === null)
    return (
      <DomStage center>
        <div className={styles.picker}>
          <h2 style={{ textAlign: 'center' }}>Choose your opponent</h2>
          {LEVELS.map((l, i) => (
            <button key={l.name} type="button" className={styles.pick} onClick={() => setLevel(i)}>
              {l.name} (bot) <span>{['Fires at random', 'Hunts in a pattern', 'Calculates odds'][i]}</span>
            </button>
          ))}
        </div>
      </DomStage>
    );

  const enemyAlive = g.enemy.filter((s) => !isSunk(s)).length;
  const mineAlive = g.mine.filter((s) => !isSunk(s)).length;
  const style = { '--ship': shipColor } as CSSProperties;

  return (
    <DomStage style={style}>
      <StatBar>
        <Stat label="Enemy ships" value={enemyAlive} />
        <Stat label="Your ships" value={mineAlive} tone={mineAlive <= 2 ? 'warn' : undefined} />
        <Stat
          label="Turn"
          value={g.turn === 'me' ? 'Fire!' : 'Bot…'}
          tone={g.turn === 'me' ? 'good' : undefined}
        />
      </StatBar>
      <div className={styles.layout}>
        <span className={styles.label}>Enemy waters</span>
        <div className={`${styles.grid} ${styles.enemy}`} role="grid" aria-label="Enemy grid">
          {Array.from({ length: N * N }, (_, c) => {
            const st = g.myShots.get(c);
            const radarShip = g.radar.has(c) && !st && g.enemy.some((s) => s.cells.includes(c));
            return (
              <button
                key={c}
                type="button"
                className={styles.cell}
                data-state={st}
                data-radar={g.radar.has(c) && !st}
                data-radarship={radarShip}
                aria-label={`${String.fromCharCode(65 + (c % N))}${Math.floor(c / N) + 1}${st ? `: ${st}` : ''}`}
                onClick={() => shoot(c)}
              />
            );
          })}
        </div>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            aria-pressed={radarMode}
            onClick={() => void radarClick()}
            disabled={busy || g.turn !== 'me'}
          >
            📡 Radar <small>{g.radars > 0 ? g.radars : 'ad'}</small>
          </button>
          {!g.started && (
            <button type="button" className={styles.tool} onClick={shuffle}>
              🔀 Move my ships
            </button>
          )}
        </div>
        <span className={styles.label}>Your fleet</span>
        <div className={`${styles.grid} ${styles.small}`} aria-label="Your grid">
          {Array.from({ length: N * N }, (_, c) => (
            <span
              key={c}
              className={styles.cell}
              data-ship={g.mine.some((s) => s.cells.includes(c))}
              data-state={g.aiShots.get(c)}
            />
          ))}
        </div>
        <Hint>
          {radarMode
            ? 'Tap the enemy grid to scan a 3×3 area.'
            : `Fleet: ${FLEET.join(', ')} · Opponent is a bot.`}
        </Hint>
      </div>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
