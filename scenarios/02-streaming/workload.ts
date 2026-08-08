import type { ScenarioWorkload } from '../types.js'

export const workload: ScenarioWorkload = {
  prompt: 'Explain what an API gateway is.',
  concurrency: 1,
  // Dropped events are detected via the monotonic SSE event id.
  streaming: true
}
