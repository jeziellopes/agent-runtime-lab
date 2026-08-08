import type { ServerResponse } from 'node:http'
import type { RuntimeEvent } from '@arl/events'

/**
 * This adapter does not use `@Sse()`, which emits `event, id, data` over a GET
 * route. Frames are written onto the response here.
 *
 * The wire format, byte for byte:
 *
 *     id: <monotonic integer, per execution, starting at 1>
 *     event: <RuntimeEvent.type>
 *     data: <JSON.stringify(event)>
 *     <blank line>
 *
 * The contract suite asserts these bytes with `od -c`.
 */
export function writeFrame(
  _response: ServerResponse,
  _id: number,
  _event: RuntimeEvent
): void {
  throw new Error('writeFrame is not implemented')
}
