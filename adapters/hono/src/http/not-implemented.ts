export interface NotImplementedBody {
  error: 'not_implemented'
  detail: string
}

/** FAKE: every route on the surface exists, routes and answers `501`. */
export function notImplemented(endpoint: string): NotImplementedBody {
  return {
    error: 'not_implemented',
    detail: `${endpoint} is scaffolded, not implemented`
  }
}
