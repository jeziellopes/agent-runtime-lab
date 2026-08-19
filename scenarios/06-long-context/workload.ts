import type { ScenarioWorkload } from '../types.js'

/**
 * `countTokens` measures whitespace-separated words, so the filler word
 * repeated `n` times is a prompt of exactly `n` tokens.
 */
function filler(tokens: number): string {
  return 'lorem '.repeat(tokens).trim()
}

const SYNTHETIC_TOKENS = [5000, 20000, 50000] as const

export const workload: ScenarioWorkload = {
  // FAKE: synthetic filler with exact token counts. No corpus dependency.
  prompt: filler(SYNTHETIC_TOKENS[0]),
  syntheticTokens: SYNTHETIC_TOKENS,
  syntheticPrompts: SYNTHETIC_TOKENS.map(filler),
  concurrency: 1
}
