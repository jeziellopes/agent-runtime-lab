/**
 * The primary metrics this scenario reports. Collected from the event stream
 * the client sees.
 */
export const metrics = [
  'node_transition_latency',
  'state_update_latency',
  'total_time'
] as const
