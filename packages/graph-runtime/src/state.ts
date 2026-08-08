import { ReducedValue, StateSchema } from '@langchain/langgraph'
import { z } from 'zod'

/**
 * The state every reference agent's graph carries. One schema, shared by all
 * three agents.
 *
 * A field without a reducer is overwritten, not merged. Anything that
 * accumulates gets a `ReducedValue`.
 *
 * Nodes return partial updates, never the state object.
 */
export const AgentState = new StateSchema({
  input: z.string().default(''),
  output: z.string().default(''),
  toolResults: new ReducedValue(
    z.array(z.unknown()).default(() => []),
    { reducer: (current, update) => current.concat(update) }
  )
})
