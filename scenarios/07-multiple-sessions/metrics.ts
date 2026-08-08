/**
 * The primary metrics this scenario reports. Collected from the event stream
 * the client sees.
 */
export const metrics = [
  'session_isolation',
  'memory_lookup_latency',
  'persistence_performance'
] as const
