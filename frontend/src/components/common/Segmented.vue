<template>
  <div
    ref="containerRef"
    class="tabs segmented"
    :role="mode"
    :aria-label="ariaLabel"
    :aria-labelledby="ariaLabelledby"
  >
    <!--
      The thumb is a real element, not a background swap on the selected item.
      That is the whole point: a background can only cut, an element can travel.
      aria-hidden because it carries no information the roles do not already
      carry, and v-show rather than v-if so it keeps its identity (and its
      spring's presentation value) across selections.
    -->
    <span
      v-show="hasSelection"
      ref="thumbRef"
      class="segmented-thumb"
      aria-hidden="true"
    />
    <button
      v-for="(option, index) in options"
      :id="option.id"
      :key="String(option.value)"
      type="button"
      data-segment
      class="tab segmented-item focus-visible:outline-none focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)] active:scale-[0.96]"
      :class="itemClass"
      :role="mode === 'tablist' ? 'tab' : 'radio'"
      :aria-checked="mode === 'radiogroup' ? index === selectedIndex : undefined"
      :aria-selected="mode === 'tablist' ? index === selectedIndex : undefined"
      :aria-controls="mode === 'tablist' && index === selectedIndex ? option.panelId : undefined"
      :aria-disabled="option.disabled === true ? 'true' : undefined"
      :aria-label="option.ariaLabel"
      :tabindex="tabIndexFor(index)"
      @pointerdown="onPointerdown(index, $event)"
      @click="onClick(index, $event)"
      @keydown="onKeydown(index, $event)"
    >
      <slot
        name="option"
        :option="option"
        :index="index"
        :selected="index === selectedIndex"
      >{{ option.label }}</slot>
    </button>
  </div>
</template>

<script lang="ts">
/**
 * One segment of a Segmented control.
 *
 * `panelId` and `id` exist for `tablist` mode only: `panelId` becomes the tab's
 * `aria-controls`, and `id` is what the panel points back at with
 * `aria-labelledby`. Both are ignored in `radiogroup` mode.
 */
export interface SegmentedOption<T extends string | number = string | number> {
  /** The value emitted through `update:modelValue` when this segment wins. */
  value: T
  /** Visible text. Override the rendering entirely with the `option` slot. */
  label: string
  /** Skipped by arrow keys, refuses activation, exposes `aria-disabled`. */
  disabled?: boolean
  /** Element id. Useful as a tabpanel's `aria-labelledby` target. */
  id?: string
  /** tablist mode: id of the panel this tab controls. */
  panelId?: string
  /** Accessible name, when the visible label is not one (e.g. an icon). */
  ariaLabel?: string
}

/** Layout read for one segment, in px, relative to the container's padding box. */
export interface SegmentedMeasurement {
  left: number
  width: number
}

/** Injectable layout reader. See the `measure` prop. */
export type SegmentedMeasure = (el: HTMLElement) => SegmentedMeasurement
</script>

<script setup lang="ts" generic="T extends string | number">
/**
 * Apple-style segmented control: the selected segment is marked by a thumb that
 * rides a spring to its new home instead of a background colour that cuts.
 *
 * Replaces the `.tabs` / `.tab` / `.tab-active` triple, where `.tab-active`
 * only ever swapped `background-color`. It deliberately keeps the `.tabs` and
 * `.tab` classes so a migrated call site does not visibly shift, and drops
 * `.tab-active` — the thumb now paints that surface, and both painting it would
 * double the fill.
 *
 * TWO SEMANTIC MODES, and their keyboard contracts genuinely differ, so `mode`
 * is required rather than defaulted. Picking a value (a time window, a metric)
 * is a `radiogroup`; swapping panels is a `tablist`.
 *
 *   mode         container    item   selected attr  arrows          Home/End
 *   radiogroup   radiogroup   radio  aria-checked   all four, wrap  no
 *   tablist      tablist      tab    aria-selected  Left/Right      yes
 *
 * The other mode's attribute is absent, not false: a `radio` carrying
 * `aria-selected` is a contradiction, and screen readers do read both.
 *
 * ACTIVATION. `select()` is the single source of truth and three separate
 * constraints have to hold at once:
 *   - `click` alone must select: 272 `trigger('click')` calls in the suite, and
 *     every real mouse and every assistive-tech activation lands there.
 *   - `pointerdown` must select, because that is the touch feel the prototype
 *     shipped, and a pointer press is followed by a `click` on the same element.
 *     So a `click` whose `pointerdown` we already handled *on that element* is
 *     suppressed, keyed on element identity rather than a bare flag so a press
 *     on one segment and a click on another still both count.
 *   - Space and Enter must select. Both are handled in `keydown` with
 *     `preventDefault()`, which also cancels the native button's synthesized
 *     `click` — one activation, and it works in jsdom, which does not implement
 *     that synthesis at all.
 * Nothing here reads `pointerId`, `button` or `pointerType`: jsdom has no
 * PointerEvent and VTU falls back to `window.Event`, so any implementation that
 * read them would pass in a browser and quietly misbehave under test.
 *
 * GEOMETRY IS LTR-ONLY BY CONSTRUCTION. The thumb is placed by
 * `translateX(left)` measured from the container's left padding edge, so under
 * `dir="rtl"` it would track the wrong end. That is deliberate and currently
 * sound: `src/i18n/index.ts` registers only `en` and `zh` and never sets `dir`,
 * and there is no `dir="rtl"` anywhere in `src`. Adding an RTL locale means
 * measuring from the trailing edge here first.
 *
 * REDUCED MOTION needs no handling at the call site: `useSpring.to()` queries
 * the preference on every call and jumps instead of animating. An instant jump
 * is the right answer for a thumb — it is a persistent, already-visible state
 * indicator whose feedback *is* its position, so jumping preserves the
 * positional cue (1.4.1 satisfied by position, not colour) and is what 2.3.3
 * asks for. A crossfade would be wrong: it reads as "replaced", not "moved".
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { SPRING_PRESETS, useSpring } from '@/composables/useSpring'

const props = defineProps<{
  /** Currently selected value. A value absent from `options` hides the thumb. */
  modelValue: T
  options: readonly SegmentedOption<T>[]
  /** Required: the two modes are not interchangeable. See the table above. */
  mode: 'radiogroup' | 'tablist'
  /**
   * Accessible name for the group. Bind it as `aria-label` at the call site —
   * Vue camelizes the attribute onto this prop, so existing markup carries over
   * verbatim. One of `aria-label` / `aria-labelledby` is required.
   */
  ariaLabel?: string
  /** Accessible name by reference. Bind as `aria-labelledby`. */
  ariaLabelledby?: string
  /** Extra classes for every segment, e.g. `px-2.5 py-1 text-xs`. */
  itemClass?: string
  /**
   * TEST SEAM. Reads one segment's geometry. Production never passes this: the
   * default reads the real DOM.
   *
   * It exists because jsdom has no layout — `offsetWidth`, `offsetLeft` and
   * `getBoundingClientRect()` are all 0 — and a prototype-level spy cannot fix
   * that here, because it returns one value for *every* element while the whole
   * point of this component is that segments sit at different offsets.
   *
   * Deliberately not `thumbLeft` / `thumbWidth` props: that would push layout
   * measurement onto all 19 call sites for the benefit of the test suite.
   */
  measure?: SegmentedMeasure
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

defineSlots<{
  /** Replaces a segment's content. Falls back to `option.label`. */
  option?: (props: { option: SegmentedOption<T>; index: number; selected: boolean }) => unknown
}>()

const containerRef = ref<HTMLElement | null>(null)
const thumbRef = ref<HTMLElement | null>(null)

const selectedIndex = computed(() =>
  props.options.findIndex((option) => option.value === props.modelValue)
)
const hasSelection = computed(() => selectedIndex.value >= 0)

if (import.meta.env.DEV) {
  watch(
    () => [props.mode, props.ariaLabel, props.ariaLabelledby] as const,
    ([mode, label, labelledby]) => {
      if (mode === 'radiogroup' && label === undefined && labelledby === undefined) {
        // A radiogroup with no accessible name is announced as an unlabelled
        // group of radios: the user hears the options but not what they choose.
        console.warn(
          '[Segmented] role="radiogroup" requires an accessible name. Pass aria-label or aria-labelledby.'
        )
      }
    },
    { immediate: true }
  )
}

/* ------------------------------------------------------------------ geometry */

const defaultMeasure: SegmentedMeasure = (el) => ({ left: el.offsetLeft, width: el.offsetWidth })

/**
 * Two springs with identical parameters, one per property. A single spring
 * driving a normalized 0..1 progress could not be re-targeted mid-flight
 * without lying about where the thumb visibly is; two independent springs each
 * resume from their own presentation value, which is what keeps a fast
 * back-and-forth continuous. Same parameters, so they stay in lockstep and read
 * as one object moving rather than two properties animating.
 *
 * `move` (critically damped) rather than a bouncier preset: overshoot would
 * push the thumb past the container's 2px padding and clip.
 *
 * Held for the life of the component and re-targeted, never reconstructed —
 * SpringCollapse needs a WeakMap because it builds a spring per transition and
 * could otherwise lose one; here there is exactly one owner per property, so
 * the same discipline (a forgotten controller leaks its rAF loop forever) is
 * satisfied structurally.
 */
const leftSpring = useSpring({
  ...SPRING_PRESETS.move,
  onUpdate: (value) => {
    const el = thumbRef.value
    if (el !== null) el.style.transform = `translateX(${value}px)`
  }
})

const widthSpring = useSpring({
  ...SPRING_PRESETS.move,
  onUpdate: (value) => {
    const el = thumbRef.value
    if (el !== null) el.style.width = `${Math.max(0, value)}px`
  }
})

/**
 * True once the thumb has a real position. Until then every placement is
 * instant, so a selection appearing after mount does not slide in from x=0.
 */
let placed = false

function itemAt(index: number): HTMLElement | null {
  if (index < 0) return null
  const root = containerRef.value
  if (root === null) return null
  // Queried rather than kept in a `ref` array: with v-for those are not
  // guaranteed to be in source order, and index order is the whole contract here.
  return root.querySelectorAll<HTMLElement>('[data-segment]')[index] ?? null
}

/**
 * Publishes the thumb's geometry as INLINE style, the way SpringCollapse writes
 * `el.style.height`. Inline styles are the only geometry jsdom can report back,
 * so this is also the entire assertion surface for the tests.
 */
function place(animate: boolean): void {
  const el = itemAt(selectedIndex.value)
  if (el === null) return

  const { left, width } = (props.measure ?? defaultMeasure)(el)

  if (animate && placed) {
    leftSpring.to(left)
    widthSpring.to(width)
  } else {
    leftSpring.set(left)
    widthSpring.set(width)
  }
  placed = true
}

let observer: ResizeObserver | null = null

onMounted(() => {
  place(false)

  if (typeof ResizeObserver === 'function' && containerRef.value !== null) {
    // Catches container-size changes: a resized viewport, and label widths where
    // the container is content-sized. A fixed-width container is the blind spot —
    // PaymentView's `class="w-full"` stays 896px across a locale switch, so this
    // never fires and the measurement is never refreshed. That call site is safe
    // only because `item-class="flex-1"` divides that fixed width evenly, making
    // segment geometry locale-invariant. Drop `flex-1`, or add a fixed-width
    // container whose segments size to their text, and the thumb keeps stale
    // geometry with nothing to correct it.
    observer = new ResizeObserver(() => place(false))
    observer.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  // useSpring's onScopeDispose already stops these; doing it explicitly keeps
  // the "no loop outlives the component" guarantee readable at this level.
  leftSpring.stop()
  widthSpring.stop()
})

// Selection moved: this is the one case that animates.
watch(selectedIndex, () => place(true), { flush: 'post' })

// The list itself changed shape, so every offset after the edit is stale. Not
// animated: nothing moved from the user's point of view, the layout was rebuilt.
watch(
  () => props.options.length,
  () => place(false),
  { flush: 'post' }
)

/* ---------------------------------------------------------------- activation */

/** The element whose `pointerdown` we handled, so its `click` can be ignored. */
let pointerActivated: EventTarget | null = null

/** Single source of truth for selection. Every input path ends up here. */
function select(index: number): void {
  const option = props.options[index]
  if (option === undefined || option.disabled === true) return
  // Re-selecting the current value emits nothing. Views that re-query on change
  // (KeyUsageView) would otherwise fire a duplicate request per interaction.
  if (option.value === props.modelValue) return
  emit('update:modelValue', option.value)
}

function onPointerdown(index: number, event: Event): void {
  pointerActivated = event.currentTarget
  select(index)
}

function onClick(index: number, event: Event): void {
  const alreadyHandled = pointerActivated !== null && pointerActivated === event.currentTarget
  pointerActivated = null
  if (alreadyHandled) return
  select(index)
}

/* ------------------------------------------------------------------ keyboard */

function focusItem(index: number): void {
  itemAt(index)?.focus()
}

/** Next enabled segment in `step` direction, wrapping. Null if none is enabled. */
function nextEnabled(from: number, step: number): number | null {
  const count = props.options.length
  if (count === 0) return null
  for (let hop = 1; hop <= count; hop += 1) {
    const index = (((from + step * hop) % count) + count) % count
    if (props.options[index]?.disabled !== true) return index
  }
  return null
}

/** First (or last) enabled segment. Null if every segment is disabled. */
function edgeEnabled(fromEnd: boolean): number | null {
  const count = props.options.length
  for (let hop = 0; hop < count; hop += 1) {
    const index = fromEnd ? count - 1 - hop : hop
    if (props.options[index]?.disabled !== true) return index
  }
  return null
}

/**
 * Arrow direction for this mode, or null if the key is not ours.
 *
 * A `tablist` here is horizontal, so Up/Down are not its keys and must fall
 * through to the page — claiming them would take scrolling away from the user.
 * A `radiogroup` owns all four.
 */
function arrowStep(key: string): number | null {
  if (key === 'ArrowLeft') return -1
  if (key === 'ArrowRight') return 1
  if (props.mode === 'radiogroup') {
    if (key === 'ArrowUp') return -1
    if (key === 'ArrowDown') return 1
  }
  return null
}

function moveTo(index: number | null): void {
  if (index === null) return
  // Focus first, then select: both modes activate automatically on arrow, and
  // focus has to land even when the value does not change (wrapping back onto
  // the only enabled segment).
  focusItem(index)
  select(index)
}

function onKeydown(index: number, event: KeyboardEvent): void {
  // A stale pointerdown must never swallow a keyboard activation.
  pointerActivated = null

  // Handled here, not left to the button's native activation, so exactly one
  // selection happens: preventDefault cancels the synthesized click (and Space's
  // page scroll), and jsdom never synthesizes one to begin with.
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    select(index)
    return
  }

  const step = arrowStep(event.key)
  if (step !== null) {
    // Arrow keys would otherwise scroll the page.
    event.preventDefault()
    moveTo(nextEnabled(index, step))
    return
  }

  if (props.mode === 'tablist' && (event.key === 'Home' || event.key === 'End')) {
    event.preventDefault()
    moveTo(edgeEnabled(event.key === 'End'))
  }
}

/**
 * Roving tabindex: the group is one tab stop and Tab moves past it, not through
 * it. New behaviour — no call site implements it today.
 *
 * With nothing selected the first enabled segment stays reachable, otherwise
 * the group would be a keyboard dead end.
 */
function tabIndexFor(index: number): number {
  const reachable = hasSelection.value ? selectedIndex.value : edgeEnabled(false)
  return index === reachable ? 0 : -1
}
</script>

<style scoped>
/* Containing block for the thumb. `.tabs` supplies the pill, the inset hairline
   and the 2px padding; only positioning is added here. */
.segmented {
  position: relative;
}

.segmented-thumb {
  position: absolute;
  /* Matches `.tabs`'s p-0.5, so the thumb sits inside the track. `left: 0` and
     `offsetLeft` share an origin — both are relative to the container's padding
     box — which is why translateX takes the measured value with no correction. */
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 0;
  border-radius: 9999px;
  background-color: var(--surface);
  box-shadow:
    var(--shadow-1),
    inset 0 0 0 0.5px var(--hairline);
  /* No CSS transition: the spring owns transform and width, and a transition on
     top would animate the animation. */
  will-change: transform, width;
  pointer-events: none;
}

/* Above the thumb, which is a preceding sibling in the same stacking context.
   `.tab` transitions color and background-color; transform joins the list for
   the press scale, and color stays so the label does not snap while the thumb
   glides. The global prefers-reduced-motion block still wins over this: it
   targets `.tab` with !important, which these items carry. */
.segmented-item {
  position: relative;
  z-index: 1;
  transition:
    color 240ms var(--ease-out),
    transform 100ms var(--ease-out);
}

.segmented-item[aria-checked='true'],
.segmented-item[aria-selected='true'] {
  color: var(--label);
}

/* Focusable on purpose rather than natively `disabled`: a disabled segment the
   user can still reach is a segment they can discover. Arrow keys skip it and
   `select()` refuses it. */
.segmented-item[aria-disabled='true'] {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
