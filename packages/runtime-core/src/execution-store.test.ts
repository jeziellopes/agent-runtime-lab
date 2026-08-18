import { AgentError, ExecutionStatus } from '@arl/contracts'
import { beforeEach, describe, expect, it } from 'vitest'

import { MAX_EXECUTIONS, InMemoryExecutionStore } from './execution-store.js'

import type { Execution } from '@arl/contracts'

let store: InMemoryExecutionStore

function execution(id: string): Execution {
  return {
    id,
    agentId: 'simple-agent',
    status: ExecutionStatus.CREATED,
    input: { prompt: 'hello' },
    createdAt: new Date(0)
  }
}

beforeEach(() => {
  store = new InMemoryExecutionStore()
})

describe('holding executions', () => {
  it('returns what was created', async () => {
    await store.create(execution('e1'))

    await expect(store.get('e1')).resolves.toMatchObject({ id: 'e1' })
  })

  it('returns null for an id nobody created', async () => {
    await expect(store.get('e1')).resolves.toBeNull()
  })
})

describe('the retention ring', () => {
  it('evicts the oldest once the bound is passed', async () => {
    for (let index = 0; index <= MAX_EXECUTIONS; index += 1) {
      await store.create(execution(`e${String(index)}`))
    }

    await expect(store.get('e0')).resolves.toBeNull()
    await expect(store.get('e1')).resolves.toMatchObject({ id: 'e1' })
    await expect(
      store.get(`e${String(MAX_EXECUTIONS)}`)
    ).resolves.not.toBeNull()
  })
})

describe('the lifecycle', () => {
  it('moves through a transition the lifecycle allows', async () => {
    await store.create(execution('e1'))

    const moved = await store.transition('e1', ExecutionStatus.INITIALIZING)

    expect(moved.status).toBe(ExecutionStatus.INITIALIZING)
    await expect(store.get('e1')).resolves.toMatchObject({
      status: ExecutionStatus.INITIALIZING
    })
  })

  it('refuses a move the lifecycle disallows, leaving the status alone', async () => {
    await store.create(execution('e1'))

    await expect(
      store.transition('e1', ExecutionStatus.COMPLETED)
    ).rejects.toBeInstanceOf(AgentError)
    await expect(store.get('e1')).resolves.toMatchObject({
      status: ExecutionStatus.CREATED
    })
  })

  it('refuses to move out of a terminal state', async () => {
    await store.create(execution('e1'))
    await store.transition('e1', ExecutionStatus.CANCELLED)

    await expect(
      store.transition('e1', ExecutionStatus.RUNNING)
    ).rejects.toThrow(/cannot move from cancelled to running/)
  })

  it('refuses to transition an execution that does not exist', async () => {
    await expect(
      store.transition('ghost', ExecutionStatus.RUNNING)
    ).rejects.toThrow(/no execution with the id ghost/)
  })
})
