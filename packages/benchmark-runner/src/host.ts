import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { cpus, platform, release, totalmem } from 'node:os'

export interface Host {
  cpu: string
  cores: { physical: number; logical: number }
  memoryGb: number
  os: string
  kernel: string
  nodeVersion: string
  bunVersion: string
}

/**
 * Reads `/proc` and `os`, which is Linux-shaped. A run on another platform
 * records what it can and leaves the rest empty rather than guessing.
 */
export function captureHost(): Host {
  return {
    cpu: cpus()[0]?.model ?? '',
    cores: { physical: physicalCoreCount(), logical: cpus().length },
    memoryGb: totalmem() / 1024 ** 3,
    os: platform(),
    kernel: release(),
    nodeVersion: stripV(process.version),
    bunVersion: bunVersion()
  }
}

/** Distinct `(physical id, core id)` pairs. Falls back to the logical count. */
function physicalCoreCount(): number {
  let raw: string

  try {
    raw = readFileSync('/proc/cpuinfo', 'utf8')
  } catch {
    return cpus().length
  }

  const seen = new Set<string>()
  let physicalId = '0'

  for (const line of raw.split('\n')) {
    if (line.startsWith('physical id')) {
      physicalId = line.split(':')[1]?.trim() ?? '0'
    }

    if (line.startsWith('core id')) {
      seen.add(`${physicalId}:${line.split(':')[1]?.trim() ?? ''}`)
    }
  }

  return seen.size > 0 ? seen.size : cpus().length
}

function bunVersion(): string {
  try {
    return execFileSync('bun', ['--version'], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function stripV(version: string): string {
  return version.startsWith('v') ? version.slice(1) : version
}
