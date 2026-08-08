import { AgentRuntimeCore, loadRuntimeConfig } from '@arl/runtime-core'

import type { Provider } from '@nestjs/common'

export const RUNTIME = 'AGENT_RUNTIME'

/**
 * The runtime is registered once and injected. This is the entire surface
 * through which the adapter reaches the runtime.
 *
 * Nothing below this line may contain agent logic, prompts, graphs, tool
 * implementations or memory handling.
 */
export const runtimeProvider: Provider = {
  provide: RUNTIME,
  useFactory: () => new AgentRuntimeCore(loadRuntimeConfig())
}
