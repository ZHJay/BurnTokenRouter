/**
 * Behaviour contract for Segmented.
 *
 * Three environment facts this file works around, each of which silently voids
 * the tests if left alone:
 *
 *  1. `src/__tests__/setup.ts:62` stubs `matchMedia` to answer `matches: true`
 *     for EVERY query, so `prefersReducedMotion()` is true by default and any
 *     motion test that merely mounts takes useSpring's instant-settle branch,
 *     lands on the final value and passes while testing nothing. Every
 *     geometry/motion test installs its own matchMedia (pattern copied from
 *     `useSpring.spec.ts:159`) answering only the reduced-motion query.
 *  2. `setup.ts:84` stubs `ResizeObserver` as a no-op whose `observe()` never
 *     invokes the callback. Replaced locally with a callback-capturing fake —
 *     locally, because changing the global setup would reach 200 other files.
 *  3. jsdom has no layout, so `offsetLeft` / `offsetWidth` /
 *     `getBoundingClientRect()` are all 0, and one spy cannot stand in for
 *     several segments at different offsets. Geometry therefore comes through
 *     the component's `measure` prop (its documented test seam) and is asserted
 *     on the thumb's INLINE style, the only geometry jsdom reports back.
 *
 * Spring physics is NOT re-tested here: `useSpring.spec.ts` already pins it
 * against the analytical damped-oscillator solution across 1186 lines. These
 * tests assert only that Segmented asks the spring for the right target at the
 * right time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import Segmented, { type SegmentedOption } from '../Segmented.vue'

const FRAME_MS = 1000 / 60
/** Bound on hand-driven frames. The `move` preset settles in ~60. */
const MAX_FRAMES = 400

let frameQueue: Map<number, FrameRequestCallback>
let nextFrameId: number
let clock: number
let rafCalls: number

/**
 * Runs one animation frame: advances the clock, then invokes the callbacks that
 * were queued before the tick. Both of the component's springs live in the same
 * queue, so one step ticks both — which is what makes the thumb's two
 * properties comparable at the same instant.
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

/** Drains frames until nothing is scheduled. Returns the frames it took. */
function stepToRest(limit = MAX_FRAMES): number {
  let frames = 0
  while (frameQueue.size > 0 && frames < limit) {
    step()
    frames += 1
  }
  return frames
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

/** Every ResizeObserver the component under test constructed. */
let observers: FakeResizeObserver[]

/**
 * ResizeObserver that hands the callback back, so a test can say "the container
 * resized" and have the component actually hear it.
 */
class FakeResizeObserver {
  observed: Element[] = []
  disconnected = false

  constructor(public callback: ResizeObserverCallback) {
    observers.push(this)
  }

  observe(target: Element): void {
    this.observed.push(target)
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true
  }

  /** Fires the callback the way a real resize would. */
  trigger(): void {
    this.callback([], this as unknown as ResizeObserver)
  }
}

/* ------------------------------------------------------------------- fixtures */

interface Layout {
  left: number
  width: number
}

/**
 * The layout jsdom cannot produce, indexed by segment position. Mutable so a
 * test can change what the next measurement returns — which is the only way to
 * tell a genuine re-measure apart from a cached value.
 */
let layout: Layout[]

/**
 * Stands in for `offsetLeft`/`offsetWidth`. Resolves the element's index the
 * same way the component does, so the two agree on what "segment 2" means.
 */
function measure(el: HTMLElement): Layout {
  const container = el.parentElement
  const index = container === null ? -1 : [...container.querySelectorAll('[data-segment]')].indexOf(el)
  return layout[index] ?? { left: 0, width: 0 }
}

type Value = 'a' | 'b' | 'c'

const OPTIONS: SegmentedOption<Value>[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' }
]

/** Geometry matching OPTIONS: 2px track padding, three segments. */
const BASE_LAYOUT: Layout[] = [
  { left: 2, width: 48 },
  { left: 50, width: 40 },
  { left: 90, width: 60 }
]

function mountSegmented(
  props: Partial<{
    modelValue: Value
    options: SegmentedOption<Value>[]
    mode: 'radiogroup' | 'tablist'
    ariaLabel: string
    itemClass: string
  }> = {}
) {
  return mount(Segmented, {
    props: {
      modelValue: 'a' as Value,
      options: OPTIONS,
      mode: 'radiogroup' as const,
      ariaLabel: 'Range',
      measure,
      ...props
    },
    attachTo: document.body
  })
}

/** Inline geometry the component published on the thumb. */
function thumbGeometry(wrapper: ReturnType<typeof mountSegmented>): {
  transform: string
  width: string
} {
  const el = wrapper.get('[aria-hidden="true"]').element as HTMLElement
  return { transform: el.style.transform, width: el.style.width }
}

function items(wrapper: ReturnType<typeof mountSegmented>) {
  return wrapper.findAll('[data-segment]')
}

/** Dispatches a real, cancellable keydown so `defaultPrevented` is meaningful. */
function keydown(el: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

beforeEach(() => {
  frameQueue = new Map()
  nextFrameId = 1
  clock = 0
  rafCalls = 0
  observers = []
  layout = BASE_LAYOUT.map((entry) => ({ ...entry }))

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
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  // Motion ON by default, against the global stub. Tests that want the
  // reduced-motion branch ask for it explicitly.
  setReducedMotion(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Segmented · rendering', () => {
  it('renders one item per option, in order, with the option label', () => {
    const wrapper = mountSegmented()

    const rendered = items(wrapper)
    expect(rendered).toHaveLength(3)
    expect(rendered.map((item) => item.text())).toEqual(['Alpha', 'Beta', 'Gamma'])

    wrapper.unmount()
  })

  it('keeps the .tabs/.tab classes so migrated call sites do not shift, and drops .tab-active', () => {
    const wrapper = mountSegmented({ modelValue: 'b', itemClass: 'px-2.5 text-xs' })

    expect(wrapper.classes()).toContain('tabs')

    const selected = items(wrapper)[1]
    expect(selected.classes()).toContain('tab')
    expect(selected.classes()).toContain('px-2.5')
    // The thumb paints that surface now; both painting it would double the fill.
    expect(selected.classes()).not.toContain('tab-active')

    wrapper.unmount()
  })

  it('renders through the option slot when one is supplied', () => {
    const wrapper = mount(Segmented, {
      props: { modelValue: 'b' as Value, options: OPTIONS, mode: 'radiogroup' as const, ariaLabel: 'Range', measure },
      slots: {
        option: ({ option, selected }: { option: SegmentedOption<Value>; selected: boolean }) =>
          `${option.label}${selected ? '*' : ''}`
      },
      attachTo: document.body
    })

    expect(items(wrapper).map((item) => item.text())).toEqual(['Alpha', 'Beta*', 'Gamma'])

    wrapper.unmount()
  })
})

describe('Segmented · selection', () => {
  it('emits update:modelValue exactly once when an unselected segment is chosen', async () => {
    const wrapper = mountSegmented({ modelValue: 'a' })

    await items(wrapper)[2].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['c']])

    wrapper.unmount()
  })

  it('does not emit when the already-selected segment is chosen again', async () => {
    const wrapper = mountSegmented({ modelValue: 'b' })

    await items(wrapper)[1].trigger('click')
    await items(wrapper)[1].trigger('pointerdown')
    keydown(items(wrapper)[1].element, ' ')

    // Guards the double-fire in views that re-query on change (KeyUsageView):
    // one interaction on the current value must not cost a second request.
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })

  it('follows an external modelValue change without emitting anything back', async () => {
    const wrapper = mountSegmented({ modelValue: 'a' })

    await wrapper.setProps({ modelValue: 'c' })

    const rendered = items(wrapper)
    expect(rendered[0].attributes('aria-checked')).toBe('false')
    expect(rendered[2].attributes('aria-checked')).toBe('true')
    // A controlled component that echoed the parent's own value back would loop.
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })

  it('selects on pointerdown and suppresses the click that follows it', async () => {
    const wrapper = mountSegmented({ modelValue: 'a' })

    // The real browser sequence for a tap: pointerdown, then click on the same
    // element. Exactly one selection must come out of it.
    await items(wrapper)[1].trigger('pointerdown')
    await items(wrapper)[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])

    wrapper.unmount()
  })

  it('still selects on a click alone, with no preceding pointerdown', async () => {
    // 272 trigger('click') calls in the existing suite dispatch click only, and
    // so does assistive-tech activation. Pointerdown-only would be dead here.
    const wrapper = mountSegmented({ modelValue: 'a' })

    await items(wrapper)[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])

    wrapper.unmount()
  })

  it('counts a pointerdown on one segment and a click on another as two selections', async () => {
    const wrapper = mountSegmented({ modelValue: 'a' })

    // Suppression is keyed on element identity, not a bare "a pointerdown
    // happened" flag, so a press that drifts to a different segment is not lost.
    await items(wrapper)[1].trigger('pointerdown')
    await items(wrapper)[2].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['b'], ['c']])

    wrapper.unmount()
  })

  it('selects the focused segment on Space and on Enter', () => {
    const wrapper = mountSegmented({ modelValue: 'a' })

    // A native button activated by Space or Enter fires click, never
    // pointerdown — and jsdom does not synthesize that click at all, which is
    // why these are handled in keydown with preventDefault.
    const space = keydown(items(wrapper)[1].element, ' ')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
    expect(space.defaultPrevented).toBe(true)

    const enter = keydown(items(wrapper)[2].element, 'Enter')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b'], ['c']])
    expect(enter.defaultPrevented).toBe(true)

    wrapper.unmount()
  })

  it('refuses a disabled segment and exposes aria-disabled on it', async () => {
    const options: SegmentedOption<Value>[] = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta', disabled: true },
      { value: 'c', label: 'Gamma' }
    ]
    const wrapper = mountSegmented({ modelValue: 'a', options })

    const rendered = items(wrapper)
    expect(rendered[1].attributes('aria-disabled')).toBe('true')
    expect(rendered[0].attributes('aria-disabled')).toBeUndefined()
    // aria-disabled rather than the native attribute: a disabled segment the
    // user can still reach is a segment they can discover. So it does receive
    // the events, and the refusal has to come from the component.
    expect(rendered[1].attributes('disabled')).toBeUndefined()

    await rendered[1].trigger('click')
    await rendered[1].trigger('pointerdown')
    keydown(rendered[1].element, ' ')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })
})

describe('Segmented · ARIA matrix', () => {
  it('radiogroup mode: radiogroup/radio/aria-checked, and no aria-selected anywhere', () => {
    const wrapper = mountSegmented({ mode: 'radiogroup', modelValue: 'b' })

    expect(wrapper.attributes('role')).toBe('radiogroup')
    expect(wrapper.attributes('aria-label')).toBe('Range')

    const rendered = items(wrapper)
    expect(rendered.map((item) => item.attributes('role'))).toEqual(['radio', 'radio', 'radio'])
    expect(rendered.map((item) => item.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false'
    ])
    // A radio carrying aria-selected is a contradiction, and both get read out.
    expect(rendered.every((item) => item.attributes('aria-selected') === undefined)).toBe(true)

    wrapper.unmount()
  })

  it('tablist mode: tablist/tab/aria-selected, and no aria-checked anywhere', () => {
    const wrapper = mountSegmented({ mode: 'tablist', modelValue: 'b' })

    expect(wrapper.attributes('role')).toBe('tablist')

    const rendered = items(wrapper)
    expect(rendered.map((item) => item.attributes('role'))).toEqual(['tab', 'tab', 'tab'])
    expect(rendered.map((item) => item.attributes('aria-selected'))).toEqual([
      'false',
      'true',
      'false'
    ])
    expect(rendered.every((item) => item.attributes('aria-checked') === undefined)).toBe(true)

    wrapper.unmount()
  })

  it('tablist mode wires aria-controls on the selected tab only', async () => {
    const options: SegmentedOption<Value>[] = [
      { value: 'a', label: 'Alpha', id: 'tab-a', panelId: 'panel-a' },
      { value: 'b', label: 'Beta', id: 'tab-b', panelId: 'panel-b' },
      { value: 'c', label: 'Gamma', id: 'tab-c', panelId: 'panel-c' }
    ]
    const wrapper = mountSegmented({ mode: 'tablist', modelValue: 'a', options })

    let rendered = items(wrapper)
    expect(rendered[0].attributes('id')).toBe('tab-a')
    expect(rendered[0].attributes('aria-controls')).toBe('panel-a')
    // Unselected panels are not mounted at the call sites, so pointing at them
    // would leave a dangling IDREF.
    expect(rendered[1].attributes('aria-controls')).toBeUndefined()

    await wrapper.setProps({ modelValue: 'b' })

    rendered = items(wrapper)
    expect(rendered[0].attributes('aria-controls')).toBeUndefined()
    expect(rendered[1].attributes('aria-controls')).toBe('panel-b')

    wrapper.unmount()
  })

  it('accepts aria-labelledby, and an option-level aria-label for icon-only segments', () => {
    const options: SegmentedOption<Value>[] = [
      { value: 'a', label: 'Alpha', ariaLabel: 'Alpha view' },
      { value: 'b', label: 'Beta' },
      { value: 'c', label: 'Gamma' }
    ]
    const wrapper = mount(Segmented, {
      props: {
        modelValue: 'a' as Value,
        options,
        mode: 'radiogroup' as const,
        ariaLabelledby: 'range-label',
        measure
      },
      attachTo: document.body
    })

    expect(wrapper.attributes('aria-labelledby')).toBe('range-label')
    expect(items(wrapper)[0].attributes('aria-label')).toBe('Alpha view')

    wrapper.unmount()
  })
})

describe('Segmented · roving tabindex', () => {
  it('gives the selected segment tabindex 0 and the rest -1, and follows selection', async () => {
    // New behaviour: no current call site implements a roving tabindex, so the
    // whole group used to be N tab stops instead of one.
    const wrapper = mountSegmented({ modelValue: 'a' })

    expect(items(wrapper).map((item) => item.attributes('tabindex'))).toEqual(['0', '-1', '-1'])

    await wrapper.setProps({ modelValue: 'c' })

    expect(items(wrapper).map((item) => item.attributes('tabindex'))).toEqual(['-1', '-1', '0'])

    wrapper.unmount()
  })

  it('keeps the first enabled segment reachable when nothing is selected', () => {
    const options: SegmentedOption<Value>[] = [
      { value: 'a', label: 'Alpha', disabled: true },
      { value: 'b', label: 'Beta' },
      { value: 'c', label: 'Gamma' }
    ]
    // modelValue matches no option: without a fallback the group would be a
    // keyboard dead end, unreachable by Tab in either direction.
    const wrapper = mountSegmented({ modelValue: 'zz' as Value, options })

    expect(items(wrapper).map((item) => item.attributes('tabindex'))).toEqual(['-1', '0', '-1'])

    wrapper.unmount()
  })
})

describe('Segmented · keyboard, per mode', () => {
  it('radiogroup: all four arrows move focus and select, wrapping at both ends', () => {
    const wrapper = mountSegmented({ mode: 'radiogroup', modelValue: 'b' })

    for (const key of ['ArrowRight', 'ArrowDown']) {
      const wrap = mountSegmented({ mode: 'radiogroup', modelValue: 'b' })
      keydown(items(wrap)[1].element, key)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrap.emitted('update:modelValue')).toEqual([['c']])
      wrap.unmount()
    }

    for (const key of ['ArrowLeft', 'ArrowUp']) {
      const wrap = mountSegmented({ mode: 'radiogroup', modelValue: 'b' })
      keydown(items(wrap)[1].element, key)
      expect(wrap.emitted('update:modelValue')).toEqual([['a']])
      wrap.unmount()
    }

    // Wrap at the end, and at the start.
    const forward = mountSegmented({ mode: 'radiogroup', modelValue: 'c' })
    keydown(items(forward)[2].element, 'ArrowRight')
    expect(forward.emitted('update:modelValue')).toEqual([['a']])
    forward.unmount()

    const backward = mountSegmented({ mode: 'radiogroup', modelValue: 'a' })
    keydown(items(backward)[0].element, 'ArrowLeft')
    expect(backward.emitted('update:modelValue')).toEqual([['c']])
    backward.unmount()

    wrapper.unmount()
  })

  it('tablist: Left/Right select, and Up/Down are left to the page', () => {
    const wrapper = mountSegmented({ mode: 'tablist', modelValue: 'b' })

    keydown(items(wrapper)[1].element, 'ArrowRight')
    expect(wrapper.emitted('update:modelValue')).toEqual([['c']])

    // A horizontal tablist does not own the vertical arrows: claiming them would
    // take page scrolling away from the user.
    const up = keydown(items(wrapper)[1].element, 'ArrowUp')
    const down = keydown(items(wrapper)[1].element, 'ArrowDown')

    expect(wrapper.emitted('update:modelValue')).toEqual([['c']])
    expect(up.defaultPrevented).toBe(false)
    expect(down.defaultPrevented).toBe(false)

    wrapper.unmount()
  })

  it('tablist: Home and End jump to the first and last segment', () => {
    const wrapper = mountSegmented({ mode: 'tablist', modelValue: 'b' })

    const end = keydown(items(wrapper)[1].element, 'End')
    expect(wrapper.emitted('update:modelValue')).toEqual([['c']])
    expect(end.defaultPrevented).toBe(true)

    const home = keydown(items(wrapper)[1].element, 'Home')
    expect(wrapper.emitted('update:modelValue')).toEqual([['c'], ['a']])
    expect(home.defaultPrevented).toBe(true)

    wrapper.unmount()
  })

  it('arrow keys call preventDefault so the page does not scroll', () => {
    const wrapper = mountSegmented({ mode: 'radiogroup', modelValue: 'b' })

    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      expect(keydown(items(wrapper)[1].element, key).defaultPrevented).toBe(true)
    }

    wrapper.unmount()
  })

  it('ignores keys it does not own', () => {
    const wrapper = mountSegmented({ mode: 'radiogroup', modelValue: 'b' })

    for (const key of ['Tab', 'Escape', 'a', 'PageDown']) {
      expect(keydown(items(wrapper)[1].element, key).defaultPrevented).toBe(false)
    }
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })

  it('moves focus with selection, and skips disabled segments on the way', () => {
    const options: SegmentedOption<Value>[] = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta', disabled: true },
      { value: 'c', label: 'Gamma' }
    ]
    const wrapper = mountSegmented({ modelValue: 'a', options })
    const rendered = items(wrapper)

    ;(rendered[0].element as HTMLElement).focus()
    keydown(rendered[0].element, 'ArrowRight')

    // Focus has to follow: the segment it left is about to become tabindex -1.
    expect(document.activeElement).toBe(rendered[2].element)
    expect(wrapper.emitted('update:modelValue')).toEqual([['c']])

    wrapper.unmount()
  })

  it('moves focus even when the value cannot change', () => {
    const options: SegmentedOption<Value>[] = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta', disabled: true },
      { value: 'c', label: 'Gamma', disabled: true }
    ]
    const wrapper = mountSegmented({ modelValue: 'a', options })
    const rendered = items(wrapper)

    ;(rendered[0].element as HTMLElement).focus()
    // Both neighbours are disabled, so the walk wraps back onto the current
    // segment: no emit, but focus must still be somewhere sensible.
    keydown(rendered[0].element, 'ArrowRight')

    expect(document.activeElement).toBe(rendered[0].element)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })
})

describe('Segmented · thumb geometry', () => {
  it('places the thumb on the selected segment at mount', () => {
    const wrapper = mountSegmented({ modelValue: 'b' })

    expect(thumbGeometry(wrapper)).toEqual({ transform: 'translateX(50px)', width: '40px' })
    // Instant: nothing moved, this is where the thumb has always been.
    expect(rafCalls).toBe(0)

    wrapper.unmount()
  })

  it('springs the thumb to the newly selected segment', async () => {
    const wrapper = mountSegmented({ modelValue: 'a' })

    expect(thumbGeometry(wrapper)).toEqual({ transform: 'translateX(2px)', width: '48px' })

    await wrapper.setProps({ modelValue: 'c' })

    // Mid-flight it is genuinely between the two, not already arrived: that is
    // the difference between a spring and today's background swap.
    step(3)
    const moving = thumbGeometry(wrapper)
    expect(parseFloat(moving.transform.replace(/[^0-9.-]/g, ''))).toBeGreaterThan(2)
    expect(parseFloat(moving.transform.replace(/[^0-9.-]/g, ''))).toBeLessThan(90)

    expect(stepToRest()).toBeLessThan(MAX_FRAMES)
    expect(thumbGeometry(wrapper)).toEqual({ transform: 'translateX(90px)', width: '60px' })

    wrapper.unmount()
  })

  it('re-measures and re-pins when the container resizes', () => {
    const wrapper = mountSegmented({ modelValue: 'b' })

    expect(observers).toHaveLength(1)
    expect(observers[0].observed).toEqual([wrapper.element])

    // The viewport changed, so every offset the thumb was placed from is stale.
    layout = [
      { left: 2, width: 96 },
      { left: 98, width: 80 },
      { left: 178, width: 120 }
    ]
    observers[0].trigger()

    // Pinned, not animated: the segment did not move, the layout was rebuilt
    // under it, and a spring chasing a window drag would lag behind the content.
    expect(thumbGeometry(wrapper)).toEqual({ transform: 'translateX(98px)', width: '80px' })
    expect(rafCalls).toBe(0)

    wrapper.unmount()
  })

  it('re-measures when the option list changes length', async () => {
    const wrapper = mountSegmented({ modelValue: 'b' })

    expect(thumbGeometry(wrapper)).toEqual({ transform: 'translateX(50px)', width: '40px' })

    // Dropping a segment widens the survivors wherever the items share the row
    // (`class="tabs flex"` at several call sites), so the cached offsets for the
    // segment that did not move are wrong too.
    layout = [
      { left: 2, width: 70 },
      { left: 72, width: 70 }
    ]
    await wrapper.setProps({ options: OPTIONS.slice(0, 2) })

    expect(items(wrapper)).toHaveLength(2)
    expect(thumbGeometry(wrapper)).toEqual({ transform: 'translateX(72px)', width: '70px' })
    expect(rafCalls).toBe(0)

    wrapper.unmount()
  })

  it('hides the thumb when modelValue matches no option', () => {
    const wrapper = mountSegmented({ modelValue: 'zz' as Value })

    expect((wrapper.get('[aria-hidden="true"]').element as HTMLElement).style.display).toBe('none')

    wrapper.unmount()
  })

  it('does not slide in from zero when a selection appears after mount', async () => {
    const wrapper = mountSegmented({ modelValue: 'zz' as Value })

    await wrapper.setProps({ modelValue: 'c' })

    // First real placement is a placement, not a move: there was no thumb on
    // screen to animate away from.
    expect(thumbGeometry(wrapper)).toEqual({ transform: 'translateX(90px)', width: '60px' })
    expect(rafCalls).toBe(0)

    wrapper.unmount()
  })
})

describe('Segmented · reduced motion', () => {
  it('lands on the final geometry with no frame scheduled at all', async () => {
    setReducedMotion(true)
    const wrapper = mountSegmented({ modelValue: 'a' })

    await wrapper.setProps({ modelValue: 'c' })

    // useSpring's reduced-motion branch settles synchronously inside to(), so
    // the geometry is already final here with no frame pumped. An instant jump
    // is the right outcome: the thumb's feedback IS its position, so the
    // positional cue survives (1.4.1 by position, not colour) and no crossfade
    // wrongly implies the element was replaced rather than moved.
    expect(thumbGeometry(wrapper)).toEqual({ transform: 'translateX(90px)', width: '60px' })
    expect(rafCalls).toBe(0)
    expect(frameQueue.size).toBe(0)

    wrapper.unmount()
  })
})

describe('Segmented · lifecycle', () => {
  it('schedules no further frames after unmounting mid-animation', async () => {
    const wrapper = mountSegmented({ modelValue: 'a' })

    await wrapper.setProps({ modelValue: 'c' })
    step(1)

    // Genuinely in flight: a forgotten controller would keep this loop alive
    // for the life of the page, writing to a detached node every frame.
    expect(frameQueue.size).toBeGreaterThan(0)

    const callsAtUnmount = rafCalls
    wrapper.unmount()

    expect(frameQueue.size).toBe(0)
    step(5)
    expect(rafCalls).toBe(callsAtUnmount)
  })

  it('disconnects the ResizeObserver on unmount', () => {
    const wrapper = mountSegmented({ modelValue: 'b' })

    expect(observers[0].disconnected).toBe(false)
    wrapper.unmount()
    expect(observers[0].disconnected).toBe(true)
  })
})
