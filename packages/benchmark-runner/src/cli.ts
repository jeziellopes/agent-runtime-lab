import { run } from './runner.js'

import type { RunOptions } from './runner.js'

/**
 * `pnpm benchmark run`, `pnpm benchmark run simple-execution --framework hono
 * --runtime bun --host 127.0.0.1`.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const [scenario] = argv.filter(arg => !arg.startsWith('--'))

  const options: RunOptions = {
    ...(scenario === undefined ? {} : { scenario }),
    ...flag(argv, '--framework'),
    ...flag(argv, '--runtime'),
    ...flag(argv, '--host')
  }
  const results = await run(options)

  process.stdout.write(
    `${String(results.length)} cell(s) written to results/\n`
  )
}

function flag(
  argv: readonly string[],
  name: '--framework' | '--runtime' | '--host'
): Partial<RunOptions> {
  const value = argv[argv.indexOf(name) + 1]

  if (argv.indexOf(name) === -1 || value === undefined) {
    return {}
  }

  const key = name.slice(2) as keyof RunOptions

  return { [key]: value }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
