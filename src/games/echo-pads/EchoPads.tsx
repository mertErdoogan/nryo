import { useCallback, useEffect, useRef, useState } from 'react';
import { DomStage, Hint, useKeyDown, useSeededRng } from '../../engine';
import type { GameProps, SoundName } from '../../platform/types';
import { checkInput, gapTime, litTime } from './logic';
import styles from './EchoPads.module.css';

const NOTES: SoundName[] = ['note-c', 'note-e', 'note-g', 'note-c2'];
const LABELS = ['Green', 'Red', 'Yellow', 'Blue'];

type Phase = 'intro' | 'showing' | 'input' | 'between' | 'failed';

export function EchoPads({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const [sequence, setSequence] = useState<number[]>(() => [rng.int(0, 3)]);
  const [input, setInput] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => clearAll, []);

  const play = useCallback(
    (seq: number[]) => {
      clearAll();
      setPhase('showing');
      setInput([]);
      const on = litTime(seq.length);
      const gap = gapTime(seq.length);
      let t = 500;
      seq.forEach((pad) => {
        later(() => {
          setLit(pad);
          api.sfx(NOTES[pad]!);
        }, t);
        later(() => setLit(null), t + on);
        t += on + gap;
      });
      later(() => setPhase('input'), t);
    },
    [api],
  );

  // Start after a short intro; pausing mid-playback replays the sequence on resume.
  useEffect(() => {
    if (paused) {
      if (phase === 'showing') {
        clearAll();
        setLit(null);
        setPhase('intro');
      }
      return;
    }
    if (phase === 'intro') {
      const t = setTimeout(() => play(sequence), 400);
      return () => clearTimeout(t);
    }
  }, [paused, phase, play, sequence]);

  const press = (pad: number) => {
    if (paused || phase !== 'input') return;
    const next = [...input, pad];
    const result = checkInput(sequence, next);
    setLit(pad);
    later(() => setLit((l) => (l === pad ? null : l)), 180);
    if (result === 'wrong') {
      setPhase('failed');
      api.sfx('error');
      api.haptic([80, 40, 80]);
      const completed = sequence.length - 1;
      later(() => api.gameOver({ score: completed, stats: [{ label: 'Longest sequence', value: String(completed) }] }), 700);
      return;
    }
    api.sfx(NOTES[pad]!);
    setInput(next);
    if (result === 'done') {
      api.setScore(sequence.length);
      setPhase('between');
      const grown = [...sequence, rng.int(0, 3)];
      later(() => {
        api.sfx(sequence.length % 5 === 0 ? 'powerup' : 'score');
        setSequence(grown);
        play(grown);
      }, 650);
    }
  };

  useKeyDown((code) => {
    const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code);
    const j = ['KeyQ', 'KeyW', 'KeyA', 'KeyS'].indexOf(code);
    const pad = i >= 0 ? i : j;
    if (pad < 0) return false;
    press(pad);
  }, !paused);

  const status =
    phase === 'showing' ? 'Watch…' : phase === 'input' ? 'Your turn' : phase === 'failed' ? 'Oops!' : phase === 'between' ? 'Nice!' : 'Get ready';

  return (
    <DomStage center>
      <div className={styles.board} data-fail={phase === 'failed'}>
        {LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={styles.pad}
            data-lit={lit === i}
            disabled={phase !== 'input'}
            aria-label={`${label} pad`}
            onPointerDown={(e) => {
              e.preventDefault();
              press(i);
            }}
          />
        ))}
        <div className={styles.hub} aria-live="polite">
          <div>
            <div className={styles.hubNum}>{sequence.length}</div>
            <div className={styles.hubLabel}>{status}</div>
          </div>
        </div>
      </div>
      <Hint>{phase === 'input' ? `${input.length} / ${sequence.length}` : 'Remember the order'}</Hint>
    </DomStage>
  );
}
