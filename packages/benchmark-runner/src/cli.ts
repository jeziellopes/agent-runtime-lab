import { run } from './runner.js'

/**
 * `pnpm benchmark run`, `pnpm benchmark run simple-agent --framework hono
 * --runtime bun`, `pnpm benchmark report`.
 */
async function main(): Promise<void> {
  const [command] = process.argv.slice(2)

  if (command !== 'run' && command !== 'report') {
    process.stderr.write('usage: benchmark <run|report> [scenario] [flags]\n')
    process.exitCode = 1

    return
  }

  const results = await run({})

  process.stdout.write(`${results.length} results\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
