import { generateReport } from './report.js'

/** `pnpm benchmark report`, `pnpm benchmark report --results-dir results --out-dir results`. */
async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  await generateReport({
    resultsDir: flag(argv, '--results-dir') ?? 'results',
    outDir: flag(argv, '--out-dir') ?? 'results'
  })

  process.stdout.write('report written\n')
}

function flag(argv: readonly string[], name: string): string | undefined {
  return argv[argv.indexOf(name) + 1]
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
