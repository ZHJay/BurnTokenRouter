/**
 * Zero-dependency spring animation, modeled the way Apple parameterizes motion.
 *
 * Apple deliberately replaced the physics triplet (mass/stiffness/damping) with
 * two designer-facing parameters:
 *   - damping  (damping ratio) controls overshoot. 1.0 = critically damped, no
 *              bounce. < 1.0 overshoots. Lower = bouncier.
 *   - response how quickly the value reaches the target, in seconds. This is
 *              NOT a duration: a spring has no fixed duration, its settle time
 *              emerges from the parameters.
 *
 * The two properties that make springs the right tool for anything a user can
 * touch, and which this implementation guarantees:
 *   1. Re-targeting always starts from the *current presentation value*, so an
 *      interrupted animation never jumps.
 *   2. Velocity is carried through a re-target, so a gesture reversal does not
 *      hit a "brick wall" of discontinuous velocity.
 *
 * Defaults: damping 1.0 everywhere. Reserve bounce (~0.8) for motion that
 * followed a real gesture with momentum (a flick, a drag release). Overshoot on
 * a menu that merely faded in feels wrong.
 */

import { onScopeDispose, ref, type Ref } from 'vue'

export interface SpringOptions {
  /** Damping ratio. 1.0 = critically damped (no overshoot). ~0.8 for momentum. */
  damping?: number
  /** Seconds to reach the target. Lower = snappier. Not a duration. */
  response?: number
  /** Starting value. */
  from?: number
  /** Called on every frame with the live value. */
  onUpdate?: (value: number) => void
  /** Called once the spring settles. */
  onRest?: () => void
}

export interface SpringController {
  /** Live presentation value, updated every frame. */
  value: Ref<number>
  /** Whether the spring is currently animating. */
  isAnimating: Ref<boolean>
  /** Animate to a target, optionally handing off a release velocity (px/s). */
  to: (target: number, initialVelocity?: number) => void
  /** Jump to a value with no animation, clearing velocity. */
  set: (value: number) => void
  /** Stop where it is, preserving the current value. */
  stop: () => void
  /** Current velocity in units/s. */
  getVelocity: () => number
}

/** Settle thresholds. Below both, the spring snaps to target and stops. */
const REST_DISPLACEMENT = 0.01
const REST_VELOCITY = 0.05
/** Clamp the timestep so a backgrounded tab cannot explode the integration. */
const MAX_FRAME_SECONDS = 1 / 30

/**
 * Detects the reduced-motion preference. Reduced motion does not mean *no*
 * feedback: the spring collapses to an immediate value change so callers still
 * observe the final state, they just don't get vestibular motion.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useSpring(options: SpringOptions = {}): SpringController {
  const { damping = 1, response = 0.4, from = 0, onUpdate, onRest } = options

  const value = ref(from)
  const isAnimating = ref(false)

  let target = from
  let velocity = 0
  let frame: number | null = null
  let lastTime = 0

  const zeta = damping
  const omega = (2 * Math.PI) / response

  function emit(next: number): void {
    value.value = next
    onUpdate?.(next)
  }

  function settle(): void {
    velocity = 0
    emit(target)
    frame = null
    isAnimating.value = false
    onRest?.()
  }

  function tick(now: number): void {
    const dt = Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS)
    lastTime = now

    // Semi-implicit Euler on a damped harmonic oscillator.
    // Integrating velocity before position keeps this stable at large dt.
    const displacement = value.value - target
    const acceleration = -omega * omega * displacement - 2 * zeta * omega * velocity
    velocity += acceleration * dt
    emit(value.value + velocity * dt)

    if (Math.abs(value.value - target) < REST_DISPLACEMENT && Math.abs(velocity) < REST_VELOCITY) {
      settle()
      return
    }

    frame = requestAnimationFrame(tick)
  }

  function to(nextTarget: number, initialVelocity?: number): void {
    target = nextTarget

    if (prefersReducedMotion()) {
      settle()
      return
    }

    // Velocity handoff: pass the gesture's release velocity so there is no
    // visible seam between dragging and animating.
    if (initialVelocity !== undefined) velocity = initialVelocity

    if (frame === null) {
      isAnimating.value = true
      lastTime =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()
      frame = requestAnimationFrame(tick)
    }
    // If a frame is already scheduled the loop keeps running from the current
    // presentation value and velocity, which is exactly what interruption needs.
  }

  function set(next: number): void {
    stop()
    target = next
    velocity = 0
    emit(next)
  }

  function stop(): void {
    if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }
    isAnimating.value = false
  }

  onScopeDispose(stop)

  return {
    value,
    isAnimating,
    to,
    set,
    stop,
    getVelocity: () => velocity
  }
}

/**
 * Apple's momentum projection, from the Designing Fluid Interfaces sample code.
 *
 * Projects where a flick would come to rest so you can snap to the target
 * nearest that point, instead of the one nearest the release point. This is what
 * makes a flick feel like it throws the element.
 *
 * Note this is the exponential-decay form, not the physics-textbook
 * v^2/(2*deceleration). The latter is not what Apple ships.
 *
 * @param initialVelocity Release velocity in px/s.
 * @param decelerationRate 0.998 for normal scroll feel, 0.99 for snappier.
 */
export function projectMomentum(initialVelocity: number, decelerationRate = 0.998): number {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/**
 * Progressive resistance past a boundary. A hard stop reads as "frozen";
 * continuous resistance reads as "responsive, but there is nothing more here."
 *
 * @param overshoot How far past the boundary the pointer has travelled.
 * @param dimension Size of the scrollable/draggable dimension.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension === 0) return 0
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/** Apple's shipped spring values, for consistency across the panel. */
export const SPRING_PRESETS = {
  /** Move / reposition. Critically damped. */
  move: { damping: 1, response: 0.4 },
  /** Rotation. Slight overshoot. */
  rotate: { damping: 0.8, response: 0.4 },
  /** Drawer / sheet. Slight overshoot, snappier. */
  sheet: { damping: 0.8, response: 0.3 },
  /** Default UI transition. No overshoot. */
  ui: { damping: 1, response: 0.34 }
} as const
