import type { CSSProperties } from 'react';
import { useReducer, useRef, useState } from 'react';
import { Banner, DomStage, Stat, StatBar, createContinueGate, useGameLoop, useSeededRng } from '../../engine';
import type { GameProps } from '../../platform/types';
import styles from './BurgerRush.module.css';

type Ing = 'bunB' | 'patty' | 'cheese' | 'lettuce' | 'tomato' | 'onion' | 'bunT';
const TOPPINGS: Ing[] = ['cheese', 'lettuce', 'tomato', 'onion'];
const LABELS: Record<Ing, string> = {
  bunB: 'Bottom bun',
  patty: 'Patty',
  cheese: 'Cheese',
  lettuce: 'Lettuce',
  tomato: 'Tomato',
  onion: 'Onion',
  bunT: 'Top bun',
};
const FACES = ['🙂', '😀', '🤠', '🧑‍🍳', '👩', '👨', '🧒', '👵', '🧔', '👱', '🐻', '🤖'];

interface Customer {
  id: number;
  face: string;
  order: Ing[];
  patience: number;
  max: number;
}
interface Grill {
  t: number;
}

const Stack = ({ items, mini }: { items: Ing[]; mini?: boolean }) => (
  <div className={`${styles.stack} ${mini ? styles.mini : ''}`}>
    {items.map((k, i) => (
      <div key={i} className={styles.layer} data-k={k} />
    ))}
  </div>
);

export function BurgerRush({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const [accent, counter] = lo.skin.colors;
  const cookTime = 4 * Math.pow(0.85, lo.level('grill'));
  const burnAfter = cookTime + 5;
  const grillSlots = 2 + lo.level('slot');
  const patienceMul = 1 + 0.15 * lo.level('patience');
  const tipMul = 1 + 0.2 * lo.level('tips');
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const continueGate = useRef(createContinueGate(api)).current;
  const g = useRef({
    customers: [null, null, null] as (Customer | null)[],
    grill: [] as Grill[],
    plate: [] as Ing[],
    nextId: 1,
    spawnT: 0.5,
    time: 0,
    hearts: 3,
    served: 0,
    score: 0,
    tipsTotal: 0,
    over: false,
    waiting: false,
    lastDraw: 0,
  }).current;

  const makeOrder = (): Ing[] => {
    const diff = Math.min(1, g.time / 180);
    const patties = rng.chance(0.2 + diff * 0.4) ? 2 : 1;
    const nTop = rng.int(0, 1 + Math.round(diff * 2));
    const mid: Ing[] = [];
    for (let i = 0; i < patties; i++) mid.push('patty');
    for (let i = 0; i < nTop; i++) mid.splice(rng.int(0, mid.length), 0, rng.pick(TOPPINGS));
    return ['bunB', ...mid, 'bunT'];
  };

  const loseHeart = (why: string) => {
    g.hearts -= 1;
    setBanner({ key: Date.now(), text: why });
    api.sfx('miss');
    api.haptic(40);
    if (g.hearts <= 0 && !g.waiting) {
      g.waiting = true;
      api.sfx('gameover');
      continueGate(
        () => {
          g.waiting = false;
          g.hearts = 2;
          for (const c of g.customers) if (c) c.patience = c.max;
          setBanner({ key: Date.now(), text: 'Second wind!', sub: '+2 hearts' });
          redraw();
        },
        () => {
          g.over = true;
          api.gameOver({
            score: g.score,
            stats: [
              { label: 'Burgers served', value: String(g.served) },
              { label: 'Tips', value: String(g.tipsTotal) },
            ],
          });
        },
      );
    }
  };

  useGameLoop((dt) => {
    if (g.over || g.waiting) return;
    g.time += dt;
    // customers
    g.spawnT -= dt;
    const free = g.customers.findIndex((c) => c === null);
    if (g.spawnT <= 0 && free >= 0) {
      const order = makeOrder();
      const max = (14 + order.length * 3.2) * patienceMul * Math.max(0.6, 1 - g.time / 400);
      g.customers[free] = { id: g.nextId++, face: rng.pick(FACES), order, patience: max, max };
      g.spawnT = Math.max(2.5, 7 - g.time / 40) * rng.range(0.7, 1.2);
      api.sfx('tick');
    }
    g.customers.forEach((c, i) => {
      if (!c) return;
      c.patience -= dt;
      if (c.patience <= 0) {
        g.customers[i] = null;
        loseHeart('A customer walked out!');
      }
    });
    for (const p of g.grill) p.t += dt;
    g.lastDraw += dt;
    if (g.lastDraw > 0.1) {
      g.lastDraw = 0;
      redraw();
    }
  }, !paused);

  const addToPlate = (k: Ing) => {
    if (paused || g.over || g.waiting) return;
    if (g.plate.length >= 9) return;
    g.plate.push(k);
    api.sfx('tap');
    redraw();
  };

  const grillPatty = () => {
    if (paused || g.over || g.waiting || g.grill.length >= grillSlots) {
      api.sfx('error');
      return;
    }
    g.grill.push({ t: 0 });
    api.sfx('swap');
    redraw();
  };

  const takePatty = (i: number) => {
    const p = g.grill[i]!;
    if (p.t < cookTime) {
      api.sfx('error');
      return;
    }
    g.grill.splice(i, 1);
    if (p.t > burnAfter) {
      api.sfx('miss');
      setBanner({ key: Date.now(), text: 'Burnt! Binned it.' });
    } else addToPlate('patty');
    redraw();
  };

  const serve = (i: number) => {
    const c = g.customers[i];
    if (!c || g.plate.length === 0 || paused || g.over || g.waiting) return;
    const ok = c.order.length === g.plate.length && c.order.every((k, j) => g.plate[j] === k);
    g.customers[i] = null;
    g.plate = [];
    if (ok) {
      const moodPct = c.patience / c.max;
      const base = 20 + c.order.length * 10;
      const tip = Math.round(base * moodPct * tipMul);
      g.score += base + tip;
      g.tipsTotal += tip;
      g.served += 1;
      api.setScore(g.score);
      if (moodPct > 0.6) api.addCoins(1);
      if (g.served % 5 === 0) api.addCoins(2);
      setBanner({
        key: Date.now(),
        text: moodPct > 0.6 ? 'Perfect service!' : 'Order up!',
        sub: `+${base} · tip ${tip}`,
      });
      api.sfx(moodPct > 0.6 ? 'perfect' : 'coin');
    } else loseHeart('Wrong order!');
    redraw();
  };

  const trash = () => {
    if (g.plate.length === 0) return;
    g.plate = [];
    api.sfx('click');
    redraw();
  };

  const matchesPrefix = (c: Customer) => g.plate.length > 0 && g.plate.every((k, j) => c.order[j] === k);
  const style = { '--counter': counter, '--accent': accent } as CSSProperties;

  return (
    <DomStage style={style}>
      <StatBar>
        <Stat label="Served" value={g.served} />
        <Stat label="Score" value={g.score} />
        <span className={styles.hearts} aria-label={`${g.hearts} hearts`}>
          {'❤️'.repeat(Math.max(0, g.hearts))}
          {'🖤'.repeat(Math.max(0, 3 - g.hearts))}
        </span>
      </StatBar>
      <div className={styles.shop}>
        <div className={styles.counter}>
          {g.customers.map((c, i) => {
            if (!c)
              return (
                <div key={`e${i}`} className={styles.customer} data-empty="true">
                  <span className={styles.face}>🪑</span>
                </div>
              );
            const pct = c.patience / c.max;
            return (
              <button
                key={c.id}
                type="button"
                className={styles.customer}
                data-ready={matchesPrefix(c) && g.plate.length === c.order.length}
                onClick={() => serve(i)}
                aria-label={`Serve customer ${i + 1}: ${c.order.map((k) => LABELS[k]).join(', ')}`}
              >
                <span className={styles.face}>{pct < 0.25 ? '😤' : pct < 0.5 ? '😐' : c.face}</span>
                <div className={styles.patience}>
                  <span
                    style={{
                      width: `${pct * 100}%`,
                      background: pct < 0.25 ? '#ef4444' : pct < 0.5 ? '#f59e0b' : '#22c55e',
                    }}
                  />
                </div>
                <Stack items={c.order} mini />
              </button>
            );
          })}
        </div>
        <div className={styles.plate} aria-label="Your burger">
          <Stack items={g.plate} />
        </div>
        <div className={styles.grill} aria-label="Grill">
          {Array.from({ length: grillSlots }, (_, i) => {
            const p = g.grill[i];
            const state = !p ? 'empty' : p.t < cookTime ? 'raw' : p.t > burnAfter ? 'burnt' : 'ready';
            return (
              <button
                key={i}
                type="button"
                className={styles.patty}
                data-state={state}
                onClick={() => (p ? takePatty(i) : grillPatty())}
              >
                {state === 'empty' ? '＋' : state === 'raw' ? '🥩' : state === 'ready' ? '🍖' : '🔥'}
                {p && (
                  <small>
                    <i
                      style={{
                        width: `${Math.min(100, (p.t / (state === 'raw' ? cookTime : burnAfter)) * 100)}%`,
                        background: state === 'raw' ? '#fbbf24' : state === 'ready' ? '#22c55e' : '#ef4444',
                      }}
                    />
                  </small>
                )}
              </button>
            );
          })}
        </div>
        <div className={styles.pantry}>
          {(['bunB', 'bunT', 'cheese', 'lettuce', 'tomato', 'onion'] as Ing[]).map((k) => (
            <button key={k} type="button" className={styles.ing} onClick={() => addToPlate(k)}>
              <div className={`${styles.stack} ${styles.mini}`}>
                <div className={styles.layer} data-k={k} />
              </div>
              <span>{LABELS[k]}</span>
            </button>
          ))}
          <button type="button" className={styles.ing} onClick={grillPatty}>
            🥩<span>Grill patty</span>
          </button>
          <button type="button" className={styles.ing} onClick={trash}>
            🗑️<span>Bin plate</span>
          </button>
        </div>
      </div>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
