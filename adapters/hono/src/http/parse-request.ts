import { ValidationError } from '@arl/contracts'
import { z } from 'zod'

import type { ExecutionRequest } from '@arl/contracts'
import type { Context } from 'hono'

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
 * The body is read as text and parsed here rather than through
 * `@hono/zod-validator`, whose JSON target answers `{}` unless the request
 * carried a JSON `Content-Type`. The header is meant to be ignored, and a body
 * that silently became `{}` would be reported as a missing `prompt`.
 */
export async function executionRequest(
  context: Context,
  agentId: string
): Promise<ExecutionRequest> {
  const parsed = EXECUTE_BODY.safeParse(await json(context))

  if (!parsed.success) {
    throw new ValidationError(detailOf(parsed.error))
  }

  return { agentId, ...parsed.data }
}

async function json(context: Context): Promise<unknown> {
  const text = await context.req.text()

  try {
    return JSON.parse(text)
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
