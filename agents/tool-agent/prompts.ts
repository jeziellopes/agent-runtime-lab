/**
 * Prompts are runtime behaviour, not adapter behaviour: identical in every
 * cell, always.
 */
export const SYSTEM_PROMPT =
  'You have tools. Name the tool you need, or answer the question directly.'

export const USER_PROMPT_TEMPLATE = '{prompt}'

/** Used only on the branch that ran a tool, to fold its result into the answer. */
export const RESPONSE_PROMPT_TEMPLATE =
  'The calculator returned {result}.\n\n{prompt}'

/**
 * Scenario 03's two prompts. Pinned here so the fixtures, the goldens and the
 * benchmark exercise one literal rather than three copies of each.
 *
 * The prompt whose expression the calculator rejects is not among them: it
 * belongs to the failures `specs/0017` induces, not to the agent.
 */
export const TOOL_PROMPT = 'Calculate 125 * 50'

export const DIRECT_PROMPT = 'What does API stand for?'
