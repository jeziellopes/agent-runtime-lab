import { llmNode, messagesFor, promptOf, respondNode } from '../shared/nodes.js'
import { STEPS, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from './prompts.js'

import type { AgentGraph, AgentNode, ExecutionContext } from '@arl/contracts'

function reasoningNode(id: keyof typeof STEPS): AgentNode {
  return llmNode(id, (context: ExecutionContext) =>
    messagesFor(
      SYSTEM_PROMPT,
      USER_PROMPT_TEMPLATE.replace('{step}', STEPS[id]).replace(
        '{prompt}',
        promptOf(context)
      )
    )
  )
}

/** Scenario 04: planner -> research -> analysis -> response. */
export const graph: AgentGraph = {
  entry: 'planner',
  nodes: [
    reasoningNode('planner'),
    reasoningNode('research'),
    reasoningNode('analysis'),
    respondNode('response')
  ],
  edges: [
    { from: 'planner', to: 'research' },
    { from: 'research', to: 'analysis' },
    { from: 'analysis', to: 'response' }
  ]
}
