import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { goBack, navigate, useSearchParams } from '../app/router';
import { useSaves, useSettings, useStats, useTodaysChallenge } from '../hooks/usePlatform';
import { randomSeed } from '../lib/rng';
import { platform } from '../platform';
import { maybeShowInterstitial } from '../platform/ads';
import { haptic, sound } from '../platform/audio';
import type { GameApi, GameEntry, GameModule, PlayMode, RoundOutcome } from '../platform/types';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { GameErrorBoundary } from './GameErrorBoundary';
import { Hud } from './Hud';
import { PauseOverlay } from './PauseOverlay';
import { ReadyOverlay } from './ReadyOverlay';
import { ResultsOverlay } from './ResultsOverlay';
import { useGameModule } from './useGameModule';
import { createValueStore } from './value-store';
import styles from './Shell.module.css';

export type Phase = 'ready' | 'playing' | 'paused' | 'over';

interface Run {
  key: number;
  seed: number;
  mode: PlayMode;
  resume: unknown;
  progress: unknown;
  best: number | null;
}

const RESULTS_DELAY_MS = 750;

/**
 * Owns the game lifecycle: ready → playing ⇄ paused → over → (restart).
 * Games only see the small `GameApi`; persistence, scoring, XP, achievements
 * and the daily challenge are handled here.
 */
export function GameShell({ game }: { game: GameEntry }) {
  const params = useSearchParams();
  const challenge = useTodaysChallenge();
  const dailyAvailable = params.get('daily') === '1' && challenge?.gameId === game.id;
  const wantsContinue = params.get('continue') === '1';
  const wantsAutostart = params.get('autostart') === '1';

  const mod = useGameModule(game);
  const module: GameModule | null = mod.status === 'ready' ? mod.module : null;
  const stats = useStats()[game.id];
  const saves = useSaves();
  const settings = useSettings();
  const saveEntry = saves.find((s) => s.gameId === game.id) ?? null;

  const [phase, setPhase] = useState<Phase>('ready');
  const [run, setRun] = useState<Run | null>(null);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const scoreStore = useMemo(() => createValueStore(0), []);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const endedRunRef = useRef(-1);
  const activeMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const resultsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ---- time accounting (only while actually playing)
  useEffect(() => {
    if (phase === 'playing') {
      segmentStartRef.current = performance.now();
      return () => {
        if (segmentStartRef.current !== null)
          activeMsRef.current += performance.now() - segmentStartRef.current;
        segmentStartRef.current = null;
      };
    }
  }, [phase]);

  useEffect(() => {
    platform.analytics.track('game_viewed', { gameId: game.id, mode: dailyAvailable ? 'daily' : 'normal' });
  }, [game.id, dailyAvailable]);

  const start = useCallback(
    (opts: { resume: boolean }) => {
      if (!module) return;
      sound.unlock();
      if (resultsTimer.current) clearTimeout(resultsTimer.current);
      const mode: PlayMode = dailyAvailable ? 'daily' : 'normal';
      let resume: unknown = null;
      if (opts.resume && module.save && mode === 'normal') resume = platform.saves.load(game.id, module.save);
      else if (!opts.resume && mode === 'normal' && platform.saves.has(game.id))
        platform.saves.clear(game.id);
      const progress = module.progress ? platform.saves.loadProgress(game.id, module.progress) : null;
      activeMsRef.current = 0;
      scoreStore.set(0);
      setOutcome(null);
      setRun((prev) => ({
        key: (prev?.key ?? 0) + 1,
        seed: mode === 'daily' && challenge ? challenge.seed : randomSeed(),
        mode,
        resume,
        progress,
        best: platform.stats.get()[game.id]?.best ?? null,
      }));
      setPhase('playing');
      platform.recent.touch(game.id);
      platform.analytics.track(resume ? 'game_resumed' : 'game_started', { gameId: game.id, mode });
      if (mode === 'daily') platform.analytics.track('daily_challenge_started', { gameId: game.id });
    },
    [module, dailyAvailable, challenge, game.id, scoreStore],
  );

  // ---- one-tap continue / autostart from links
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !module || phase !== 'ready') return;
    if (wantsContinue && platform.saves.has(game.id)) {
      autoStarted.current = true;
      start({ resume: true });
    } else if (wantsAutostart && !platform.saves.has(game.id)) {
      autoStarted.current = true;
      start({ resume: false });
    }
  }, [module, wantsContinue, wantsAutostart, phase, start, game.id]);

  const api = useMemo<GameApi | null>(() => {
    if (!run || !module) return null;
    const runKey = run.key;
    const ended = () => endedRunRef.current === runKey;
    return {
      meta: game,
      mode: run.mode,
      seed: run.seed,
      target: run.mode === 'daily' ? (challenge?.target ?? null) : null,
      best: run.best,
      resume: run.resume,
      progress: run.progress,
      setScore: (score) => {
        if (!ended() && Number.isFinite(score)) scoreStore.set(score);
      },
      gameOver: (result) => {
        if (ended()) return;
        endedRunRef.current = runKey;
        scoreStore.set(result.score);
        if (segmentStartRef.current !== null) {
          activeMsRef.current += performance.now() - segmentStartRef.current;
          segmentStartRef.current = performance.now();
        }
        if (game.resumable && run.mode === 'normal') platform.saves.clear(game.id);
        const result2 = platform.recordRound({
          meta: game,
          result,
          mode: run.mode,
          durationMs: activeMsRef.current,
          daily: run.mode === 'daily' ? challenge : null,
        });
        resultsTimer.current = setTimeout(() => {
          setOutcome(result2);
          setPhase('over');
          sound.play(result2.isNewBest || result2.won || result2.daily?.firstCompletion ? 'win' : 'gameover');
          if (result2.levelAfter > result2.levelBefore) setTimeout(() => sound.play('levelup'), 500);
        }, RESULTS_DELAY_MS);
      },
      save: (data, summary) => {
        if (ended() || run.mode !== 'normal' || !module.save) return;
        platform.saves.write(game.id, module.save.version, data, summary);
      },
      clearSave: () => {
        if (run.mode === 'normal') platform.saves.clear(game.id);
      },
      saveProgress: (data) => {
        if (module.progress) platform.saves.writeProgress(game.id, module.progress.version, data);
      },
      sfx: (name) => sound.play(name),
      haptic: (pattern) => haptic(settingsRef.current.haptics, pattern),
    };
  }, [run, module, game, challenge, scoreStore]);

  useEffect(
    () => () => {
      if (resultsTimer.current) clearTimeout(resultsTimer.current);
    },
    [],
  );

  // ---- abandon tracking when leaving mid-round
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(
    () => () => {
      const r = runRef.current;
      if (
        r &&
        endedRunRef.current !== r.key &&
        (phaseRef.current === 'playing' || phaseRef.current === 'paused')
      ) {
        platform.analytics.track('game_abandoned', { gameId: game.id, score: scoreStore.get() });
      }
    },
    [game.id, scoreStore],
  );

  const pause = useCallback(() => {
    if (phaseRef.current === 'playing' && endedRunRef.current !== runRef.current?.key) setPhase('paused');
  }, []);
  const resume = useCallback(() => {
    if (phaseRef.current === 'paused') setPhase('playing');
  }, []);

  const doRestart = useCallback(() => {
    setConfirmRestart(false);
    platform.analytics.track('game_restarted', { gameId: game.id });
    start({ resume: false });
  }, [game.id, start]);

  const requestRestart = useCallback(() => {
    // Restarting a resumable game throws away saved progress — confirm first.
    if (
      game.resumable &&
      run?.mode === 'normal' &&
      platform.saves.has(game.id) &&
      phaseRef.current !== 'over'
    ) {
      if (phaseRef.current === 'playing') setPhase('paused');
      setConfirmRestart(true);
    } else doRestart();
  }, [game.resumable, game.id, run?.mode, doRestart]);

  const exit = useCallback(() => goBack('/games'), []);

  const playAgain = useCallback(() => {
    void maybeShowInterstitial('between-games').then(() => start({ resume: false }));
  }, [start]);

  // ---- auto-pause real-time games when the tab is hidden or the window loses focus
  useEffect(() => {
    if (!game.realtime) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    const onBlur = () => pause();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [game.realtime, pause]);

  // ---- shell keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('dialog')))
        return;
      const p = phaseRef.current;
      if (e.key === 'Escape' || (e.key.toLowerCase() === 'p' && p !== 'ready')) {
        if (p === 'playing') {
          e.preventDefault();
          pause();
        } else if (p === 'paused') {
          e.preventDefault();
          resume();
        }
      } else if (e.key === 'Enter' && p === 'ready' && module && !(target instanceof HTMLButtonElement)) {
        e.preventDefault();
        start({ resume: platform.saves.has(game.id) && !dailyAvailable });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [module, pause, resume, start, game.id, dailyAvailable]);

  // Clean one-shot params so a refresh shows the ready screen instead of re-triggering.
  useEffect(() => {
    if (phase === 'playing' && (wantsContinue || wantsAutostart)) {
      navigate(`/games/${game.id}${dailyAvailable ? '?daily=1' : ''}`, { replace: true, keepScroll: true });
    }
  }, [phase, wantsContinue, wantsAutostart, game.id, dailyAvailable]);

  const Component = module?.Component;
  const style = {
    '--game-from': game.theme.from,
    '--game-to': game.theme.to,
    '--game-accent': game.theme.accent,
  } as CSSProperties;
  const canContinue = !dailyAvailable && !!saveEntry && !!module?.save;

  return (
    <div className={styles.shell} style={style}>
      <Hud
        game={game}
        mode={run?.mode ?? (dailyAvailable ? 'daily' : 'normal')}
        target={dailyAvailable ? (challenge?.target ?? null) : null}
        score={scoreStore}
        best={stats?.best ?? null}
        medal={stats?.medal ?? 0}
        canPause={phase === 'playing' || phase === 'paused'}
        paused={phase === 'paused'}
        canRestart={phase !== 'ready'}
        onExit={exit}
        onPauseToggle={phase === 'paused' ? resume : pause}
        onRestart={requestRestart}
      />
      <div className={styles.stage} data-testid="game-stage" data-phase={phase}>
        {run && api && Component && (
          <div className={styles.gameRoot} inert={phase === 'paused' || phase === 'over' ? true : undefined}>
            <GameErrorBoundary
              key={run.key}
              gameId={game.id}
              onRestart={doRestart}
              onExit={() => navigate('/')}
            >
              <Component key={run.key} api={api} paused={phase !== 'playing'} />
            </GameErrorBoundary>
          </div>
        )}
        {phase === 'ready' && (
          <ReadyOverlay
            game={game}
            stats={stats}
            loading={mod.status === 'loading'}
            loadError={mod.status === 'error'}
            canContinue={canContinue}
            continueLabel={saveEntry?.summary.label ?? null}
            daily={dailyAvailable && challenge ? { target: challenge.target } : null}
            onPlay={() => start({ resume: false })}
            onContinue={() => start({ resume: true })}
            onRetryLoad={mod.retry}
          />
        )}
        {phase === 'paused' && !confirmRestart && (
          <PauseOverlay
            game={game}
            onResume={resume}
            onRestart={requestRestart}
            onExit={exit}
            resumable={!!game.resumable}
          />
        )}
        {phase === 'over' && outcome && (
          <ResultsOverlay game={game} outcome={outcome} onPlayAgain={playAgain} onExit={exit} />
        )}
      </div>
      <Dialog open={confirmRestart} onClose={() => setConfirmRestart(false)} title="Start over?">
        <p style={{ color: 'var(--text-muted)' }}>
          Your current saved progress in {game.title} will be lost.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Button variant="danger" icon="restart" onClick={doRestart}>
            Restart
          </Button>
          <Button onClick={() => setConfirmRestart(false)}>Keep playing</Button>
        </div>
      </Dialog>
    </div>
  );
}
