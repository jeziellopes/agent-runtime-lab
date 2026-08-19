import { run } from './runner.js'

import type { RunOptions } from './runner.js'

const FLAG_NAMES = ['--framework', '--runtime', '--host'] as const

/**
 * `pnpm benchmark run`, `pnpm benchmark run simple-execution --framework hono
 * --runtime bun --host 127.0.0.1`, `pnpm benchmark run --framework nestjs
 * --runtime node` (no scenario, all seven against one cell).
 */
async function main(): Promise<void> {
  const results = await run(parseRunArgs(process.argv.slice(2)))

  process.stdout.write(
    `${String(results.length)} cell(s) written to results/\n`
  )
}

/**
 * The scenario is whichever token is neither a flag nor a flag's value.
 * Filtering argv for "does not start with --" alone also catches `nestjs`,
 * the value of `--framework`, whenever no scenario is named; flag values are
 * tracked by index and excluded from that search first.
 */
export function parseRunArgs(argv: readonly string[]): RunOptions {
  const flagIndices = new Set<number>()
  const options: RunOptions = {}

  for (const name of FLAG_NAMES) {
    const index = argv.indexOf(name)
    const value = argv[index + 1]

    if (index === -1 || value === undefined) {
      continue
    }

    options[name.slice(2) as keyof Omit<RunOptions, 'scenario'>] = value
    flagIndices.add(index)
    flagIndices.add(index + 1)
  }

  const scenario = argv.find(
    (arg, index) => !flagIndices.has(index) && !arg.startsWith('--')
  )

  return scenario === undefined ? options : { ...options, scenario }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
