import { ToolError } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { CalculatorTool } from './calculator-tool.js'

const calculator = new CalculatorTool()

describe('evaluating one binary operation', () => {
  it('answers the expression the tool agent sends', async () => {
    await expect(calculator.execute({ expression: '125 * 50' })).resolves.toBe(
      6250
    )
  })

  it.each([
    ['12 + 30', 42],
    ['50 - 8', 42],
    ['6 * 7', 42],
    ['7 / 2', 3.5],
    ['-4 * 5', -20],
    ['2.5 * 4', 10]
  ])('evaluates %s', async (expression, expected) => {
    await expect(calculator.execute({ expression })).resolves.toBe(expected)
  })

  it.each(['125*50', '  125 * 50  ', '125 *50', '125\t*\t50'])(
    'is unmoved by the whitespace in %s',
    async expression => {
      await expect(calculator.execute({ expression })).resolves.toBe(6250)
    }
  )
})

describe('what the grammar refuses', () => {
  it.each([
    ['a second operation', '2 + 3 * 4'],
    ['exponentiation', '125 ** 50'],
    ['parentheses', '(1+2)*3'],
    ['anything that looks like code', 'require("fs")'],
    ['a bare number', '42'],
    ['an operator with no right operand', '42 +'],
    ['scientific notation', '1e3 * 2'],
    ['whitespace only', '   '],
    ['nothing at all', '']
  ])('refuses %s', async (_case, expression) => {
    await expect(calculator.execute({ expression })).rejects.toBeInstanceOf(
      ToolError
    )
  })

  it('refuses to evaluate 2 + 3 * 4 as either 14 or 20', async () => {
    await expect(
      calculator.execute({ expression: '2 + 3 * 4' })
    ).rejects.toThrow(/not one binary operation/)
  })
})

describe('arithmetic that has no answer', () => {
  it('refuses division by zero rather than resolving to Infinity', async () => {
    await expect(calculator.execute({ expression: '1 / 0' })).rejects.toThrow(
      /division by zero/
    )
  })

  it('refuses a result that overflows to Infinity', async () => {
    const huge = '9'.repeat(400)

    await expect(
      calculator.execute({ expression: `${huge} * ${huge}` })
    ).rejects.toThrow(/not finite/)
  })
})

describe('what the input must be', () => {
  it.each([
    ['an absent expression', {}],
    ['a numeric expression', { expression: 42 }],
    ['a null input', null],
    ['a string input', 'expression'],
    ['an undefined input', undefined]
  ])('refuses %s', async (_case, input) => {
    await expect(calculator.execute(input)).rejects.toBeInstanceOf(ToolError)
  })
})

describe('the shape of the tool', () => {
  it('raises tool-category errors only', async () => {
    await expect(calculator.execute({})).rejects.toMatchObject({
      category: 'tool',
      code: 'tool_error'
    })
  })

  it('names and describes itself as the agents expect', () => {
    expect(calculator.name).toBe('calculator')
    expect(calculator.description).toBe('Evaluate an arithmetic expression')
  })
})
