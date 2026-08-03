/**
 * BaseDialog accessibility contract.
 *
 * BaseDialog backs 50 of the 55 modals in this app, so each of these is a
 * whole-app regression guard rather than a single-component check.
 *
 * jsdom does not implement sequential focus navigation: pressing Tab moves
 * nothing on its own. So `emulateTab` below does what a browser would — dispatch
 * the key, and if nothing called preventDefault, advance focus to the next
 * focusable element **in the whole document**. That is what makes these tests
 * able to fail: without a trap, focus walks straight out of the panel and into
 * the page behind it, which is exactly the reported defect.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import BaseDialog from '@/components/common/BaseDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const TAB_ORDER_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

/** Everything a browser would visit on Tab, in document order. */
function documentTabOrder() {
  return Array.from(document.querySelectorAll<HTMLElement>(TAB_ORDER_SELECTOR)).filter(
    (el) => el.getAttribute('tabindex') !== '-1' && !el.hasAttribute('disabled') && !el.hasAttribute('hidden')
  )
}

/**
 * Note this deliberately ignores `inert`. The JS trap has to hold on its own —
 * `inert` is defence in depth, not the mechanism under test here.
 */
function emulateTab(shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true, bubbles: true })
  const prevented = !document.dispatchEvent(event)
  if (prevented) return

  const order = documentTabOrder()
  if (order.length === 0) return
  const index = order.indexOf(document.activeElement as HTMLElement)
  const next = shiftKey
    ? order[index <= 0 ? order.length - 1 : index - 1]
    : order[index === -1 || index === order.length - 1 ? 0 : index + 1]
  next?.focus()
}

const pressEscape = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))

/** The app root BaseDialog marks `inert`. It lives in AppLayout, so it is only ever found by selector. */
function createAppRoot() {
  const root = document.createElement('div')
  root.id = 'app'
  // Background focusables: if the trap leaks, focus lands on one of these.
  root.innerHTML = `
    <button id="bg-1">background 1</button>
    <a id="bg-2" href="#x">background 2</a>
    <input id="bg-3" />
  `
  document.body.appendChild(root)
  return root
}

const appRoot = () => document.getElementById('app')!
const panel = () => document.body.querySelector<HTMLElement>('[role="dialog"]')!
const panels = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="dialog"]'))

let wrappers: VueWrapper<any>[] = []

function track<T extends VueWrapper<any>>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
  document.body.innerHTML = ''
  document.body.className = ''
})

/** One dialog with a realistic body: several fields plus a footer action. */
const SingleHost = defineComponent({
  props: {
    show: { type: Boolean, default: true },
    initialFocus: { type: String, default: undefined },
    showCloseButton: { type: Boolean, default: true },
    body: { type: Boolean, default: true },
    footer: { type: Boolean, default: true }
  },
  setup(props) {
    const slots: Record<string, () => any> = {
      default: () =>
        props.body
          ? [
              h('input', { id: 'field-1' }),
              h('input', { id: 'field-2' }),
              h('input', { id: 'field-hidden', hidden: true }),
              h('input', { id: 'field-disabled', disabled: true }),
              h('a', { id: 'link-1', href: '#a' }, 'link')
            ]
          : [h('p', 'nothing focusable here')]
    }
    if (props.footer) {
      slots.footer = () => h('button', { id: 'confirm' }, 'confirm')
    }

    return () =>
      h('div', [
        h('button', { id: 'invoker' }, 'open'),
        h(
          BaseDialog,
          {
            show: props.show,
            title: 'Dialog title',
            initialFocus: props.initialFocus,
            showCloseButton: props.showCloseButton
          },
          slots
        )
      ])
  }
})

describe('BaseDialog focus trap', () => {
  it('does not let focus escape the panel on repeated Tab', async () => {
    createAppRoot()
    const wrapper = track(mount(SingleHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    // Runtime report: focus reached BODY on the 10th Tab. 30 is well past both
    // that and one full cycle of this panel.
    for (let i = 0; i < 30; i++) {
      emulateTab()
      expect(document.activeElement).not.toBe(document.body)
      expect(appRoot().contains(document.activeElement)).toBe(false)
      expect(panel().contains(document.activeElement)).toBe(true)
    }
  })

  it('wraps backward from the first focusable element to the last', async () => {
    createAppRoot()
    const wrapper = track(mount(SingleHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    const inPanel = Array.from(panel().querySelectorAll<HTMLElement>(TAB_ORDER_SELECTOR))
    const first = inPanel[0]
    const last = inPanel[inPanel.length - 1]

    first.focus()
    expect(document.activeElement).toBe(first)

    // Reported behaviour: one Shift+Tab from the first element left the dialog.
    emulateTab(true)
    expect(document.activeElement).toBe(last)
    expect(panel().contains(document.activeElement)).toBe(true)
  })

  it('wraps forward from the last focusable element to the first', async () => {
    createAppRoot()
    const wrapper = track(mount(SingleHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    const inPanel = Array.from(panel().querySelectorAll<HTMLElement>(TAB_ORDER_SELECTOR))
    const first = inPanel[0]
    const last = inPanel[inPanel.length - 1]

    last.focus()
    emulateTab()
    expect(document.activeElement).toBe(first)
  })

  it('recomputes the focusable set, so fields added after open are trapped too', async () => {
    createAppRoot()
    const wrapper = track(mount(SingleHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    // These dialog bodies are full of v-if fields; a set captured at open time
    // goes stale the moment one renders.
    const late = document.createElement('input')
    late.id = 'late-field'
    panel().querySelector('.modal-body')!.appendChild(late)

    late.focus()
    emulateTab()
    expect(panel().contains(document.activeElement)).toBe(true)

    const inPanel = Array.from(panel().querySelectorAll<HTMLElement>(TAB_ORDER_SELECTOR))
    expect(inPanel).toContain(late)
    inPanel[inPanel.length - 1].focus()
    emulateTab()
    expect(document.activeElement).toBe(inPanel[0])
  })
})

describe('BaseDialog background inert', () => {
  it('marks the app root inert while open and clears it on close', async () => {
    createAppRoot()
    const wrapper = track(
      mount(SingleHost, { props: { show: false }, attachTo: appRoot(), global: { stubs: { Icon: true } } })
    )
    await wrapper.vm.$nextTick()
    expect(appRoot().hasAttribute('inert')).toBe(false)

    await wrapper.setProps({ show: true })
    await wrapper.vm.$nextTick()
    // aria-modal alone does nothing for Tab order; inert is what removes the
    // background from it.
    expect(appRoot().hasAttribute('inert')).toBe(true)

    await wrapper.setProps({ show: false })
    await wrapper.vm.$nextTick()
    expect(appRoot().hasAttribute('inert')).toBe(false)
  })

  it('clears inert when a dialog is unmounted while still open', async () => {
    createAppRoot()
    const wrapper = mount(SingleHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } })
    await wrapper.vm.$nextTick()
    expect(appRoot().hasAttribute('inert')).toBe(true)

    // v-if callers never flip `show` back to false — unmounting is the close.
    wrapper.unmount()
    expect(appRoot().hasAttribute('inert')).toBe(false)
    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('restores focus to the invoking element on close', async () => {
    createAppRoot()
    const wrapper = track(
      mount(SingleHost, { props: { show: false }, attachTo: appRoot(), global: { stubs: { Icon: true } } })
    )
    const invoker = document.getElementById('invoker') as HTMLButtonElement
    invoker.focus()
    expect(document.activeElement).toBe(invoker)

    await wrapper.setProps({ show: true })
    await wrapper.vm.$nextTick()
    expect(panel().contains(document.activeElement)).toBe(true)

    await wrapper.setProps({ show: false })
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(invoker)
  })

  it('parks focus on the panel when the body has nothing focusable', async () => {
    createAppRoot()
    const wrapper = track(
      mount(SingleHost, {
        props: { body: false, showCloseButton: false, footer: false },
        attachTo: appRoot(),
        global: { stubs: { Icon: true } }
      })
    )
    await wrapper.vm.$nextTick()

    // Leaving focus behind would strand it inside the now-inert background.
    expect(document.activeElement).toBe(panel())
    expect(panel().getAttribute('tabindex')).toBe('-1')

    emulateTab()
    expect(panel().contains(document.activeElement)).toBe(true)
  })
})

describe('BaseDialog initialFocus', () => {
  it('focuses the requested element instead of the first in DOM order', async () => {
    createAppRoot()
    const wrapper = track(
      mount(SingleHost, {
        props: { initialFocus: '#field-2' },
        attachTo: appRoot(),
        global: { stubs: { Icon: true } }
      })
    )
    await wrapper.vm.$nextTick()

    expect(document.activeElement).toBe(document.getElementById('field-2'))
  })

  it('falls back to the first focusable element when the target is disabled', async () => {
    createAppRoot()
    const wrapper = track(
      mount(SingleHost, {
        props: { initialFocus: '#field-disabled' },
        attachTo: appRoot(),
        global: { stubs: { Icon: true } }
      })
    )
    await wrapper.vm.$nextTick()

    const active = document.activeElement as HTMLElement
    expect(active.id).not.toBe('field-disabled')
    expect(panel().contains(active)).toBe(true)
  })

  it('skips hidden and disabled candidates in the trap', async () => {
    createAppRoot()
    const wrapper = track(mount(SingleHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    const visited = new Set<string>()
    for (let i = 0; i < 20; i++) {
      emulateTab()
      visited.add((document.activeElement as HTMLElement).id)
    }

    expect(visited.has('field-hidden')).toBe(false)
    expect(visited.has('field-disabled')).toBe(false)
    expect(visited.has('field-1')).toBe(true)
    expect(visited.has('confirm')).toBe(true)
  })
})

/** Two dialogs, independently toggleable, the inner one stacked above. */
const StackHost = defineComponent({
  setup() {
    const outer = ref(true)
    const inner = ref(true)
    return { outer, inner }
  },
  render() {
    return h('div', [
      h(
        BaseDialog,
        { show: this.outer, title: 'Outer dialog', onClose: () => (this.outer = false) },
        { default: () => h('input', { id: 'outer-field' }) }
      ),
      h(
        BaseDialog,
        { show: this.inner, title: 'Inner dialog', zIndex: 60, onClose: () => (this.inner = false) },
        { default: () => h('input', { id: 'inner-field' }) }
      )
    ])
  }
})

describe('BaseDialog stacking', () => {
  it('gives stacked dialogs different title ids, each resolving its own name', async () => {
    createAppRoot()
    const wrapper = track(mount(StackHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    const ids = Array.from(document.body.querySelectorAll('.modal-title')).map((el) => el.id)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])

    // The real symptom of the duplicate id: the second dialog's accessible name
    // resolved to the FIRST dialog's title.
    const names = panels().map((p) =>
      document.getElementById(p.getAttribute('aria-labelledby')!)?.textContent?.trim()
    )
    expect(names).toEqual(['Outer dialog', 'Inner dialog'])
  })

  it('closes only the topmost dialog on Escape', async () => {
    createAppRoot()
    const wrapper = track(mount(StackHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()
    expect(panels()).toHaveLength(2)

    pressEscape()
    await wrapper.vm.$nextTick()

    // Both instances hear the same document-level keydown; only the top may act.
    expect((wrapper.vm as any).inner).toBe(false)
    expect((wrapper.vm as any).outer).toBe(true)
    // The closed panel lingers in the DOM for the leave transition, so state and
    // the background locks are the honest signal here, not node counts.
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(appRoot().hasAttribute('inert')).toBe(true)

    pressEscape()
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).outer).toBe(false)
    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(appRoot().hasAttribute('inert')).toBe(false)
  })

  it('keeps the scroll lock while an outer dialog is still open', async () => {
    createAppRoot()
    const wrapper = track(mount(StackHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()
    expect(document.body.classList.contains('modal-open')).toBe(true)

    ;(wrapper.vm as any).inner = false
    await wrapper.vm.$nextTick()

    // The lock used to be removed unconditionally, unlocking the page behind a
    // dialog that was still open.
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(appRoot().hasAttribute('inert')).toBe(true)

    ;(wrapper.vm as any).outer = false
    await wrapper.vm.$nextTick()
    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(appRoot().hasAttribute('inert')).toBe(false)
  })

  it('traps focus inside the topmost dialog, not the one underneath', async () => {
    createAppRoot()
    const wrapper = track(mount(StackHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    const top = panels()[1]
    for (let i = 0; i < 12; i++) {
      emulateTab()
      expect(top.contains(document.activeElement)).toBe(true)
    }
  })
})

describe('BaseDialog dialog semantics', () => {
  it('puts role, aria-modal and aria-labelledby on the panel, not the scrim', async () => {
    createAppRoot()
    const wrapper = track(mount(SingleHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    const overlay = document.body.querySelector<HTMLElement>('.modal-overlay')!
    const content = document.body.querySelector<HTMLElement>('.modal-content')!

    // The scrim is the full viewport; naming it as the dialog made the dialog
    // boundary the whole screen.
    expect(overlay.getAttribute('role')).toBeNull()
    expect(overlay.getAttribute('aria-modal')).toBeNull()
    expect(overlay.getAttribute('aria-labelledby')).toBeNull()

    expect(content.getAttribute('role')).toBe('dialog')
    expect(content.getAttribute('aria-modal')).toBe('true')
    expect(content.querySelector(`#${content.getAttribute('aria-labelledby')}`)?.textContent?.trim()).toBe(
      'Dialog title'
    )
  })

  it('honours closeOnEscape=false and does not leak Escape to a dialog underneath', async () => {
    createAppRoot()
    const Blocking = defineComponent({
      setup() {
        const outer = ref(true)
        const blocking = ref(true)
        return { outer, blocking }
      },
      render() {
        return h('div', [
          h(
            BaseDialog,
            { show: this.outer, title: 'Outer', onClose: () => (this.outer = false) },
            { default: () => h('input', { id: 'outer-field' }) }
          ),
          h(
            BaseDialog,
            {
              show: this.blocking,
              title: 'Blocking',
              zIndex: 80,
              closeOnEscape: false,
              onClose: () => (this.blocking = false)
            },
            { default: () => h('input', { id: 'blocking-field' }) }
          )
        ])
      }
    })

    const wrapper = track(mount(Blocking, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await wrapper.vm.$nextTick()

    pressEscape()
    await wrapper.vm.$nextTick()

    // AdminComplianceDialog relies on this: Escape must neither close it nor
    // fall through to whatever is underneath.
    expect((wrapper.vm as any).blocking).toBe(true)
    expect((wrapper.vm as any).outer).toBe(true)
  })
})
