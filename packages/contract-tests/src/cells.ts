export type Framework = 'nestjs' | 'hono'

export type JsRuntime = 'node' | 'bun'

export interface Cell {
  /** The cell's directory name under `results/`. */
  readonly id: string
  readonly framework: Framework
  readonly runtime: JsRuntime
  readonly port: number
}

/**
 * The 2 x 2 matrix: two frameworks against two JS runtimes. Every cell must be
 * contract-green.
 *
 * Ports match `scripts/start.mjs` and `docker-compose.yml`.
 */
export const CELLS: readonly Cell[] = [
  { id: 'nestjs-node', framework: 'nestjs', runtime: 'node', port: 3000 },
  { id: 'hono-node', framework: 'hono', runtime: 'node', port: 3001 },
  { id: 'nestjs-bun', framework: 'nestjs', runtime: 'bun', port: 3002 },
  { id: 'hono-bun', framework: 'hono', runtime: 'bun', port: 3003 }
]

export function baseUrl(cell: Cell, host = '127.0.0.1'): string {
  return `http://${host}:${cell.port}`
}

export function findCell(framework: Framework, runtime: JsRuntime): Cell {
  const cell = CELLS.find(
    candidate =>
      candidate.framework === framework && candidate.runtime === runtime
  )

  if (!cell) {
    throw new Error(`no such cell: ${framework}/${runtime}`)
  }

  return cell
}
