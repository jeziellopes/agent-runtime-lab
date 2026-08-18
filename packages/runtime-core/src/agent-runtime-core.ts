import {
  AgentError,
  ExecutionStatus,
  ProviderError,
  RuntimeError
} from '@arl/contracts'

import { deriveExecutionId, randomExecutionId } from './execution-id.js'
import { InMemoryEventStream } from './event-stream.js'
import { InMemoryExecutionStore } from './execution-store.js'
import { createRetryPolicy } from './retry-policy.js'
import { retrying } from './retrying-provider.js'

import type { EventStream } from './event-stream.js'
import type { ExecutionStore } from './execution-store.js'
import type {
  AgentDefinition,
  AgentRuntime,
  Execution,
  ExecutionContext,
  ExecutionRequest,
  ExecutionResult,
  LLMProvider,
  MemoryStore,
  RuntimeConfig,
  RuntimeMetrics,
  TokenUsage,
  ToolRegistry
} from '@arl/contracts'
import { DefaultAgentEngine } from '@arl/agent-engine'
import type { AgentEngine } from '@arl/agent-engine'
import type { EmittedEvent, RuntimeEvent } from '@arl/events'
import type { GraphDeps } from '@arl/graph-runtime'

/**
 * The provider, tools and memory are optional because the cell's composition
 * root supplies them and an engine with no agents registered never reaches one:
 * `resolve` rejects first. A registered agent with a missing collaborator does
 * reach them, and is refused by name rather than by a null dereference.
 */
export interface RuntimeCollaborators {
  engine: AgentEngine
  provider?: LLMProvider
  tools?: ToolRegistry
  memory?: MemoryStore
  store?: ExecutionStore
  events?: EventStream
}

/** What one in-flight execution needs that the store does not hold. */
interface Running {
  controller: AbortController
  cancelled: boolean
}

/**
 * L2. Creates executions, manages their lifecycle, drives workflows, emits the
 * twelve runtime events and owns execution state.
 *
 * It imports no HTTP framework and touches no request object; a lint rule over
 * `packages/` enforces that.
 */
export class AgentRuntimeCore implements AgentRuntime {
  private readonly engine: AgentEngine

  private readonly store: ExecutionStore

  private readonly stream_: EventStream

  private readonly provider: LLMProvider | undefined

  private readonly tools: ToolRegistry | undefined

  private readonly memory: MemoryStore | undefined

  private readonly running = new Map<string, Running>()

  constructor(
    private readonly config: RuntimeConfig,
    collaborators: RuntimeCollaborators = { engine: new DefaultAgentEngine() }
  ) {
    this.engine = collaborators.engine
    this.provider = collaborators.provider
    this.tools = collaborators.tools
    this.memory = collaborators.memory
    this.store = collaborators.store ?? new InMemoryExecutionStore()
    this.stream_ =
      collaborators.events ?? new InMemoryEventStream(config.deterministic)
  }

  /**
   * The unary path does not skip events. It drives the same run and reads the
   * same stream, so `execution_duration` and the benchmark's metrics come from
   * the source a streaming client also sees.
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const { executionId, settled } = this.begin(request)

    return { executionId, ...(await settled) }
  }

  stream(request: ExecutionRequest): AsyncIterable<RuntimeEvent> {
    const { executionId, settled } = this.begin(request)

    /* The run is already publishing; the buffer replays from the first event,
       so attaching after `execution.created` misses nothing. */
    void settled.catch(() => undefined)

    return this.stream_.events(executionId)
  }

  getExecution(id: string): Promise<Execution | null> {
    return this.store.get(id)
  }

  /** A no-op on an unknown or already-terminal id, never an error. */
  cancel(id: string): Promise<void> {
    const running = this.running.get(id)

    if (running !== undefined) {
      running.cancelled = true
      running.controller.abort()
    }

    return Promise.resolve()
  }

  listAgents(): Promise<AgentDefinition[]> {
    return Promise.resolve([...this.engine.agents()])
  }

  /** Identical across all four cells. */
  get runtimeConfig(): RuntimeConfig {
    return this.config
  }

  /**
   * Resolution happens before an id is issued, so a rejected request creates no
   * execution, emits no `execution.created` and consumes no id.
   */
  private begin(request: ExecutionRequest): {
    executionId: string
    settled: Promise<Omit<ExecutionResult, 'executionId'>>
  } {
    const definition = this.engine.resolve(request)
    const prompt = (request.input as { prompt: string }).prompt
    const executionId = this.config.deterministic
      ? deriveExecutionId(definition.id, prompt)
      : randomExecutionId()

    /* Declared before `drive` awaits anything, so `stream` can attach in the
       same tick and still read `execution.created` as its first event. */
    this.stream_.open(executionId)

    return { executionId, settled: this.drive(request, executionId) }
  }

  private async drive(
    request: ExecutionRequest,
    executionId: string
  ): Promise<Omit<ExecutionResult, 'executionId'>> {
    const startedAt = performance.now()
    const context = this.engine.createContext(request, executionId)
    const running: Running = {
      controller: new AbortController(),
      cancelled: false
    }

    this.running.set(executionId, running)

    await this.store.create({
      id: executionId,
      agentId: request.agentId,
      status: ExecutionStatus.CREATED,
      input: request.input,
      createdAt: this.config.deterministic ? new Date(0) : new Date()
    })

    this.publish({
      type: 'execution.created',
      executionId,
      data: { agentId: request.agentId }
    })

    await this.store.transition(executionId, ExecutionStatus.INITIALIZING)
    await this.store.transition(executionId, ExecutionStatus.RUNNING)
    this.publish({ type: 'execution.started', executionId })

    try {
      return await this.runGraph(context, running, startedAt)
    } catch (failure) {
      /* Normalised once, here, so the event and the rejection carry the same
         identity. A node's own error is already a RuntimeError; anything else
         is an internal defect and is agent-category. */
      const error =
        failure instanceof RuntimeError
          ? failure
          : new AgentError(
              failure instanceof Error ? failure.message : String(failure)
            )

      await this.fail(executionId, error)

      throw error
    } finally {
      this.running.delete(executionId)
    }
  }

  private async runGraph(
    context: ExecutionContext,
    running: Running,
    startedAt: number
  ): Promise<Omit<ExecutionResult, 'executionId'>> {
    const { executionId } = context
    const tally = newTally()
    const graphStartedAt = performance.now()
    const timeout = this.armTimeout(running)
    const run = this.engine.stream(context, this.graphDeps(running))

    try {
      for await (const event of run) {
        account(tally, event)
        this.publish(event)
      }
    } finally {
      clearTimeout(timeout)
    }

    if (running.cancelled) {
      await this.store.transition(executionId, ExecutionStatus.CANCELLED)
      this.publish({ type: 'execution.cancelled', executionId })

      return { status: ExecutionStatus.CANCELLED, output: null }
    }

    if (running.controller.signal.aborted) {
      throw new ProviderError(
        `the execution exceeded its ${String(this.config.timeoutMs)}ms budget`
      )
    }

    /* The state of the traversal just drained, not a second run of it.
       `AgentState` defaults `output` to the empty string, so there is nothing
       to substitute here: a missing key would serialise as "undefined" and fail
       a golden loudly, which is the right way to find out the schema changed. */
    const state = await run.state()
    const output = { text: String(state['output']) }
    const metrics = this.config.deterministic
      ? undefined
      : measure(tally, startedAt, graphStartedAt)

    await this.store.transition(executionId, ExecutionStatus.COMPLETED)
    this.publish({
      type: 'execution.completed',
      executionId,
      data: { output, ...(metrics === undefined ? {} : { metrics }) }
    })

    return {
      status: ExecutionStatus.COMPLETED,
      output,
      ...(tally.usage === undefined ? {} : { usage: tally.usage }),
      ...(metrics === undefined ? {} : { metrics })
    }
  }

  /**
   * The node calls the provider, but the runtime owns retry, so what the node
   * is handed already retries. That is what keeps retry transparent in the
   * event stream: one `llm.started` / `llm.completed` pair however many
   * attempts it took.
   */
  private graphDeps(running: Running): GraphDeps {
    const { provider, tools, memory } = this

    if (provider === undefined || tools === undefined || memory === undefined) {
      throw new AgentError(
        'the runtime was built without a provider, tools or memory'
      )
    }

    return {
      provider: retrying(
        provider,
        createRetryPolicy(this.config.maxRetries),
        ms => this.sleep(ms)
      ),
      model: this.config.defaultModel,
      tools,
      memory,
      signal: running.controller.signal
    }
  }

  private armTimeout(running: Running): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      running.controller.abort()
    }, this.config.timeoutMs)
  }

  private sleep(ms: number): Promise<void> {
    if (this.config.deterministic) {
      return Promise.resolve()
    }

    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Only ever reached with the execution in `RUNNING`, because `drive`
   * transitions there before the try and every terminal path returns rather
   * than throwing. So the move is always legal and needs no guard.
   */
  private async fail(
    executionId: string,
    failure: RuntimeError
  ): Promise<void> {
    await this.store.transition(executionId, ExecutionStatus.FAILED)
    this.publish({
      type: 'execution.failed',
      executionId,
      data: { error: failure.code, detail: failure.message }
    })
  }

  private publish(event: EmittedEvent): void {
    this.stream_.publish(event)
  }
}

interface Tally {
  llmCalls: number
  toolCalls: number
  events: number
  nodeDuration: number
  nodeStartedAt: number | undefined
  usage: TokenUsage | undefined
}

function newTally(): Tally {
  return {
    llmCalls: 0,
    toolCalls: 0,
    events: 0,
    nodeDuration: 0,
    nodeStartedAt: undefined,
    usage: undefined
  }
}

/**
 * Counts what the graph produced. The lifecycle events either side of it are
 * the runtime's own and constant across all four cells, so including them would
 * add the same number everywhere and tell the comparison nothing.
 */
function account(tally: Tally, event: EmittedEvent): void {
  tally.events += 1

  if (event.type === 'llm.started') {
    tally.llmCalls += 1
  }

  if (event.type === 'tool.started') {
    tally.toolCalls += 1
  }

  if (event.type === 'llm.completed') {
    tally.usage = add(tally.usage, event.data.usage)
  }

  if (event.type === 'node.started') {
    tally.nodeStartedAt = performance.now()
  }

  if (event.type === 'node.completed' && tally.nodeStartedAt !== undefined) {
    tally.nodeDuration += performance.now() - tally.nodeStartedAt
    tally.nodeStartedAt = undefined
  }
}

function add(current: TokenUsage | undefined, next: TokenUsage): TokenUsage {
  return {
    inputTokens: (current?.inputTokens ?? 0) + next.inputTokens,
    outputTokens: (current?.outputTokens ?? 0) + next.outputTokens,
    totalTokens: (current?.totalTokens ?? 0) + next.totalTokens
  }
}

/** Counted before the terminal event, which has not been published yet. */
function measure(
  tally: Tally,
  startedAt: number,
  graphStartedAt: number
): RuntimeMetrics {
  const now = performance.now()

  return {
    executionDuration: now - startedAt,
    graphDuration: now - graphStartedAt,
    nodeDuration: tally.nodeDuration,
    toolCalls: tally.toolCalls,
    llmCalls: tally.llmCalls,
    eventsGenerated: tally.events
  }
}
