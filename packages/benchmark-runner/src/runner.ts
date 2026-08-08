import type { ScenarioResult } from './metrics.js'

export interface RunOptions {
  scenario?: string
  framework?: 'nestjs' | 'hono'
  runtime?: 'node' | 'bun'
}

/**
 * Starts scenarios, drives requests, collects metrics and writes raw results.
 *
 * Two rules that live here and nowhere else: cells are interleaved, never run
 * back to back; and the load generator runs on the same host as the cell.
 */
export function run(_options: RunOptions): Promise<ScenarioResult[]> {
  throw new Error('run is not implemented')
}
