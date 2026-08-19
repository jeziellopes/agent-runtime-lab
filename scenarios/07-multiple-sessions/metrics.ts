/**
 * The primary metrics this scenario reports. Collected by comparing the two
 * sessions' responses and from the runner's own clock.
 */
export const metrics = [
  'session_isolation',
  'memory_lookup_latency',
  'persistence_performance'
] as const
