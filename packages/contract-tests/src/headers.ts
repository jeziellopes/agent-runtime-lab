/**
 * Header names are case-insensitive per RFC 9110, and the spike observed the
 * same header emitted as `x-powered-by` under Node and `X-Powered-By` under
 * Bun, in a different position. An exact-string comparison would report a
 * framework difference that is not one.
 */
export type HeaderPairs = readonly (readonly [string, string])[]

export function headerValue(
  headers: HeaderPairs,
  name: string
): string | undefined {
  const wanted = name.toLowerCase()

  return headers.find(([key]) => key.toLowerCase() === wanted)?.[1]
}

/** Order carries no meaning, so the comparison is over a name-keyed map. */
export function headersEqual(a: HeaderPairs, b: HeaderPairs): boolean {
  const left = normalise(a)
  const right = normalise(b)

  if (left.size !== right.size) {
    return false
  }

  for (const [name, value] of left) {
    if (right.get(name) !== value) {
      return false
    }
  }

  return true
}

function normalise(headers: HeaderPairs): Map<string, string> {
  return new Map(headers.map(([key, value]) => [key.toLowerCase(), value]))
}
