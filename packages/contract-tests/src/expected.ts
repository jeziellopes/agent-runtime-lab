import type { RuntimeEventType } from '@arl/events'

/**
 * The event sequences the three reference agents emit, from `specs/0008`.
 *
 * These are the contract, not a recording. `sse.event.sequence` compares a
 * cell's parsed stream against them, and the goldens encode the same order in
 * bytes.
 */
export interface ExpectedRun {
  agentId: string
  prompt: string
  /** Byte-pinned against a golden, or asserted on the parsed sequence only. */
  golden: boolean
  events: readonly RuntimeEventType[]
}

function llmCall(tokens: number): RuntimeEventType[] {
  return [
    'llm.started',
    ...Array<RuntimeEventType>(tokens).fill('llm.token'),
    'llm.completed'
  ]
}

/** A node that calls the model: entered, the call, left. */
function reasoningNode(tokens: number): RuntimeEventType[] {
  return ['node.started', ...llmCall(tokens), 'node.completed']
}

/** A node that formats or routes and calls nothing. */
const plainNode: readonly RuntimeEventType[] = [
  'node.started',
  'node.completed'
]

const OPEN: readonly RuntimeEventType[] = [
  'execution.created',
  'execution.started'
]

export const EXPECTED_RUNS: readonly ExpectedRun[] = [
  {
    agentId: 'simple-agent',
    prompt: 'Explain what an API gateway is.',
    golden: true,
    events: [...OPEN, ...reasoningNode(8), ...plainNode, 'execution.completed']
  },
  {
    agentId: 'tool-agent',
    prompt: 'Calculate 125 * 50',
    golden: true,
    events: [
      ...OPEN,
      ...reasoningNode(6),
      ...plainNode,
      'node.started',
      'tool.started',
      'tool.completed',
      'node.completed',
      ...reasoningNode(6),
      'execution.completed'
    ]
  },
  {
    agentId: 'tool-agent',
    prompt: 'What does API stand for?',
    golden: false,
    events: [
      ...OPEN,
      ...reasoningNode(6),
      ...plainNode,
      ...plainNode,
      'execution.completed'
    ]
  },
  {
    agentId: 'multi-step-agent',
    prompt: 'Compare REST and GraphQL for a public API.',
    golden: true,
    events: [
      ...OPEN,
      ...reasoningNode(6),
      ...reasoningNode(7),
      ...reasoningNode(7),
      ...plainNode,
      'execution.completed'
    ]
  }
]

/** The three runs a golden file exists for, one per reference agent. */
export const GOLDEN_RUNS = EXPECTED_RUNS.filter(run => run.golden)
