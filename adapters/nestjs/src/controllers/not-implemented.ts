export interface NotImplementedBody {
  error: 'not_implemented'
  detail: string
}

/**
 * FAKE: every route on the surface exists, routes and answers `501`.
 *
 * `not_implemented` is not one of the six runtime error codes.
 */
export function notImplemented(endpoint: string): NotImplementedBody {
  return {
    error: 'not_implemented',
    detail: `${endpoint} is scaffolded, not implemented`
  }
}
