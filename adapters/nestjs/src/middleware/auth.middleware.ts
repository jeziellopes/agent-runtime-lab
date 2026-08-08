import { Injectable } from '@nestjs/common'

import type { NestMiddleware } from '@nestjs/common'

/**
 * FAKE: stands in for production authorization.
 *
 * An empty middleware slot: no tokens, no claims, no policy. Present in both
 * adapters, so the request path has the same shape in every cell.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(_request: unknown, _response: unknown, next: () => void): void {
    next()
  }
}
