import type { FastifyPluginCallback } from 'fastify'

/** `GET /health`: adapter-local; it never reaches the runtime. */
export const healthRoutes =
  (): FastifyPluginCallback => (app, _options, done) => {
    app.get('/health', () => ({ status: 'ok', uptime: process.uptime() }))
    done()
  }
