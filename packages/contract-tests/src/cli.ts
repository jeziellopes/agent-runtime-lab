import { CELLS, findCell } from './cells.js'
import { runContractSuite } from './suite.js'

import type { Cell, Framework, JsRuntime } from './cells.js'

/**
 * `pnpm contract-test --all` and
 * `pnpm contract-test --framework hono --runtime bun`.
 *
 * Argument parsing is real; the suite it calls is not (see `suite.ts`).
 */
function selected(argv: readonly string[]): readonly Cell[] {
  if (argv.includes('--all')) {
    return CELLS
  }

  const framework = argv[argv.indexOf('--framework') + 1] as Framework
  const runtime = argv[argv.indexOf('--runtime') + 1] as JsRuntime

  return [findCell(framework, runtime)]
}

async function main(): Promise<void> {
  for (const cell of selected(process.argv.slice(2))) {
    const report = await runContractSuite(cell)

    process.stdout.write(`${cell.id}: ${report.passed ? 'PASS' : 'FAIL'}\n`)
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
