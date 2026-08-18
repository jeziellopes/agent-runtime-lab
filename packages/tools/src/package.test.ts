import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SOURCES = [
  'registry.ts',
  join('calculator', 'calculator-tool.ts'),
  join('search', 'search-tool.ts')
]

function read(relative: string): string {
  return readFileSync(join(__dirname, relative), 'utf8')
}

describe('what the package is allowed to reach', () => {
  it('declares no framework dependency and no HTTP client', () => {
    const { dependencies } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> }

    expect(Object.keys(dependencies)).toEqual(['@arl/contracts'])
  })

  it.each(SOURCES)('imports nothing that could reach a network in %s', file => {
    expect(read(file)).not.toMatch(
      /from '(node:http|node:https|node:net|undici|axios|got)/
    )
    expect(read(file)).not.toMatch(/\bfetch\(/)
  })

  it.each(SOURCES)('constructs no code in %s', file => {
    expect(read(file)).not.toMatch(/\beval\(|new Function\(|Function\(['"`]/)
  })

  it('reads only its own committed fixture', () => {
    expect(read(join('search', 'search-tool.ts'))).toMatch(
      /'fixtures',\s*'search\.json'/
    )
    expect(read(join('calculator', 'calculator-tool.ts'))).not.toMatch(
      /node:fs/
    )
  })
})
