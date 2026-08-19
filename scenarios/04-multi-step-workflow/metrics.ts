/**
 * The primary metrics this scenario reports. Collected from `ExecutionResult`
 * timing and node-level accounting, and from the runner's own clock.
 */
export const metrics = [
  'node_transition_latency',
  'state_update_latency',
  'total_time'
] as const
