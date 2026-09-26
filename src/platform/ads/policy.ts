/**
 * Ad pacing: the rules that keep ads from getting in the way.
 *
 *  - Rewarded ads are always opt-in (the player presses a button that says an
 *    ad will play) and never capped by pacing — they are the player's choice.
 *  - Interstitials only ever appear between rounds, never before the player's
 *    third round of a visit, at most every three minutes, and not shortly
 *    after the player chose to watch a rewarded ad.
 */
export const PACING = {
  minRoundsBeforeFirst: 3,
  minIntervalMs: 180_000,
  graceAfterRewardedMs: 150_000,
  /** Rounds shorter than this don't count towards the interstitial budget. */
  minRoundMs: 15_000,
} as const;

export interface PacingState {
  rounds: number;
  lastInterstitialAt: number | null;
  lastRewardedAt: number | null;
}

export const initialPacing = (): PacingState => ({
  rounds: 0,
  lastInterstitialAt: null,
  lastRewardedAt: null,
});

export function shouldShowInterstitial(state: PacingState, now: number): boolean {
  if (state.rounds < PACING.minRoundsBeforeFirst) return false;
  if (state.lastInterstitialAt !== null && now - state.lastInterstitialAt < PACING.minIntervalMs)
    return false;
  if (state.lastRewardedAt !== null && now - state.lastRewardedAt < PACING.graceAfterRewardedMs) return false;
  return true;
}

export function noteRound(state: PacingState, durationMs: number): PacingState {
  return durationMs >= PACING.minRoundMs ? { ...state, rounds: state.rounds + 1 } : state;
}
