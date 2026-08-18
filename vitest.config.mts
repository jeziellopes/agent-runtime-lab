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
        'adapters/hono/src/http/app.ts',
        'adapters/hono/src/http/error-mapping.ts',
        'adapters/hono/src/http/middleware/auth.ts',
        'adapters/hono/src/http/parse-request.ts',
        'adapters/hono/src/http/routes/*.ts',
        'adapters/hono/src/sse/frame-writer.ts',
        'adapters/nestjs/src/app.ts',
        'adapters/nestjs/src/controllers/*.ts',
        'adapters/nestjs/src/errors/*.ts',
        'adapters/nestjs/src/middleware/auth.middleware.ts',
        'adapters/nestjs/src/modules/app.module.ts',
        'adapters/nestjs/src/pipes/execution-request.pipe.ts',
        'adapters/nestjs/src/providers/runtime.provider.ts',
        'adapters/nestjs/src/sse/frame-writer.ts',
        'agents/index.ts',
        'agents/multi-step-agent/graph.ts',
        'agents/shared/nodes.ts',
        'agents/simple-agent/graph.ts',
        'agents/tool-agent/graph.ts',
        'packages/contracts/src/agent-summary.ts',
        'packages/contracts/src/cells.ts',
        'packages/contracts/src/errors.ts',
        'packages/contracts/src/execution-status.ts',
        'packages/events/src/event-type.ts',
        'packages/agent-engine/src/agent-engine.ts',
        'packages/runtime-core/src/agent-runtime-core.ts',
        'packages/runtime-core/src/config.ts',
        'packages/runtime-core/src/create-runtime.ts',
        'packages/runtime-core/src/event-stream.ts',
        'packages/runtime-core/src/execution-id.ts',
        'packages/runtime-core/src/execution-store.ts',
        'packages/runtime-core/src/retry-policy.ts',
        'packages/runtime-core/src/retrying-provider.ts',
        'packages/agent-engine/src/agent-registry.ts',
        'packages/graph-runtime/src/event-queue.ts',
        'packages/graph-runtime/src/graph-runtime.ts',
        'packages/graph-runtime/src/validate.ts',
        'packages/llm/src/fixtures.ts',
        'packages/llm/src/providers/replay/replay-provider.ts',
        'packages/llm/src/providers/replay/replay-stream.ts',
        'packages/memory/src/in-memory-store.ts',
        'packages/memory/src/namespace.ts',
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
