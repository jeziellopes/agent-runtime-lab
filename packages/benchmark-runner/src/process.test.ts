import { findCell } from '@arl/contracts'
import { afterEach, describe, expect, it } from 'vitest'

import { sampleResourceUsage, spawnCell, stopCell } from './process.js'

import type { SpawnedCell } from './process.js'

describe('sampling resource usage', () => {
  it('reports a positive memory figure for a live pid', async () => {
    const usage = await sampleResourceUsage(process.pid)

    expect(usage.memoryMb).toBeGreaterThan(0)
  })

  it('reports zeros for a pid that does not exist', async () => {
    const usage = await sampleResourceUsage(999_999_999)

    expect(usage).toEqual({
      cpuPercent: 0,
      memoryMb: 0,
      heapMb: 0,
      startupTimeMs: 0
    })
  })
})

describe('spawning and stopping a cell', () => {
  let spawned: SpawnedCell | undefined

  afterEach(() => {
    if (spawned !== undefined) {
      stopCell(spawned)
      spawned = undefined
    }
  })

  it('resolves once the cell answers its first successful health check', async () => {
    spawned = await spawnCell(findCell('hono', 'node'), '127.0.0.1')

    expect(spawned.startupTimeMs).toBeGreaterThan(0)
    expect(spawned.pid).toBeGreaterThan(0)
  }, 20_000)

  it('leaves no process behind once stopped', async () => {
    spawned = await spawnCell(findCell('hono', 'node'), '127.0.0.1')
    const { pid, groupPid } = spawned

    stopCell(spawned)
    spawned = undefined

    await new Promise(resolve => setTimeout(resolve, 500))

    expect(() => process.kill(pid, 0)).toThrow()
    expect(() => process.kill(groupPid, 0)).toThrow()
  }, 20_000)
})
