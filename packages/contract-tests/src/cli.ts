import { CELLS, findCell } from '@arl/contracts'

import { runContractSuite } from './suite.js'

import type { Cell, Framework, JsRuntime } from '@arl/contracts'

/**
 * `pnpm contract-test --all` and
 * `pnpm contract-test --framework hono --runtime bun --host hono-bun`.
 *
 * One line per check per cell, so `docker compose up` surfaces the verdict
 * without a reader parsing JSON. Exits non-zero if any cell failed.
 */
export function selected(argv: readonly string[]): readonly Cell[] {
  if (argv.includes('--all') || argv.length === 0) {
    return CELLS
  }

  const framework = argv[argv.indexOf('--framework') + 1] as Framework
  const runtime = argv[argv.indexOf('--runtime') + 1] as JsRuntime

  return [findCell(framework, runtime)]
}

export function flag(
  argv: readonly string[],
  name: string
): string | undefined {
  const index = argv.indexOf(name)

  return index === -1 ? undefined : argv[index + 1]
}

async function main(): Promise<void> {
  let failed = false
  const argv = process.argv.slice(2)
  const host = flag(argv, '--host')

  for (const cell of selected(argv)) {
    const report = await runContractSuite(cell, host)

    for (const check of report.checks) {
      const mark = check.passed ? 'pass' : 'FAIL'
      const detail = check.detail === undefined ? '' : ` -- ${check.detail}`

      process.stdout.write(`${cell.id} ${mark} ${check.id}${detail}\n`)
    }

    process.stdout.write(`${cell.id}: ${report.passed ? 'PASS' : 'FAIL'}\n`)

    failed ||= !report.passed
  }

  if (failed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
