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
 * The three properties that make springs the right tool for anything a user can
 * touch, and which this implementation guarantees:
 *   1. Re-targeting always starts from the *current presentation value*, so an
 *      interrupted animation never jumps.
 *   2. Velocity is carried through a re-target, so a gesture reversal does not
 *      hit a "brick wall" of discontinuous velocity.
 *   3. The trajectory is a function of elapsed time, not of the refresh rate:
 *      the integration runs in fixed sub-steps drained from each frame, so
 *      30Hz, 60Hz and 120Hz put the same value on screen at the same instant.
 *
 * Defaults: damping 1.0 everywhere. Reserve bounce (~0.8) for motion that
 * followed a real gesture with momentum (a flick, a drag release). Overshoot on
 * a menu that merely faded in feels wrong.
 */

import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

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

/**
 * Settle thresholds, as a floor. Below both, the spring snaps to target and
 * stops. These are absolute, which is right for a 0..1 range and far too tight
 * for a 800px collapse: 0.01px of 800 is invisible, but the spring keeps
 * running for another half second to reach it, holding `will-change` and
 * withholding onRest the whole way. See restFor().
 */
const REST_DISPLACEMENT = 0.01
const REST_VELOCITY = 0.05
/**
 * Rest thresholds also scale with the span of the animation, so "close enough"
 * means the same fraction of the motion at every scale. 0.1% of the span is
 * under a pixel on an 800px move, and small enough to leave a damping-0.9
 * bounce (0.15% of the span) intact — a 1% threshold would swallow it, which
 * would reintroduce the same "the bounce never happens" bug from the other end.
 */
const REST_DISPLACEMENT_RATIO = 0.001
const REST_VELOCITY_RATIO = 0.005
/**
 * Fixed integration sub-step. The physics advances in steps of this size no
 * matter how often the display refreshes, which is what makes 30/60/120Hz
 * produce the same trajectory in time instead of three different animations.
 */
const STEP_SECONDS = 1 / 240
/**
 * Cap on how much time one frame may integrate, so returning to a backgrounded
 * tab replays a bounded number of sub-steps instead of thousands.
 *
 * This is a *work* bound, not a stability bound. It used to be 1/30, sold as
 * protecting the integration, and it did the opposite: it pinned dt at exactly
 * the value that makes a single Euler step diverge for any response <= 0.25s,
 * turning a stiff spring into NaN and an unkillable rAF loop. Stability now
 * comes from the sub-step size, so this can sit high enough that a genuinely
 * 30fps device integrates real elapsed time rather than being slowed down.
 */
const MAX_FRAME_SECONDS = 1 / 15
/**
 * Sanity clamps on the caller-facing parameters. They exist to bound the work
 * per frame and to guarantee the loop can terminate, not to second-guess the
 * designer: every shipped preset passes through untouched.
 *
 * - response below one frame cannot be perceived as motion anyway, and drives
 *   the sub-step count up without changing what is on screen.
 * - damping 0 is a frictionless spring: it oscillates forever, never reaches
 *   the rest thresholds, and so would leave rAF running for the life of the
 *   page with onRest never firing.
 */
const MIN_RESPONSE_SECONDS = 1 / 60
const MIN_DAMPING = 0.01
const MAX_DAMPING = 10
/**
 * Upper bound on the sub-step relative to the oscillation period, applied only
 * to springs stiffer than STEP_SECONDS can resolve. RK4 is stable while
 * omega*dt stays under ~2.8 for any damping ratio at or below critical, and the
 * bound tightens as damping grows; 0.2 * response / max(1, damping) keeps
 * omega*dt <= 1.26 across the whole clamped parameter range. With the clamps
 * above, one frame integrates at most 200 sub-steps.
 */
const SUBSTEP_PERIOD_FRACTION = 0.2
/**
 * Slack when draining the accumulator. A frame that is an exact multiple of the
 * sub-step must run exactly that many steps; without the slack, float error of
 * one part in 10^16 drops the last step and the trajectory would depend on the
 * frame rate again — the precise thing sub-stepping is here to prevent.
 */
const STEP_EPSILON = 1e-9

/** Mutable integration state, reused every sub-step so the loop allocates nothing. */
interface SpringState {
  displacement: number
  velocity: number
}

function acceleration(
  displacement: number,
  velocity: number,
  zeta: number,
  omega: number
): number {
  return -omega * omega * displacement - 2 * zeta * omega * velocity
}

/**
 * One classical RK4 step of the damped harmonic oscillator
 * x'' = -omega^2 * x - 2 * zeta * omega * x'.
 *
 * The integrator matters more than it looks, because every visible property of
 * a spring is a property of its *trajectory*, and a single Euler step per frame
 * gets the trajectory wrong in ways a designer would call bugs: it damps out
 * the overshoot that a bouncy preset exists to produce (0.11% instead of 1.52%
 * at damping 0.8), it front-loads the motion so the first frame jumps ~2.5x too
 * far, and it inverts a velocity handoff that points away from the target.
 *
 * RK4 at a 1/240s sub-step tracks the closed-form solution to well under a
 * hundredth of a pixel on an 800px move, so the numbers the parameters promise
 * are the numbers that reach the screen.
 */
function integrate(state: SpringState, dt: number, zeta: number, omega: number): void {
  const d = state.displacement
  const v = state.velocity
  const half = 0.5 * dt

  const k1d = v
  const k1v = acceleration(d, v, zeta, omega)
  const k2d = v + half * k1v
  const k2v = acceleration(d + half * k1d, v + half * k1v, zeta, omega)
  const k3d = v + half * k2v
  const k3v = acceleration(d + half * k2d, v + half * k2v, zeta, omega)
  const k4d = v + dt * k3v
  const k4v = acceleration(d + dt * k3d, v + dt * k3v, zeta, omega)

  state.displacement = d + (dt / 6) * (k1d + 2 * k2d + 2 * k3d + k4d)
  state.velocity = v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
}

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

  const zeta = Number.isFinite(damping)
    ? Math.min(Math.max(damping, MIN_DAMPING), MAX_DAMPING)
    : 1
  const responseSeconds = Math.max(
    Number.isFinite(response) && response > 0 ? response : 0.4,
    MIN_RESPONSE_SECONDS
  )
  const omega = (2 * Math.PI) / responseSeconds
  /** Sub-step for this spring: fixed, so it cannot depend on the frame rate. */
  const stepSeconds = Math.min(
    STEP_SECONDS,
    (SUBSTEP_PERIOD_FRACTION * responseSeconds) / Math.max(1, zeta)
  )

  /** Un-integrated time carried between frames. */
  let accumulator = 0
  const state: SpringState = { displacement: 0, velocity: 0 }
  let restDisplacement = REST_DISPLACEMENT
  let restVelocity = REST_VELOCITY

  /**
   * Sizes the rest thresholds to the motion about to happen. Scaling by
   * multiplication, with the absolute values as a floor, means a zero span
   * cannot divide by zero and a sub-pixel animation keeps exactly today's
   * thresholds instead of getting a tighter — slower — one.
   *
   * A handoff velocity counts towards the span: a 10px re-target flicked at
   * 2000px/s travels far further than 10px, and the thresholds should describe
   * the motion the user sees, not the distance to the target.
   */
  function measureRest(nextTarget: number): void {
    const distance = Math.abs(nextTarget - value.value)
    const throw_ = Math.abs(velocity) / omega
    const span = Math.max(
      Number.isFinite(distance) ? distance : 0,
      Number.isFinite(throw_) ? throw_ : 0
    )
    restDisplacement = Math.max(REST_DISPLACEMENT, REST_DISPLACEMENT_RATIO * span)
    restVelocity = Math.max(REST_VELOCITY, REST_VELOCITY_RATIO * span)
  }

  function emit(next: number): void {
    value.value = next
    onUpdate?.(next)
  }

  function settle(): void {
    // Cancel any queued frame before resting. Without this, a frame scheduled
    // by the previous tick still fires, finds itself already at rest, and calls
    // settle() a second time — so onRest, documented as firing once, fires
    // twice. Reachable when reduced motion turns on mid-flight: to() takes the
    // immediate-settle branch while a frame is still pending.
    if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }
    velocity = 0
    accumulator = 0
    emit(target)
    isAnimating.value = false
    onRest?.()
  }

  function tick(now: number): void {
    // The scheduled frame has fired, so nothing is pending any more. Recording
    // that before running any caller code is what lets the tail of this
    // function tell "nobody touched the loop" apart from "a callback stopped or
    // re-scheduled it".
    frame = null

    // A negative delta (clock adjustment, or a frame timestamp older than the
    // one to() recorded) must not run the integration backwards.
    const elapsed = Math.max((now - lastTime) / 1000, 0)
    lastTime = now
    accumulator += Math.min(elapsed, MAX_FRAME_SECONDS)

    // Read the presentation value back each frame, so a caller that writes
    // `value` between frames is still honoured.
    state.displacement = value.value - target
    state.velocity = velocity

    // Drain the frame's elapsed time in fixed sub-steps. The physics is a
    // property of the spring, not of how often the display happens to refresh.
    let stepped = false
    let rested = false
    while (accumulator >= stepSeconds - STEP_EPSILON) {
      accumulator -= stepSeconds
      integrate(state, stepSeconds, zeta, omega)
      stepped = true

      // Checked per sub-step rather than per frame: at 240 steps/s the spring
      // can arrive mid-frame, and there is no reason to integrate past rest.
      if (
        Math.abs(state.displacement) < restDisplacement &&
        Math.abs(state.velocity) < restVelocity
      ) {
        rested = true
        break
      }
    }

    velocity = state.velocity

    if (rested) {
      settle()
      return
    }

    // One write per frame, not per sub-step: onUpdate drives layout, and a
    // frame that advanced nothing has nothing to publish.
    if (stepped) emit(target + state.displacement)

    // onUpdate is caller code, and it is allowed to stop this spring or
    // re-target it. Scheduling unconditionally here would hand back a loop the
    // caller had just stopped — with isAnimating already false, so nothing
    // reports it as running and no later stop() can reach it — or a second
    // concurrent loop if the callback called stop() and then to(). Re-check
    // both facts we own: still animating, and no frame booked meanwhile.
    if (isAnimating.value && frame === null) frame = requestAnimationFrame(tick)
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

    measureRest(nextTarget)

    if (frame === null) {
      isAnimating.value = true
      accumulator = 0
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
    // Time that was never integrated is not owed to the next run.
    accumulator = 0
    isAnimating.value = false
  }

  // Only when there is a scope to own it. Transition hooks, event handlers and
  // rAF callbacks all run outside one, where onScopeDispose registers nothing
  // and only logs a warning — so the guard costs no cleanup and removes a
  // misleading warning from anything that constructs a spring imperatively.
  if (getCurrentScope()) onScopeDispose(stop)

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
