export interface ScenarioDefinition {
  id: string
  agentId: string
  measures: string
  /**
   * 250 for latency scenarios, after 50 discarded warmup iterations; 3 for
   * concurrency and long context, which are reported as observations with their
   * spread shown and are excluded from the significance test.
   */
  measuredRuns: number
}

export interface ScenarioWorkload {
  prompt: string
  concurrency: number | readonly number[]
  streaming?: boolean
  sessions?: number
  syntheticTokens?: readonly number[]
}
