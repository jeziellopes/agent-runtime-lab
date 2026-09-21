import { ValidationError } from '@arl/contracts'
import { z } from 'zod'

import type { ExecutionRequest } from '@arl/contracts'

/**
 * Unknown fields are stripped rather than rejected, and nothing is coerced: a
 * numeric `prompt` is a client error, not a string.
 */
const EXECUTE_BODY = z.object({
  input: z.object({ prompt: z.string().min(1) }),
  sessionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

/**
 * The body arrives as text, whatever `Content-Type` it claimed, and is parsed
 * here so that no validation behavior belongs to the framework.
 */
export function executionRequest(
  body: unknown,
  agentId: string
): ExecutionRequest {
  const parsed = EXECUTE_BODY.safeParse(json(body))

  if (!parsed.success) {
    throw new ValidationError(detailOf(parsed.error))
  }

  return { agentId, ...parsed.data }
}

function json(body: unknown): unknown {
  try {
    return JSON.parse(String(body))
  } catch {
    throw new ValidationError('the request body is not valid JSON')
  }
}

function detailOf(error: z.ZodError): string {
  return error.issues
    .map(issue =>
      issue.path.length === 0
        ? issue.message
        : `${issue.path.join('.')}: ${issue.message}`
    )
    .join('; ')
}
