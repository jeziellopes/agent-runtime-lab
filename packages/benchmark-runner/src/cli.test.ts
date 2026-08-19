import { describe, expect, it } from 'vitest'

import { parseRunArgs } from './cli.js'

describe('parsing run arguments', () => {
  it('returns no options for an empty argv', () => {
    expect(parseRunArgs([])).toEqual({})
  })

  it('reads the scenario as the one token that is not a flag', () => {
    expect(parseRunArgs(['streaming'])).toEqual({ scenario: 'streaming' })
  })

  it('reads framework and runtime with no scenario named', () => {
    expect(
      parseRunArgs(['--framework', 'nestjs', '--runtime', 'node'])
    ).toEqual({ framework: 'nestjs', runtime: 'node' })
  })

  it('does not mistake a flag value for the scenario', () => {
    const options = parseRunArgs(['--framework', 'nestjs'])

    expect(options.scenario).toBeUndefined()
    expect(options.framework).toBe('nestjs')
  })

  it('combines a scenario with every flag', () => {
    expect(
      parseRunArgs([
        'long-context',
        '--framework',
        'hono',
        '--runtime',
        'bun',
        '--host',
        '127.0.0.1'
      ])
    ).toEqual({
      scenario: 'long-context',
      framework: 'hono',
      runtime: 'bun',
      host: '127.0.0.1'
    })
  })

  it('reads the scenario whichever side of the flags it falls on', () => {
    expect(
      parseRunArgs(['--framework', 'hono', 'tool-calling', '--runtime', 'bun'])
    ).toEqual({ scenario: 'tool-calling', framework: 'hono', runtime: 'bun' })
  })

  it('ignores a flag with no value trailing it', () => {
    expect(parseRunArgs(['--framework'])).toEqual({})
  })
})
