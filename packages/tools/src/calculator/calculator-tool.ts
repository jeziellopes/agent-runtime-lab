import { ToolError } from '@arl/contracts'

import type { Tool } from '@arl/contracts'

/**
 * One binary operation on two numbers, over the whole trimmed string.
 *
 * The grammar is restricted rather than parsed. Precedence, parentheses and
 * unary minus would be a parser and a test suite serving no requirement, and
 * nothing here is evaluated as code at any point.
 */
const EXPRESSION = /^\s*(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/

const OPERATIONS = {
  '+': (left: number, right: number) => left + right,
  '-': (left: number, right: number) => left - right,
  '*': (left: number, right: number) => left * right,
  '/': (left: number, right: number) => left / right
}

type Operator = keyof typeof OPERATIONS

/**
 * The three groups exist whenever the pattern matches, so the tuple is what the
 * regex already guarantees rather than an assumption about the input.
 */
type Matched = [whole: string, left: string, operator: Operator, right: string]

/** Scenario 03 drives this one with "Calculate 125 * 50". */
export class CalculatorTool implements Tool {
  readonly name = 'calculator'

  readonly description = 'Evaluate an arithmetic expression'

  /**
   * A bad expression rejects the promise rather than throwing at the call site,
   * so the node awaiting it emits `tool.completed` carrying the failure.
   */
  execute(input: unknown): Promise<number> {
    return new Promise(resolve => {
      resolve(evaluate(input))
    })
  }
}

function evaluate(input: unknown): number {
  if (typeof input !== 'object' || input === null) {
    throw new ToolError('calculator input must be an object')
  }

  const { expression } = input as { expression?: unknown }

  if (typeof expression !== 'string') {
    throw new ToolError('calculator input needs an expression string')
  }

  const match = EXPRESSION.exec(expression)

  if (match === null) {
    throw new ToolError(
      `not one binary operation on two numbers: ${expression}`
    )
  }

  const [, left, operator, right] = match as unknown as Matched

  if (operator === '/' && Number(right) === 0) {
    throw new ToolError(`division by zero: ${expression}`)
  }

  const result = OPERATIONS[operator](Number(left), Number(right))

  if (!Number.isFinite(result)) {
    throw new ToolError(`result is not finite: ${expression}`)
  }

  return result
}
