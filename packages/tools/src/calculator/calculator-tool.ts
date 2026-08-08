import type { Tool } from '@arl/contracts'

/** Scenario 03 drives this one with "Calculate 125 * 50". */
export class CalculatorTool implements Tool {
  readonly name = 'calculator'

  readonly description = 'Evaluate an arithmetic expression'

  execute(_input: unknown): Promise<unknown> {
    throw new Error('CalculatorTool.execute is not implemented')
  }
}
