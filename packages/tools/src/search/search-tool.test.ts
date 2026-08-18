import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ToolError } from '@arl/contracts'
import { describe, expect, it } from 'vitest'

import { SearchTool } from './search-tool.js'

const search = new SearchTool()

const QUERY = 'Find information about TypeScript'

/** Writes a throwaway fixture, so a broken one can be loaded without shipping it. */
function fixture(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'arl-search-')), 'search.json')

  writeFileSync(path, contents, 'utf8')

  return path
}

describe('the committed fixture', () => {
  it('answers the query Scenario 03 names with three results', async () => {
    const results = await search.execute({ query: QUERY })

    expect(results).toHaveLength(3)

    for (const result of results) {
      expect(result.title.length).toBeGreaterThan(0)
      expect(result.url.length).toBeGreaterThan(0)
      expect(result.snippet.length).toBeGreaterThan(0)
    }
  })

  it('answers the same query the same way twice', async () => {
    expect(await search.execute({ query: QUERY })).toEqual(
      await search.execute({ query: QUERY })
    )
  })

  it('names the query it could not find', async () => {
    await expect(search.execute({ query: 'unlisted' })).rejects.toThrow(
      /holds no query: unlisted/
    )
  })

  it('names and describes itself as the agents expect', () => {
    expect(search.name).toBe('search')
    expect(search.description).toBe('Search for information about a topic')
  })
})

describe('a query the fixture answers with nothing', () => {
  it('returns an empty list rather than raising', async () => {
    const empty = new SearchTool(fixture('{"nothing here": []}'))

    await expect(empty.execute({ query: 'nothing here' })).resolves.toEqual([])
  })
})

describe('what the input must be', () => {
  it.each([
    ['an absent query', {}],
    ['a numeric query', { query: 42 }],
    ['a null input', null],
    ['a string input', 'query'],
    ['an undefined input', undefined]
  ])('refuses %s', async (_case, input) => {
    await expect(search.execute(input)).rejects.toBeInstanceOf(ToolError)
  })

  it('raises tool-category errors only', async () => {
    await expect(search.execute({})).rejects.toMatchObject({
      category: 'tool',
      code: 'tool_error'
    })
  })
})

describe('a fixture that cannot be trusted', () => {
  it.each([
    ['is missing', '__absent__', /the search fixture is missing/],
    ['is not JSON', '{', /not valid JSON/],
    ['is a JSON array', '[]', /must be a JSON object/],
    ['is a JSON scalar', '3', /must be a JSON object/],
    ['maps a query to a scalar', '{"q": 3}', /q must map to a list of results/],
    [
      'holds a result that is not an object',
      '{"q": ["hit"]}',
      /every result for q must be an object/
    ],
    [
      'holds a result with no title',
      '{"q": [{"url": "u", "snippet": "s"}]}',
      /q: every result needs a non-empty title/
    ],
    [
      'holds a result with an empty url',
      '{"q": [{"title": "t", "url": "", "snippet": "s"}]}',
      /q: every result needs a non-empty url/
    ],
    [
      'holds a result with a numeric snippet',
      '{"q": [{"title": "t", "url": "u", "snippet": 7}]}',
      /q: every result needs a non-empty snippet/
    ]
  ])('refuses one that %s', (_case, contents, message) => {
    const path =
      contents === '__absent__' ? '/nonexistent/search.json' : fixture(contents)

    expect(() => new SearchTool(path)).toThrow(ToolError)
    expect(() => new SearchTool(path)).toThrow(message)
  })

  it('fails at construction, not at the first request', () => {
    expect(() => new SearchTool(fixture('{'))).toThrow(ToolError)
  })
})
