/**
 * Defined in `@arl/events` and re-exported here, because `execution.completed`
 * carries the same block and this package depends on that one.
 *
 * Durations are milliseconds as floats, from a monotonic clock. A wall clock
 * ticks at a millisecond and the quantity reported here is smaller than that.
 *
 * Absent under `RuntimeConfig.deterministic`: absence means not measured, and
 * zero is a measurement.
 */
export type { RuntimeMetrics } from '@arl/events'
