/**
 * The primary metrics this scenario reports. Collected from the event stream
 * the client sees.
 */
export const metrics = [
  'total_latency',
  'framework_overhead',
  'runtime_time',
  'memory',
  'cpu'
] as const
