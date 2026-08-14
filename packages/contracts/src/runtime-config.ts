export type LLMMode = 'replay' | 'live'

/**
 * Framework-independent and identical across all four cells.
 *
 * `llmMode` defaults to `replay`. `live` is opt-in and used only to re-record
 * fixtures and verify against a real model.
 */
export interface RuntimeConfig {
  defaultModel: string
  maxIterations: number
  timeoutMs: number
  llmMode: LLMMode
  maxRetries: number

  /**
   * Execution ids come from a per-process counter, event timestamps are the
   * epoch, retry does not sleep, and `ExecutionResult.metrics` is omitted. What
   * makes byte-identity across cells assertable without masking a field.
   */
  deterministic: boolean
}
