import type { Cell } from './cells.js'

/**
 * FAKE: the assertions are enumerated; `runContractSuite` throws.
 *
 * One suite, importing zero framework packages, run once per cell against a
 * base URL, asserting that every cell produces identical HTTP responses,
 * identical SSE event sequences and identical error mappings.
 *
 * Four rules hold for every assertion written here:
 *
 *   - Assert against the contract, never against what an adapter does.
 *   - SSE equivalence is asserted on the bytes (`od -c` on the raw response),
 *     so HTTP chunk framing is inside the comparison.
 *   - Compare header names case-insensitively and never assert header order.
 *     Express emits `x-powered-by` under Node and `X-Powered-By` under Bun, in
 *     a different position; header names are case-insensitive per RFC 9110.
 *   - Mid-stream errors arrive as an `execution.failed` event, not as a status
 *     code: the headers are already sent. The unary and streaming paths are
 *     asymmetric here.
 */

export interface ContractCheck {
  readonly id: string
  readonly passed: boolean
  readonly detail?: string
}

export interface ContractReport {
  readonly cell: Cell
  readonly checks: readonly ContractCheck[]
  readonly passed: boolean
}

/**
 * Everything the suite asserts. The first six are the endpoint surface; the
 * rest are the ways two adapters diverge by default.
 */
export const CONTRACT_ASSERTIONS = [
  'health.response',
  'agents.list',
  'agents.execute',
  'agents.stream',
  'executions.get',
  'executions.cancel',
  'sse.framing.bytes',
  'sse.event.sequence',
  'sse.event.id.monotonic',
  'sse.terminates.after.terminal.event',
  'error.status.per.category',
  'error.body.shape',
  'error.midstream.is.event.not.status',
  'cancel.aborts.provider.call',
  'headers.case.insensitive'
] as const

export type ContractAssertion = (typeof CONTRACT_ASSERTIONS)[number]

/** Runs every assertion above against one cell and reports what failed. */
export function runContractSuite(_cell: Cell): Promise<ContractReport> {
  throw new Error('runContractSuite is not implemented: this is the hard part')
}
