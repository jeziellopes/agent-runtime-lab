/**
 * Never crosses HTTP, so it carries no category and no status (ADR-0022):
 * adding these to `RuntimeErrorCode` would force an entry in each adapter's
 * exhaustive status table for something no request can produce.
 */
export type BenchmarkErrorCode =
  | 'cell_start_failed'
  | 'cell_unreachable'
  | 'metrics_absent'
  | 'deterministic_mode'
  | 'scenario_unknown'
  | 'cell_unknown'
  | 'results_unreadable'
  | 'results_incomplete'
  | 'hosts_disagree'

export class BenchmarkError extends Error {
  constructor(
    public readonly code: BenchmarkErrorCode,
    detail: string
  ) {
    super(detail)
    this.name = 'BenchmarkError'
  }
}
