import type { ScenarioWorkload } from '../types.js'

export const workload: ScenarioWorkload = {
  prompt: 'What did I just ask you?',
  // Two interleaved sessionIds; neither may observe the other's history.
  sessions: 2,
  concurrency: 1
}
