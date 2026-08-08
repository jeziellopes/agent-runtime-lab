/**
 * The primary metrics this scenario reports. Collected from the event stream
 * the client sees.
 */
export const metrics = [
  'duration',
  'memory',
  'token_processing_time',
  'streaming_stability'
] as const
