import { Hono } from 'hono'

/**
 * `GET /health`: adapter-local; it never reaches the runtime.
 *
 * Paths are written out in full and mounted at the root.
 */
export function healthRoutes(): Hono {
  const app = new Hono()

  app.get('/health', context =>
    context.json({ status: 'ok', uptime: process.uptime() })
  )

  return app
}
