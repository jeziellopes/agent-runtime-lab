/**
 * The primary metrics this scenario reports. Collected by `autocannon`, which
 * computes its own latency distribution and is not comparable to a scenario
 * driven by the in-repo runner.
 */
export const metrics = [
  'rps',
  'mean_latency',
  'p95_latency',
  'p99_latency',
  'error_rate',
  'memory_growth'
] as const
