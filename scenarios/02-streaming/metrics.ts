/**
 * The primary metrics this scenario reports. Collected from the event stream
 * the client sees.
 */
export const metrics = [
  'time_to_first_event',
  'time_to_first_token',
  'token_throughput',
  'connection_duration',
  'dropped_events'
] as const
