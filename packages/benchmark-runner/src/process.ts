import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'

import { baseUrl } from '@arl/contracts'

import { BenchmarkError } from './errors.js'

import type { Cell } from '@arl/contracts'
import type { ResourceMetrics } from './metrics.js'

const HEALTH_TIMEOUT_MS = 30_000
const HEALTH_POLL_MS = 100
const CLOCK_TICKS_PER_SECOND = 100

export interface SpawnedCell {
  cell: Cell
  /** The pid `sampleResourceUsage` reads: the framework process itself. */
  pid: number
  /**
   * The `scripts/start.mjs` wrapper's own pid, which `detached: true` also
   * makes its process group id. `stopCell` signals this, negated, because
   * the framework process it wraps is not a group leader and cannot be
   * signalled by its own pid.
   */
  groupPid: number
  startupTimeMs: number
}

/**
 * Spawns one cell through `scripts/start.mjs`, with `FIXTURE_SET=benchmark`
 * added to the environment it forwards, and waits for its first successful
 * `GET /health`. The process group is detached, so `stopCell` can reach every
 * process it spawned, including the framework process `start.mjs` launches as
 * its own child.
 */
export function spawnCell(
  cell: Cell,
  host: string,
  healthTimeoutMs = HEALTH_TIMEOUT_MS
): Promise<SpawnedCell> {
  const startedAt = performance.now()
  const child = spawn(
    'node',
    [
      'scripts/start.mjs',
      '--framework',
      cell.framework,
      '--runtime',
      cell.runtime
    ],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, FIXTURE_SET: 'benchmark' }
    }
  )

  return new Promise((resolve, reject) => {
    child.once('error', (cause: unknown) => {
      reject(
        new BenchmarkError('cell_start_failed', `${cell.id}: ${String(cause)}`)
      )
    })

    child.once('exit', code => {
      reject(
        new BenchmarkError(
          'cell_start_failed',
          `${cell.id}: exited with code ${String(code)} before answering /health`
        )
      )
    })

    waitForHealth(cell, host, healthTimeoutMs)
      .then(async () => {
        child.removeAllListeners('error')
        child.removeAllListeners('exit')

        resolve({
          cell,
          pid: (await childPid(child.pid)) ?? child.pid ?? -1,
          groupPid: child.pid ?? -1,
          startupTimeMs: performance.now() - startedAt
        })
      })
      .catch((cause: unknown) => {
        reject(cause)
      })
  })
}

/** Signals the whole process group, so the framework process is stopped too. */
export function stopCell(spawned: SpawnedCell): void {
  try {
    process.kill(-spawned.groupPid, 'SIGTERM')
  } catch {
    /* Already exited: nothing left to stop. */
  }
}

async function waitForHealth(
  cell: Cell,
  host: string,
  timeoutMs: number
): Promise<void> {
  const deadline = performance.now() + timeoutMs

  for (;;) {
    try {
      const response = await fetch(`${baseUrl(cell, host)}/health`)

      if (response.ok) {
        return
      }
    } catch {
      /* Not listening yet. */
    }

    if (performance.now() >= deadline) {
      throw new BenchmarkError(
        'cell_unreachable',
        `${cell.id}: no successful /health within ${String(timeoutMs)}ms`
      )
    }

    await new Promise(resolve => setTimeout(resolve, HEALTH_POLL_MS))
  }
}

/**
 * The pid `scripts/start.mjs` spawned for the framework process, read from
 * `/proc`. Falls back to the wrapper's own pid where `/proc` cannot answer.
 */
async function childPid(
  wrapperPid: number | undefined
): Promise<number | undefined> {
  if (wrapperPid === undefined) {
    return undefined
  }

  try {
    const raw = await readFile(
      `/proc/${String(wrapperPid)}/task/${String(wrapperPid)}/children`,
      'utf8'
    )
    const [first] = raw
      .trim()
      .split(/\s+/)
      .filter(entry => entry.length > 0)

    return first === undefined ? wrapperPid : Number(first)
  } catch {
    return wrapperPid
  }
}

/**
 * `cpu`, `memory` and peak memory from `/proc/<pid>/stat` and
 * `/proc/<pid>/status`. Peak memory reads `VmHWM`, the high-water mark of
 * resident memory: `VmData`, a virtual address-space reservation rather than
 * memory in use, reads as tens of gigabytes on Bun's engine and is not a
 * heap figure for either runtime. A pid that has already exited, or a
 * non-Linux host, reads as all zeros rather than throwing: a resource
 * sample is never load-bearing enough to fail a measured round over.
 */
export async function sampleResourceUsage(
  pid: number
): Promise<ResourceMetrics> {
  try {
    const [stat, status, uptime] = await Promise.all([
      readFile(`/proc/${String(pid)}/stat`, 'utf8'),
      readFile(`/proc/${String(pid)}/status`, 'utf8'),
      readFile('/proc/uptime', 'utf8')
    ])

    return {
      cpuPercent: cpuPercentOf(stat, uptime),
      memoryMb: statusFieldKb(status, 'VmRSS') / 1024,
      peakMemoryMb: statusFieldKb(status, 'VmHWM') / 1024,
      startupTimeMs: 0
    }
  } catch {
    return { cpuPercent: 0, memoryMb: 0, peakMemoryMb: 0, startupTimeMs: 0 }
  }
}

function cpuPercentOf(stat: string, uptime: string): number {
  const afterComm = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const utime = Number(afterComm[11])
  const stime = Number(afterComm[12])
  const starttime = Number(afterComm[19])
  const systemUptime = Number(uptime.trim().split(/\s+/)[0])
  const processUptime = systemUptime - starttime / CLOCK_TICKS_PER_SECOND

  if (!(processUptime > 0)) {
    return 0
  }

  return ((utime + stime) / CLOCK_TICKS_PER_SECOND / processUptime) * 100
}

function statusFieldKb(status: string, field: string): number {
  const line = status
    .split('\n')
    .find(candidate => candidate.startsWith(`${field}:`))
  const match = /(\d+)\s*kB/.exec(line ?? '')

  return match === null ? 0 : Number(match[1])
}
