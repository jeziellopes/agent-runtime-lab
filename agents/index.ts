import type { AgentDefinition } from '@arl/contracts'

import { config as multiStep } from './multi-step-agent/config.js'
import { graph as multiStepGraph } from './multi-step-agent/graph.js'
import { tools as multiStepTools } from './multi-step-agent/tools.js'
import { config as simple } from './simple-agent/config.js'
import { graph as simpleGraph } from './simple-agent/graph.js'
import { tools as simpleTools } from './simple-agent/tools.js'
import { config as tool } from './tool-agent/config.js'
import { graph as toolGraph } from './tool-agent/graph.js'
import { tools as toolTools } from './tool-agent/tools.js'

/**
 * The three reference agents, registered with the runtime rather than imported
 * by it. The same definitions run in every cell, always.
 */
export const REFERENCE_AGENTS: readonly AgentDefinition[] = [
  { ...simple, graph: simpleGraph, tools: [...simpleTools] },
  { ...tool, graph: toolGraph, tools: [...toolTools] },
  { ...multiStep, graph: multiStepGraph, tools: [...multiStepTools] }
]
