import type { AgentRuntime } from '@arl/contracts'
import type { Provider } from '@nestjs/common'

export const RUNTIME = 'AGENT_RUNTIME'

/**
 * The runtime is registered once and injected. This is the entire surface
 * through which the adapter reaches the runtime.
 *
 * Nothing below this line may contain agent logic, prompts, graphs, tool
 * implementations or memory handling.
 */
export function runtimeProvider(runtime: AgentRuntime): Provider {
  return { provide: RUNTIME, useValue: runtime }
}
