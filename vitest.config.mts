import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    clearMocks: true,
    include: [
      '{packages,adapters}/*/src/**/*.test.ts',
      '{agents,scenarios}/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      // Opt-in per file, at 100%. The list is what must be fully covered, not
      // the whole tree. A file belongs here only while it can be exercised
      // without a running cell; `suite.ts` asserts against one, and its own
      // coverage is what a suite run reports.
      include: [
        'packages/contracts/src/agent-summary.ts',
        'packages/contracts/src/cells.ts',
        'packages/contracts/src/errors.ts',
        'packages/contracts/src/execution-status.ts',
        'packages/events/src/event-type.ts',
        'packages/llm/src/fixtures.ts',
        'packages/llm/src/providers/replay/replay-provider.ts',
        'packages/llm/src/providers/replay/replay-stream.ts',
        'packages/tools/src/calculator/calculator-tool.ts',
        'packages/tools/src/registry.ts',
        'packages/tools/src/search/search-tool.ts',
        'packages/contract-tests/src/expected.ts',
        'packages/contract-tests/src/goldens.ts',
        'packages/contract-tests/src/headers.ts',
        'packages/contract-tests/src/sse.ts'
      ],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100
      }
    }
  }
})
