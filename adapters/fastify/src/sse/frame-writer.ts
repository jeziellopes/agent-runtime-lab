import type { RuntimeEvent } from '@arl/events'

/**
 * Framing is written here, on the raw response; Fastify's own reply
 * serialization is not used. Every adapter writes its own frames.
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
export function encodeFrame(id: number, event: RuntimeEvent): string {
  return `id: ${String(id)}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}
