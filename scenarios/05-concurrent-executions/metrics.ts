/**
 * The primary metrics this scenario reports. Collected from the event stream
 * the client sees.
 */
export const metrics = [
  'rps',
  'mean_latency',
  'p95_latency',
  'p99_latency',
  'error_rate',
  'memory_growth'
] as const
