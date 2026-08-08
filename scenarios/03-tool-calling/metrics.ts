/**
 * The primary metrics this scenario reports. Collected from the event stream
 * the client sees.
 */
export const metrics = [
  'total_duration',
  'tool_execution_time',
  'event_count',
  'error_rate'
] as const
