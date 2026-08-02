<template>
  <!--
    Spring-driven height collapse.

    Vue's <transition> JS hooks let a real spring drive the height instead of a
    fixed-duration CSS transition. That matters because a spring animates from
    the current presentation value, so toggling mid-flight reverses smoothly
    rather than jumping to the target and restarting.
  -->
  <transition
    :css="false"
    @enter="onEnter"
    @leave="onLeave"
    @enter-cancelled="onCancelled"
    @leave-cancelled="onCancelled"
  >
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { effectScope, onBeforeUnmount, type EffectScope } from 'vue'

import { useSpring, SPRING_PRESETS, type SpringController } from '@/composables/useSpring'

interface RunningSpring {
  spring: SpringController
  scope: EffectScope
}

/**
 * The spring currently writing to each element.
 *
 * Previously a spring was constructed per enter/leave and immediately
 * forgotten, so interrupting an animation left its rAF loop running forever:
 * two springs then wrote `height` to the same node every frame, and whichever
 * reached rest first cleared `overflow: hidden` in the middle of the other's
 * animation. Holding the controller is what makes an interruption stoppable.
 */
const running = new WeakMap<HTMLElement, RunningSpring>()

/**
 * The element with a live loop. Needed in addition to the map because an
 * interruption can hand over to a *different* element (see inFlightHeight), and
 * the old one has to be stopped without having a key to look it up by.
 */
let activeElement: HTMLElement | null = null

/**
 * Height the interrupted animation was showing.
 *
 * This cannot live in a WeakMap keyed by element, because the element identity
 * does not survive the interruption it needs to bridge: when a leave is
 * interrupted by an enter, Vue finishes the leave on the old node and mounts a
 * *brand new* element for the enter, so a per-element record is already gone by
 * the time the enter needs it — which is why the collapse used to read an empty
 * `style.height` and jump to 0. Component scope outlives both elements.
 */
let inFlightHeight: number | null = null

/** Stops the spring on `el` and releases everything it owns. Idempotent. */
function release(el: HTMLElement): void {
  const entry = running.get(el)
  if (entry === undefined) return
  running.delete(el)
  if (activeElement === el) activeElement = null
  entry.spring.stop()
  entry.scope.stop()
}

/**
 * Animates el's height to target on a spring, then clears the inline styles.
 *
 * `from` is passed in rather than read off the element: only the caller knows
 * whether the truthful starting height is an interrupted animation's value, an
 * inline height, or a fresh measurement.
 */
function animateHeight(el: HTMLElement, from: number, target: number, done: () => void): void {
  // Whatever was animating has been superseded, on this element or another one.
  if (activeElement !== null) release(activeElement)
  release(el)

  el.style.overflow = 'hidden'
  el.style.willChange = 'height'
  el.style.height = `${Math.max(0, from)}px`
  inFlightHeight = from

  // Owned effect scope: useSpring registers cleanup via onScopeDispose, and a
  // transition hook is not inside one. Disposing this scope is what guarantees
  // the loop cannot outlive the animation even on an unmount mid-flight.
  const scope = effectScope()
  const spring = scope.run(() =>
    useSpring({
      ...SPRING_PRESETS.ui,
      from,
      onUpdate: (value) => {
        inFlightHeight = value
        el.style.height = `${Math.max(0, value)}px`
      },
      onRest: () => {
        // Reached the target, so there is no interrupted height to carry.
        inFlightHeight = null
        el.style.overflow = ''
        el.style.height = ''
        el.style.willChange = ''
        release(el)
        done()
      }
    })
  ) as SpringController

  // Registered before to(), because reduced motion settles synchronously inside
  // it and onRest must be able to find this entry to release it.
  running.set(el, { spring, scope })
  activeElement = el

  spring.to(target)
}

/** Inline height in px, or null when the element has none. */
function inlineHeight(el: HTMLElement): number | null {
  const parsed = parseFloat(el.style.height)
  return Number.isNaN(parsed) ? null : parsed
}

function onEnter(element: Element, done: () => void): void {
  const el = element as HTMLElement
  const inline = inlineHeight(el)
  // Measure the natural height with no inline constraint: a partially collapsed
  // height would otherwise clip scrollHeight and become the target.
  el.style.height = ''
  const target = el.scrollHeight
  // Resume from the interrupted height first. It is the only source that
  // survives Vue swapping the element, and preferring it is what keeps a
  // reversal continuous instead of restarting from 0.
  const start = inFlightHeight ?? inline ?? 0
  animateHeight(el, start, target, done)
}

function onLeave(element: Element, done: () => void): void {
  const el = element as HTMLElement
  // Same precedence, but a leave that was not interrupted starts from the
  // element's own height. Unconditionally assigning scrollHeight here is what
  // used to throw an in-flight collapse back to its full height.
  const start = inFlightHeight ?? inlineHeight(el) ?? el.scrollHeight
  animateHeight(el, start, 0, done)
}

function onCancelled(element: Element): void {
  const el = element as HTMLElement
  // The value the spring was showing stays in inFlightHeight, so the opposite
  // direction resumes from it. The inline styles are dropped so a cancel that
  // is not followed by another animation leaves nothing orphaned; when one does
  // follow, it runs in the same task and repaints before the browser draws.
  release(el)
  el.style.overflow = ''
  el.style.height = ''
  el.style.willChange = ''
}

onBeforeUnmount(() => {
  // Without this the loop kept running against a detached node.
  if (activeElement !== null) release(activeElement)
  inFlightHeight = null
})
</script>
