import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  Stat,
  StatBar,
  TimerBar,
  createContinueGate,
  useCountdown,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { GameProps } from '../../platform/types';
import { isWord } from '../_shared/words';
import { answerWords } from '../_shared/words/pick';
import styles from './AnagramRush.module.css';

const START = 60;

export function AnagramRush({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const [face, edge, ink] = lo.skin.colors;
  const skipCost = Math.max(2, 5 - lo.level('skip'));
  const used = useRef(new Set<string>());
  const [solvedCount, setSolvedCount] = useState(0);

  const pickWord = (n: number) => {
    const len: 5 | 7 = n < 5 ? 5 : n < 10 ? (rng.chance(0.4) ? 7 : 5) : rng.chance(0.7) ? 7 : 5;
    const list = answerWords(len);
    let w = rng.pick(list);
    for (let i = 0; i < 20 && used.current.has(w); i++) w = rng.pick(list);
    used.current.add(w);
    return w;
  };
  const scramble = (w: string) => {
    let s = [...w];
    for (let i = 0; i < 10; i++) {
      s = rng.shuffle(s);
      if (s.join('') !== w) break;
    }
    return s;
  };

  const [word, setWord] = useState(() => pickWord(0));
  const [letters, setLetters] = useState<string[]>(() => scramble(word));
  const [placed, setPlaced] = useState<number[]>([]);
  const [hinted, setHinted] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [freeHints, setFreeHints] = useState(2 * lo.level('hint'));
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState(false);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const stats = useRef({ score: 0, streak: 0, over: false, waiting: false, wordStart: performance.now() });
  const continueGate = useRef(createContinueGate(api)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const timeUp = () => {
    if (stats.current.over || stats.current.waiting) return;
    stats.current.waiting = true;
    api.sfx('gameover');
    continueGate(
      () => {
        stats.current.waiting = false;
        clock.reset(20);
        setBanner({ key: Date.now(), text: '+20 seconds' });
      },
      () => {
        stats.current.over = true;
        api.gameOver({
          score: stats.current.score,
          stats: [
            { label: 'Words', value: String(solvedCount) },
            { label: 'Last word', value: word.toUpperCase() },
          ],
        });
      },
    );
  };
  const clock = useCountdown(START + 10 * lo.level('time'), !paused && !lock && !busy, timeUp);

  const load = (n: number) => {
    const w = pickWord(n);
    setWord(w);
    setLetters(scramble(w));
    setPlaced([]);
    setHinted(0);
    stats.current.wordStart = performance.now();
  };

  const check = (p: number[]) => {
    const attempt = p.map((i) => letters[i]).join('');
    if (attempt === word || (attempt.length === word.length && isWord(attempt))) {
      const s = stats.current;
      s.streak += 1;
      const speed = Math.max(0, 12 - (performance.now() - s.wordStart) / 2000);
      const pts = Math.round(40 + word.length * 15 + speed * 5 + Math.min(10, s.streak) * 5 - hinted * 15);
      s.score += Math.max(10, pts);
      api.setScore(s.score);
      clock.add(word.length + 3);
      setSolvedCount((c) => c + 1);
      if ((solvedCount + 1) % 5 === 0) api.addCoins(2);
      setBanner({
        key: Date.now(),
        text: attempt.toUpperCase(),
        sub: `+${Math.max(10, pts)} · +${word.length + 3}s`,
      });
      api.sfx('score');
      setLock(true);
      timers.current.push(
        setTimeout(() => {
          setLock(false);
          load(solvedCount + 1);
        }, 700),
      );
    } else {
      setWrong(true);
      api.sfx('error');
      timers.current.push(
        setTimeout(() => {
          setWrong(false);
          setPlaced((pl) => pl.slice(0, hinted));
        }, 350),
      );
    }
  };

  const place = (i: number) => {
    if (paused || lock || stats.current.over || stats.current.waiting || placed.includes(i)) return;
    const next = [...placed, i];
    setPlaced(next);
    api.sfx('tap');
    if (next.length === word.length) check(next);
  };
  const unplace = (slot: number) => {
    if (lock || slot < hinted) return;
    setPlaced((p) => p.slice(0, slot));
  };

  const skip = () => {
    if (lock || stats.current.over) return;
    clock.add(-skipCost);
    stats.current.streak = 0;
    setBanner({ key: Date.now(), text: word.toUpperCase(), sub: `Skipped · −${skipCost}s` });
    api.sfx('miss');
    load(solvedCount + 1);
  };

  const applyHint = () => {
    const keep = placed.slice(0, hinted).filter((idx, k) => letters[idx] === word[k]);
    const pos = keep.length;
    const need = word[pos]!;
    const idx = letters.findIndex((l, k) => l === need && !keep.includes(k));
    if (idx < 0) return;
    const next = [...keep, idx];
    setPlaced(next);
    setHinted(next.length);
    api.sfx('powerup');
    if (next.length === word.length) check(next);
  };
  const hintClick = async () => {
    if (lock || busy || hinted >= word.length - 1) return;
    if (freeHints > 0) {
      setFreeHints((h) => h - 1);
      applyHint();
      return;
    }
    setBusy(true);
    const ok = await api.watchAd('A letter hint');
    setBusy(false);
    if (ok) applyHint();
  };

  useKeyDown((code) => {
    const m = /^Key([A-Z])$/.exec(code);
    if (m) {
      const ch = m[1]!.toLowerCase();
      const i = letters.findIndex((l, k) => l === ch && !placed.includes(k));
      if (i >= 0) place(i);
    } else if (code === 'Backspace' && placed.length > hinted) setPlaced((p) => p.slice(0, -1));
    else if (code === 'Enter') skip();
  }, !paused);

  const style = { '--face': face, '--edge': edge, '--ink': ink } as CSSProperties;

  return (
    <DomStage style={style}>
      <StatBar>
        <Stat label="Words" value={solvedCount} />
        <Stat
          label="Time"
          value={`${Math.ceil(clock.remaining)}s`}
          tone={clock.remaining < 10 ? 'warn' : undefined}
        />
        <Stat label="Score" value={stats.current.score} />
      </StatBar>
      <TimerBar ratio={Math.min(1, clock.remaining / START)} label="Time left" />
      <div className={styles.play}>
        <div className={`${styles.row} ${styles.answer}`} data-wrong={wrong} aria-label="Your answer">
          {Array.from({ length: word.length }, (_, k) => {
            const idx = placed[k];
            return (
              <button
                key={k}
                type="button"
                className={styles.slot}
                data-filled={idx !== undefined}
                data-hinted={k < hinted}
                onClick={() => unplace(k)}
                aria-label={idx !== undefined ? `Remove ${letters[idx]}` : `Empty slot ${k + 1}`}
              >
                {idx !== undefined ? letters[idx] : ''}
              </button>
            );
          })}
        </div>
        <div className={styles.row} aria-label="Scrambled letters">
          {letters.map((l, i) => (
            <button
              key={`${word}-${i}`}
              type="button"
              className={styles.tile}
              data-used={placed.includes(i)}
              onClick={() => place(i)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            onClick={() => void hintClick()}
            disabled={busy || lock}
          >
            💡 Hint <small>{freeHints > 0 ? freeHints : 'ad'}</small>
          </button>
          <button type="button" className={styles.tool} onClick={skip} disabled={lock}>
            ⏭️ Skip <small>−{skipCost}s</small>
          </button>
        </div>
      </div>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
