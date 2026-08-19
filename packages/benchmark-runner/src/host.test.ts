import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureHost } from './host.js'

import type NodeChildProcess from 'node:child_process'
import type NodeFs from 'node:fs'
import type NodeOs from 'node:os'

let cpuinfo: string | undefined
let bunAbsent = false
let noCpus = false

vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof NodeOs>()

  return { ...actual, cpus: () => (noCpus ? [] : actual.cpus()) }
})

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof NodeFs>()

  return {
    ...actual,
    readFileSync: (path: string, encoding: BufferEncoding) => {
      if (path !== '/proc/cpuinfo') {
        return actual.readFileSync(path, encoding)
      }

      if (cpuinfo === undefined) {
        throw new Error('no /proc on this platform')
      }

      return cpuinfo
    }
  }
})

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof NodeChildProcess>()

  return {
    ...actual,
    execFileSync: (file: string, args: readonly string[]) => {
      if (bunAbsent) {
        throw new Error('bun: command not found')
      }

      return actual.execFileSync(file, args, { encoding: 'utf8' })
    }
  }
})

describe('capturing the host', () => {
  afterEach(() => {
    cpuinfo = undefined
    bunAbsent = false
    noCpus = false
  })

  it('reports a non-empty cpu model', () => {
    expect(captureHost().cpu.length).toBeGreaterThan(0)
  })

  it('reports a positive logical core count', () => {
    expect(captureHost().cores.logical).toBeGreaterThan(0)
  })

  it('reports a positive physical core count', () => {
    expect(captureHost().cores.physical).toBeGreaterThan(0)
  })

  it('reports a positive memory figure', () => {
    expect(captureHost().memoryGb).toBeGreaterThan(0)
  })

  it('reports the node version without a leading v', () => {
    expect(captureHost().nodeVersion).not.toMatch(/^v/)
  })

  it('leaves a version with no leading v unchanged', () => {
    const original = Object.getOwnPropertyDescriptor(process, 'version')

    Object.defineProperty(process, 'version', {
      value: '24.4.1',
      configurable: true
    })

    try {
      expect(captureHost().nodeVersion).toBe('24.4.1')
    } finally {
      if (original !== undefined) {
        Object.defineProperty(process, 'version', original)
      }
    }
  })

  it('reports the same host block on repeated calls', () => {
    expect(captureHost()).toEqual(captureHost())
  })

  it('falls back to the logical core count when /proc/cpuinfo cannot be read', () => {
    const logical = captureHost().cores.logical

    expect(captureHost().cores.physical).toBe(logical)
  })

  it('counts distinct physical id/core id pairs from /proc/cpuinfo', () => {
    cpuinfo = [
      'processor\t: 0',
      'physical id\t: 0',
      'core id\t: 0',
      '',
      'processor\t: 1',
      'physical id\t: 0',
      'core id\t: 1',
      ''
    ].join('\n')

    expect(captureHost().cores.physical).toBe(2)
  })

  it('falls back to the logical core count when no line names a core id', () => {
    cpuinfo = 'processor\t: 0\n'

    expect(captureHost().cores.physical).toBe(captureHost().cores.logical)
  })

  it('falls back to an unlabelled physical id when a line carries no value', () => {
    cpuinfo = ['physical id', 'core id\t: 0', ''].join('\n')

    expect(captureHost().cores.physical).toBe(1)
  })

  it('falls back to an unlabelled core id when a line carries no value', () => {
    cpuinfo = ['physical id\t: 0', 'core id', ''].join('\n')

    expect(captureHost().cores.physical).toBe(1)
  })

  it('reports an empty cpu model when the host reports no cpus at all', () => {
    noCpus = true

    expect(captureHost().cpu).toBe('')
  })

  it('reports an empty bun version when bun is not on the path', () => {
    bunAbsent = true

    expect(captureHost().bunVersion).toBe('')
  })
})
