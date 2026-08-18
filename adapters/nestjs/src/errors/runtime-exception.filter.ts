import { Catch } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'

import { toErrorResponse } from './error-mapping.js'

import type { ArgumentsHost } from '@nestjs/common'
import type { ServerResponse } from 'node:http'

/**
 * Errors converge here: handlers throw, and nothing maps a status at a return
 * site. Written onto the raw response so the body carries exactly the two keys
 * the contract names, rather than the framework's `statusCode`/`message` shape.
 *
 * A failure this adapter does not own falls through to the framework, which is
 * how an unmatched route stays the framework's answer about its own routing.
 */
@Catch()
export class RuntimeExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const mapped = toErrorResponse(exception)

    if (mapped === undefined) {
      super.catch(exception, host)

      return
    }

    const response = host.switchToHttp().getResponse<ServerResponse>()

    /* Nothing is written once the SSE headers are out: a failure after the
       first frame is an `execution.failed` event, not a status. */
    if (response.headersSent) {
      response.end()

      return
    }

    response.writeHead(mapped.status, {
      'content-type': 'application/json',
      ...mapped.headers
    })
    response.end(JSON.stringify(mapped.body))
  }
}
