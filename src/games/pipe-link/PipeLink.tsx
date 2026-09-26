import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, DomStage, Hint, PowerChip, Stat, StatBar, useSeededRng, useStopwatch } from '../../engine';
import { formatClock } from '../../lib/format';
import { arr, num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { connected, E, generate, N, puzzleScore, rotateMask, S, scramble, sizeForLevel, W } from './logic';
import styles from './PipeLink.module.css';

const saveSchema = obj({
  size: num({ int: true, min: 3, max: 8 }),
  source: num({ int: true, min: 0, max: 63 }),
  base: arr(num({ int: true, min: 0, max: 15 }), { max: 64 }),
  turns: arr(num({ int: true, min: 0 }), { max: 64 }),
  moves: num({ int: true, min: 0 }),
  elapsed: num({ min: 0 }),
});
type Save = Infer<typeof saveSchema>;
const progressSchema = obj({ level: num({ int: true, min: 1, max: 999 }) });
type Progress = Infer<typeof progressSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };
export const progressSpec: VersionedSpec<Progress> = { version: 1, is: progressSchema.is };

function Shape({ mask, isSource, isLeaf }: { mask: number; isSource: boolean; isLeaf: boolean }) {
  const arms: [number, string][] = [
    [N, 'M50 50V0'],
    [E, 'M50 50H100'],
    [S, 'M50 50V100'],
    [W, 'M50 50H0'],
  ];
  return (
    <>
      {arms.map(([bit, d]) =>
        mask & bit ? (
          <path key={bit} d={d} className={styles.pipe} strokeWidth={16} strokeLinecap="round" />
        ) : null,
      )}
      {isSource ? (
        <>
          <circle cx={50} cy={50} r={22} className={styles.core} />
          <circle cx={50} cy={50} r={10} fill="#fff" />
        </>
      ) : isLeaf ? (
        <>
          <circle cx={50} cy={50} r={21} fill="#0b1026" stroke="#64748b" strokeWidth={4} />
          <circle cx={50} cy={50} r={13} className={styles.lamp} />
        </>
      ) : (
        <circle
          cx={50}
          cy={50}
          r={9}
          className={styles.pipe}
          fill="currentColor"
          strokeWidth={0}
          style={{ fill: 'currentColor' }}
        />
      )}
    </>
  );
}

export function PipeLink({ api, paused }: GameProps<Save, Progress>) {
  const rng = useSeededRng(api.seed);
  const level = api.mode === 'daily' ? 5 : (api.progress?.level ?? 1);
  const [puzzle] = useState(() => {
    if (api.resume) return { size: api.resume.size, source: api.resume.source, base: api.resume.base };
    const size = sizeForLevel(level);
    return { size, ...generate(size, rng) };
  });
  const [turns, setTurns] = useState<number[]>(() => {
    if (api.resume) return api.resume.turns;
    let t = scramble(puzzle.size, rng);
    // Never start already solved.
    while (
      connected(
        puzzle.base.map((m, i) => rotateMask(m, t[i]!)),
        puzzle.size,
        puzzle.source,
      ).size ===
      puzzle.size ** 2
    ) {
      t = scramble(puzzle.size, rng);
    }
    return t;
  });
  const [moves, setMoves] = useState(api.resume?.moves ?? 0);
  const [solved, setSolved] = useState(false);
  const [elapsed, readElapsed] = useStopwatch(!paused && !solved, api.resume?.elapsed ?? 0);
  const done = useRef(false);
  const lo = api.loadout;
  const glow = lo.skin.colors[0];
  const [hints, setHints] = useState(lo.level('hint'));
  const [busy, setBusy] = useState(false);

  const masks = useMemo(() => puzzle.base.map((m, i) => rotateMask(m, turns[i]!)), [puzzle, turns]);
  const lit = useMemo(() => connected(masks, puzzle.size, puzzle.source), [masks, puzzle]);
  const total = puzzle.size * puzzle.size;

  useEffect(() => {
    if (lit.size !== total || done.current) return;
    done.current = true;
    setSolved(true);
    const seconds = readElapsed();
    const score = puzzleScore(puzzle.size, seconds);
    api.setScore(score);
    api.sfx('win');
    api.addCoins(1 + Math.floor(puzzle.size / 2));
    if (api.mode === 'normal') api.saveProgress({ level: level + 1 });
    setTimeout(
      () =>
        api.gameOver({
          score,
          won: true,
          stats: [
            { label: 'Board', value: `${puzzle.size}×${puzzle.size}` },
            { label: 'Moves', value: String(moves) },
            { label: 'Time', value: formatClock(seconds) },
          ],
        }),
      1200,
    );
  }, [lit, total, api, level, moves, puzzle.size, readElapsed]);

  const rotate = (i: number, by = 1) => {
    if (paused || solved) return;
    const next = turns.slice();
    next[i] = next[i]! + by;
    setTurns(next);
    setMoves((m) => m + 1);
    api.sfx('tick');
    const litNow = connected(
      puzzle.base.map((m, k) => rotateMask(m, next[k]!)),
      puzzle.size,
      puzzle.source,
    ).size;
    api.save(
      { ...puzzle, turns: next.map((t) => t % 4), moves: moves + 1, elapsed: readElapsed() },
      {
        label: `Level ${level} · ${puzzle.size}×${puzzle.size} · ${Math.round((litNow / total) * 100)}% lit`,
        progress: litNow / total,
      },
    );
  };

  /** Hint: snap one wrongly turned tile into place. */
  const hint = async () => {
    if (solved || busy) return;
    const wrong = puzzle.base.map((b, i) => (rotateMask(b, turns[i]!) === b ? -1 : i)).filter((i) => i >= 0);
    if (!wrong.length) return;
    if (hints > 0) setHints((n) => n - 1);
    else {
      setBusy(true);
      const ok = await api.watchAd('A pipe hint');
      setBusy(false);
      if (!ok) return;
    }
    const i = rng.pick(wrong);
    let by = 1;
    while (rotateMask(puzzle.base[i]!, turns[i]! + by) !== puzzle.base[i]) by += 1;
    rotate(i, by);
    api.sfx('powerup');
  };

  const style = { '--n': puzzle.size, '--glow': glow } as CSSProperties;
  const leaf = (m: number) => m === N || m === E || m === S || m === W;

  return (
    <DomStage>
      <StatBar>
        <Stat label="Level" value={level} />
        <Stat label="Lit" value={`${lit.size}/${total}`} tone={solved ? 'good' : undefined} />
        <Stat label="Time" value={formatClock(elapsed)} />
      </StatBar>
      <div
        className={styles.grid}
        style={style}
        data-solved={solved}
        role="group"
        aria-label={`Pipe puzzle ${puzzle.size} by ${puzzle.size}`}
      >
        {puzzle.base.map((base, i) => (
          <button
            key={i}
            type="button"
            className={styles.tile}
            data-on={lit.has(i)}
            aria-label={`Tile ${i + 1}${lit.has(i) ? ', powered' : ''}`}
            onClick={() => rotate(i)}
          >
            <svg
              className={styles.shape}
              viewBox="0 0 100 100"
              style={{ transform: `rotate(${turns[i]! * 90}deg)`, color: lit.has(i) ? glow : '#475569' }}
              aria-hidden="true"
            >
              <Shape mask={base} isSource={i === puzzle.source} isLeaf={leaf(base)} />
            </svg>
          </button>
        ))}
      </div>
      <Hint>{solved ? 'All connected!' : 'Tap tiles to rotate. Light up every lamp.'}</Hint>
      <PowerChip
        corner="inline"
        icon="💡"
        label="Fix a tile"
        badge={hints > 0 ? hints : 'ad'}
        onClick={() => void hint()}
        disabled={busy || solved}
      />
      {solved && <Banner text="Connected!" sub={`Level ${level} complete`} />}
    </DomStage>
  );
}
