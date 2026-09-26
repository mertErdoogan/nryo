import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, DomStage, Stat, StatBar, useKeyDown, useSeededRng } from '../../engine';
import { arr, num, obj, str, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { answerList, evaluate, isValidGuess, keyStates, MAX_GUESSES, solvePoints, WORD_LENGTH } from './logic';
import styles from './FiveLetters.module.css';

const word5 = str({ pattern: /^[a-z]{5}$/ });
const saveSchema = obj({
  answer: word5,
  guesses: arr(word5, { max: MAX_GUESSES }),
  streak: num({ int: true, min: 0 }),
  score: num({ min: 0 }),
  words: num({ int: true, min: 0 }),
});
type Save = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const REVEAL_MS = 5 * 120 + 480;

export function FiveLetters({ api, paused }: GameProps<Save>) {
  const rng = useSeededRng(api.seed);
  const pickAnswer = () => rng.pick(answerList());
  const [answer, setAnswer] = useState(() => {
    if (!api.resume) return pickAnswer();
    // Advance the sequence past words already played so they don't repeat.
    for (let i = 0; i <= api.resume.words; i++) pickAnswer();
    return api.resume.answer;
  });
  const [guesses, setGuesses] = useState<string[]>(() => api.resume?.guesses ?? []);
  const [current, setCurrent] = useState('');
  const [shake, setShake] = useState(0);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const progress = useRef({ streak: api.resume?.streak ?? 0, score: api.resume?.score ?? 0, words: api.resume?.words ?? 0, over: false });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => {
    api.setScore(progress.current.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (ans: string, gs: string[]) => {
    const p = progress.current;
    api.save(
      { answer: ans, guesses: gs, streak: p.streak, score: p.score, words: p.words },
      { label: `Streak ${p.streak} · guess ${gs.length + 1} of 6`, progress: Math.min(1, p.streak / 10) },
    );
  };

  const keys = useMemo(() => keyStates(guesses, answer), [guesses, answer]);

  const say = (text: string) => setToast({ key: Date.now(), text });

  const submit = () => {
    const p = progress.current;
    if (paused || locked || p.over) return;
    if (current.length < WORD_LENGTH) {
      setShake((n) => n + 1);
      say('Not enough letters');
      api.sfx('error');
      return;
    }
    if (!isValidGuess(current)) {
      setShake((n) => n + 1);
      say('Not in word list');
      api.sfx('error');
      api.haptic(40);
      return;
    }
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent('');
    setLocked(true);
    api.sfx('swap');
    later(() => {
      setLocked(false);
      if (current === answer) {
        p.streak += 1;
        p.words += 1;
        const pts = solvePoints(next.length, p.streak - 1);
        p.score += pts;
        api.setScore(p.score);
        api.sfx('win');
        setBanner({ key: Date.now(), text: next.length === 1 ? 'Genius!' : `Solved in ${next.length}!`, sub: `+${pts} · streak ${p.streak}` });
        setLocked(true);
        later(() => {
          const fresh = pickAnswer();
          setAnswer(fresh);
          setGuesses([]);
          setLocked(false);
          persist(fresh, []);
        }, 1700);
      } else if (next.length >= MAX_GUESSES) {
        p.over = true;
        say(answer.toUpperCase());
        api.sfx('gameover');
        later(
          () =>
            api.gameOver({
              score: p.score,
              won: p.words > 0,
              stats: [
                { label: 'Words solved', value: String(p.words) },
                { label: 'Missed word', value: answer.toUpperCase() },
              ],
            }),
          1500,
        );
      } else {
        persist(answer, next);
      }
    }, REVEAL_MS);
  };

  const type = (letter: string) => {
    if (paused || locked || progress.current.over) return;
    if (current.length >= WORD_LENGTH) return;
    setCurrent((c) => c + letter);
    api.sfx('tick');
  };
  const erase = () => {
    if (!locked) setCurrent((c) => c.slice(0, -1));
  };

  useKeyDown((code, e) => {
    if (code === 'Enter') submit();
    else if (code === 'Backspace') erase();
    else if (/^[a-zA-Z]$/.test(e.key)) type(e.key.toLowerCase());
    else return false;
  }, !paused);

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => {
    const g = guesses[r];
    if (g) return { letters: g, marks: evaluate(g, answer) };
    if (r === guesses.length) return { letters: current, marks: null };
    return { letters: '', marks: null };
  });

  return (
    <DomStage>
      <StatBar>
        <Stat label="Streak" value={progress.current.streak} tone={progress.current.streak > 0 ? 'good' : undefined} />
        <Stat label="Guess" value={`${Math.min(MAX_GUESSES, guesses.length + 1)}/6`} />
      </StatBar>
      <div className={styles.board} role="grid" aria-label="Guesses">
        {rows.map((row, r) => (
          <div
            key={r === guesses.length ? `${answer}-${r}-${shake}` : `${answer}-${r}`}
            className={styles.row}
            data-shake={r === guesses.length && shake > 0}
            role="row"
          >
            {Array.from({ length: WORD_LENGTH }, (_, c) => {
              const letter = row.letters[c] ?? '';
              const mark = row.marks?.[c];
              return (
                <div
                  key={c}
                  role="gridcell"
                  className={styles.tile}
                  data-filled={!!letter && !mark}
                  data-mark={mark}
                  style={mark ? ({ animationDelay: `${c * 120}ms` } as CSSProperties) : undefined}
                  aria-label={letter ? `${letter.toUpperCase()}${mark ? ` ${mark}` : ''}` : 'empty'}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.keyboard} aria-label="Keyboard">
        {ROWS.map((row, i) => (
          <div key={row} className={styles.keyRow}>
            {i === 2 && (
              <button type="button" className={`${styles.key} ${styles.wideKey}`} onClick={submit}>
                Enter
              </button>
            )}
            {row.split('').map((k) => (
              <button
                key={k}
                type="button"
                className={styles.key}
                data-mark={keys[k]}
                onPointerDown={(e) => {
                  e.preventDefault();
                  type(k);
                }}
                aria-label={`${k}${keys[k] ? ` ${keys[k]}` : ''}`}
              >
                {k}
              </button>
            ))}
            {i === 2 && (
              <button type="button" className={`${styles.key} ${styles.wideKey}`} onClick={erase} aria-label="Backspace">
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
      {toast && (
        <div key={toast.key} className={styles.toast} role="status">
          {toast.text}
        </div>
      )}
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
