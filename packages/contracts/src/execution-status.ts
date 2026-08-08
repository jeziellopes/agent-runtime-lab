/**
 * The canonical seven-state execution lifecycle.
 *
 *     CREATED -> INITIALIZING -> RUNNING -> COMPLETED
 *                                  |  ^
 *                                  v  |
 *                               WAITING
 *                                  |
 *                         FAILED / CANCELLED
 *
 * Every state has an observable trigger.
 *
 * The values are the wire form: an `Execution` serialises as
 * `{ "status": "completed" }`, and all four cells must agree on that string.
 */
export const ExecutionStatus = {
  CREATED: 'created',
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  WAITING: 'waiting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const

export type ExecutionStatus =
  (typeof ExecutionStatus)[keyof typeof ExecutionStatus]

export const TERMINAL_STATUSES = [
  ExecutionStatus.COMPLETED,
  ExecutionStatus.FAILED,
  ExecutionStatus.CANCELLED
] as const satisfies readonly ExecutionStatus[]

export type TerminalStatus = (typeof TERMINAL_STATUSES)[number]

/**
 * The lifecycle above, as data.
 *
 * `WAITING` is entered when a tool is awaited, observable as `tool.started`,
 * and left when the tool resolves or fails (`tool.completed`). `CANCELLED` is
 * reachable from any non-terminal state: `DELETE /executions/:id`, or the SSE
 * client disconnecting.
 */
export const EXECUTION_TRANSITIONS: Readonly<
  Record<ExecutionStatus, readonly ExecutionStatus[]>
> = {
  created: [ExecutionStatus.INITIALIZING, ExecutionStatus.CANCELLED],
  initializing: [
    ExecutionStatus.RUNNING,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED
  ],
  running: [
    ExecutionStatus.WAITING,
    ExecutionStatus.COMPLETED,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED
  ],
  waiting: [
    ExecutionStatus.RUNNING,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED
  ],
  completed: [],
  failed: [],
  cancelled: []
}

export function isTerminalStatus(status: ExecutionStatus): boolean {
  return (TERMINAL_STATUSES as readonly ExecutionStatus[]).includes(status)
}

export function canTransition(
  from: ExecutionStatus,
  to: ExecutionStatus
): boolean {
  return EXECUTION_TRANSITIONS[from].includes(to)
}
