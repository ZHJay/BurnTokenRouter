import { ref, onScopeDispose, type Ref } from 'vue'

/**
 * Interruptible spring animator implementing the physics from Apple's
 * "Designing Fluid Interfaces" (WWDC18) talk.
 *
 * Instead of exposing raw stiffness/mass/damping-coefficient, we use the two
 * designer-facing parameters Apple recommends:
 *
 *  - `response`: the approximate time (in seconds) for the spring to reach its
 *    target. Internally this maps to the natural angular frequency:
 *      omega = 2 * PI / response
 *  - `damping`: the damping ratio (zeta). 1.0 = critically damped (fast, no
 *    overshoot); < 1 underdamped (bouncy overshoot); > 1 overdamped (sluggish).
 *
 * The animation is fully interruptible: calling `set()` mid-flight retargets
 * from the current presentation value AND velocity, so there is never a jump.
 */
export interface SpringOptions {
  /** Damping ratio (zeta). 1 = critical (default), <1 overshoots, >1 sluggish. */
  damping?: number
  /** Seconds to reach the target. Default 0.35. */
  response?: number
}

export interface UseSpringReturn {
  /** Live presentation value. */
  value: Ref<number>
  /** Live presentation velocity (units/second). */
  velocity: Ref<number>
  /** Retarget the spring. Optionally override damping/response for this move. */
  set: (target: number, opts?: SpringOptions) => void
  /** Halt the animation immediately, leaving `value` where it is. */
  stop: () => void
}

const DEFAULT_DAMPING = 1.0
const DEFAULT_RESPONSE = 0.35

/** Below these thresholds we consider the spring settled and snap to target. */
const REST_DELTA = 0.001
const REST_VELOCITY = 0.001

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

/**
 * Create an interruptible spring.
 *
 * @param initial starting value
 * @param opts default damping/response for this spring
 */
export function useSpring(initial: number, opts: SpringOptions = {}): UseSpringReturn {
  const value = ref<number>(initial)
  const velocity = ref<number>(0)

  let target = initial
  let damping = opts.damping ?? DEFAULT_DAMPING
  let response = opts.response ?? DEFAULT_RESPONSE

  let rafId: number | null = null
  let lastTime = 0

  const canRaf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'

  function cancelFrame(): void {
    if (rafId !== null && canRaf) {
      window.cancelAnimationFrame(rafId)
    }
    rafId = null
  }

  function settle(): void {
    value.value = target
    velocity.value = 0
    cancelFrame()
  }

  /**
   * Integrate the spring one step. Uses an analytic solution of the damped
   * harmonic oscillator so it stays stable regardless of frame timing.
   *
   * Equation of motion (displacement x = value - target):
   *   x'' + 2*zeta*omega*x' + omega^2 * x = 0
   */
  function step(dt: number): void {
    const omega = (2 * Math.PI) / Math.max(response, 1e-4)
    const zeta = Math.max(damping, 0)

    // Displacement/velocity relative to target.
    const x0 = value.value - target
    const v0 = velocity.value

    let x: number
    let v: number

    if (zeta < 1) {
      // Underdamped — oscillatory decay.
      const omegaD = omega * Math.sqrt(1 - zeta * zeta)
      const envelope = Math.exp(-zeta * omega * dt)
      const c1 = x0
      const c2 = (v0 + zeta * omega * x0) / omegaD
      const cos = Math.cos(omegaD * dt)
      const sin = Math.sin(omegaD * dt)
      x = envelope * (c1 * cos + c2 * sin)
      v =
        envelope *
        ((c1 * cos + c2 * sin) * -zeta * omega + (-c1 * sin + c2 * cos) * omegaD)
    } else if (zeta === 1) {
      // Critically damped — fastest non-oscillating return.
      const envelope = Math.exp(-omega * dt)
      const c1 = x0
      const c2 = v0 + omega * x0
      x = (c1 + c2 * dt) * envelope
      v = (c2 - omega * (c1 + c2 * dt)) * envelope
    } else {
      // Overdamped — two real exponentials.
      const disc = omega * Math.sqrt(zeta * zeta - 1)
      const r1 = -zeta * omega + disc
      const r2 = -zeta * omega - disc
      const c2 = (v0 - r1 * x0) / (r2 - r1)
      const c1 = x0 - c2
      const e1 = Math.exp(r1 * dt)
      const e2 = Math.exp(r2 * dt)
      x = c1 * e1 + c2 * e2
      v = c1 * r1 * e1 + c2 * r2 * e2
    }

    value.value = target + x
    velocity.value = v

    if (Math.abs(x) < REST_DELTA && Math.abs(v) < REST_VELOCITY) {
      settle()
    }
  }

  function tick(): void {
    const t = now()
    // Clamp dt to avoid instability after tab-switches / long pauses.
    const dt = Math.min((t - lastTime) / 1000, 1 / 30)
    lastTime = t

    if (dt > 0) step(dt)

    if (rafId !== null && canRaf) {
      rafId = window.requestAnimationFrame(tick)
    }
  }

  function startLoop(): void {
    if (!canRaf) {
      // No rAF available (e.g. SSR / non-browser): jump straight to target.
      settle()
      return
    }
    if (rafId !== null) return
    lastTime = now()
    rafId = window.requestAnimationFrame(tick)
  }

  function set(nextTarget: number, nextOpts?: SpringOptions): void {
    if (nextOpts?.damping !== undefined) damping = nextOpts.damping
    if (nextOpts?.response !== undefined) response = nextOpts.response

    target = nextTarget

    if (prefersReducedMotion()) {
      // Honor the user's reduced-motion preference: no springy travel.
      settle()
      return
    }

    // Interruptible: keep the current value/velocity and simply retarget.
    if (value.value === target && Math.abs(velocity.value) < REST_VELOCITY) {
      settle()
      return
    }

    startLoop()
  }

  function stop(): void {
    // Freeze in place: retarget to the live value so the loop won't restart.
    target = value.value
    velocity.value = 0
    cancelFrame()
  }

  onScopeDispose(() => {
    cancelFrame()
  })

  return { value, velocity, set, stop }
}
