import { useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  Stat,
  StatBar,
  TimerBar,
  createContinueGate,
  useGameLoop,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { GameProps } from '../../platform/types';
import { comboMultiplier, pointsFor, ROUND_SECONDS, spawnInterval, visibleFor, type Hole } from './logic';
import styles from './WhackAttack.module.css';

const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
const LETTERS = ['KeyQ', 'KeyW', 'KeyE', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC'];

interface Pop {
  id: number;
  hole: number;
  text: string;
  bad: boolean;
}

export function WhackAttack({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const roundTime = ROUND_SECONDS + 3 * lo.level('time');
  const goldenChance = 0.07 + 0.03 * lo.level('golden');
  const bombPenalty = lo.level('armor') > 0 ? 1 : 2;
  const continueGate = useRef(createContinueGate(api)).current;
  const [banner, setBanner] = useState<{ key: number; text: string } | null>(null);
  const g = useRef({
    holes: Array.from({ length: 9 }, (): Hole => ({ kind: null, ttl: 0, hitAge: -1 })),
    elapsed: 0,
    remaining: roundTime,
    waiting: false,
    spawnTimer: 0.6,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    over: false,
  }).current;
  const [, setTick] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [shake, setShake] = useState(0);
  const popId = useRef(0);
  const rerender = () => setTick((t) => t + 1);

  const addPop = (hole: number, text: string, bad = false) => {
    const id = ++popId.current;
    setPops((p) => [...p.slice(-6), { id, hole, text, bad }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 650);
  };

  const whack = (index: number) => {
    if (paused || g.over || g.waiting) return;
    const hole = g.holes[index]!;
    if (!hole.kind || hole.hitAge >= 0) {
      g.combo = 0;
      g.misses += 1;
      api.sfx('miss');
      rerender();
      return;
    }
    if (hole.kind === 'bomb') {
      g.score = Math.max(0, g.score + pointsFor('bomb', 0));
      g.remaining = Math.max(0, g.remaining - bombPenalty);
      g.combo = 0;
      addPop(index, `−25 −${bombPenalty}s`, true);
      setShake((s) => s + 1);
      api.sfx('explode');
      api.haptic([50, 30, 50]);
    } else {
      g.combo += 1;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
      g.hits += 1;
      const pts = pointsFor(hole.kind, g.combo);
      g.score += pts;
      addPop(index, `+${pts}`);
      if (hole.kind === 'golden') api.addCoins(1);
      api.sfx(hole.kind === 'golden' ? 'coin' : 'hit');
      api.haptic(15);
    }
    hole.hitAge = 0;
    hole.ttl = 0.25;
    api.setScore(g.score);
    rerender();
  };

  useKeyDown((code) => {
    const i = KEYS.indexOf(code) >= 0 ? KEYS.indexOf(code) : LETTERS.indexOf(code);
    if (i >= 0) whack(i);
    else return false;
  }, !paused);

  useGameLoop((dt) => {
    if (g.over || g.waiting) return;
    g.elapsed += dt;
    g.remaining -= dt;
    let changed = false;
    for (const hole of g.holes) {
      if (!hole.kind) continue;
      hole.ttl -= dt;
      if (hole.hitAge >= 0) hole.hitAge += dt;
      if (hole.ttl <= 0) {
        if (hole.hitAge < 0 && hole.kind !== 'bomb') g.combo = 0; // a mole escaped
        hole.kind = null;
        hole.hitAge = -1;
        changed = true;
      }
    }
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0 && g.remaining > 0.5) {
      g.spawnTimer = spawnInterval(g.elapsed) * rng.range(0.7, 1.2);
      const empty = g.holes.map((h, i) => (h.kind ? -1 : i)).filter((i) => i >= 0);
      const burst = g.elapsed > 15 && rng.chance(0.25) ? 2 : 1;
      for (let n = 0; n < burst && empty.length > 0; n++) {
        const idx = empty.splice(rng.int(0, empty.length - 1), 1)[0]!;
        const roll = rng.next();
        const bombChance = Math.min(0.24, 0.1 + g.elapsed * 0.004);
        g.holes[idx] = {
          kind: roll < bombChance ? 'bomb' : roll < bombChance + goldenChance ? 'golden' : 'mole',
          ttl: visibleFor(g.elapsed) * (roll < bombChance ? 1.3 : 1),
          hitAge: -1,
        };
        changed = true;
      }
    }
    if (g.remaining <= 0) {
      g.waiting = true;
      g.remaining = 0;
      for (const hole of g.holes) hole.kind = null;
      continueGate(
        () => {
          g.remaining = 10;
          g.waiting = false;
          setBanner({ key: Date.now(), text: '+10 seconds' });
          rerender();
        },
        () => {
          g.over = true;
          const accuracy = g.hits + g.misses > 0 ? Math.round((g.hits / (g.hits + g.misses)) * 100) : 0;
          api.gameOver({
            score: g.score,
            stats: [
              { label: 'Whacks', value: String(g.hits) },
              { label: 'Best combo', value: String(g.bestCombo) },
              { label: 'Accuracy', value: `${accuracy}%` },
            ],
          });
        },
      );
      changed = true;
    }
    // Throttle re-renders for the timer bar to ~10 fps unless holes changed.
    if (changed || Math.floor(g.elapsed * 10) !== Math.floor((g.elapsed - dt) * 10)) rerender();
  }, !paused);

  const mult = comboMultiplier(g.combo);

  return (
    <DomStage>
      <StatBar>
        <Stat label="Time" value={`${Math.ceil(g.remaining)}s`} tone={g.remaining < 8 ? 'warn' : undefined} />
        <Stat label="Combo" value={g.combo} />
        <Stat label="Multiplier" value={`×${mult}`} tone={mult > 1 ? 'good' : undefined} />
      </StatBar>
      <TimerBar ratio={Math.min(1, g.remaining / roundTime)} label="Time remaining" />
      <div className={styles.grid} data-shake={shake > 0} key={`grid-${shake}`}>
        {g.holes.map((hole, i) => {
          const cls = [
            styles.hole,
            hole.kind && styles.up,
            hole.hitAge >= 0 && styles.hit,
            hole.kind === 'golden' && styles.golden,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={i}
              type="button"
              className={cls}
              aria-label={hole.kind ? `Hole ${i + 1}: ${hole.kind}` : `Hole ${i + 1}: empty`}
              onPointerDown={(e) => {
                e.preventDefault();
                whack(i);
              }}
            >
              <span className={styles.key} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.window}>
                <span className={styles.critter}>
                  {hole.kind === 'bomb' ? (
                    <span className={styles.bomb} />
                  ) : (
                    <span className={styles.mole}>
                      <span className={styles.eye} />
                      <span className={styles.eye} />
                      <span className={styles.nose} />
                    </span>
                  )}
                </span>
              </span>
              {pops
                .filter((p) => p.hole === i)
                .map((p) => (
                  <span key={p.id} className={styles.pop} data-bad={p.bad}>
                    {p.text}
                  </span>
                ))}
            </button>
          );
        })}
      </div>
      {banner && <Banner key={banner.key} text={banner.text} />}
    </DomStage>
  );
}
