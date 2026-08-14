import type { HeaderPairs } from './headers.js'

/**
 * What an assertion sees. The body is kept as raw text as well as parsed, so
 * `sse.framing.bytes` compares what arrived rather than what a parse produced.
 */
export interface HttpResponse {
  status: number
  headers: HeaderPairs
  raw: string
}

export class TransportError extends Error {}

export async function request(
  url: string,
  init: RequestInit = {}
): Promise<HttpResponse> {
  let response: Response

  try {
    response = await fetch(url, init)
  } catch (cause) {
    throw new TransportError(`${init.method ?? 'GET'} ${url}: ${String(cause)}`)
  }

  return {
    status: response.status,
    headers: [...response.headers.entries()],
    raw: await response.text()
  }
}

export function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }
}

export function parseJson<T>(response: HttpResponse): T {
  return JSON.parse(response.raw) as T
}
