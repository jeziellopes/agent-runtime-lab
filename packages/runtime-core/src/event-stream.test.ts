import { describe, expect, it } from 'vitest'

import { EPOCH, InMemoryEventStream } from './event-stream.js'

import type { EmittedEvent, RuntimeEvent } from '@arl/events'

const created = (executionId: string): EmittedEvent => ({
  type: 'execution.created',
  executionId,
  data: { agentId: 'simple-agent' }
})

const started = (executionId: string): EmittedEvent => ({
  type: 'execution.started',
  executionId
})

const completed = (executionId: string): EmittedEvent => ({
  type: 'execution.completed',
  executionId,
  data: { output: { text: 'done' } }
})

async function drain(
  iterable: AsyncIterable<RuntimeEvent>
): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = []

  for await (const event of iterable) {
    events.push(event)
  }

  return events
}

describe('replaying from the beginning', () => {
  it('gives a late consumer every event, starting at the first', async () => {
    const stream = new InMemoryEventStream()

    stream.publish(created('e1'))
    stream.publish(started('e1'))

    const reading = drain(stream.events('e1'))

    stream.publish(completed('e1'))

    expect((await reading).map(event => event.type)).toEqual([
      'execution.created',
      'execution.started',
      'execution.completed'
    ])
  })

  it('completes rather than hanging once the terminal event has passed', async () => {
    const stream = new InMemoryEventStream()

    stream.publish(created('e1'))
    stream.publish(completed('e1'))

    expect(await drain(stream.events('e1'))).toEqual([])
  })

  it('yields nothing for an execution that never ran', async () => {
    expect(await drain(new InMemoryEventStream().events('ghost'))).toEqual([])
  })

  it('wakes a consumer already waiting on the next event', async () => {
    const stream = new InMemoryEventStream()

    stream.publish(created('e1'))

    const reading = drain(stream.events('e1'))

    await Promise.resolve()
    stream.publish(completed('e1'))

    expect(await reading).toHaveLength(2)
  })
})

describe('keeping executions apart', () => {
  it('gives each consumer only its own execution', async () => {
    const stream = new InMemoryEventStream()

    stream.publish(created('one'))
    stream.publish(created('two'))

    const first = drain(stream.events('one'))
    const second = drain(stream.events('two'))

    stream.publish(completed('one'))
    stream.publish(completed('two'))

    expect((await first).every(event => event.executionId === 'one')).toBe(true)
    expect((await second).every(event => event.executionId === 'two')).toBe(
      true
    )
  })
})

describe('the serialised key order', () => {
  it('puts the timestamp before the data, not after it', async () => {
    const stream = new InMemoryEventStream(true)

    stream.open('exec-1')
    stream.publish(created('exec-1'))

    const events = drain(stream.events('exec-1'))

    stream.publish(completed('exec-1'))

    const [first] = await events

    expect(JSON.stringify(first)).toBe(
      '{"type":"execution.created","executionId":"exec-1","timestamp":"1970-01-01T00:00:00.000Z","data":{"agentId":"simple-agent"}}'
    )
  })

  it('writes no data key for the two events that carry none', async () => {
    const stream = new InMemoryEventStream(true)

    stream.open('exec-1')
    stream.publish(started('exec-1'))

    const events = drain(stream.events('exec-1'))

    stream.publish(completed('exec-1'))

    const [first] = await events

    expect(JSON.stringify(first)).toBe(
      '{"type":"execution.started","executionId":"exec-1","timestamp":"1970-01-01T00:00:00.000Z"}'
    )
  })
})

describe('stamping the timestamp', () => {
  it('writes the epoch constant under deterministic mode', async () => {
    const stream = new InMemoryEventStream(true)

    stream.publish(created('e1'))
    stream.publish(completed('e1'))

    const events = await drain(stream.events('e1'))

    expect(events).toEqual([])
    expect(EPOCH.toISOString()).toBe('1970-01-01T00:00:00.000Z')
  })

  it('stamps every event with the same constant when deterministic', async () => {
    const stream = new InMemoryEventStream(true)

    stream.publish(created('e1'))

    const reading = drain(stream.events('e1'))

    stream.publish(completed('e1'))

    for (const event of await reading) {
      expect(event.timestamp.toISOString()).toBe('1970-01-01T00:00:00.000Z')
    }
  })

  it('stamps the wall clock otherwise', async () => {
    const stream = new InMemoryEventStream(false)

    stream.publish(created('e1'))

    const reading = drain(stream.events('e1'))

    stream.publish(completed('e1'))

    for (const event of await reading) {
      expect(event.timestamp.getTime()).toBeGreaterThan(0)
    }
  })

  it('leaves the emitter unable to set one', () => {
    const emitted = created('e1')

    expect(emitted).not.toHaveProperty('timestamp')
  })
})
