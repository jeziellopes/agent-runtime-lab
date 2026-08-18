import { ToolError } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { InMemoryToolRegistry } from './registry.js'

import type { Tool } from '@arl/contracts'

function stub(name: string): Tool {
  return {
    name,
    description: `the ${name} tool`,
    execute: () => Promise.resolve(name)
  }
}

describe('resolving a tool by name', () => {
  it('returns what was registered', () => {
    const registry = new InMemoryToolRegistry()
    const calculator = stub('calculator')

    registry.register(calculator)

    expect(registry.get('calculator')).toBe(calculator)
  })

  it('returns null for a name nobody registered', () => {
    expect(new InMemoryToolRegistry().get('calculator')).toBeNull()
  })
})

describe('registering', () => {
  it('lets the first registration stand and refuses the second', () => {
    const registry = new InMemoryToolRegistry()
    const first = stub('calculator')

    registry.register(first)

    expect(() => registry.register(stub('calculator'))).toThrow(ToolError)
    expect(registry.get('calculator')).toBe(first)
  })

  it.each([
    ['an empty name', ''],
    ['a name that is not a string', 42]
  ])('refuses %s', (_case, name) => {
    const registry = new InMemoryToolRegistry()

    expect(() => registry.register({ ...stub('x'), name } as Tool)).toThrow(
      ToolError
    )
  })

  it('raises tool-category errors only', () => {
    const registry = new InMemoryToolRegistry()

    registry.register(stub('calculator'))

    try {
      registry.register(stub('calculator'))
      expect.unreachable('the name is taken')
    } catch (error) {
      expect((error as ToolError).category).toBe('tool')
      expect((error as ToolError).code).toBe('tool_error')
    }
  })
})

describe('listing', () => {
  it('sorts by name, whatever order they arrived in', () => {
    const registry = new InMemoryToolRegistry()

    for (const name of ['search', 'calculator', 'archive']) {
      registry.register(stub(name))
    }

    expect(registry.list().map(tool => tool.name)).toEqual([
      'archive',
      'calculator',
      'search'
    ])
  })

  it('is empty before anything is registered', () => {
    expect(new InMemoryToolRegistry().list()).toEqual([])
  })
})
