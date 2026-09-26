import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  Hint,
  PowerChip,
  Stat,
  StatBar,
  createContinueGate,
  useSeededRng,
} from '../../engine';
import type { GameProps } from '../../platform/types';
import { gridSizeFor, pickTiles, showTime, tilesFor } from './logic';
import styles from './GridRecall.module.css';

type Phase = 'show' | 'input' | 'reveal' | 'next';

export function GridRecall({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const [level, setLevel] = useState(1);
  const [targets, setTargets] = useState(() => pickTiles(1, rng));
  const [found, setFound] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>('show');
  const lo = api.loadout;
  const [lives, setLives] = useState(3 + lo.level('lives'));
  const peekTime = 1 + 0.15 * lo.level('focus');
  const [peeks, setPeeks] = useState(lo.level('peek'));
  const [busy, setBusy] = useState(false);
  const continueGate = useRef(createContinueGate(api)).current;
  const [banner, setBanner] = useState<{ key: number; text: string } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const over = useRef(false);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Show the pattern, then hide it (restarts after a pause).
  useEffect(() => {
    if (phase !== 'show' || paused) return;
    const t = setTimeout(() => setPhase('input'), showTime(targets.size) * peekTime);
    return () => clearTimeout(t);
  }, [phase, paused, targets, peekTime]);

  const startLevel = (lv: number) => {
    setLevel(lv);
    setTargets(pickTiles(lv, rng));
    setFound(new Set());
    setWrong(new Set());
    setPhase('show');
  };

  const tap = (i: number) => {
    if (paused || phase !== 'input' || over.current || found.has(i) || wrong.has(i)) return;
    if (targets.has(i)) {
      const next = new Set(found).add(i);
      setFound(next);
      api.sfx('tap');
      if (next.size === targets.size) {
        api.setScore(level);
        if (level % 3 === 0) api.addCoins(1);
        api.sfx('score');
        setPhase('next');
        setBanner({ key: Date.now(), text: `Level ${level + 1}` });
        later(() => startLevel(level + 1), 900);
      }
      return;
    }
    const w = new Set(wrong).add(i);
    setWrong(w);
    api.sfx('error');
    api.haptic(50);
    if (w.size >= 3) {
      const remaining = lives - 1;
      setLives(remaining);
      setPhase('reveal');
      if (remaining <= 0) {
        over.current = true;
        later(
          () =>
            continueGate(
              () => {
                over.current = false;
                setLives(1);
                startLevel(level);
              },
              () =>
                api.gameOver({
                  score: level - 1,
                  stats: [
                    { label: 'Level reached', value: String(level) },
                    { label: 'Tiles in last level', value: String(targets.size) },
                  ],
                }),
            ),
          1200,
        );
      } else {
        later(() => startLevel(level), 1600);
      }
    }
  };

  /** Flash the pattern once more. */
  const peek = async () => {
    if (phase !== 'input' || busy || over.current) return;
    if (peeks > 0) setPeeks((p) => p - 1);
    else {
      setBusy(true);
      const ok = await api.watchAd('Another look');
      setBusy(false);
      if (!ok) return;
    }
    setPhase('show');
  };

  const n = gridSizeFor(level);
  const style = { '--n': n } as CSSProperties;

  return (
    <DomStage>
      <StatBar>
        <Stat label="Level" value={level} />
        <Stat label="Tiles" value={`${found.size}/${tilesFor(level)}`} />
        <Stat label="Lives" value={<span className={styles.lives}>{'♥'.repeat(lives) || '—'}</span>} />
      </StatBar>
      <div className={styles.grid} style={style} role="group" aria-label={`Level ${level} grid`}>
        {Array.from({ length: n * n }, (_, i) => {
          let state = 'idle';
          if (phase === 'show' && targets.has(i)) state = 'show';
          else if (found.has(i)) state = 'found';
          else if (wrong.has(i)) state = 'wrong';
          else if (phase === 'reveal' && targets.has(i)) state = 'missed';
          return (
            <button
              key={`${level}-${targets.size}-${i}`}
              type="button"
              className={styles.tile}
              data-state={state}
              disabled={phase !== 'input'}
              aria-label={`Tile ${i + 1}`}
              onPointerDown={(e) => {
                e.preventDefault();
                tap(i);
              }}
            />
          );
        })}
      </div>
      <Hint>
        {phase === 'show'
          ? 'Remember the highlighted tiles…'
          : phase === 'input'
            ? `Tap the ${targets.size - found.size} remaining tile${targets.size - found.size === 1 ? '' : 's'}`
            : phase === 'reveal'
              ? lives > 0
                ? `${lives} ${lives === 1 ? 'life' : 'lives'} left — here’s what you missed`
                : 'Out of lives!'
              : 'Nice memory!'}
      </Hint>
      <PowerChip
        corner="inline"
        icon="👀"
        label="Peek again"
        badge={peeks > 0 ? peeks : 'ad'}
        onClick={() => void peek()}
        disabled={busy || phase !== 'input'}
      />
      {banner && phase === 'next' && <Banner key={banner.key} text={banner.text} />}
    </DomStage>
  );
}
