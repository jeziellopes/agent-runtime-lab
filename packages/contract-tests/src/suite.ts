import { ExecutionStatus, baseUrl } from '@arl/contracts'
import { isTerminalEvent } from '@arl/events'

import { EXPECTED_RUNS, GOLDEN_RUNS } from './expected.js'
import { loadGoldens } from './goldens.js'
import { headerValue } from './headers.js'
import { json, parseJson, request } from './http.js'
import { eventTypes, idsAreMonotonic, parseFrames } from './sse.js'

import type { Cell, ExecutionResult, RuntimeErrorCode } from '@arl/contracts'
import type { RUNTIME_EVENT_TYPES } from '@arl/events'
import type { ExpectedRun } from './expected.js'
import type { HttpResponse } from './http.js'

/**
 * One suite, importing zero framework packages, run once per cell against a
 * base URL, asserting that every cell produces identical HTTP responses,
 * identical SSE event sequences and identical error mappings.
 *
 * Four rules hold for every assertion written here:
 *
 *   - Assert against the contract, never against what an adapter does.
 *   - SSE equivalence is asserted on the bytes, so HTTP chunk framing is
 *     inside the comparison.
 *   - Compare header names case-insensitively and never assert header order.
 *   - Mid-stream errors arrive as an `execution.failed` event, not as a status
 *     code: the headers are already sent.
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
  'headers.case.insensitive',
  'deterministic.omits.metrics'
] as const

export type ContractAssertion = (typeof CONTRACT_ASSERTIONS)[number]

/** No frame may carry a type outside the twelve. */
const TWELVE: readonly (typeof RUNTIME_EVENT_TYPES)[number][] = [
  'execution.created',
  'execution.started',
  'node.started',
  'node.completed',
  'llm.started',
  'llm.token',
  'llm.completed',
  'tool.started',
  'tool.completed',
  'execution.completed',
  'execution.failed',
  'execution.cancelled'
]

/**
 * Every row of `specs/0004`'s table. The four that no black-box client could
 * otherwise reach are induced by the reserved prompts in `specs/0017`.
 */
const INDUCIBLE_ERRORS: readonly {
  readonly what: string
  readonly path: string
  readonly body: unknown
  readonly status: number
  readonly code: RuntimeErrorCode
  readonly keys: readonly string[]
}[] = [
  {
    what: 'an unknown agent id',
    path: '/agents/no-such-agent/execute',
    body: { input: { prompt: 'anything' } },
    status: 404,
    code: 'agent_not_found',
    keys: ['error', 'detail']
  },
  {
    what: 'a request with no prompt',
    path: '/agents/simple-agent/execute',
    body: {},
    status: 400,
    code: 'invalid_request',
    keys: ['error', 'detail']
  },
  {
    what: 'a provider that never answers',
    path: '/agents/simple-agent/execute',
    body: { input: { prompt: '__fail_provider__' } },
    status: 503,
    code: 'provider_error',
    keys: ['error', 'detail']
  },
  {
    what: 'a provider that rate limits every attempt',
    path: '/agents/simple-agent/execute',
    body: { input: { prompt: '__fail_rate_limit__' } },
    status: 429,
    code: 'rate_limited',
    keys: ['error', 'detail', 'retryAfter']
  },
  {
    what: 'an expression the calculator rejects',
    path: '/agents/tool-agent/execute',
    body: { input: { prompt: 'Calculate 1 / bananas' } },
    status: 422,
    code: 'tool_error',
    keys: ['error', 'detail']
  }
]

interface Suite {
  readonly base: string
  readonly goldens: Map<string, string>
}

type Check = (suite: Suite) => Promise<void>

/** Runs every assertion above against one cell and reports what failed. */
export async function runContractSuite(
  cell: Cell,
  host?: string
): Promise<ContractReport> {
  const suite: Suite = {
    base: baseUrl(cell, host),
    goldens: loadGoldens()
  }

  const checks: ContractCheck[] = []

  for (const id of CONTRACT_ASSERTIONS) {
    checks.push(await runCheck(id, CHECKS[id], suite))
  }

  return { cell, checks, passed: checks.every(check => check.passed) }
}

async function runCheck(
  id: ContractAssertion,
  check: Check,
  suite: Suite
): Promise<ContractCheck> {
  try {
    await check(suite)

    return { id, passed: true }
  } catch (failure) {
    return { id, passed: false, detail: String(failure) }
  }
}

const CHECKS: Readonly<Record<ContractAssertion, Check>> = {
  'health.response': async suite => {
    const response = await request(`${suite.base}/health`)

    expect(
      response.status === 200,
      `status ${String(response.status)}, want 200`
    )

    const body = parseJson<Record<string, unknown>>(response)

    expect(
      keysEqual(body, ['status', 'uptime']),
      `keys ${Object.keys(body).sort().join(',')}, want status,uptime`
    )
    expect(body.status === 'ok', `status ${String(body.status)}, want ok`)
    expect(typeof body.uptime === 'number', 'uptime is not a number')
  },

  'agents.list': async suite => {
    const response = await request(`${suite.base}/agents`)

    expect(
      response.status === 200,
      `status ${String(response.status)}, want 200`
    )

    const ids = parseJson<{ id: string }[]>(response)
      .map(agent => agent.id)
      .sort()

    expect(
      ids.join(',') === 'multi-step-agent,simple-agent,tool-agent',
      `agents ${ids.join(',')}`
    )
  },

  'agents.execute': async suite => {
    const response = await execute(suite, 'simple-agent', run('simple-agent'))

    expect(
      response.status === 200,
      `status ${String(response.status)}, want 200`
    )

    const result = parseJson<ExecutionResult>(response)

    expect(
      result.status === ExecutionStatus.COMPLETED,
      `status ${String(result.status)}, want ${ExecutionStatus.COMPLETED}`
    )
    expect(
      typeof result.executionId === 'string' && result.executionId.length > 0,
      'executionId is absent or empty'
    )
  },

  'agents.stream': async suite => {
    const response = await stream(suite, run('simple-agent'))

    expect(
      response.status === 200,
      `status ${String(response.status)}, want 200`
    )

    const contentType = headerValue(response.headers, 'content-type')

    expect(
      contentType === 'text/event-stream',
      `content-type ${String(contentType)}, want text/event-stream exactly`
    )
  },

  'executions.get': async suite => {
    const executed = parseJson<ExecutionResult>(
      await execute(suite, 'simple-agent', run('simple-agent'))
    )
    const found = await request(
      `${suite.base}/executions/${executed.executionId}`
    )

    expect(found.status === 200, `status ${String(found.status)}, want 200`)
    expect(
      parseJson<{ id: string }>(found).id === executed.executionId,
      'the execution read back under a different id'
    )

    const missing = await request(`${suite.base}/executions/no-such-execution`)

    expect(missing.status === 404, `status ${String(missing.status)}, want 404`)
    expect(
      parseJson<{ error: string }>(missing).error === 'execution_not_found',
      'unknown id did not report execution_not_found'
    )
  },

  'executions.cancel': async suite => {
    const executed = parseJson<ExecutionResult>(
      await execute(suite, 'simple-agent', run('simple-agent'))
    )
    const cancelled = await request(
      `${suite.base}/executions/${executed.executionId}`,
      { method: 'DELETE' }
    )

    expect(
      cancelled.status === 204,
      `status ${String(cancelled.status)}, want 204`
    )
    expect(cancelled.raw === '', 'the response carried a body')
  },

  'sse.framing.bytes': async suite => {
    for (const expected of GOLDEN_RUNS) {
      const response = await stream(suite, expected)
      const golden = suite.goldens.get(expected.agentId) ?? ''

      expect(
        response.raw === golden,
        `${expected.agentId}: ${describeFirstDifference(response.raw, golden)}`
      )
    }
  },

  'sse.event.sequence': async suite => {
    for (const expected of EXPECTED_RUNS) {
      const types = eventTypes(parseFrames((await stream(suite, expected)).raw))

      for (const type of types) {
        expect(
          TWELVE.includes(type),
          `${expected.agentId}: ${type} is not one of the twelve`
        )
      }

      expect(
        types.join(',') === expected.events.join(','),
        `${expected.agentId}: sequence differs from specs/0008`
      )
    }
  },

  'sse.event.id.monotonic': async suite => {
    for (const expected of GOLDEN_RUNS) {
      const frames = parseFrames((await stream(suite, expected)).raw)

      expect(
        frames.length === expected.events.length,
        `${expected.agentId}: ${String(frames.length)} frames, want ${String(expected.events.length)}`
      )
      expect(
        idsAreMonotonic(frames),
        `${expected.agentId}: ids ${frames.map(frame => frame.id).join(',')}`
      )
    }
  },

  'sse.terminates.after.terminal.event': async suite => {
    for (const expected of GOLDEN_RUNS) {
      const types = eventTypes(parseFrames((await stream(suite, expected)).raw))
      const terminal = types.findIndex(isTerminalEvent)

      expect(terminal !== -1, `${expected.agentId}: no terminal event`)
      expect(
        terminal === types.length - 1,
        `${expected.agentId}: ${String(types.length - 1 - terminal)} frames follow the terminal event`
      )
    }
  },

  'error.status.per.category': async suite => {
    for (const row of INDUCIBLE_ERRORS) {
      const response = await request(`${suite.base}${row.path}`, json(row.body))

      expect(
        response.status === row.status,
        `${row.what}: status ${String(response.status)}, want ${String(row.status)}`
      )
    }
  },

  'error.body.shape': async suite => {
    for (const row of INDUCIBLE_ERRORS) {
      const response = await request(`${suite.base}${row.path}`, json(row.body))
      const body = parseJson<Record<string, unknown>>(response)

      expect(
        keysEqual(body, row.keys),
        `${row.what}: keys ${Object.keys(body).sort().join(',')}, want ${[...row.keys].sort().join(',')}`
      )
      expect(
        body.error === row.code,
        `${row.what}: error ${String(body.error)}, want ${row.code}`
      )
      expect(
        typeof body.detail === 'string' && body.detail.length > 0,
        `${row.what}: detail is absent or empty`
      )

      if (row.status !== 429) {
        continue
      }

      expect(
        headerValue(response.headers, 'retry-after') ===
          String(body.retryAfter),
        `${row.what}: Retry-After header and retryAfter body disagree`
      )
    }
  },

  'error.midstream.is.event.not.status': async suite => {
    const response = await request(
      `${suite.base}/agents/simple-agent/stream`,
      json({ input: { prompt: '__fail_midstream__' } })
    )

    expect(
      response.status === 200,
      `status ${String(response.status)}: a failure after the headers cannot change them`
    )

    const types = eventTypes(parseFrames(response.raw))
    const tokens = types.filter(type => type === 'llm.token').length

    expect(tokens === 3, `${String(tokens)} llm.token frames, want 3`)
    expect(
      types[types.length - 1] === 'execution.failed',
      `stream ended with ${String(types[types.length - 1])}, want execution.failed`
    )
    expect(
      types.filter(isTerminalEvent).length === 1,
      'more than one terminal event'
    )
  },

  'cancel.aborts.provider.call': async suite => {
    const executed = parseJson<ExecutionResult>(
      await execute(suite, 'simple-agent', run('simple-agent'))
    )

    await request(`${suite.base}/executions/${executed.executionId}`, {
      method: 'DELETE'
    })

    const found = await request(
      `${suite.base}/executions/${executed.executionId}`
    )

    expect(
      parseJson<{ status: string }>(found).status === ExecutionStatus.CANCELLED,
      `the execution did not read back as ${ExecutionStatus.CANCELLED}`
    )
  },

  'headers.case.insensitive': async suite => {
    const response = await request(`${suite.base}/health`)
    const upper = headerValue(response.headers, 'CONTENT-TYPE')

    expect(upper !== undefined, 'the response carried no content-type at all')
    expect(
      upper === headerValue(response.headers, 'content-type'),
      'header lookup is case-sensitive'
    )
  },

  'deterministic.omits.metrics': async suite => {
    const response = await execute(suite, 'simple-agent', run('simple-agent'))
    const result = parseJson<Record<string, unknown>>(response)

    expect(
      !('metrics' in result),
      'ExecutionResult carried a metrics block under deterministic mode'
    )

    const frames = parseFrames((await stream(suite, run('simple-agent'))).raw)

    for (const frame of frames) {
      if (frame.data.type !== 'execution.completed') {
        continue
      }

      expect(
        !('metrics' in frame.data.data),
        'execution.completed carried a metrics block under deterministic mode'
      )
    }
  }
}

function run(agentId: string): ExpectedRun {
  const found = EXPECTED_RUNS.find(candidate => candidate.agentId === agentId)

  if (!found) {
    throw new Error(`no expected run for ${agentId}`)
  }

  return found
}

function execute(
  suite: Suite,
  agentId: string,
  expected: ExpectedRun
): Promise<HttpResponse> {
  return request(
    `${suite.base}/agents/${agentId}/execute`,
    json({ input: { prompt: expected.prompt } })
  )
}

function stream(suite: Suite, expected: ExpectedRun): Promise<HttpResponse> {
  return request(
    `${suite.base}/agents/${expected.agentId}/stream`,
    json({ input: { prompt: expected.prompt } })
  )
}

function expect(condition: boolean, detail: string): void {
  if (!condition) {
    throw new Error(detail)
  }
}

function keysEqual(body: object, want: readonly string[]): boolean {
  return Object.keys(body).sort().join(',') === [...want].sort().join(',')
}

/** Names the offset, because "the bytes differ" is not a usable report. */
function describeFirstDifference(actual: string, expected: string): string {
  const limit = Math.min(actual.length, expected.length)

  for (let index = 0; index < limit; index += 1) {
    if (actual[index] !== expected[index]) {
      return `first difference at byte ${String(index)}: ${JSON.stringify(actual.slice(index, index + 40))} vs ${JSON.stringify(expected.slice(index, index + 40))}`
    }
  }

  return `lengths differ: ${String(actual.length)} vs ${String(expected.length)}`
}
