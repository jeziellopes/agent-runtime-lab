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

/**
 * Reads a stream until `stop` accepts a frame, then drops the connection
 * without a word to the server: no `DELETE`, no `cancel`. What the server
 * makes of the hang-up is the caller's question. Resolves with every frame
 * read, the accepted one last, or fewer if the stream ended first.
 */
export async function requestFramesUntil(
  url: string,
  init: RequestInit,
  stop: (frame: string) => boolean
): Promise<string[]> {
  const controller = new AbortController()
  let response: Response

  try {
    response = await fetch(url, { ...init, signal: controller.signal })
  } catch (cause) {
    throw new TransportError(`${init.method ?? 'GET'} ${url}: ${String(cause)}`)
  }

  const decoder = new TextDecoder()
  const frames: string[] = []
  let raw = ''
  let consumed = 0

  const reader = response.body?.getReader()

  /* Aborting with a read pending would reject it, and an async iterator's
     cleanup after an early exit rejects too, so the reader is left as it is. */
  for (
    let read = await reader?.read();
    read && !read.done;
    read = await reader?.read()
  ) {
    raw += decoder.decode(read.value, { stream: true })

    for (let end = raw.indexOf('\n\n', consumed); end !== -1;) {
      const frame = raw.slice(consumed, end)

      frames.push(frame)
      consumed = end + 2

      if (stop(frame)) {
        controller.abort()

        return frames
      }

      end = raw.indexOf('\n\n', consumed)
    }
  }

  return frames
}
