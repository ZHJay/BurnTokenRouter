/**
 * Momentum projection + rubber-banding helpers, modeled on Apple's
 * "Designing Fluid Interfaces" (WWDC18) talk.
 *
 * These are pure functions — no reactivity, no DOM — so they are trivial to
 * unit test and can be composed into any gesture/animation pipeline.
 */

/**
 * Project where a decelerating momentum scroll will come to rest, given an
 * initial velocity (in units/second) and a per-frame deceleration rate.
 *
 * This is the exact formula Apple presents for UIScrollView-style momentum:
 *
 *   distance = (velocity / 1000) * decelerationRate / (1 - decelerationRate)
 *
 * `velocity` is divided by 1000 to convert from units/second into the
 * units/millisecond space the geometric decay series is expressed in.
 *
 * @param initialVelocity release velocity in units per second (can be signed)
 * @param decelerationRate per-ms multiplier in [0, 1); UIKit "normal" = 0.998
 * @returns signed distance the value will travel before coming to rest
 */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  if (decelerationRate <= 0 || decelerationRate >= 1) {
    // Degenerate rate: no meaningful geometric decay, so no projected travel.
    return 0
  }
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate)
}

/**
 * Rubber-band resistance for dragging past a boundary, matching the iOS feel
 * where the further you pull, the more resistance you get (asymptotic).
 *
 *   offset = (overshoot * dimension * constant) / (dimension + constant * |overshoot|)
 *
 * @param overshoot how far past the edge the raw gesture wants to go (signed)
 * @param dimension the size of the scrollable/draggable dimension
 * @param constant resistance constant; Apple uses 0.55
 * @returns the damped offset to actually apply (same sign as overshoot)
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0) return 0
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/**
 * Return the value from `points` closest to `value`. Useful for paging /
 * snap-to-detent behavior after a projected momentum throw.
 *
 * @param value the (possibly projected) resting value
 * @param points candidate snap points; if empty, `value` is returned unchanged
 */
export function nearestSnapPoint(value: number, points: number[]): number {
  if (points.length === 0) return value
  let best = points[0]
  let bestDist = Math.abs(value - best)
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(value - points[i])
    if (d < bestDist) {
      best = points[i]
      bestDist = d
    }
  }
  return best
}
