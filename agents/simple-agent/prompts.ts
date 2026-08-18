/**
 * Prompts are runtime behaviour, not adapter behaviour: identical in every
 * cell, always.
 */
export const SYSTEM_PROMPT =
  'You are a concise technical assistant. Answer in one short sentence.'

export const USER_PROMPT_TEMPLATE = '{prompt}'

/**
 * Scenario 01's prompt. Pinned here so the fixture, the golden and the
 * benchmark exercise one literal rather than three copies of it.
 */
export const EXAMPLE_PROMPT = 'Explain what an API gateway is.'
