/**
 * Turns raw results into JSON, markdown and the published comparison
 * (`results/<cell>/report.md` plus the GitHub Pages page).
 *
 * Three things the generated report must carry:
 *
 *   - Each comparison presented per cell, with the framework effect and the
 *     runtime effect separated.
 *   - The resolution floor.
 *   - Its own limitations: replay removes real provider latency; the NestJS
 *     adapter bypasses `@Sse()`, so Nest's own SSE serializer is not measured;
 *     any cell needing workarounds has them disclosed as confounds; and the
 *     benchmark evaluates this architecture only.
 *
 * A published number states the hardware it was measured on.
 */
export interface ReportOptions {
  resultsDir: string
  outDir: string
}

export function generateReport(_options: ReportOptions): Promise<void> {
  throw new Error('generateReport is not implemented')
}
