import { RuntimeError, ToolError } from '@arl/contracts'

import {
  answerOf,
  callModel,
  llmNode,
  messagesFor,
  promptOf,
  toolResultsOf
} from '../shared/nodes.js'
import {
  RESPONSE_PROMPT_TEMPLATE,
  SYSTEM_PROMPT,
  USER_PROMPT_TEMPLATE
} from './prompts.js'
import { CALCULATOR } from './tools.js'

import type { AgentGraph, AgentNode, RuntimeErrorCode } from '@arl/contracts'

/** `Calculate 125 * 50` is the prompt; `125 * 50` is what the calculator takes. */
const CALCULATE = /^Calculate\s+/

const planner = llmNode('planner', context =>
  messagesFor(
    SYSTEM_PROMPT,
    USER_PROMPT_TEMPLATE.replace('{prompt}', promptOf(context))
  )
)

/**
 * Routes on what the planner asked for. The planner names a tool or it does
 * not, and the registry is what decides whether that name is one.
 */
const decision: AgentNode = {
  id: 'decision',
  execute: (context, deps) => {
    const asked = answerOf(context).toLowerCase()
    const named = deps.tools.list().find(tool => asked.includes(tool.name))

    return Promise.resolve({
      stateUpdate: {},
      nextNode: named === undefined ? 'response' : 'tool'
    })
  }
}

/**
 * Entry to and exit from WAITING (`specs/0003`), observable as the two events
 * and nothing else. A failing tool still exits: an execution that emitted
 * `tool.started` and never its pair reads as waiting forever.
 */
const tool: AgentNode = {
  id: 'tool',
  execute: async (context, deps) => {
    const { executionId } = context
    const chosen = deps.tools.get(CALCULATOR)

    if (chosen === null) {
      throw new ToolError(`no tool named ${CALCULATOR} is registered`)
    }

    const input = { expression: promptOf(context).replace(CALCULATE, '') }

    deps.emit({
      type: 'tool.started',
      executionId,
      data: { tool: chosen.name, input }
    })

    try {
      const output = await chosen.execute(input)

      deps.emit({
        type: 'tool.completed',
        executionId,
        data: { tool: chosen.name, output }
      })

      return { stateUpdate: { toolResults: [output] } }
    } catch (failure) {
      deps.emit({
        type: 'tool.completed',
        executionId,
        data: { tool: chosen.name, output: reported(failure) }
      })

      throw failure
    }
  }
}

/**
 * Calls the model only on the branch that ran a tool, because only that branch
 * has something the planner has not already said.
 */
const response: AgentNode = {
  id: 'response',
  execute: async (context, deps) => {
    const results = toolResultsOf(context)

    if (results.length === 0) {
      return { stateUpdate: { output: answerOf(context).trim() } }
    }

    const messages = messagesFor(
      SYSTEM_PROMPT,
      RESPONSE_PROMPT_TEMPLATE.replace('{result}', String(results[0])).replace(
        '{prompt}',
        promptOf(context)
      )
    )

    return {
      stateUpdate: {
        output: await callModel('response', messages, context, deps)
      }
    }
  }
}

function reported(failure: unknown): {
  error: RuntimeErrorCode
  detail: string
} {
  return failure instanceof RuntimeError
    ? { error: failure.code, detail: failure.message }
    : { error: 'agent_error', detail: String(failure) }
}

/**
 * Scenario 03: LLM -> tool selection -> tool execution -> LLM. Entering the
 * tool node is entry to WAITING, observable as `tool.started`.
 */
export const graph: AgentGraph = {
  entry: 'planner',
  nodes: [planner, decision, tool, response],
  edges: [
    { from: 'planner', to: 'decision' },
    { from: 'decision', to: 'tool', condition: 'needsTool' },
    { from: 'decision', to: 'response', condition: 'answersDirectly' },
    { from: 'tool', to: 'response' }
  ]
}
