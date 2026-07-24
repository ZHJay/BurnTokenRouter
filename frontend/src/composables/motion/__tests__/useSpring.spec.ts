import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { useSpring } from '../useSpring'

/**
 * Drive requestAnimationFrame manually so we can advance the spring
 * deterministically without real time passing. `performance.now` is advanced
 * in lockstep so the spring integrates a known dt each frame.
 */
function installFakeRaf(frameMs = 16) {
  let queue: FrameRequestCallback[] = []
  let clock = 0

  const raf = vi.fn((cb: FrameRequestCallback) => {
    queue.push(cb)
    return queue.length
  })
  const caf = vi.fn((id: number) => {
    // Best-effort: null out the callback at that slot.
    if (id >= 1 && id <= queue.length) queue[id - 1] = (() => {}) as FrameRequestCallback
  })

  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock)

  function flush(frames: number) {
    for (let i = 0; i < frames; i++) {
      clock += frameMs
      const pending = queue
      queue = []
      for (const cb of pending) cb(clock)
    }
  }

  return {
    flush,
    restore() {
      nowSpy.mockRestore()
      vi.unstubAllGlobals()
    }
  }
}

describe('useSpring', () => {
  let fake: ReturnType<typeof installFakeRaf>

  beforeEach(() => {
    fake = installFakeRaf()
    // Ensure reduced-motion is OFF so the spring actually animates.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })) as unknown as typeof window.matchMedia
  })

  afterEach(() => {
    fake.restore()
  })

  it('exposes a reactive value initialized to the seed', () => {
    const scope = effectScope()
    scope.run(() => {
      const { value, velocity } = useSpring(10)
      expect(value.value).toBe(10)
      expect(velocity.value).toBe(0)
    })
    scope.stop()
  })

  it('set()/stop() do not throw and value stays reactive', async () => {
    const scope = effectScope()
    scope.run(() => {
      const spring = useSpring(0)
      expect(() => spring.set(100)).not.toThrow()
      expect(() => spring.stop()).not.toThrow()
    })
    await nextTick()
    scope.stop()
  })

  it('settles at the target after enough frames (critically damped, no overshoot)', () => {
    const scope = effectScope()
    scope.run(() => {
      const { value, set } = useSpring(0, { damping: 1, response: 0.35 })
      set(100)
      // Advance well past the response time (0.35s -> ~22 frames at 16ms).
      fake.flush(120)
      expect(value.value).toBeCloseTo(100, 1)
    })
    scope.stop()
  })

  it('never overshoots when critically damped', () => {
    const scope = effectScope()
    scope.run(() => {
      const { value, set } = useSpring(0, { damping: 1, response: 0.3 })
      set(100)
      let maxSeen = -Infinity
      for (let i = 0; i < 120; i++) {
        fake.flush(1)
        maxSeen = Math.max(maxSeen, value.value)
      }
      // Allow a tiny numeric epsilon above the target.
      expect(maxSeen).toBeLessThanOrEqual(100 + 0.5)
    })
    scope.stop()
  })

  it('is interruptible: retargeting mid-flight does not jump the value', () => {
    const scope = effectScope()
    scope.run(() => {
      const { value, set } = useSpring(0, { damping: 1, response: 0.4 })
      set(100)
      fake.flush(5)
      const mid = value.value
      expect(mid).toBeGreaterThan(0)
      expect(mid).toBeLessThan(100)
      // Retarget — the value must remain continuous (no snap to new target).
      set(0)
      const afterRetarget = value.value
      expect(afterRetarget).toBeCloseTo(mid, 5)
      fake.flush(120)
      expect(value.value).toBeCloseTo(0, 1)
    })
    scope.stop()
  })

  it('stop() halts the animation in place', () => {
    const scope = effectScope()
    scope.run(() => {
      const { value, set, stop } = useSpring(0, { response: 0.5 })
      set(100)
      fake.flush(4)
      const frozen = value.value
      stop()
      fake.flush(60)
      expect(value.value).toBe(frozen)
    })
    scope.stop()
  })

  it('respects prefers-reduced-motion by jumping to the target', () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })) as unknown as typeof window.matchMedia

    const scope = effectScope()
    scope.run(() => {
      const { value, set } = useSpring(0)
      set(250)
      expect(value.value).toBe(250)
    })
    scope.stop()
  })
})
