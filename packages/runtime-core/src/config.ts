import type { LLMMode, RuntimeConfig } from '@arl/contracts'

/**
 * The only module that reads `process.env`. Adapters must not read it: the
 * configuration is framework-independent and identical across all four cells.
 *
 * `llmMode` defaults to `replay`. Day-to-day development needs no API key.
 *
 * `deterministic` defaults to `false`, so a benchmark run reports real ids,
 * real timestamps and real metrics unless the contract suite asks otherwise.
 */
export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): RuntimeConfig {
  const llmMode: LLMMode = env.LLM_MODE === 'live' ? 'live' : 'replay'

  return {
    defaultModel: env.MODEL_NAME ?? '',
    maxIterations: integer(env.MAX_ITERATIONS, 10),
    timeoutMs: integer(env.TIMEOUT_MS, 30_000),
    llmMode,
    maxRetries: integer(env.MAX_RETRIES, 3),
    deterministic: env.DETERMINISTIC === 'true'
  }
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)

  return Number.isFinite(parsed) ? parsed : fallback
}
