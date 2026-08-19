/**
 * The primary metrics this scenario reports. Collected from the runner's own
 * clock and counters, from `ExecutionResult.metrics`, and from the pid the
 * runner spawned.
 */
export const metrics = [
  'total_latency',
  'framework_overhead',
  'runtime_time',
  'memory',
  'cpu'
] as const
