import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  Hint,
  PowerChip,
  Stat,
  StatBar,
  TimerBar,
  createContinueGate,
  useCountdown,
  useSeededRng,
} from '../../engine';
import type { GameProps } from '../../platform/types';
import { deal, layoutForLevel, levelBonusSeconds, matchPoints, type Card } from './logic';
import styles from './MemoryMatch.module.css';

const START_SECONDS = 60;

export function MemoryMatch({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const [level, setLevel] = useState(1);
  const [cards, setCards] = useState<Card[]>(() => deal(1, rng));
  const [open, setOpen] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [preview, setPreview] = useState(true);
  const [transition, setTransition] = useState(false);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const stats = useRef({ score: 0, combo: 0, bestCombo: 0, matches: 0, flips: 0, over: false });
  const lo = api.loadout;
  const startTime = START_SECONDS + 5 * lo.level('time');
  const [peeks, setPeeks] = useState(lo.level('peek'));
  const [busy, setBusy] = useState(false);
  const continueGate = useRef(createContinueGate(api)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const finish = () => {
    if (stats.current.over) return;
    stats.current.over = true;
    const s = stats.current;
    continueGate(
      () => {
        s.over = false;
        clock.reset(20);
        setBanner({ key: Date.now(), text: '+20 seconds' });
      },
      () =>
        api.gameOver({
          score: s.score,
          stats: [
            { label: 'Boards', value: String(level - 1) },
            { label: 'Pairs', value: String(s.matches) },
            { label: 'Best streak', value: String(s.bestCombo) },
          ],
        }),
    );
  };

  const clock = useCountdown(startTime, !paused && !preview && !transition && !busy, finish);

  // Preview: show all cards briefly at the start of each board.
  useEffect(() => {
    if (!preview) return;
    const t = setTimeout(() => setPreview(false), level === 1 ? 1600 : 1100);
    return () => clearTimeout(t);
  }, [preview, level]);

  const flip = (index: number) => {
    if (paused || preview || transition || stats.current.over) return;
    const card = cards[index]!;
    if (card.matched || open.includes(index)) return;
    stats.current.flips += 1;
    api.sfx('tap');
    if (open.length === 0 || open.length === 2) {
      setWrong([]);
      setOpen([index]);
      return;
    }
    const first = open[0]!;
    const pair = [first, index];
    setOpen(pair);
    const s = stats.current;
    if (cards[first]!.symbol === card.symbol) {
      s.combo += 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      s.matches += 1;
      s.score += matchPoints(s.combo);
      api.setScore(s.score);
      api.sfx(s.combo >= 3 ? 'perfect' : 'score');
      const next = cards.map((c, i) => (i === first || i === index ? { ...c, matched: true } : c));
      setCards(next);
      setOpen([]);
      if (next.every((c) => c.matched)) {
        const bonusTime = levelBonusSeconds(level);
        const timeBonus = Math.round(clock.remaining * 5);
        s.score += 200 * level + timeBonus;
        api.setScore(s.score);
        api.addCoins(1 + Math.floor(level / 3));
        clock.add(bonusTime);
        setTransition(true);
        setBanner({
          key: Date.now(),
          text: `Board ${level} clear!`,
          sub: `+${200 * level + timeBonus} pts · +${bonusTime}s`,
        });
        api.sfx('win');
        later(() => {
          const nextLevel = level + 1;
          setLevel(nextLevel);
          setCards(deal(nextLevel, rng));
          setPreview(true);
          setTransition(false);
        }, 1400);
      }
    } else {
      s.combo = 0;
      setWrong(pair);
      api.sfx('miss');
      later(() => {
        setOpen((o) => (o.length === 2 && o[0] === first && o[1] === index ? [] : o));
        setWrong([]);
      }, 750);
    }
  };

  /** Flip every card face-up for a moment. */
  const peek = async () => {
    if (preview || transition || busy || stats.current.over) return;
    if (peeks > 0) setPeeks((n) => n - 1);
    else {
      setBusy(true);
      const ok = await api.watchAd('A peek at the cards');
      setBusy(false);
      if (!ok) return;
    }
    setOpen([]);
    setPreview(true);
  };

  const { cols, rows } = layoutForLevel(level);
  const style = { '--cols': cols, '--rows': rows } as CSSProperties;

  return (
    <DomStage>
      <StatBar>
        <Stat label="Board" value={level} />
        <Stat
          label="Time"
          value={`${Math.ceil(clock.remaining)}s`}
          tone={clock.remaining < 10 ? 'warn' : undefined}
        />
        <Stat
          label="Streak"
          value={stats.current.combo}
          tone={stats.current.combo >= 2 ? 'good' : undefined}
        />
      </StatBar>
      <TimerBar ratio={Math.min(1, clock.remaining / startTime)} label="Time remaining" />
      <div className={styles.board} style={style} role="group" aria-label={`Memory board ${level}`}>
        {cards.map((card, i) => {
          const up = preview || card.matched || open.includes(i);
          return (
            <button
              key={`${level}-${card.id}`}
              type="button"
              className={styles.card}
              data-up={up}
              data-matched={card.matched}
              data-wrong={wrong.includes(i)}
              disabled={card.matched}
              aria-label={up ? `Card ${card.symbol}` : `Hidden card ${i + 1}`}
              onClick={() => flip(i)}
            >
              <span className={`${styles.face} ${styles.back}`} aria-hidden="true" />
              <span className={`${styles.face} ${styles.front}`} aria-hidden="true">
                {card.symbol}
              </span>
            </button>
          );
        })}
      </div>
      <Hint>{preview ? 'Memorise the cards…' : 'Find the pairs'}</Hint>
      <PowerChip
        corner="inline"
        icon="👀"
        label="Peek"
        badge={peeks > 0 ? peeks : 'ad'}
        onClick={() => void peek()}
        disabled={busy || preview || transition}
      />
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
