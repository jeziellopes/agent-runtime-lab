import { describe, expect, it } from 'vitest'

import {
  differsSignificantly,
  distributionOf,
  resolutionFloor
} from './statistics.js'

import type { Distribution } from './statistics.js'

describe('a distribution computed from a sample', () => {
  it('carries the mean, percentiles, stdev and run count the sample implies', () => {
    expect(distributionOf([1, 2, 3, 4, 5])).toEqual({
      mean: 3,
      p50: 3,
      p95: 5,
      p99: 5,
      stdev: Math.sqrt(2.5),
      runs: 5
    })
  })

  it('has a stdev of 0 for a sample of one run', () => {
    expect(distributionOf([7]).stdev).toBe(0)
  })
})

describe('the resolution floor', () => {
  it('is 1.96 times the standard error of the pair', () => {
    const a: Distribution = {
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      stdev: 1,
      runs: 100
    }
    const b: Distribution = {
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      stdev: 1,
      runs: 100
    }

    expect(resolutionFloor(a, b)).toBeCloseTo(1.96 * Math.sqrt(0.02), 10)
  })
})

describe('the significance test', () => {
  const a: Distribution = {
    mean: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    stdev: 1,
    runs: 100
  }

  it('is true when the difference of means exceeds the resolution floor', () => {
    const floor = resolutionFloor(a, a)
    const b: Distribution = { ...a, mean: floor + 0.0001 }

    expect(differsSignificantly(a, b)).toBe(true)
  })

  it('is false exactly at the resolution floor', () => {
    const floor = resolutionFloor(a, a)
    const b: Distribution = { ...a, mean: floor }

    expect(differsSignificantly(a, b)).toBe(false)
  })

  it('is false for two identical distributions at any run count', () => {
    const identical: Distribution = {
      mean: 5,
      p50: 5,
      p95: 5,
      p99: 5,
      stdev: 2,
      runs: 1_000_000
    }

    expect(differsSignificantly(identical, identical)).toBe(false)
  })

  it('is false for two identical distributions with stdev 0', () => {
    const zero: Distribution = {
      mean: 5,
      p50: 5,
      p95: 5,
      p99: 5,
      stdev: 0,
      runs: 1
    }

    expect(differsSignificantly(zero, zero)).toBe(false)
  })
})
