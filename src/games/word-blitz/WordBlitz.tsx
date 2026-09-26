import { useMemo, useRef, useState } from 'react';
import {
  DomStage,
  GameButton,
  Stat,
  StatBar,
  TimerBar,
  useCountdown,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import { Icon } from '../../ui/Icon';
import type { GameProps } from '../../platform/types';
import { makePuzzle, wordScore } from './logic';
import styles from './WordBlitz.module.css';

const ROUND = 90;

export function WordBlitz({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const puzzle = useMemo(() => makePuzzle(rng), [rng]);
  const [order, setOrder] = useState(() => puzzle.letters.map((_, i) => i));
  const [picked, setPicked] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [feedback, setFeedback] = useState<{ key: number; tone: 'good' | 'bad' } | null>(null);
  const score = useRef(0);
  const over = useRef(false);

  const clock = useCountdown(ROUND, !paused, () => {
    over.current = true;
    const longest = found.reduce((a, w) => (w.length > a.length ? w : a), '');
    api.gameOver({
      score: score.current,
      stats: [
        { label: 'Words', value: `${found.length} of ${puzzle.answers.size}` },
        { label: 'Longest', value: longest ? longest.toUpperCase() : '—' },
        { label: 'Seven-letter word', value: puzzle.seed.toUpperCase() },
      ],
    });
  });

  const word = picked.map((i) => puzzle.letters[i]).join('');

  const flash = (text: string, tone: 'good' | 'bad') => {
    setMessage({ text, tone });
    setFeedback({ key: Date.now(), tone });
  };

  const submit = () => {
    if (paused || over.current || word.length === 0) return;
    if (word.length < 3) {
      flash('Words need at least 3 letters', 'bad');
      api.sfx('error');
    } else if (found.includes(word)) {
      flash('Already found', 'bad');
      api.sfx('error');
    } else if (!puzzle.answers.has(word)) {
      flash(`“${word.toUpperCase()}” isn’t in our word list`, 'bad');
      api.sfx('error');
      api.haptic(40);
    } else {
      const pts = wordScore(word, puzzle.letters.length);
      score.current += pts;
      api.setScore(score.current);
      setFound((f) => [word, ...f]);
      const pangram = word.length === puzzle.letters.length;
      flash(pangram ? `SEVEN-LETTER WORD! +${pts}` : `+${pts}`, 'good');
      api.sfx(pangram ? 'win' : word.length >= 5 ? 'powerup' : 'score');
    }
    setPicked([]);
  };

  const pick = (i: number) => {
    if (paused || over.current || picked.includes(i)) return;
    setPicked((p) => [...p, i]);
    api.sfx('tap');
  };

  const backspace = () => setPicked((p) => p.slice(0, -1));

  useKeyDown((code, e) => {
    if (code === 'Enter') submit();
    else if (code === 'Backspace') backspace();
    else if (code === 'Escape') setPicked([]);
    else if (code === 'Space') setOrder((o) => rng.shuffle(o));
    else if (/^[a-zA-Z]$/.test(e.key)) {
      const letter = e.key.toLowerCase();
      const idx = puzzle.letters.findIndex((l, i) => l === letter && !picked.includes(i));
      if (idx >= 0) pick(idx);
      else api.sfx('error');
    } else return false;
  }, !paused);

  return (
    <DomStage>
      <StatBar>
        <Stat
          label="Time"
          value={`${Math.ceil(clock.remaining)}s`}
          tone={clock.remaining < 10 ? 'warn' : undefined}
        />
        <Stat label="Words" value={`${found.length}/${puzzle.answers.size}`} />
      </StatBar>
      <TimerBar ratio={clock.remaining / ROUND} label="Time remaining" />
      <div className={styles.layout}>
        <div
          className={styles.current}
          data-feedback={feedback?.tone}
          key={feedback?.key ?? 0}
          aria-live="polite"
        >
          {word ? (
            word.split('').map((c, i) => (
              <span key={i} className={styles.slot}>
                {c}
              </span>
            ))
          ) : (
            <span className={styles.placeholder}>Tap letters to make a word</span>
          )}
        </div>
        <p className={styles.message} data-tone={message?.tone}>
          {message?.text ?? ' '}
        </p>
        <div className={styles.letters}>
          {order.map((i) => (
            <button
              key={i}
              type="button"
              className={styles.letter}
              disabled={picked.includes(i)}
              onPointerDown={(e) => {
                e.preventDefault();
                pick(i);
              }}
              aria-label={`Letter ${puzzle.letters[i]!.toUpperCase()}`}
            >
              {puzzle.letters[i]}
            </button>
          ))}
        </div>
        <div className={styles.controls}>
          <GameButton onClick={() => setOrder((o) => rng.shuffle(o))} label="Shuffle letters">
            <Icon name="shuffle" size={18} />
          </GameButton>
          <GameButton onClick={backspace} disabled={!word} label="Delete last letter">
            ⌫
          </GameButton>
          <GameButton onClick={submit} disabled={!word} label="Submit word" tone="primary">
            <Icon name="check" size={18} /> Enter
          </GameButton>
        </div>
        <div className={styles.found}>
          <div className={styles.foundHead}>
            <span>Found words</span>
            <span>
              {found.length} / {puzzle.answers.size}
            </span>
          </div>
          <div className={styles.words}>
            {found.map((w) => (
              <span key={w} className={styles.word} data-pangram={w.length === puzzle.letters.length}>
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
    </DomStage>
  );
}
