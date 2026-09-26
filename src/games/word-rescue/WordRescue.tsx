import { useEffect, useRef, useState } from 'react';
import { Banner, DomStage, Stat, StatBar, createContinueGate, useKeyDown, useSeededRng } from '../../engine';
import type { GameProps } from '../../platform/types';
import { answerWords } from '../_shared/words/pick';
import styles from './WordRescue.module.css';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const VOWELS = 'aeiou';

export function WordRescue({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const balloonsPerWord = 6 + lo.level('balloon');
  const colors = lo.skin.colors;
  const vowelStart = lo.level('vowel') > 0;
  const used = useRef(new Set<string>());

  const nextWord = (n: number) => {
    const list = answerWords(n < 4 ? 5 : n < 8 ? (rng.chance(0.5) ? 5 : 7) : 7);
    let w = rng.pick(list);
    for (let i = 0; i < 20 && used.current.has(w); i++) w = rng.pick(list);
    used.current.add(w);
    return w;
  };
  const initialGuesses = (w: string) => {
    const set = new Set<string>();
    if (vowelStart) {
      const v = [...w].find((c) => VOWELS.includes(c));
      if (v) set.add(v);
    }
    return set;
  };

  const [solved, setSolved] = useState(0);
  const [word, setWord] = useState(() => nextWord(0));
  const [guessed, setGuessed] = useState<Set<string>>(() => initialGuesses(word));
  const [balloons, setBalloons] = useState(balloonsPerWord);
  const [hints, setHints] = useState(lo.level('hint'));
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const stats = useRef({ score: 0, streak: 0, best: 0, over: false });
  const continueGate = useRef(createContinueGate(api)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const complete = (g: Set<string>) => [...word].every((c) => g.has(c));

  const advance = () => {
    const w = nextWord(solved + 1);
    setWord(w);
    setGuessed(initialGuesses(w));
    setBalloons(balloonsPerWord);
    setState('play');
  };

  const lose = () => {
    setState('lost');
    api.sfx('gameover');
    timers.current.push(
      setTimeout(() => {
        continueGate(
          () => {
            setBalloons(3);
            setState('play');
            setBanner({ key: Date.now(), text: '+3 balloons!' });
          },
          () => {
            stats.current.over = true;
            api.gameOver({
              score: stats.current.score,
              stats: [
                { label: 'Words rescued', value: String(solved) },
                { label: 'Best streak', value: String(stats.current.best) },
                { label: 'Last word', value: word.toUpperCase() },
              ],
            });
          },
        );
      }, 900),
    );
  };

  const guess = (ch: string) => {
    if (paused || state !== 'play' || stats.current.over || guessed.has(ch)) return;
    const g = new Set(guessed);
    g.add(ch);
    setGuessed(g);
    if (word.includes(ch)) {
      api.sfx('tap');
      if (complete(g)) {
        const s = stats.current;
        s.streak += 1;
        s.best = Math.max(s.best, s.streak);
        const pts = 50 + word.length * 10 + balloons * 15 + Math.min(10, s.streak) * 10;
        s.score += pts;
        api.setScore(s.score);
        api.addCoins(1);
        setSolved((n) => n + 1);
        setState('won');
        setBanner({
          key: Date.now(),
          text: word.toUpperCase(),
          sub: `+${pts} pts${s.streak > 1 ? ` · streak ${s.streak}` : ''}`,
        });
        api.sfx('win');
        timers.current.push(setTimeout(advance, 1400));
      }
    } else {
      api.sfx('miss');
      api.haptic(30);
      const left = balloons - 1;
      setBalloons(left);
      if (left <= 0) {
        stats.current.streak = 0;
        lose();
      }
    }
  };

  useKeyDown((code) => {
    const m = /^Key([A-Z])$/.exec(code);
    if (m) guess(m[1]!.toLowerCase());
  }, !paused);

  const revealLetter = () => {
    const missing = [...new Set(word)].filter((c) => !guessed.has(c));
    if (missing.length) {
      const c = rng.pick(missing);
      guess(c);
    }
  };
  const hintClick = async () => {
    if (state !== 'play' || busy) return;
    if (hints > 0) {
      setHints((h) => h - 1);
      revealLetter();
      return;
    }
    setBusy(true);
    const ok = await api.watchAd('A letter');
    setBusy(false);
    if (ok) revealLetter();
  };

  return (
    <DomStage>
      <StatBar>
        <Stat label="Rescued" value={solved} />
        <Stat
          label="Streak"
          value={stats.current.streak}
          tone={stats.current.streak > 1 ? 'good' : undefined}
        />
        <Stat label="Score" value={stats.current.score} />
      </StatBar>
      <div className={styles.scene} aria-label={`${balloons} balloons left`}>
        <div className={styles.explorer} data-fallen={state === 'lost'}>
          <div className={styles.balloons}>
            {Array.from({ length: balloonsPerWord }, (_, i) => {
              const spread = (i - (balloonsPerWord - 1) / 2) * 20;
              return (
                <span
                  key={i}
                  className={styles.balloon}
                  data-popped={i >= balloons}
                  style={{
                    left: `calc(50% + ${spread}px - 13px)`,
                    bottom: `${20 + Math.abs(spread) * -0.3 + (i % 2) * 14}px`,
                    background: colors[i % colors.length],
                    animationDelay: `${i * 0.3}s`,
                  }}
                >
                  <span className={styles.string} />
                </span>
              );
            })}
          </div>
          <div className={styles.basket}>
            <span>{state === 'lost' ? '😱' : state === 'won' ? '🥳' : '🧑‍🚀'}</span>
          </div>
        </div>
      </div>
      <div className={styles.word} aria-live="polite">
        {[...word].map((c, i) => (
          <span
            key={i}
            className={styles.slot}
            data-revealed={guessed.has(c)}
            data-missed={state === 'lost' && !guessed.has(c)}
          >
            {guessed.has(c) || state === 'lost' ? c : ''}
          </span>
        ))}
      </div>
      <div className={styles.tools}>
        <button
          type="button"
          className={styles.tool}
          onClick={() => void hintClick()}
          disabled={busy || state !== 'play'}
        >
          💡 Reveal a letter <small>{hints > 0 ? hints : 'ad'}</small>
        </button>
      </div>
      <div className={styles.keys}>
        {ROWS.map((row) => (
          <div key={row} className={styles.row}>
            {[...row].map((ch) => (
              <button
                key={ch}
                type="button"
                className={styles.key}
                data-state={guessed.has(ch) ? (word.includes(ch) ? 'hit' : 'miss') : undefined}
                disabled={guessed.has(ch) || state !== 'play'}
                onClick={() => guess(ch)}
              >
                {ch}
              </button>
            ))}
          </div>
        ))}
      </div>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
