import { spawn } from 'node:child_process'

/**
 * `pnpm benchmark run [scenario] [flags]`, `pnpm benchmark report [flags]`.
 *
 * `benchmark-report` reads what `benchmark-runner` writes, so it depends on
 * that package; routing the two subcommands from here, rather than from
 * inside either package's own CLI, is what keeps that dependency one-way.
 */
const ENTRIES = {
  run: 'packages/benchmark-runner/dist/cli.js',
  report: 'packages/benchmark-report/dist/cli.js'
}

const [command, ...rest] = process.argv.slice(2)
const entry = ENTRIES[command]

if (!entry) {
  process.stderr.write(
    `usage: benchmark <run|report> [args]\nexpected one of: ${Object.keys(ENTRIES).join(', ')}\n`
  )
  process.exit(1)
}

spawn('node', [entry, ...rest], { stdio: 'inherit' }).on('exit', code =>
  process.exit(code ?? 0)
)
