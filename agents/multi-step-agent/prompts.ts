/**
 * Prompts are runtime behaviour, not adapter behaviour: identical in every
 * cell, always.
 */
export const SYSTEM_PROMPT =
  'You are a research assistant. Work one step at a time and keep each step short.'

export const USER_PROMPT_TEMPLATE = '{step}\n\n{prompt}'

/** What distinguishes the three reasoning nodes, since they share a template. */
export const STEPS = {
  planner: 'Plan how to compare the two options.',
  research: 'Gather the facts your plan calls for.',
  analysis: 'Weigh the findings and state the trade-off.'
} as const

/**
 * Scenario 04's prompt. Pinned here so the fixture, the golden and the
 * benchmark exercise one literal rather than three copies of it.
 */
export const EXAMPLE_PROMPT = 'Compare REST and GraphQL for a public API.'
