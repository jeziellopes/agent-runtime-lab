import type { ScenarioWorkload } from '../types.js'

export const workload: ScenarioWorkload = {
  // FAKE: synthetic filler with exact token counts. No corpus dependency.
  prompt: '',
  syntheticTokens: [5000, 20000, 50000],
  concurrency: 1
}
