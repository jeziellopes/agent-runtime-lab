import { createHash, randomUUID } from 'node:crypto'

/**
 * Under deterministic mode the id is derived from the request rather than
 * counted, because a counted id depends on how many executions preceded it and
 * a golden cannot encode that: the contract suite does not own the cell's
 * lifecycle, and four earlier checks each execute before the byte comparison.
 *
 * Derivation also makes `specs/0009`'s claim that two runs of one request
 * produce the same id literally true, which a counter never did.
 */
export function deriveExecutionId(agentId: string, prompt: string): string {
  const digest = createHash('sha256')
    .update(`${agentId}\0${prompt}`)
    .digest('hex')

  return `exec-${digest.slice(0, 8)}`
}

export function randomExecutionId(): string {
  return `exec-${randomUUID()}`
}
