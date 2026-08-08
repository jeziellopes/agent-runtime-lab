import type { MiddlewareHandler } from 'hono'

/**
 * FAKE: stands in for production authorization.
 *
 * An empty middleware slot: no tokens, no claims, no policy. Present in both
 * adapters, so the request path has the same shape in every cell.
 */
export const auth = (): MiddlewareHandler => async (_context, next) => {
  await next()
}
