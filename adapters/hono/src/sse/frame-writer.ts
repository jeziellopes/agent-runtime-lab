import type { RuntimeEvent } from '@arl/events'

const ENCODER = new TextEncoder()

/**
 * Framing is written here; `hono/streaming`'s `streamSSE` is not used. Both
 * adapters write their own frames.
 *
 * The wire format, byte for byte:
 *
 *     id: <monotonic integer, per execution, starting at 1>
 *     event: <RuntimeEvent.type>
 *     data: <JSON.stringify(event)>
 *     <blank line>
 *
 * No `retry:` field and no reconnection.
 */
export function encodeFrame(id: number, event: RuntimeEvent): Uint8Array {
  return ENCODER.encode(
    `id: ${String(id)}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  )
}
