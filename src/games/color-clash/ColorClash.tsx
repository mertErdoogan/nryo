import { useRef, useState } from 'react';
import { DomStage, Stat, StatBar, TimerBar, useCountdown, useKeyDown, useSeededRng } from '../../engine';
import type { GameProps } from '../../platform/types';
import { COLORS, makeQuestion, multiplier } from './logic';
import styles from './ColorClash.module.css';

const ROUND = 45;

export function ColorClash({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const [question, setQuestion] = useState(() => makeQuestion(rng, 0));
  const [qid, setQid] = useState(0);
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);
  const g = useRef({
    score: 0,
    streak: 0,
    best: 0,
    correct: 0,
    wrong: 0,
    over: false,
    started: performance.now(),
  });

  const clock = useCountdown(ROUND, !paused, () => {
    g.current.over = true;
    const s = g.current;
    const total = s.correct + s.wrong;
    api.gameOver({
      score: s.score,
      stats: [
        { label: 'Correct', value: String(s.correct) },
        { label: 'Accuracy', value: total ? `${Math.round((s.correct / total) * 100)}%` : '—' },
        { label: 'Best streak', value: String(s.best) },
      ],
    });
  });

  const answer = (saysMatch: boolean) => {
    const s = g.current;
    if (paused || s.over) return;
    if (saysMatch === question.matches) {
      s.streak += 1;
      s.best = Math.max(s.best, s.streak);
      s.correct += 1;
      s.score += 10 * multiplier(s.streak);
      api.sfx(s.streak % 5 === 0 ? 'powerup' : 'score');
      setFeedback('good');
    } else {
      s.streak = 0;
      s.wrong += 1;
      clock.add(-2);
      api.sfx('error');
      api.haptic(60);
      setFeedback('bad');
    }
    api.setScore(s.score);
    setQuestion(makeQuestion(rng, ROUND - clock.remaining));
    setQid((q) => q + 1);
  };

  useKeyDown((code) => {
    if (code === 'ArrowLeft' || code === 'KeyN' || code === 'KeyA') answer(false);
    else if (code === 'ArrowRight' || code === 'KeyY' || code === 'KeyD') answer(true);
    else return false;
  }, !paused);

  const mult = multiplier(g.current.streak);
  const tint = question.tint !== null ? `${COLORS[question.tint].hex}22` : undefined;

  return (
    <DomStage>
      <StatBar>
        <Stat
          label="Time"
          value={`${Math.ceil(clock.remaining)}s`}
          tone={clock.remaining < 8 ? 'warn' : undefined}
        />
        <Stat label="Streak" value={g.current.streak} />
        <Stat label="Multiplier" value={`×${mult}`} tone={mult > 1 ? 'good' : undefined} />
      </StatBar>
      <TimerBar ratio={clock.remaining / ROUND} label="Time remaining" />
      <div
        className={styles.card}
        data-feedback={feedback ?? undefined}
        key={`card-${qid}`}
        style={{ background: tint ? `linear-gradient(${tint}, ${tint}), #f8fafc` : undefined }}
      >
        <p className={styles.question}>Does the meaning match the ink?</p>
        <span
          className={styles.word}
          style={{ color: COLORS[question.ink].hex }}
          aria-label={`Word ${COLORS[question.word].name} in ${COLORS[question.ink].name.toLowerCase()} ink`}
        >
          {COLORS[question.word].name}
        </span>
      </div>
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.answer} ${styles.no}`}
          onPointerDown={(e) => {
            e.preventDefault();
            answer(false);
          }}
          aria-label="No, they do not match"
        >
          ✗<small>No · ←</small>
        </button>
        <button
          type="button"
          className={`${styles.answer} ${styles.yes}`}
          onPointerDown={(e) => {
            e.preventDefault();
            answer(true);
          }}
          aria-label="Yes, they match"
        >
          ✓<small>Yes · →</small>
        </button>
      </div>
    </DomStage>
  );
}
