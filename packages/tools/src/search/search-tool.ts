import type { Tool } from '@arl/contracts'

/**
 * FAKE: stands in for a real search API.
 *
 * Returns canned results from `fixtures/search.json`. No network, no API key,
 * deterministic.
 */
export class SearchTool implements Tool {
  readonly name = 'search'

  readonly description = 'Search for information about a topic'

  execute(_input: unknown): Promise<unknown> {
    throw new Error('SearchTool.execute is not implemented')
  }
}
