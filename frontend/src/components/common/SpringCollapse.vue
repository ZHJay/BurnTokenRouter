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
import { useSpring, SPRING_PRESETS } from '@/composables/useSpring'

/** Animates el's height to target on a spring, then clears the inline styles. */
function animateHeight(el: HTMLElement, target: number, done: () => void): void {
  el.style.overflow = 'hidden'
  el.style.willChange = 'height'

  const spring = useSpring({
    ...SPRING_PRESETS.ui,
    from: parseFloat(el.style.height) || 0,
    onUpdate: (value) => {
      el.style.height = `${Math.max(0, value)}px`
    },
    onRest: () => {
      el.style.overflow = ''
      el.style.height = ''
      el.style.willChange = ''
      done()
    }
  })

  spring.to(target)
}

function onEnter(element: Element, done: () => void): void {
  const el = element as HTMLElement
  // Start from the height already on screen: 0 on a fresh open, or the
  // partially collapsed height when interrupting a close.
  const start = parseFloat(el.style.height) || 0
  const target = el.scrollHeight
  el.style.height = `${start}px`
  animateHeight(el, target, done)
}

function onLeave(element: Element, done: () => void): void {
  const el = element as HTMLElement
  el.style.height = `${el.scrollHeight}px`
  animateHeight(el, 0, done)
}

function onCancelled(element: Element): void {
  // Keep the inline height so the opposite direction resumes from the current
  // value instead of snapping.
  const el = element as HTMLElement
  el.style.willChange = ''
}
</script>
