import type { onRequestHookHandler } from 'fastify'

/**
 * FAKE: stands in for production authorization.
 *
 * An empty middleware slot: no tokens, no claims, no policy. Present in every
 * adapter, so the request path has the same shape in every cell.
 */
export const auth = (): onRequestHookHandler => (_request, _reply, done) => {
  done()
}
