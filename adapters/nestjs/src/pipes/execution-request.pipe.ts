import { Injectable } from '@nestjs/common'
import { ValidationError } from '@arl/contracts'

import type { PipeTransform } from '@nestjs/common'

export interface ExecutionBody {
  input: { prompt: string }
  sessionId?: string
  metadata?: Record<string, unknown>
}

/**
 * This adapter's own validation. The Hono adapter validates with zod; the
 * status and the `error` code must match between them, and the `detail` text
 * need not.
 *
 * Unknown fields are dropped rather than rejected, and nothing is coerced: a
 * numeric `prompt` is a client error, not a string.
 */
@Injectable()
export class ExecutionRequestPipe implements PipeTransform<unknown> {
  transform(value: unknown): ExecutionBody {
    const body = object(value, 'the request body must be an object')
    const input = object(body['input'], 'input must be an object')
    const prompt = input['prompt']

    if (typeof prompt !== 'string' || prompt.length === 0) {
      throw new ValidationError('input.prompt must be a non-empty string')
    }

    return {
      input: { prompt },
      ...optionalText(body, 'sessionId'),
      ...optionalObject(body, 'metadata')
    }
  }
}

function object(value: unknown, complaint: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(complaint)
  }

  return value as Record<string, unknown>
}

function optionalText(
  body: Record<string, unknown>,
  key: 'sessionId'
): { sessionId?: string } {
  const value = body[key]

  if (value === undefined) {
    return {}
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${key} must be a string`)
  }

  return { sessionId: value }
}

function optionalObject(
  body: Record<string, unknown>,
  key: 'metadata'
): { metadata?: Record<string, unknown> } {
  const value = body[key]

  return value === undefined
    ? {}
    : { metadata: object(value, `${key} must be an object`) }
}
