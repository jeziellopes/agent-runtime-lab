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

export function flag(
  argv: readonly string[],
  name: string
): string | undefined {
  const index = argv.indexOf(name)

  return index === -1 ? undefined : argv[index + 1]
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
