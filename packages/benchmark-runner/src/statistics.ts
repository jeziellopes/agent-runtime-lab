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
 * Computed from a sample of per-run values. `stdev` is the sample standard
 * deviation and is `0` for a sample of fewer than two runs, where it is
 * otherwise undefined.
 */
export function distributionOf(samples: readonly number[]): Distribution {
  const sorted = [...samples].sort((a, b) => a - b)
  const mean = sum(sorted) / sorted.length

  return {
    mean,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    stdev: stdev(sorted, mean),
    runs: sorted.length
  }
}

/**
 * Two cells differ only when
 *
 *     |mean_a - mean_b| > 1.96 x sqrt(sd_a^2/n_a + sd_b^2/n_b)
 *
 * Anything smaller is reported as "no measurable difference", not as a winner.
 */
export function differsSignificantly(
  a: Distribution,
  b: Distribution
): boolean {
  return Math.abs(a.mean - b.mean) > resolutionFloor(a, b)
}

/** `1.96 x SE`, the number a difference of means is compared against. */
export function resolutionFloor(a: Distribution, b: Distribution): number {
  return Z_95 * standardError(a, b)
}

function standardError(a: Distribution, b: Distribution): number {
  return Math.sqrt(a.stdev ** 2 / a.runs + b.stdev ** 2 / b.runs)
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function stdev(sorted: readonly number[], mean: number): number {
  if (sorted.length < 2) {
    return 0
  }

  const variance =
    sum(sorted.map(value => (value - mean) ** 2)) / (sorted.length - 1)

  return Math.sqrt(variance)
}

/** Nearest-rank on a value already sorted ascending. */
function percentile(sorted: readonly number[], p: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1)
  )

  return sorted[index] as number
}
