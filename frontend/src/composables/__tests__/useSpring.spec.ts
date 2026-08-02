/**
 * Behaviour contract for useSpring.
 *
 * jsdom has no display clock, so every test drives the spring by hand: rAF is a
 * queue we drain frame by frame and performance.now() reads a counter we advance
 * by exactly one 60 Hz frame per step. That makes the integration deterministic,
 * so assertions can be about *observable motion* (does it overshoot, does it
 * resume from where it visibly was) instead of "was rAF called".
 *
 * Two environment notes that the tests depend on:
 *  - src/__tests__/setup.ts stubs window.matchMedia to return matches:true for
 *    EVERY query, which would make prefersReducedMotion() true everywhere. Each
 *    test therefore installs its own matchMedia answering only the
 *    prefers-reduced-motion query.
 *  - useSpring registers onScopeDispose, so controllers are built inside an
 *    effectScope to avoid the "onScopeDispose() is called when there is no
 *    active effect scope" warning.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, nextTick, type EffectScope } from 'vue'
import { mount } from '@vue/test-utils'

import {
  SPRING_PRESETS,
  projectMomentum,
  rubberband,
  useSpring,
  type SpringController,
  type SpringOptions
} from '../useSpring'
import SpringCollapse from '@/components/common/SpringCollapse.vue'

const FRAME_MS = 1000 / 60
/** Bound on hand-driven frames. A 0.4s response settles in ~60 frames. */
const MAX_FRAMES = 400

let frameQueue: Map<number, FrameRequestCallback>
let nextFrameId: number
let clock: number
let rafCalls: number

/**
 * Analytical displacement of a damped harmonic oscillator, so assertions can be
 * pinned to the physics rather than to whatever the integrator happens to do.
 * d0/v0 are relative to the target; returns x - target at time t.
 */
function analyticalDisplacement(
  d0: number,
  v0: number,
  zeta: number,
  response: number,
  t: number
): number {
  const omega = (2 * Math.PI) / response
  if (zeta === 1) {
    const c = v0 + omega * d0
    return Math.exp(-omega * t) * (d0 + c * t)
  }
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const b = (v0 + zeta * omega * d0) / wd
  return Math.exp(-zeta * omega * t) * (d0 * Math.cos(wd * t) + b * Math.sin(wd * t))
}

/** Peak overshoot of a step response as a fraction of the span. */
function analyticalOvershoot(zeta: number): number {
  return Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta))
}

/**
 * Runs one animation frame: advances the clock by a frame, then invokes the
 * callbacks that were queued before the tick. Callbacks scheduled *during* the
 * tick are left for the next step, which is how a real rAF loop behaves.
 */
function step(frames = 1): void {
  for (let i = 0; i < frames; i += 1) {
    if (frameQueue.size === 0) return
    const batch = [...frameQueue.values()]
    frameQueue.clear()
    clock += FRAME_MS
    for (const cb of batch) cb(clock)
  }
}

/**
 * Runs frames of an arbitrary length, for the frame-rate tests. Sub-stepping
 * means one rAF frame performs several integration steps, so the trajectory is
 * a function of the elapsed milliseconds handed to the callback and nothing
 * else — which is exactly what these tests pin down.
 */
function stepAt(frameMs: number, frames = 1): void {
  for (let i = 0; i < frames; i += 1) {
    if (frameQueue.size === 0) return
    const batch = [...frameQueue.values()]
    frameQueue.clear()
    clock += frameMs
    for (const cb of batch) cb(clock)
  }
}

/** Resets the hand-driven clock and queue, so springs can be run in isolation. */
function resetClock(): void {
  frameQueue = new Map()
  nextFrameId = 1
  clock = 0
  rafCalls = 0
}

/**
 * Samples one spring at a fixed frame rate, recording the value at each
 * wall-clock time in `atMs`. Each rate runs on its own clock so the comparison
 * is "same instant in time", not "same frame number".
 */
function trajectoryAt(fps: number, atMs: number[], options: SpringOptions, target: number): number[] {
  resetClock()
  const spring = makeSpring(options)
  spring.to(target)

  const frameMs = 1000 / fps
  const samples: number[] = []
  const limit = Math.max(...atMs)
  let pending = [...atMs]

  while (pending.length > 0 && clock < limit + frameMs) {
    stepAt(frameMs)
    while (pending.length > 0 && clock >= pending[0] - 1e-9) {
      samples.push(spring.value.value)
      pending = pending.slice(1)
    }
    if (frameQueue.size === 0) break
  }

  return samples
}

/** Steps until the spring reports rest, returning the frames it took. */
function stepToRest(spring: SpringController, limit = MAX_FRAMES): number {
  let frames = 0
  while (spring.isAnimating.value && frames < limit) {
    step()
    frames += 1
  }
  return frames
}

/**
 * Samples several springs in lockstep. The frame queue is shared, so one step()
 * ticks every live spring — sampling them one after another would compare frame
 * 1..3 of the first against frame 4..6 of the second and hide real differences.
 */
function sampleTogether(springs: SpringController[], count: number): number[][] {
  const tracks: number[][] = springs.map(() => [])
  for (let i = 0; i < count; i += 1) {
    step()
    springs.forEach((spring, index) => tracks[index].push(spring.value.value))
  }
  return tracks
}

function setReducedMotion(reduce: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  )
}

const scopes: EffectScope[] = []

/** Builds a controller inside an effect scope so onScopeDispose has an owner. */
function makeSpring(options: SpringOptions = {}): SpringController {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useSpring(options)) as SpringController
}

beforeEach(() => {
  frameQueue = new Map()
  nextFrameId = 1
  clock = 0
  rafCalls = 0

  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => {
      const id = nextFrameId
      nextFrameId += 1
      frameQueue.set(id, cb)
      rafCalls += 1
      return id
    })
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => {
      frameQueue.delete(id)
    })
  )
  // Spied rather than replaced wholesale: vitest's own reporting reads
  // performance, so only now() is redirected at our frame clock.
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  setReducedMotion(false)
})

afterEach(() => {
  while (scopes.length > 0) scopes.pop()?.stop()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useSpring · settling', () => {
  it('converges on the target and comes to rest, calling onRest exactly once', () => {
    const onRest = vi.fn()
    const spring = makeSpring({ from: 0, onRest })

    spring.to(100)
    expect(spring.isAnimating.value).toBe(true)

    const frames = stepToRest(spring)

    expect(frames).toBeLessThan(MAX_FRAMES)
    expect(spring.value.value).toBe(100)
    expect(spring.isAnimating.value).toBe(false)
    expect(spring.getVelocity()).toBe(0)
    expect(onRest).toHaveBeenCalledTimes(1)

    // Rest means rest: no further frames are queued after settling.
    const callsAtRest = rafCalls
    step(5)
    expect(rafCalls).toBe(callsAtRest)
    expect(onRest).toHaveBeenCalledTimes(1)
  })

  it('publishes the live value through onUpdate on every frame', () => {
    const seen: number[] = []
    const spring = makeSpring({ from: 0, onUpdate: (v) => seen.push(v) })

    spring.to(50)
    step(4)

    expect(seen).toHaveLength(4)
    expect(seen[seen.length - 1]).toBe(spring.value.value)
    // Monotonic climb out of the gate, no frame emitting a stale value.
    expect([...seen].sort((a, b) => a - b)).toEqual(seen)
  })
})

describe('useSpring · damping', () => {
  it('does not overshoot the target when critically damped (damping 1.0)', () => {
    const spring = makeSpring({ damping: 1, from: 0 })

    spring.to(100)

    let peak = Number.NEGATIVE_INFINITY
    let frames = 0
    while (spring.isAnimating.value && frames < MAX_FRAMES) {
      step()
      peak = Math.max(peak, spring.value.value)
      frames += 1
    }

    expect(frames).toBeLessThan(MAX_FRAMES)
    // Sampled across the whole run, never past the target while travelling up.
    expect(peak).toBeLessThanOrEqual(100)
    expect(spring.value.value).toBe(100)
  })

  it('overshoots at least once when underdamped (damping 0.8)', () => {
    const spring = makeSpring({ damping: 0.8, from: 0 })

    spring.to(100)

    const overshoots: number[] = []
    let frames = 0
    while (spring.isAnimating.value && frames < MAX_FRAMES) {
      step()
      if (spring.value.value > 100) overshoots.push(spring.value.value)
      frames += 1
    }

    expect(frames).toBeLessThan(MAX_FRAMES)
    expect(overshoots.length).toBeGreaterThan(0)
    // Bounce, not blow-up: it still lands exactly on the target.
    expect(spring.value.value).toBe(100)
  })

  it('overshoots by the amount the damping ratio predicts, not a damped-out trace', () => {
    // The whole point of damping 0.8 is a visible bounce. exp(-zeta*pi/sqrt(1-zeta^2))
    // puts it at 1.5165% of the span; a single Euler step per frame produced 0.11%
    // at 60fps and 0.00% at 30fps, i.e. 0.02px on an 800px move — no bounce at all.
    const expected = analyticalOvershoot(0.8) * 100
    expect(expected).toBeCloseTo(1.5165, 3)

    const spring = makeSpring({ damping: 0.8, from: 0 })
    spring.to(100)

    let peak = Number.NEGATIVE_INFINITY
    let frames = 0
    while (spring.isAnimating.value && frames < MAX_FRAMES) {
      step()
      peak = Math.max(peak, spring.value.value)
      frames += 1
    }

    const measured = peak - 100
    expect(measured).toBeGreaterThan(1.35)
    expect(measured).toBeLessThan(1.65)
    // And it is within a tenth of a percent of the true peak.
    expect(measured).toBeCloseTo(expected, 1)
  })

  it('scales the bounce with the span instead of settling before it happens', () => {
    // Rest thresholds grow with the span, so they must stay small enough to let
    // the overshoot through. On an 800px move the true peak is 12.2px.
    const spring = makeSpring({ damping: 0.8, from: 0 })
    spring.to(800)

    let peak = Number.NEGATIVE_INFINITY
    let frames = 0
    while (spring.isAnimating.value && frames < MAX_FRAMES) {
      step()
      peak = Math.max(peak, spring.value.value)
      frames += 1
    }

    expect(peak - 800).toBeCloseTo(analyticalOvershoot(0.8) * 800, 0)
    expect(spring.value.value).toBe(800)
  })
})

describe('useSpring · integration accuracy', () => {
  it('tracks the analytical solution from the first frame, with no opening pop', () => {
    // One Euler step per frame moved 9.49% of the distance on frame 1 against a
    // true 3.87% — a 45px pop at the start of an 800px collapse.
    const spring = makeSpring({ damping: 1, response: 0.34, from: 0 })
    spring.to(800)

    for (let frame = 1; frame <= 6; frame += 1) {
      step()
      const t = (frame * FRAME_MS) / 1000
      const truth = 800 + analyticalDisplacement(-800, 0, 1, 0.34, t)
      // Within a hundredth of a pixel of the closed-form solution.
      expect(Math.abs(spring.value.value - truth)).toBeLessThan(0.01)
    }
  })

  it('stays finite for a stiff spring instead of diverging to NaN', () => {
    // response <= 0.25 used to blow up: the dt clamp pinned the timestep at
    // exactly the value that makes a single Euler step unstable, so the value
    // became NaN, the rAF loop never terminated and onRest never fired.
    for (const response of [0.05, 0.1, 0.15, 0.2, 0.25]) {
      resetClock()
      const onRest = vi.fn()
      const spring = makeSpring({ damping: 1, response, from: 0, onRest })
      spring.to(100)

      let frames = 0
      while (spring.isAnimating.value && frames < MAX_FRAMES) {
        step()
        expect(Number.isFinite(spring.value.value), `response ${response}`).toBe(true)
        expect(Math.abs(spring.value.value), `response ${response}`).toBeLessThanOrEqual(200)
        frames += 1
      }

      expect(frames, `response ${response}`).toBeLessThan(MAX_FRAMES)
      expect(spring.value.value, `response ${response}`).toBe(100)
      expect(onRest, `response ${response}`).toHaveBeenCalledTimes(1)
    }
  })

  it('survives a long stalled frame without exploding', () => {
    // A backgrounded tab hands back a huge dt. The frame's work is capped, but
    // the sub-step size is not allowed to grow, so stability is unaffected.
    const spring = makeSpring({ damping: 1, response: 0.15, from: 0 })
    spring.to(100)

    stepAt(2000)
    expect(Number.isFinite(spring.value.value)).toBe(true)
    expect(spring.value.value).toBeGreaterThanOrEqual(0)
    expect(spring.value.value).toBeLessThanOrEqual(101)

    let frames = 0
    while (spring.isAnimating.value && frames < MAX_FRAMES) {
      step()
      frames += 1
    }
    expect(spring.value.value).toBe(100)
  })
})

describe('useSpring · frame-rate independence', () => {
  const AT_MS = [100, 200, 300, 400]

  it('puts the same value on screen at the same instant at 30, 60 and 120fps', () => {
    const options: SpringOptions = { damping: 1, response: 0.34, from: 0 }

    const at30 = trajectoryAt(30, AT_MS, options, 800)
    const at60 = trajectoryAt(60, AT_MS, options, 800)
    const at120 = trajectoryAt(120, AT_MS, options, 800)

    expect(at30).toHaveLength(AT_MS.length)
    expect(at60).toHaveLength(AT_MS.length)
    expect(at120).toHaveLength(AT_MS.length)

    AT_MS.forEach((ms, index) => {
      // Not merely "similar": the same fixed sub-steps run in every case, so the
      // trajectories agree to floating-point noise. A single Euler step per frame
      // spread these by up to 169px.
      expect(at60[index], `${ms}ms 30 vs 60`).toBeCloseTo(at30[index], 6)
      expect(at120[index], `${ms}ms 60 vs 120`).toBeCloseTo(at60[index], 6)

      // And all three sit on the analytical curve.
      const truth = 800 + analyticalDisplacement(-800, 0, 1, 0.34, ms / 1000)
      expect(at60[index], `${ms}ms vs analytical`).toBeCloseTo(truth, 1)
    })
  })

  it('is frame-rate independent for a bouncy spring too, overshoot included', () => {
    const options: SpringOptions = { damping: 0.8, response: 0.4, from: 0 }
    const at30 = trajectoryAt(30, AT_MS, options, 800)
    const at120 = trajectoryAt(120, AT_MS, options, 800)

    AT_MS.forEach((ms, index) => {
      expect(at120[index], `${ms}ms`).toBeCloseTo(at30[index], 6)
    })
  })
})

describe('useSpring · rest thresholds', () => {
  /** Frames until rest, on a clock of its own. */
  function framesToRest(options: SpringOptions, target: number): number {
    resetClock()
    const spring = makeSpring(options)
    spring.to(target)
    return stepToRest(spring)
  }

  it('does not drag an invisible tail behind a large-span animation', () => {
    resetClock()
    const spring = makeSpring({ damping: 1, response: 0.34, from: 0 })
    spring.to(800)

    const trace: number[] = []
    let frames = 0
    while (spring.isAnimating.value && frames < MAX_FRAMES) {
      step()
      trace.push(spring.value.value)
      frames += 1
    }

    // First frame from which the motion is no longer visible: within half a pixel
    // of the target, and never leaving again.
    const visuallyDone =
      trace.findIndex((_, index) =>
        trace.slice(index).every((value) => Math.abs(value - 800) <= 0.5)
      ) + 1

    expect(visuallyDone).toBeGreaterThan(0)
    // The bug was the gap between those two. With absolute thresholds an 800px
    // collapse was visually finished at frame 32 but ran to 64, so will-change
    // and overflow:hidden stayed applied and onRest was withheld for another
    // 533ms. Measured tail is now 3 frames (50ms) instead of 32 (533ms).
    expect(frames - visuallyDone).toBeLessThanOrEqual(5)
    // 35 frames / 583ms, against 64 frames / 1067ms before.
    expect(frames).toBeLessThan(40)
    // The snap that ends it is sub-pixel, so nothing jumps at the end.
    expect(800 - trace[trace.length - 2]).toBeLessThan(1)
  })

  it('keeps settle time proportional rather than growing with the span', () => {
    const options: SpringOptions = { damping: 1, response: 0.34, from: 0 }
    const smallSpan = framesToRest(options, 1)
    const largeSpan = framesToRest(options, 800)

    // An 800x larger move must not cost 800x more decay. Thresholds scale with
    // the span, so the extra frames come only from the tighter *relative*
    // tolerance a large span gets, not from chasing an absolute 0.01px.
    expect(largeSpan - smallSpan).toBeLessThanOrEqual(12)
  })

  it('still delivers the whole distance before resting, at every scale', () => {
    // The flip side of a scaled threshold is snapping early. Check what fraction
    // of the span is actually travelled before the spring calls it done.
    for (const span of [0.05, 1, 100, 800]) {
      resetClock()
      const spring = makeSpring({ damping: 1, response: 0.34, from: 0 })
      spring.to(span)

      let lastBeforeRest = 0
      let frames = 0
      while (spring.isAnimating.value && frames < MAX_FRAMES) {
        step()
        if (spring.isAnimating.value) lastBeforeRest = spring.value.value
        frames += 1
      }

      expect(lastBeforeRest / span, `span ${span}`).toBeGreaterThan(0.9)
      expect(spring.value.value, `span ${span}`).toBe(span)
    }
  })

  it('settles a zero-span re-target rather than dividing by zero', () => {
    const onRest = vi.fn()
    const spring = makeSpring({ from: 42, onRest })

    spring.to(42)
    stepToRest(spring)

    expect(Number.isFinite(spring.value.value)).toBe(true)
    expect(spring.value.value).toBe(42)
    expect(spring.isAnimating.value).toBe(false)
    expect(onRest).toHaveBeenCalledTimes(1)
  })
})

describe('useSpring · interruption', () => {
  it('re-targets from the current presentation value, not from the old target', () => {
    const spring = makeSpring({ from: 0 })

    spring.to(100)
    step(5)

    const visible = spring.value.value
    expect(visible).toBeGreaterThan(0)
    expect(visible).toBeLessThan(100)

    spring.to(0)

    // Re-targeting itself must not move the value.
    expect(spring.value.value).toBe(visible)

    step()
    // The next frame continues from where it visibly was. Inherited momentum can
    // still carry it a little further before the spring reverses, so the test is
    // "no jump" — not "instantly heading back".
    expect(Math.abs(spring.value.value - visible)).toBeLessThan(10)
    expect(spring.value.value).toBeGreaterThan(0)

    stepToRest(spring)
    expect(spring.value.value).toBe(0)
  })

  it('keeps a single frame loop across a re-target instead of restarting one', () => {
    const spring = makeSpring({ from: 0 })

    spring.to(100)
    step(3)
    const callsBefore = rafCalls

    spring.to(40)

    // No extra frame is scheduled by the re-target itself; the running loop
    // simply reads the new target on its next tick.
    expect(rafCalls).toBe(callsBefore)
    expect(spring.isAnimating.value).toBe(true)

    stepToRest(spring)
    expect(spring.value.value).toBe(40)
  })

  it('carries a handoff velocity into the early trajectory', () => {
    const coasting = makeSpring({ from: 0 })
    const flicked = makeSpring({ from: 0 })

    coasting.to(100)
    flicked.to(100, 400)

    // Sampled in lockstep: both springs share the frame queue, so they must be
    // read at the same frame numbers or the comparison measures elapsed time
    // instead of the handoff.
    const [coastingEarly, flickedEarly] = sampleTogether([coasting, flicked], 3)

    // Same target, same spring: the only difference is the released velocity,
    // and it has to be visible immediately rather than averaged away.
    expect(flickedEarly[0]).toBeGreaterThan(coastingEarly[0])
    flickedEarly.forEach((value, index) => {
      expect(value).toBeGreaterThan(coastingEarly[index])
    })

    // And the difference is a real head start, not floating-point noise.
    expect(flickedEarly[0] - coastingEarly[0]).toBeGreaterThan(1)

    stepToRest(coasting)
    stepToRest(flicked)
    expect(coasting.value.value).toBe(100)
    expect(flicked.value.value).toBe(100)
  })

  it('treats a negative handoff velocity as motion away from the target', () => {
    const coasting = makeSpring({ from: 0 })
    const reversed = makeSpring({ from: 0 })
    const hardReverse = makeSpring({ from: 0 })

    coasting.to(100)
    reversed.to(100, -400)
    hardReverse.to(100, -900)

    const [coastingEarly, reversedEarly, hardEarly] = sampleTogether(
      [coasting, reversed, hardReverse],
      3
    )

    reversedEarly.forEach((value, index) => {
      expect(value).toBeLessThan(coastingEarly[index])
    })

    // A flick pointing away from the target travels *backwards* first: at
    // -400px/s the analytical solution dips to -2.42px before turning around,
    // and the value on the first frame is already negative. "Held further back
    // but still positive" was an artefact of one coarse Euler step per frame
    // letting the spring force win inside the first 16ms.
    expect(reversedEarly[0]).toBeLessThan(0)
    expect(Math.min(...reversedEarly)).toBeLessThan(0)

    // Harder flick, further back, and still the correct ordering.
    expect(hardEarly[0]).toBeLessThan(reversedEarly[0])
    expect(hardEarly[0]).toBeLessThan(0)

    stepToRest(reversed)
    stepToRest(hardReverse)
    expect(reversed.value.value).toBe(100)
    expect(hardReverse.value.value).toBe(100)
  })
})

describe('useSpring · imperative control', () => {
  it('set() jumps immediately, animates nothing, and clears velocity', () => {
    const onRest = vi.fn()
    const spring = makeSpring({ from: 0, onRest })

    spring.to(100)
    step(4)
    expect(spring.getVelocity()).not.toBe(0)

    const callsBefore = rafCalls
    spring.set(12)

    expect(spring.value.value).toBe(12)
    expect(spring.isAnimating.value).toBe(false)
    expect(spring.getVelocity()).toBe(0)
    expect(rafCalls).toBe(callsBefore)

    // Nothing left in flight, and a jump is not a settle.
    step(5)
    expect(spring.value.value).toBe(12)
    expect(onRest).not.toHaveBeenCalled()
  })

  it('stop() halts mid-flight and preserves the value it was showing', () => {
    const onRest = vi.fn()
    const spring = makeSpring({ from: 0, onRest })

    spring.to(100)
    step(4)
    const halted = spring.value.value
    expect(halted).toBeGreaterThan(0)
    expect(halted).toBeLessThan(100)

    spring.stop()

    expect(spring.isAnimating.value).toBe(false)
    expect(spring.value.value).toBe(halted)

    step(10)
    expect(spring.value.value).toBe(halted)
    // Stopping is not arriving, so the rest callback must stay silent.
    expect(onRest).not.toHaveBeenCalled()
  })

  it('stays reusable after stop(): a later to() runs and still lands on target', () => {
    const onRest = vi.fn()
    const spring = makeSpring({ from: 0, onRest })

    spring.to(100)
    step(4)
    spring.stop()
    const halted = spring.value.value

    spring.to(100)

    // A stopped spring is not a dead spring: the loop restarts from where the
    // value was left, not from `from`.
    expect(spring.isAnimating.value).toBe(true)
    expect(spring.value.value).toBe(halted)

    stepToRest(spring)
    expect(spring.value.value).toBe(100)
    expect(onRest).toHaveBeenCalledTimes(1)
  })
})

describe('useSpring · reduced motion', () => {
  it('settles straight to the target and schedules no frames', () => {
    setReducedMotion(true)
    const onRest = vi.fn()
    const onUpdate = vi.fn()
    const spring = makeSpring({ from: 0, onRest, onUpdate })

    spring.to(100)

    expect(spring.value.value).toBe(100)
    expect(spring.isAnimating.value).toBe(false)
    expect(spring.getVelocity()).toBe(0)
    expect(rafCalls).toBe(0)
    expect(frameQueue.size).toBe(0)
    // Reduced motion still reports the final state, it just skips the travel.
    expect(onUpdate).toHaveBeenCalledWith(100)
    expect(onRest).toHaveBeenCalledTimes(1)
  })
})

describe('projectMomentum', () => {
  it('uses exponential decay, not the textbook v^2/(2a) form', () => {
    // (v / 1000) * d / (1 - d) with d = 0.998 → v * 0.499
    expect(projectMomentum(1000)).toBeCloseTo(499, 6)
    expect(projectMomentum(2000)).toBeCloseTo(998, 6)

    // v^2/(2a) would be quadratic in v; this is linear.
    expect(projectMomentum(2000) / projectMomentum(1000)).toBeCloseTo(2, 6)
  })

  it('preserves the direction of the flick', () => {
    expect(projectMomentum(1200)).toBeGreaterThan(0)
    expect(projectMomentum(-1200)).toBeLessThan(0)
    expect(projectMomentum(-1200)).toBeCloseTo(-projectMomentum(1200), 6)
    expect(projectMomentum(0)).toBe(0)
  })

  it('projects further as velocity grows', () => {
    const distances = [200, 600, 1500, 4000].map((v) => projectMomentum(v))
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1])
    }
  })

  it('projects further as the deceleration rate rises', () => {
    // 0.998 is scroll feel, 0.99 is snappier and must travel less far.
    expect(projectMomentum(1000, 0.998)).toBeGreaterThan(projectMomentum(1000, 0.99))
    expect(projectMomentum(1000, 0.99)).toBeGreaterThan(projectMomentum(1000, 0.95))
  })
})

describe('rubberband', () => {
  const DIMENSION = 300

  it('always yields less than the raw overshoot', () => {
    for (const overshoot of [1, 10, 50, 120, 400, 1000]) {
      const resisted = rubberband(overshoot, DIMENSION)
      expect(resisted).toBeGreaterThan(0)
      expect(resisted).toBeLessThan(overshoot)
    }
  })

  it('resists progressively harder the further past the boundary you pull', () => {
    const pulls = [10, 50, 120, 400]
    const followRatios = pulls.map((o) => rubberband(o, DIMENSION) / o)

    // Each additional unit of pull returns less travel than the one before it.
    for (let i = 1; i < followRatios.length; i += 1) {
      expect(followRatios[i]).toBeLessThan(followRatios[i - 1])
    }

    // Absolute travel still increases: resistance, not a hard stop.
    const distances = pulls.map((o) => rubberband(o, DIMENSION))
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1])
    }
  })

  it('preserves the sign of the overshoot', () => {
    expect(rubberband(80, DIMENSION)).toBeGreaterThan(0)
    expect(rubberband(-80, DIMENSION)).toBeLessThan(0)
    expect(rubberband(-80, DIMENSION)).toBeCloseTo(-rubberband(80, DIMENSION), 10)
    expect(rubberband(0, DIMENSION)).toBe(0)
  })

  it('returns 0 for a zero dimension instead of dividing by zero', () => {
    expect(rubberband(50, 0)).toBe(0)
    expect(rubberband(-50, 0)).toBe(0)
    expect(Number.isNaN(rubberband(50, 0))).toBe(false)
  })
})

describe('SPRING_PRESETS', () => {
  it('exposes the move / rotate / sheet / ui presets', () => {
    expect(Object.keys(SPRING_PRESETS).sort()).toEqual(['move', 'rotate', 'sheet', 'ui'])
  })

  it('keeps damping and response in sane ranges', () => {
    for (const [name, preset] of Object.entries(SPRING_PRESETS)) {
      expect(preset.damping, name).toBeGreaterThan(0)
      expect(preset.damping, name).toBeLessThanOrEqual(1)
      expect(preset.response, name).toBeGreaterThan(0)
      expect(preset.response, name).toBeLessThanOrEqual(1)
    }
  })

  it('reserves bounce for gesture-driven motion and keeps the rest critically damped', () => {
    // Overshoot belongs to motion that followed real momentum.
    expect(SPRING_PRESETS.move.damping).toBe(1)
    expect(SPRING_PRESETS.ui.damping).toBe(1)
    expect(SPRING_PRESETS.rotate.damping).toBeLessThan(1)
    expect(SPRING_PRESETS.sheet.damping).toBeLessThan(1)

    // A sheet is the snappier of the two bouncy presets.
    expect(SPRING_PRESETS.sheet.response).toBeLessThan(SPRING_PRESETS.rotate.response)
  })

  it('produces the documented behaviour when fed to useSpring', () => {
    const ui = makeSpring({ ...SPRING_PRESETS.ui, from: 0 })
    ui.to(100)
    let uiPeak = Number.NEGATIVE_INFINITY
    let frames = 0
    while (ui.isAnimating.value && frames < MAX_FRAMES) {
      step()
      uiPeak = Math.max(uiPeak, ui.value.value)
      frames += 1
    }
    expect(uiPeak).toBeLessThanOrEqual(100)

    const sheet = makeSpring({ ...SPRING_PRESETS.sheet, from: 0 })
    sheet.to(100)
    let sheetOvershot = false
    frames = 0
    while (sheet.isAnimating.value && frames < MAX_FRAMES) {
      step()
      if (sheet.value.value > 100) sheetOvershot = true
      frames += 1
    }
    expect(sheetOvershot).toBe(true)
  })
})

/**
 * SpringCollapse is the engine's only consumer, and the place where a leaked rAF
 * loop is actually observable: the transition hooks run outside any effect scope,
 * so nothing disposes a spring unless the component does it itself.
 *
 * jsdom reports scrollHeight as 0, so it is stubbed on the prototype — Vue
 * creates the element itself during the transition, so there is no instance to
 * stub beforehand.
 */
describe('SpringCollapse · lifecycle', () => {
  const CONTENT_HEIGHT = 400
  let scrollHeightSpy: ReturnType<typeof vi.spyOn> | null = null

  /** Renders <SpringCollapse> around a v-if child, driven by `open`. */
  const Host = defineComponent({
    props: { open: { type: Boolean, default: false } },
    setup(props) {
      return () =>
        h(SpringCollapse, null, {
          default: () => (props.open ? [h('div', { class: 'body' }, 'content')] : [])
        })
    }
  })

  /** The element <transition> is animating, if any. */
  function body(): HTMLElement | null {
    return document.querySelector('.body')
  }

  beforeEach(() => {
    scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(CONTENT_HEIGHT)
  })

  afterEach(() => {
    scrollHeightSpy?.mockRestore()
    scrollHeightSpy = null
    document.body.innerHTML = ''
  })

  it('runs no frames against a detached node after unmounting mid-animation', async () => {
    const wrapper = mount(Host, { props: { open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    step(3)

    const el = body()
    expect(el).not.toBeNull()
    expect(parseFloat(el!.style.height)).toBeGreaterThan(0)

    wrapper.unmount()

    // The measured symptom was 58 of the next 60 frames still executing against
    // a node that had left the document.
    const callsAfterUnmount = rafCalls
    step(60)
    expect(rafCalls).toBe(callsAfterUnmount)
    expect(frameQueue.size).toBe(0)
  })

  it('leaves no second loop alive when an animation is interrupted', async () => {
    const wrapper = mount(Host, { props: { open: false }, attachTo: document.body })

    await wrapper.setProps({ open: true })
    step(3)
    await wrapper.setProps({ open: false })
    step(3)
    await wrapper.setProps({ open: true })
    step(3)

    // Two springs writing height on the same element would queue two callbacks
    // per frame; a single live loop queues exactly one.
    expect(frameQueue.size).toBeLessThanOrEqual(1)

    // And it still reaches a resting state rather than fighting itself forever.
    let frames = 0
    while (frameQueue.size > 0 && frames < MAX_FRAMES) {
      step()
      frames += 1
    }
    expect(frames).toBeLessThan(MAX_FRAMES)
    wrapper.unmount()
  })

  it('reverses a collapse from the height on screen instead of jumping to full', async () => {
    const wrapper = mount(Host, { props: { open: true }, attachTo: document.body })
    step(40)
    // Opened and settled: the inline styles are released.
    expect(body()!.style.height).toBe('')

    await wrapper.setProps({ open: false })
    step(6)
    const collapsing = parseFloat(body()!.style.height)
    expect(collapsing).toBeGreaterThan(0)
    expect(collapsing).toBeLessThan(CONTENT_HEIGHT)

    // Re-open mid-collapse. Vue mounts a *new* element here, so this is the case
    // that used to read an empty style.height and restart the open from 0.
    await wrapper.setProps({ open: true })
    const resumed = parseFloat(body()!.style.height)
    expect(resumed).toBeCloseTo(collapsing, 5)

    step(1)
    // Continuous: the first frame after the reversal does not jump.
    expect(Math.abs(parseFloat(body()!.style.height) - collapsing)).toBeLessThan(
      CONTENT_HEIGHT / 4
    )

    step(60)
    expect(body()!.style.height).toBe('')
    wrapper.unmount()
  })

  it('collapses from the height on screen when an open is interrupted', async () => {
    const wrapper = mount(Host, { props: { open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    step(4)

    const opening = parseFloat(body()!.style.height)
    expect(opening).toBeGreaterThan(0)
    expect(opening).toBeLessThan(CONTENT_HEIGHT)

    // Close while opening. onLeave used to assign scrollHeight unconditionally,
    // throwing the element from its in-flight height straight to 400px.
    await wrapper.setProps({ open: false })
    const afterReverse = parseFloat(body()!.style.height)
    expect(afterReverse).toBeCloseTo(opening, 5)
    expect(afterReverse).toBeLessThan(CONTENT_HEIGHT)

    step(60)
    wrapper.unmount()
  })

  it('clears height, overflow and will-change once it settles', async () => {
    const wrapper = mount(Host, { props: { open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    step(2)

    const el = body()!
    expect(el.style.overflow).toBe('hidden')
    expect(el.style.willChange).toBe('height')

    step(60)
    expect(el.style.height).toBe('')
    expect(el.style.overflow).toBe('')
    expect(el.style.willChange).toBe('')
    wrapper.unmount()
  })

  it('leaves the DOM sane when a transition is cancelled', async () => {
    const wrapper = mount(Host, { props: { open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    step(3)

    const el = body()!
    // Cancelling an enter must not orphan inline styles on the node it leaves
    // behind; the value it was showing lives in the component, not the DOM.
    await wrapper.setProps({ open: false })
    step(60)

    expect(el.style.overflow).toBe('')
    expect(el.style.willChange).toBe('')
    expect(frameQueue.size).toBe(0)
    wrapper.unmount()
  })

  it('does not warn about onScopeDispose outside an effect scope', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mount(Host, { props: { open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    step(3)
    await wrapper.setProps({ open: false })
    step(60)
    wrapper.unmount()

    const scopeWarnings = warn.mock.calls
      .map((args) => args.join(' '))
      .filter((message) => message.includes('onScopeDispose'))
    expect(scopeWarnings).toEqual([])

    warn.mockRestore()
  })

  it('keeps two collapses independent instead of stopping each other', async () => {
    // AppSidebar mounts one SpringCollapse per nav group. The spring registry
    // and the carried in-flight height live in <script setup>, which Vue
    // compiles per instance — if they were shared module state, opening one
    // group would release the other group's spring and freeze it mid-height.
    const Pair = defineComponent({
      props: { openA: { type: Boolean, default: false }, openB: { type: Boolean, default: false } },
      setup(props) {
        return () =>
          h('div', null, [
            h(SpringCollapse, null, {
              default: () => (props.openA ? [h('div', { class: 'a' }, 'A')] : [])
            }),
            h(SpringCollapse, null, {
              default: () => (props.openB ? [h('div', { class: 'b' }, 'B')] : [])
            })
          ])
      }
    })

    const wrapper = mount(Pair, { props: { openA: false, openB: false }, attachTo: document.body })

    await wrapper.setProps({ openA: true })
    step(3)
    const aBeforeB = parseFloat(document.querySelector<HTMLElement>('.a')!.style.height)
    expect(aBeforeB).toBeGreaterThan(0)

    // Second instance starts while the first is still in flight.
    await wrapper.setProps({ openB: true })
    step(3)

    const aAfterB = parseFloat(document.querySelector<HTMLElement>('.a')!.style.height)
    const bAfterB = parseFloat(document.querySelector<HTMLElement>('.b')!.style.height)

    // Both are still animating: A kept climbing, B started from 0.
    expect(aAfterB).toBeGreaterThan(aBeforeB)
    expect(bAfterB).toBeGreaterThan(0)

    step(60)
    expect(document.querySelector<HTMLElement>('.a')!.style.height).toBe('')
    expect(document.querySelector<HTMLElement>('.b')!.style.height).toBe('')
    wrapper.unmount()
  })

  it('still delivers the final height under reduced motion', async () => {
    setReducedMotion(true)
    const wrapper = mount(Host, { props: { open: false }, attachTo: document.body })

    await wrapper.setProps({ open: true })
    await nextTick()

    // Reduced motion settles immediately, so the inline styles are already gone
    // and the element is at its natural height rather than stuck at 0.
    const el = body()
    expect(el).not.toBeNull()
    expect(el!.style.height).toBe('')
    expect(rafCalls).toBe(0)

    await wrapper.setProps({ open: false })
    await nextTick()
    expect(body()).toBeNull()
    expect(rafCalls).toBe(0)
    wrapper.unmount()
  })
})
