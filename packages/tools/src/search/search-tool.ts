import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ToolError } from '@arl/contracts'

import type { Tool } from '@arl/contracts'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export const SEARCH_FIXTURE = join(
  __dirname,
  '..',
  '..',
  'fixtures',
  'search.json'
)

/**
 * FAKE: stands in for a real search API.
 *
 * Returns canned results from `fixtures/search.json`. No network, no API key,
 * deterministic.
 *
 * The fixture is read and validated once, at construction, so a broken file
 * stops the cell from starting rather than failing one request at a time.
 */
export class SearchTool implements Tool {
  readonly name = 'search'

  readonly description = 'Search for information about a topic'

  private readonly results: Map<string, SearchResult[]>

  constructor(fixturePath: string = SEARCH_FIXTURE) {
    this.results = readResults(fixturePath)
  }

  /**
   * A bad query rejects the promise rather than throwing at the call site, so
   * the node awaiting it emits `tool.completed` carrying the failure.
   */
  execute(input: unknown): Promise<SearchResult[]> {
    return new Promise(resolve => {
      resolve(this.lookUp(input))
    })
  }

  private lookUp(input: unknown): SearchResult[] {
    if (typeof input !== 'object' || input === null) {
      throw new ToolError('search input must be an object')
    }

    const { query } = input as { query?: unknown }

    if (typeof query !== 'string') {
      throw new ToolError('search input needs a query string')
    }

    const results = this.results.get(query)

    if (results === undefined) {
      throw new ToolError(`the search fixture holds no query: ${query}`)
    }

    return results
  }
}

function invalid(path: string, problem: string): never {
  throw new ToolError(`${path}: ${problem}`)
}

function readResult(path: string, query: string, value: unknown): SearchResult {
  if (typeof value !== 'object' || value === null) {
    invalid(path, `every result for ${query} must be an object`)
  }

  const result = value as Record<string, unknown>

  for (const field of ['title', 'url', 'snippet']) {
    const present = result[field]

    if (typeof present !== 'string' || present.length === 0) {
      invalid(path, `${query}: every result needs a non-empty ${field}`)
    }
  }

  return {
    title: result['title'] as string,
    url: result['url'] as string,
    snippet: result['snippet'] as string
  }
}

function readResults(path: string): Map<string, SearchResult[]> {
  let raw: string

  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    invalid(path, 'the search fixture is missing')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    invalid(path, 'the search fixture is not valid JSON')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    invalid(path, 'the search fixture must be a JSON object')
  }

  const results = new Map<string, SearchResult[]>()

  for (const [query, value] of Object.entries(parsed)) {
    if (!Array.isArray(value)) {
      invalid(path, `${query} must map to a list of results`)
    }

    results.set(
      query,
      value.map(result => readResult(path, query, result))
    )
  }

  return results
}
