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
import { effectScope, type EffectScope } from 'vue'

import {
  SPRING_PRESETS,
  projectMomentum,
  rubberband,
  useSpring,
  type SpringController,
  type SpringOptions
} from '../useSpring'

const FRAME_MS = 1000 / 60
/** Bound on hand-driven frames. A 0.4s response settles in ~60 frames. */
const MAX_FRAMES = 400

let frameQueue: Map<number, FrameRequestCallback>
let nextFrameId: number
let clock: number
let rafCalls: number

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

    // A flick pointing away from the target holds the value back. At -400 the
    // spring force already wins inside one 16ms frame, so the observable
    // contract is "further behind", not "negative".
    reversedEarly.forEach((value, index) => {
      expect(value).toBeLessThan(coastingEarly[index])
    })

    // Push the release velocity hard enough and it does visibly travel backwards
    // past the start before the spring reels it in.
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
