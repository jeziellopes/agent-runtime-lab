import type { RuntimeEvent, RuntimeEventType } from '@arl/events'

/**
 * One parsed frame. The bytes are what `sse.framing.bytes` compares; this
 * parse exists for the assertions about sequence and id, which are about
 * meaning rather than about framing.
 */
export interface ParsedFrame {
  id: number
  event: RuntimeEventType
  data: RuntimeEvent
}

export class SseParseError extends Error {}

/**
 * The wire format is fixed: `id`, then `event`, then `data`, then a blank line.
 * A parse that accepted fields in any order would hide a divergence in the one
 * thing both adapters must write identically.
 */
export function parseFrames(raw: string): ParsedFrame[] {
  return raw
    .split('\n\n')
    .filter(block => block.length > 0)
    .map(parseFrame)
}

function parseFrame(block: string): ParsedFrame {
  const lines = block.split('\n')
  const [idLine, eventLine, dataLine, ...rest] = lines

  if (rest.length > 0) {
    throw new SseParseError(`frame has ${String(lines.length)} lines, want 3`)
  }

  const id = Number(prefixed(idLine, 'id: '))

  if (!Number.isInteger(id)) {
    throw new SseParseError(`frame id is not an integer: ${String(idLine)}`)
  }

  return {
    id,
    event: prefixed(eventLine, 'event: ') as RuntimeEventType,
    data: JSON.parse(prefixed(dataLine, 'data: ')) as RuntimeEvent
  }
}

function prefixed(line: string | undefined, prefix: string): string {
  if (line === undefined || !line.startsWith(prefix)) {
    throw new SseParseError(
      `expected a line starting ${prefix}, got ${String(line)}`
    )
  }

  return line.slice(prefix.length)
}

/** Ids start at 1 and step by exactly one, so a dropped frame is detectable. */
export function idsAreMonotonic(frames: readonly ParsedFrame[]): boolean {
  return frames.every((frame, index) => frame.id === index + 1)
}

export function eventTypes(frames: readonly ParsedFrame[]): RuntimeEventType[] {
  return frames.map(frame => frame.event)
}
