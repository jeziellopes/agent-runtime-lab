import { describe, expect, it } from 'vitest'

import { frameworkOverhead } from './metrics.js'

import type { ApplicationMetrics } from './metrics.js'
import type { RuntimeMetrics } from '@arl/contracts'

function runtimeMetrics(executionDuration: number): RuntimeMetrics {
  return {
    executionDuration,
    graphDuration: executionDuration,
    nodeDuration: 0,
    toolCalls: 0,
    llmCalls: 1,
    eventsGenerated: 4
  }
}

function applicationMetrics(requestLatency: number): ApplicationMetrics {
  return {
    startupTime: 0,
    requestLatency,
    responseTime: requestLatency,
    errorCount: 0,
    activeRequests: 1
  }
}

describe('framework overhead', () => {
  it('is the request latency minus the execution duration', () => {
    expect(
      frameworkOverhead(applicationMetrics(120), runtimeMetrics(100))
    ).toBe(20)
  })

  it('is negative rather than clamped when the runtime reports longer than the client observed', () => {
    expect(
      frameworkOverhead(applicationMetrics(100), runtimeMetrics(120))
    ).toBe(-20)
  })
})
