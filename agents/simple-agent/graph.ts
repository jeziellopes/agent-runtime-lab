import { llmNode, messagesFor, promptOf, respondNode } from '../shared/nodes.js'
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from './prompts.js'

import type { AgentGraph } from '@arl/contracts'

/** Scenario 01: client -> runtime -> LLM -> response. */
export const graph: AgentGraph = {
  entry: 'llm',
  nodes: [
    llmNode('llm', context =>
      messagesFor(
        SYSTEM_PROMPT,
        USER_PROMPT_TEMPLATE.replace('{prompt}', promptOf(context))
      )
    ),
    respondNode('response')
  ],
  edges: [{ from: 'llm', to: 'response' }]
}
