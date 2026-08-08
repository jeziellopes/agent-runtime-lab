/** Discarded, per cell per scenario. */
export const WARMUP_RUNS = 50

/** Measured, per cell per scenario, for the latency scenarios. */
export const MEASURED_RUNS_LATENCY = 250

/**
 * Concurrency and long context. Reported as observations with their spread
 * shown, never as a ranking, and excluded from the significance test below.
 */
export const MEASURED_RUNS_OBSERVATIONAL = 3

/** Two-sided 95%. */
export const Z_95 = 1.96

export interface Distribution {
  mean: number
  p50: number
  p95: number
  p99: number
  stdev: number
  runs: number
}

/**
 * Two cells differ only when
 *
 *     |mean_a - mean_b| > 1.96 x sqrt(sd_a^2/n_a + sd_b^2/n_b)
 *
 * Anything smaller is reported as "no measurable difference", not as a winner.
 */
export function differsSignificantly(
  _a: Distribution,
  _b: Distribution
): boolean {
  throw new Error('differsSignificantly is not implemented')
}
