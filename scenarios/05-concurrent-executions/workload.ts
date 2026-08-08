import type { ScenarioWorkload } from '../types.js'

export const workload: ScenarioWorkload = {
  prompt: 'Explain what an API gateway is.',
  // autocannon drives this one; the in-repo runner drives the agent scenarios.
  concurrency: [1, 10, 50, 100]
}
