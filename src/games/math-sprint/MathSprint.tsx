import { useRef, useState } from 'react';
import { DomStage, Stat, StatBar, TimerBar, useCountdown, useKeyDown, useSeededRng } from '../../engine';
import type { GameProps } from '../../platform/types';
import { makeProblem, tierFor } from './logic';
import styles from './MathSprint.module.css';

const START = 40;
const MAX = 60;

export function MathSprint({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const [problem, setProblem] = useState(() => makeProblem(rng, 1));
  const [pid, setPid] = useState(0);
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);
  const g = useRef({ score: 0, solved: 0, wrong: 0, streak: 0, best: 0, over: false });

  const clock = useCountdown(START, !paused, () => {
    const s = g.current;
    s.over = true;
    api.gameOver({
      score: s.score,
      stats: [
        { label: 'Solved', value: String(s.solved) },
        { label: 'Level', value: String(tierFor(s.solved)) },
        { label: 'Best streak', value: String(s.best) },
      ],
    });
  });

  const choose = (value: number) => {
    const s = g.current;
    if (paused || s.over) return;
    if (value === problem.answer) {
      s.solved += 1;
      s.streak += 1;
      s.best = Math.max(s.best, s.streak);
      s.score += 10 * problem.tier + (s.streak >= 5 ? 5 : 0);
      if (clock.remaining < MAX) clock.add(Math.min(1.5, MAX - clock.remaining));
      api.sfx(tierFor(s.solved) > problem.tier ? 'powerup' : 'score');
      setFeedback('good');
    } else {
      s.wrong += 1;
      s.streak = 0;
      clock.add(-3);
      api.sfx('error');
      api.haptic(60);
      setFeedback('bad');
    }
    api.setScore(s.score);
    setProblem(makeProblem(rng, tierFor(s.solved)));
    setPid((p) => p + 1);
  };

  useKeyDown((code) => {
    const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code);
    if (i < 0) return false;
    choose(problem.options[i]!);
  }, !paused);

  return (
    <DomStage>
      <StatBar>
        <Stat
          label="Time"
          value={`${Math.ceil(clock.remaining)}s`}
          tone={clock.remaining < 8 ? 'warn' : undefined}
        />
        <Stat label="Level" value={problem.tier} />
        <Stat label="Streak" value={g.current.streak} tone={g.current.streak >= 5 ? 'good' : undefined} />
      </StatBar>
      <TimerBar ratio={clock.remaining / MAX} label="Time remaining" />
      <div className={styles.problem} data-feedback={feedback ?? undefined}>
        <p className={styles.expr} key={pid} aria-live="polite">
          {problem.text} <span>=</span> ?
        </p>
      </div>
      <div className={styles.options}>
        {problem.options.map((o, i) => (
          <button
            key={`${pid}-${i}`}
            type="button"
            className={styles.option}
            onPointerDown={(e) => {
              e.preventDefault();
              choose(o);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                choose(o);
              }
            }}
          >
            <span className={styles.key}>{i + 1}</span>
            {o}
          </button>
        ))}
      </div>
    </DomStage>
  );
}
