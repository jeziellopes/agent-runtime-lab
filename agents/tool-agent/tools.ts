import { CalculatorTool, SearchTool } from '@arl/tools'

import type { Tool } from '@arl/contracts'

const calculator = new CalculatorTool()

/** The name the tool node resolves against the registry, taken from the tool. */
export const CALCULATOR = calculator.name

/**
 * Registered, never imported by a node directly. `SearchTool` is registered and
 * unused by the contract fixture: Scenario 03 exercises it, and a
 * registered-but-unused tool is a real condition the runtime must handle.
 */
export const tools: Tool[] = [calculator, new SearchTool()]
