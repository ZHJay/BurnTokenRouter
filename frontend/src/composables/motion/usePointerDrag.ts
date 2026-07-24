import { onScopeDispose, watch, type Ref } from 'vue'

/**
 * 1:1 pointer drag with Pointer Events, grab-offset preservation, and a short
 * velocity history so releases can feed momentum projection.
 *
 * Design notes (Apple "Designing Fluid Interfaces"):
 *  - Movement tracks the finger 1:1 (dx/dy are raw deltas from grab point).
 *  - A small hysteresis threshold prevents accidental drags on taps/clicks.
 *  - Release velocity is computed from the last few samples, not a single
 *    frame, so a flick reads as a flick even if the final frame stalled.
 */
export interface PointerDragMoveEvent {
  /** Total delta from the drag origin along X (px). */
  dx: number
  /** Total delta from the drag origin along Y (px). */
  dy: number
  /** Current pointer X in client coordinates. */
  x: number
  /** Current pointer Y in client coordinates. */
  y: number
}

export interface PointerDragEndEvent {
  /** Release velocity along X in px/second. */
  vx: number
  /** Release velocity along Y in px/second. */
  vy: number
}

export interface PointerDragHandlers {
  onStart?: (ev: { x: number; y: number }) => void
  onMove?: (ev: PointerDragMoveEvent) => void
  onEnd?: (ev: PointerDragEndEvent) => void
}

export interface PointerDragOptions {
  /** Pixels of movement required before a drag commits. Default 5. */
  threshold?: number
  /** Max number of recent samples kept for velocity estimation. Default 5. */
  maxSamples?: number
}

export interface UsePointerDragReturn {
  /** True once the threshold has been crossed and the drag is active. */
  isDragging: () => boolean
  /** Force-teardown listeners (also runs automatically on scope dispose). */
  destroy: () => void
}

interface Sample {
  x: number
  y: number
  t: number
}

const DEFAULT_THRESHOLD = 5
const DEFAULT_MAX_SAMPLES = 5

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

export function usePointerDrag(
  target: Ref<HTMLElement | null>,
  handlers: PointerDragHandlers = {},
  opts: PointerDragOptions = {}
): UsePointerDragReturn {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD
  const maxSamples = Math.max(2, opts.maxSamples ?? DEFAULT_MAX_SAMPLES)

  const isBrowser = typeof window !== 'undefined'

  let el: HTMLElement | null = null
  let activePointerId: number | null = null
  let committed = false

  // Grab origin (where the pointer went down) in client coords.
  let originX = 0
  let originY = 0

  let samples: Sample[] = []

  function pushSample(x: number, y: number): void {
    samples.push({ x, y, t: now() })
    if (samples.length > maxSamples) samples.shift()
  }

  /**
   * Estimate release velocity (px/s) from the oldest-to-newest sample span.
   * Averaging over a small window smooths out a single stalled final frame.
   */
  function releaseVelocity(): { vx: number; vy: number } {
    if (samples.length < 2) return { vx: 0, vy: 0 }
    const first = samples[0]
    const last = samples[samples.length - 1]
    const dt = (last.t - first.t) / 1000
    if (dt <= 0) return { vx: 0, vy: 0 }
    return {
      vx: (last.x - first.x) / dt,
      vy: (last.y - first.y) / dt
    }
  }

  function onPointerDown(ev: PointerEvent): void {
    // Only track the primary button / first pointer.
    if (activePointerId !== null) return
    activePointerId = ev.pointerId
    committed = false
    originX = ev.clientX
    originY = ev.clientY
    samples = []
    pushSample(ev.clientX, ev.clientY)

    // Capture so we keep receiving moves even if the pointer leaves the element.
    if (el && typeof el.setPointerCapture === 'function') {
      try {
        el.setPointerCapture(ev.pointerId)
      } catch {
        // ignore — capture is best-effort
      }
    }
  }

  function onPointerMove(ev: PointerEvent): void {
    if (ev.pointerId !== activePointerId) return

    const dx = ev.clientX - originX
    const dy = ev.clientY - originY

    if (!committed) {
      if (Math.hypot(dx, dy) < threshold) return
      // Threshold crossed: commit and fire onStart from the grab origin.
      committed = true
      handlers.onStart?.({ x: originX, y: originY })
    }

    pushSample(ev.clientX, ev.clientY)
    handlers.onMove?.({ dx, dy, x: ev.clientX, y: ev.clientY })
  }

  function finish(ev: PointerEvent): void {
    if (ev.pointerId !== activePointerId) return

    if (el && typeof el.releasePointerCapture === 'function') {
      try {
        el.releasePointerCapture(ev.pointerId)
      } catch {
        // ignore
      }
    }

    if (committed) {
      pushSample(ev.clientX, ev.clientY)
      const { vx, vy } = releaseVelocity()
      handlers.onEnd?.({ vx, vy })
    }

    activePointerId = null
    committed = false
    samples = []
  }

  function attach(node: HTMLElement): void {
    node.addEventListener('pointerdown', onPointerDown)
    node.addEventListener('pointermove', onPointerMove)
    node.addEventListener('pointerup', finish)
    node.addEventListener('pointercancel', finish)
  }

  function detach(node: HTMLElement): void {
    node.removeEventListener('pointerdown', onPointerDown)
    node.removeEventListener('pointermove', onPointerMove)
    node.removeEventListener('pointerup', finish)
    node.removeEventListener('pointercancel', finish)
  }

  const stopWatch = isBrowser
    ? watch(
        target,
        (next, prev) => {
          if (prev) detach(prev)
          el = next ?? null
          if (el) attach(el)
        },
        { immediate: true }
      )
    : null

  function destroy(): void {
    if (el) detach(el)
    el = null
    activePointerId = null
    committed = false
    samples = []
    stopWatch?.()
  }

  onScopeDispose(destroy)

  return {
    isDragging: () => committed,
    destroy
  }
}
