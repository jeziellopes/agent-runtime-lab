import { GraphInvalidError } from '@arl/contracts'

import type { AgentEdge, AgentGraph } from '@arl/contracts'

export interface CompileOptions {
  maxIterations: number
}

/**
 * Validation runs at compile time rather than at first request: a malformed
 * graph is a boot failure, and a cell that boots and then fails every request
 * is a cell that reports as available.
 */
export function validateGraph(
  graph: AgentGraph,
  options: CompileOptions
): void {
  if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1) {
    throw new GraphInvalidError(
      `maxIterations must be a positive integer, not ${String(options.maxIterations)}`
    )
  }

  const ids = collectNodeIds(graph)

  if (!ids.has(graph.entry)) {
    throw new GraphInvalidError(`entry names no node: ${graph.entry}`)
  }

  validateEdges(graph, ids)
  validateReachability(graph, ids)
  validateBranches(graph)
  validateCycles(graph)
}

function collectNodeIds(graph: AgentGraph): Set<string> {
  if (graph.nodes.length === 0) {
    throw new GraphInvalidError('a graph needs at least one node')
  }

  const ids = new Set<string>()

  for (const node of graph.nodes) {
    if (ids.has(node.id)) {
      throw new GraphInvalidError(`two nodes share the id ${node.id}`)
    }

    ids.add(node.id)
  }

  return ids
}

function validateEdges(graph: AgentGraph, ids: Set<string>): void {
  for (const edge of graph.edges) {
    for (const [end, id] of [
      ['from', edge.from],
      ['to', edge.to]
    ] as const) {
      if (!ids.has(id)) {
        throw new GraphInvalidError(`an edge's ${end} names no node: ${id}`)
      }
    }
  }
}

function validateReachability(graph: AgentGraph, ids: Set<string>): void {
  const reached = new Set([graph.entry])
  const frontier = [graph.entry]

  for (const from of frontier) {
    for (const edge of outgoing(graph, from)) {
      if (!reached.has(edge.to)) {
        reached.add(edge.to)
        frontier.push(edge.to)
      }
    }
  }

  for (const id of ids) {
    if (!reached.has(id)) {
      throw new GraphInvalidError(`${id} is unreachable from ${graph.entry}`)
    }
  }
}

function validateBranches(graph: AgentGraph): void {
  for (const node of graph.nodes) {
    const edges = outgoing(graph, node.id)

    if (edges.length > 1 && edges.some(edge => edge.condition === undefined)) {
      throw new GraphInvalidError(
        `${node.id} has ${String(edges.length)} outgoing edges and one carries no condition`
      )
    }
  }
}

/**
 * A cycle whose members only point at each other cannot terminate, so it is a
 * boot failure rather than an iteration-limit failure at request time.
 */
function validateCycles(graph: AgentGraph): void {
  for (const component of stronglyConnected(graph)) {
    const members = new Set(component)
    const cyclic =
      component.length > 1 ||
      component.some(id => outgoing(graph, id).some(edge => edge.to === id))

    if (!cyclic) {
      continue
    }

    const leaves = component.some(id =>
      outgoing(graph, id).some(edge => !members.has(edge.to))
    )

    if (!leaves) {
      throw new GraphInvalidError(
        `the cycle ${component.join(' -> ')} has no edge leaving it`
      )
    }
  }
}

interface Visit {
  index: number
  low: number
  onStack: boolean
}

interface Frame {
  id: string
  visit: Visit
  targets: string[]
}

/** Tarjan, iterative, so a deep graph cannot overflow the stack at boot. */
function stronglyConnected(graph: AgentGraph): string[][] {
  const visits = new Map<string, Visit>()
  const stack: Frame[] = []
  const components: string[][] = []
  let counter = 0

  const open = (id: string): Frame => {
    const visit = { index: counter, low: counter, onStack: true }
    const frame = {
      id,
      visit,
      targets: outgoing(graph, id).map(edge => edge.to)
    }

    counter += 1
    visits.set(id, visit)
    stack.push(frame)

    return frame
  }

  for (const node of graph.nodes) {
    if (visits.has(node.id)) {
      continue
    }

    const work: Frame[] = [open(node.id)]
    let frame = work[work.length - 1]

    while (frame !== undefined) {
      const next = frame.targets.shift()

      if (next !== undefined) {
        const seen = visits.get(next)

        if (seen === undefined) {
          work.push(open(next))
        } else if (seen.onStack) {
          frame.visit.low = Math.min(frame.visit.low, seen.index)
        }

        frame = work[work.length - 1]
        continue
      }

      work.pop()

      const parent = work[work.length - 1]

      if (parent !== undefined) {
        parent.visit.low = Math.min(parent.visit.low, frame.visit.low)
      }

      if (frame.visit.low === frame.visit.index) {
        components.push(close(stack, frame.id))
      }

      frame = parent
    }
  }

  return components
}

/**
 * The root and everything pushed after it are one component. Splicing at the
 * root rather than popping until we meet it keeps the walk total: the root is
 * always on the stack, so a loop testing for it would carry an exit nothing can
 * take.
 */
function close(stack: Frame[], root: string): string[] {
  const component = stack.splice(stack.findIndex(entry => entry.id === root))

  for (const entry of component) {
    entry.visit.onStack = false
  }

  return component.map(entry => entry.id)
}

export function outgoing(graph: AgentGraph, from: string): AgentEdge[] {
  return graph.edges.filter(edge => edge.from === from)
}
