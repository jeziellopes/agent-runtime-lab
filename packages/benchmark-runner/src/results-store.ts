import type { ScenarioResult } from './metrics.js'

/**
 * FAKE: stands in for a metrics backend.
 *
 * JSON files on disk, under `results/<cell>/metrics.json`. No Prometheus, no
 * time-series database, no Grafana.
 */
export function writeResults(
  _cellId: string,
  _results: readonly ScenarioResult[]
): Promise<void> {
  throw new Error('writeResults is not implemented')
}

export function readResults(_cellId: string): Promise<ScenarioResult[]> {
  throw new Error('readResults is not implemented')
}
