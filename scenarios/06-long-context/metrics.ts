/**
 * The primary metrics this scenario reports. Collected from the runner's own
 * clock, from the pid the runner spawned, and from the SSE event stream.
 */
export const metrics = [
  'duration',
  'memory',
  'token_processing_time',
  'streaming_stability'
] as const
