/**
 * What the runtime accounted for, so a client can subtract it from its own
 * clock and be left with adapter overhead.
 *
 * Durations are milliseconds as floats, from a monotonic clock. A wall clock
 * ticks at a millisecond and the quantity reported here is smaller than that.
 *
 * Absent under `RuntimeConfig.deterministic`: absence means not measured, and
 * zero is a measurement.
 */
export interface RuntimeMetrics {
  executionDuration: number
  graphDuration: number
  nodeDuration: number
  toolCalls: number
  llmCalls: number
  eventsGenerated: number
}
