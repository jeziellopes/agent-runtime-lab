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

/**
 * Reads a stream frame by frame instead of waiting for it to finish, and hands
 * each one to `onFrame` as it arrives. `cancel.aborts.provider.call` needs to
 * act on an execution while it is still running, which `request` cannot do:
 * it resolves only once the body is complete.
 */
export async function requestFrames(
  url: string,
  init: RequestInit,
  onFrame: (frame: string) => Promise<void> | void
): Promise<HttpResponse> {
  let response: Response

  try {
    response = await fetch(url, init)
  } catch (cause) {
    throw new TransportError(`${init.method ?? 'GET'} ${url}: ${String(cause)}`)
  }

  const decoder = new TextDecoder()
  let raw = ''
  let consumed = 0

  for await (const chunk of response.body ?? []) {
    raw += decoder.decode(chunk as Uint8Array, { stream: true })

    for (let end = raw.indexOf('\n\n', consumed); end !== -1;) {
      await onFrame(raw.slice(consumed, end))
      consumed = end + 2
      end = raw.indexOf('\n\n', consumed)
    }
  }

  return {
    status: response.status,
    headers: [...response.headers.entries()],
    raw
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
