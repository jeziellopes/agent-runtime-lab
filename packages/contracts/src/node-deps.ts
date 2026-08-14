import type { RuntimeEvent } from '@arl/events'

import type { LLMProvider } from './llm-provider.js'
import type { MemoryStore } from './memory-store.js'
import type { ToolRegistry } from './tool.js'

/**
 * What a node is handed to do its work, separate from `ExecutionContext`, which
 * stays data.
 *
 * A node reaches nothing it was not given, so an agent cannot acquire a
 * collaborator the runtime did not supply.
 */
export interface NodeDeps {
  provider: LLMProvider
  tools: ToolRegistry
  memory: MemoryStore
  emit(event: RuntimeEvent): void
  signal: AbortSignal
}
