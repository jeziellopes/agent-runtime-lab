/**
 * The primary metrics this scenario reports. Collected from the runner's own
 * clock, from the tool events in the unary response, and from `errorCount`.
 */
export const metrics = [
  'total_duration',
  'tool_execution_time',
  'event_count',
  'error_rate'
] as const
