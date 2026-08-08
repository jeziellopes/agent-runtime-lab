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
      // the whole tree.
      include: [
        'packages/contracts/src/execution-status.ts',
        'packages/events/src/event-type.ts',
        'packages/contract-tests/src/cells.ts',
        'packages/contract-tests/src/suite.ts'
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
