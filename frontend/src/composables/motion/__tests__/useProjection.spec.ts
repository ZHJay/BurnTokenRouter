import { describe, it, expect } from 'vitest'

import { project, rubberband, nearestSnapPoint } from '../useProjection'

describe('project (momentum landing distance)', () => {
  it('matches the Apple formula (v/1000)*d/(1-d)', () => {
    const v = 2000 // px/s
    const d = 0.998
    const expected = (v / 1000) * d / (1 - d)
    expect(project(v, d)).toBeCloseTo(expected, 10)
  })

  it('uses the default deceleration rate of 0.998', () => {
    expect(project(1000)).toBeCloseTo((1000 / 1000) * 0.998 / (1 - 0.998), 10)
  })

  it('preserves the sign of the velocity', () => {
    expect(project(-1500)).toBeLessThan(0)
    expect(project(1500)).toBeGreaterThan(0)
  })

  it('returns zero for zero velocity', () => {
    expect(project(0)).toBe(0)
  })

  it('returns zero for degenerate deceleration rates', () => {
    expect(project(1000, 0)).toBe(0)
    expect(project(1000, 1)).toBe(0)
    expect(project(1000, 1.5)).toBe(0)
  })
})

describe('rubberband (edge resistance)', () => {
  it('matches the Apple formula', () => {
    const overshoot = 120
    const dimension = 400
    const constant = 0.55
    const expected =
      (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
    expect(rubberband(overshoot, dimension, constant)).toBeCloseTo(expected, 10)
  })

  it('defaults the constant to 0.55', () => {
    const overshoot = 80
    const dimension = 300
    const expected = (overshoot * dimension * 0.55) / (dimension + 0.55 * Math.abs(overshoot))
    expect(rubberband(overshoot, dimension)).toBeCloseTo(expected, 10)
  })

  it('is always smaller in magnitude than the raw overshoot (resistance)', () => {
    const overshoot = 200
    const dimension = 400
    expect(Math.abs(rubberband(overshoot, dimension))).toBeLessThan(Math.abs(overshoot))
  })

  it('preserves the sign of the overshoot', () => {
    expect(rubberband(-100, 400)).toBeLessThan(0)
    expect(rubberband(100, 400)).toBeGreaterThan(0)
  })

  it('returns zero for a non-positive dimension', () => {
    expect(rubberband(100, 0)).toBe(0)
    expect(rubberband(100, -50)).toBe(0)
  })
})

describe('nearestSnapPoint', () => {
  it('returns the closest point', () => {
    expect(nearestSnapPoint(42, [0, 50, 100])).toBe(50)
    expect(nearestSnapPoint(24, [0, 50, 100])).toBe(0)
    expect(nearestSnapPoint(76, [0, 50, 100])).toBe(100)
  })

  it('returns the value unchanged when there are no points', () => {
    expect(nearestSnapPoint(37, [])).toBe(37)
  })

  it('handles a single point', () => {
    expect(nearestSnapPoint(1000, [7])).toBe(7)
  })

  it('picks the first candidate on an exact tie', () => {
    // Distance to 0 and 100 is equal for value 50; first-wins keeps 0.
    expect(nearestSnapPoint(50, [0, 100])).toBe(0)
  })
})
