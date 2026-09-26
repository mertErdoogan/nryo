import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DomStage, GameButton, useInterval, useKeyDown } from '../../engine';
import { formatCompact } from '../../lib/format';
import { arr, num, obj, str, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import {
  BUILDINGS,
  buildingMultiplier,
  DESCEND_AT,
  gemBonus,
  gemsForRun,
  GOALS,
  goldPerSecond,
  maxAffordable,
  offlineEarnings,
  priceOf,
  tapPower,
  UPGRADES,
  type EconomyState,
} from './economy';
import styles from './GemMiner.module.css';

const saveSchema = obj({
  gold: num({ min: 0 }),
  runEarned: num({ min: 0 }),
  owned: arr(num({ int: true, min: 0, max: 100_000 }), { max: 20 }),
  upgrades: arr(str({ max: 32 }), { max: 100 }),
  goals: arr(str({ max: 32 }), { max: 100 }),
  clicks: num({ int: true, min: 0 }),
  savedAt: num({ min: 0 }),
});
type Save = Infer<typeof saveSchema>;
const progressSchema = obj({ gems: num({ int: true, min: 0 }), descents: num({ int: true, min: 0 }) });
type Progress = Infer<typeof progressSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };
export const progressSpec: VersionedSpec<Progress> = { version: 1, is: progressSchema.is };

type Tab = 'build' | 'upgrades' | 'goals';

interface State extends EconomyState {
  goals: string[];
}

export function GemMiner({ api, paused }: GameProps<Save, Progress>) {
  const gems = api.progress?.gems ?? 0;
  const descents = api.progress?.descents ?? 0;
  const [state, setState] = useState<State>(() => {
    const r = api.resume;
    return {
      gold: r?.gold ?? 0,
      runEarned: r?.runEarned ?? 0,
      owned: BUILDINGS.map((_, i) => r?.owned[i] ?? 0),
      upgrades: r?.upgrades ?? [],
      goals: r?.goals ?? [],
      clicks: r?.clicks ?? 0,
    };
  });
  const [tab, setTab] = useState<Tab>('build');
  const [amount, setAmount] = useState<1 | 10 | 'max'>(1);
  const [floaters, setFloaters] = useState<{ id: number; x: number; y: number; text: string; lucky: boolean }[]>([]);
  const [welcome, setWelcome] = useState<number | null>(null);
  const floaterId = useRef(0);
  const ended = useRef(false);

  const perSecond = useMemo(() => goldPerSecond(state.owned, state.upgrades, gems), [state.owned, state.upgrades, gems]);
  const power = tapPower(state.upgrades, gems, perSecond);

  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const persist = useCallback(() => {
    if (ended.current) return;
    const s = stateRef.current;
    api.save(
      { ...s, savedAt: Date.now() },
      { label: `${formatCompact(s.gold)} gold · ${formatCompact(goldPerSecond(s.owned, s.upgrades, gems))}/s`, progress: Math.min(1, s.runEarned / DESCEND_AT) },
    );
  }, [api, gems]);

  // Offline earnings on return.
  useEffect(() => {
    const r = api.resume;
    if (!r) return;
    const earned = offlineEarnings(goldPerSecond(r.owned, r.upgrades, gems), Date.now() - r.savedAt);
    if (earned > 0) {
      setState((s) => ({ ...s, gold: s.gold + earned, runEarned: s.runEarned + earned }));
      setWelcome(earned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.setScore(Math.floor(state.runEarned));
  }, [api, state.runEarned]);

  // Production tick.
  useInterval(
    () => {
      if (perSecond <= 0) return;
      setState((s) => ({ ...s, gold: s.gold + perSecond * 0.1, runEarned: s.runEarned + perSecond * 0.1 }));
    },
    paused ? null : 100,
  );
  useInterval(persist, paused ? null : 5000);
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      persist();
    };
  }, [persist]);

  const dig = (x: number, y: number) => {
    if (paused) return;
    const lucky = state.upgrades.includes('lucky') && Math.random() < 0.05;
    const gain = power * (lucky ? 15 : 1);
    setState((s) => ({ ...s, gold: s.gold + gain, runEarned: s.runEarned + gain, clicks: s.clicks + 1 }));
    const id = ++floaterId.current;
    setFloaters((f) => [...f.slice(-8), { id, x, y, text: `${lucky ? 'Lucky! ' : ''}+${formatCompact(gain)}`, lucky }]);
    setTimeout(() => setFloaters((f) => f.filter((fl) => fl.id !== id)), 800);
    api.sfx(lucky ? 'coin' : 'tap');
  };

  const buy = (i: number) => {
    const b = BUILDINGS[i]!;
    const owned = state.owned[i]!;
    const n = amount === 'max' ? Math.max(1, maxAffordable(b, owned, state.gold)) : amount;
    const cost = priceOf(b, owned, n);
    if (cost > state.gold) return;
    setState((s) => ({ ...s, gold: s.gold - cost, owned: s.owned.map((o, k) => (k === i ? o + n : o)) }));
    api.sfx('coin');
  };

  const buyUpgrade = (id: string, cost: number) => {
    if (state.gold < cost || state.upgrades.includes(id)) return;
    setState((s) => ({ ...s, gold: s.gold - cost, upgrades: [...s.upgrades, id] }));
    api.sfx('powerup');
  };

  const claimGoal = (id: string, reward: number) => {
    setState((s) => ({ ...s, gold: s.gold + reward, runEarned: s.runEarned + reward, goals: [...s.goals, id] }));
    api.sfx('win');
  };

  const descend = () => {
    const gained = gemsForRun(state.runEarned);
    if (gained <= 0 || ended.current) return;
    ended.current = true;
    api.saveProgress({ gems: gems + gained, descents: descents + 1 });
    api.gameOver({
      score: Math.floor(state.runEarned),
      won: true,
      stats: [
        { label: 'Gems gained', value: `+${gained} 💎` },
        { label: 'Permanent bonus', value: `+${Math.round((gemBonus(gems + gained) - 1) * 100)}%` },
      ],
    });
  };

  useKeyDown((code) => {
    if (code === 'Space' || code === 'Enter') dig(50, 40);
    else return false;
  }, !paused);

  const visibleUpgrades = UPGRADES.filter((u) => !state.upgrades.includes(u.id) && u.visible(state)).sort((a, b) => a.cost - b.cost);
  const claimable = GOALS.filter((g) => !state.goals.includes(g.id) && (() => { const [c, t] = g.progress(state, perSecond); return c >= t; })());
  const gemsNow = gemsForRun(state.runEarned);

  return (
    <DomStage>
      <div className={styles.top}>
        <span className={styles.gold} aria-live="off">
          🪙 {formatCompact(Math.floor(state.gold))}
        </span>
        <span className={styles.rate}>
          {formatCompact(perSecond)} gold/s · {formatCompact(power)} per tap
        </span>
        {(gems > 0 || descents > 0) && (
          <span className={styles.gems}>
            💎 {gems} gems · +{Math.round((gemBonus(gems) - 1) * 100)}% bonus
          </span>
        )}
      </div>
      <div className={styles.rockWrap}>
        <button
          type="button"
          className={styles.rock}
          aria-label="Dig the rock"
          onPointerDown={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.parentElement!.getBoundingClientRect();
            dig(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
          }}
        />
        {floaters.map((f) => (
          <span key={f.id} className={styles.floater} data-lucky={f.lucky} style={{ left: `${f.x}%`, top: `${f.y}%` }}>
            {f.text}
          </span>
        ))}
      </div>
      {gemsNow > 0 && (
        <button type="button" className={styles.descend} onClick={descend}>
          ⬇️ Descend deeper · +{gemsNow} 💎 (resets this mine)
        </button>
      )}
      <div className={styles.tabs} role="tablist">
        {(
          [
            ['build', 'Crew'],
            ['upgrades', `Upgrades${visibleUpgrades.some((u) => u.cost <= state.gold) ? ' •' : ''}`],
            ['goals', `Goals${claimable.length ? ` (${claimable.length})` : ''}`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" className={styles.tab} aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.list} role="tabpanel">
        {tab === 'build' && (
          <>
            <div className={styles.amounts}>
              {([1, 10, 'max'] as const).map((a) => (
                <button key={a} type="button" className={styles.amount} aria-pressed={amount === a} onClick={() => setAmount(a)}>
                  {a === 'max' ? 'Max' : `×${a}`}
                </button>
              ))}
            </div>
            {BUILDINGS.map((b, i) => {
              const owned = state.owned[i]!;
              const locked = i > 0 && state.owned[i - 1]! === 0 && owned === 0;
              if (locked && i > 1 && state.owned[i - 2]! === 0) return null;
              const n = amount === 'max' ? Math.max(1, maxAffordable(b, owned, state.gold)) : amount;
              const cost = priceOf(b, owned, n);
              const rate = b.rate * buildingMultiplier(i, state.upgrades) * gemBonus(gems);
              return (
                <div key={b.id} className={styles.row}>
                  <span className={styles.icon} aria-hidden="true">
                    {locked ? '❔' : b.icon}
                  </span>
                  <span className={styles.info}>
                    <span className={styles.name}>{locked ? '???' : b.name}</span>
                    <span className={styles.sub}>+{formatCompact(rate)}/s each</span>
                  </span>
                  <span className={styles.owned}>{owned}</span>
                  <button type="button" className={styles.buy} disabled={cost > state.gold} onClick={() => buy(i)}>
                    {n > 1 ? `×${n} ` : ''}🪙{formatCompact(cost)}
                  </button>
                </div>
              );
            })}
          </>
        )}
        {tab === 'upgrades' &&
          (visibleUpgrades.length === 0 ? (
            <p className={styles.sub} style={{ textAlign: 'center', padding: 16 }}>
              Keep digging — new upgrades appear as your mine grows.
            </p>
          ) : (
            visibleUpgrades.map((u) => (
              <div key={u.id} className={styles.row}>
                <span className={styles.icon} aria-hidden="true">
                  {u.icon}
                </span>
                <span className={styles.info}>
                  <span className={styles.name}>{u.name}</span>
                  <span className={styles.sub}>{u.description}</span>
                </span>
                <button type="button" className={styles.buy} disabled={u.cost > state.gold} onClick={() => buyUpgrade(u.id, u.cost)}>
                  🪙{formatCompact(u.cost)}
                </button>
              </div>
            ))
          ))}
        {tab === 'goals' &&
          GOALS.map((g) => {
            const [cur, target] = g.progress(state, perSecond);
            const claimed = state.goals.includes(g.id);
            return (
              <div key={g.id} className={styles.row}>
                <span className={styles.icon} aria-hidden="true">
                  {claimed ? '✅' : '🎯'}
                </span>
                <span className={styles.info}>
                  <span className={styles.name}>{g.label}</span>
                  <span className={styles.sub}>
                    {formatCompact(Math.min(cur, target))} / {formatCompact(target)} · reward 🪙{formatCompact(g.reward)}
                  </span>
                </span>
                {claimed ? (
                  <span className={styles.done}>Done</span>
                ) : (
                  <button type="button" className={styles.buy} disabled={cur < target} onClick={() => claimGoal(g.id, g.reward)}>
                    Claim
                  </button>
                )}
              </div>
            );
          })}
      </div>
      {welcome !== null && (
        <div className={styles.welcome} data-game-overlay>
          <div className={styles.welcomeCard}>
            <span style={{ fontSize: 44 }} aria-hidden="true">
              ⛏️
            </span>
            <strong style={{ fontSize: '1.3rem' }}>Welcome back!</strong>
            <span className={styles.rate}>While you were away your crew dug</span>
            <span className={styles.gold}>🪙 {formatCompact(welcome)}</span>
            <GameButton tone="primary" onClick={() => setWelcome(null)}>
              Collect
            </GameButton>
          </div>
        </div>
      )}
    </DomStage>
  );
}
