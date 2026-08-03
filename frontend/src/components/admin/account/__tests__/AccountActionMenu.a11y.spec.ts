/**
 * Keyboard and focus contract for the teleported row action menu.
 *
 * Why this menu specifically: it renders into <body> while its trigger stays in
 * a table row, so before this work its 10 destructive actions (test connection,
 * re-authorize, refresh token, reset quota, recover state, …) sat at the END of
 * the document tab order. Reaching them from the trigger meant tabbing through
 * the rest of the page.
 *
 * These assertions are about behaviour that a keyboard user can observe — where
 * focus is, and where it goes back to — not about which classes are present.
 * The leave *animation* is deliberately NOT asserted here: see the note at the
 * bottom of this file.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import AccountActionMenu from '../AccountActionMenu.vue'
import type { Account } from '@/types'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'test-account',
    platform: 'anthropic',
    type: 'oauth',
    proxy_id: null,
    concurrency: 3,
    priority: 50,
    status: 'active',
    error_message: null,
    last_used_at: null,
    expires_at: null,
    auto_pause_on_expired: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    schedulable: true,
    rate_limited_at: null,
    rate_limit_reset_at: null,
    overload_until: null,
    temp_unschedulable_until: null,
    temp_unschedulable_reason: null,
    session_window_start: null,
    session_window_end: null,
    session_window_status: null,
    ...overrides,
  } as Account
}

const position = { top: 100, left: 100 }

const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]')
const items = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))

/** A trigger outside the menu, standing in for the table row's button. */
let trigger: HTMLButtonElement

beforeEach(() => {
  trigger = document.createElement('button')
  trigger.textContent = 'row trigger'
  document.body.appendChild(trigger)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AccountActionMenu · menu semantics', () => {
  it('exposes role=menu with every action as a menuitem', () => {
    const wrapper = mount(AccountActionMenu, {
      props: { show: true, account: makeAccount(), position },
      attachTo: document.body,
    })

    expect(menu()).not.toBeNull()
    // Every actionable row must be reachable as a menuitem, so a screen reader
    // announces "menu, N items" instead of a pile of unrelated buttons.
    const actionButtons = Array.from(
      menu()!.querySelectorAll<HTMLElement>('button')
    )
    expect(actionButtons.length).toBeGreaterThan(0)
    expect(items().length).toBe(actionButtons.length)

    wrapper.unmount()
  })

  it('hides the mouse-only backdrop from assistive technology', () => {
    const wrapper = mount(AccountActionMenu, {
      props: { show: true, account: makeAccount(), position },
      attachTo: document.body,
    })

    // The backdrop has a click handler and no keyboard equivalent; Escape is the
    // keyboard path. Announcing it would offer an action that cannot be taken.
    const backdrop = document.body.querySelector('.fixed.inset-0')
    expect(backdrop).not.toBeNull()
    expect(backdrop!.getAttribute('aria-hidden')).toBe('true')

    wrapper.unmount()
  })
})

describe('AccountActionMenu · focus', () => {
  it('moves focus to the first item on open', async () => {
    trigger.focus()
    const wrapper = mount(AccountActionMenu, {
      props: { show: false, account: makeAccount(), position },
      attachTo: document.body,
    })

    await wrapper.setProps({ show: true })
    await nextTick()

    expect(items().length).toBeGreaterThan(0)
    expect(document.activeElement).toBe(items()[0])

    wrapper.unmount()
  })

  it('restores focus to the trigger when it closes', async () => {
    trigger.focus()
    const wrapper = mount(AccountActionMenu, {
      props: { show: false, account: makeAccount(), position },
      attachTo: document.body,
    })

    await wrapper.setProps({ show: true })
    await nextTick()
    expect(document.activeElement).not.toBe(trigger)

    await wrapper.setProps({ show: false })
    await nextTick()

    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('leaves focus alone when something else has already claimed it', async () => {
    // Every item emits its action *and* close, and several of those actions open
    // a dialog that takes focus in the same tick. Restoring unconditionally would
    // yank focus out of the dialog that just opened.
    trigger.focus()
    const wrapper = mount(AccountActionMenu, {
      props: { show: false, account: makeAccount(), position },
      attachTo: document.body,
    })
    await wrapper.setProps({ show: true })
    await nextTick()

    const dialogInput = document.createElement('input')
    document.body.appendChild(dialogInput)
    dialogInput.focus()

    await wrapper.setProps({ show: false })
    await nextTick()

    expect(document.activeElement).toBe(dialogInput)
    wrapper.unmount()
  })

  it('restores focus on unmount, for a parent that unmounts instead of closing', async () => {
    trigger.focus()
    const wrapper = mount(AccountActionMenu, {
      props: { show: true, account: makeAccount(), position },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.activeElement).not.toBe(trigger)

    wrapper.unmount()
    expect(document.activeElement).toBe(trigger)
  })

  it('focuses without scrolling the trigger back into view', async () => {
    /*
     * Regression guard with a measured cause. The menu is fixed-position and
     * teleported, but the trigger lives inside `.table-wrapper`, a scroll
     * container — and both AccountsView and UsersView close the row menu on any
     * scroll. A plain focus() asks the browser to reveal the focused node, which
     * fired a scroll and closed the menu on the frame after it opened. Verified
     * in Chromium: click -> MENU ADDED -> focus -> scroll(.table-wrapper) ->
     * MENU REMOVED.
     *
     * jsdom does not implement scrolling, so the observable fact here is the
     * option we pass, which is the thing that was wrong.
     */
    const wrapper = mount(AccountActionMenu, {
      props: { show: false, account: makeAccount(), position },
      attachTo: document.body,
    })
    await wrapper.setProps({ show: true })
    await nextTick()

    const first = items()[0]
    const focusSpy = vi.spyOn(first, 'focus')
    // Re-focus through the menu's own keyboard path.
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    focusSpy.mockRestore()
    wrapper.unmount()
  })
})

describe('AccountActionMenu · keyboard', () => {
  const press = (key: string, shiftKey = false) =>
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }))

  it('walks items with ArrowDown/ArrowUp and wraps at both ends', async () => {
    const wrapper = mount(AccountActionMenu, {
      props: { show: true, account: makeAccount(), position },
      attachTo: document.body,
    })
    await nextTick()

    const list = items()
    expect(list.length).toBeGreaterThan(2)
    expect(document.activeElement).toBe(list[0])

    press('ArrowDown')
    expect(document.activeElement).toBe(list[1])

    press('ArrowUp')
    expect(document.activeElement).toBe(list[0])

    // Wrapping: up from the first item lands on the last.
    press('ArrowUp')
    expect(document.activeElement).toBe(list[list.length - 1])

    press('ArrowDown')
    expect(document.activeElement).toBe(list[0])

    wrapper.unmount()
  })

  it('jumps to the first and last item with Home/End', async () => {
    const wrapper = mount(AccountActionMenu, {
      props: { show: true, account: makeAccount(), position },
      attachTo: document.body,
    })
    await nextTick()
    const list = items()

    press('End')
    expect(document.activeElement).toBe(list[list.length - 1])

    press('Home')
    expect(document.activeElement).toBe(list[0])

    wrapper.unmount()
  })

  it('traps Tab inside the menu instead of letting it fall to the page', async () => {
    const after = document.createElement('button')
    document.body.appendChild(after)

    const wrapper = mount(AccountActionMenu, {
      props: { show: true, account: makeAccount(), position },
      attachTo: document.body,
    })
    await nextTick()
    const list = items()

    press('Tab')
    expect(document.activeElement).toBe(list[1])

    press('Tab', true)
    expect(document.activeElement).toBe(list[0])

    // From the first item, Shift+Tab wraps to the last rather than escaping to
    // the document — the whole point of the trap.
    press('Tab', true)
    expect(document.activeElement).toBe(list[list.length - 1])
    expect(document.activeElement).not.toBe(after)

    wrapper.unmount()
  })

  it('emits close on Escape', async () => {
    const wrapper = mount(AccountActionMenu, {
      props: { show: true, account: makeAccount(), position },
      attachTo: document.body,
    })
    await nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()

    wrapper.unmount()
  })
})

/*
 * NOT asserted here, on purpose: that the menu animates out.
 *
 * A truthful leave-animation assertion would be "the element is still in the DOM
 * more than one frame after close, with a non-`none` computed animation" — and
 * jsdom has no layout, no compositor and no CSS animation clock, so both halves
 * would be measuring the test double rather than the app. Worse, src/__tests__/
 * setup.ts stubs matchMedia to answer `matches: true` for EVERY query, so
 * prefers-reduced-motion reads as ON unless a test overrides it — a "motion" test
 * that merely mounts takes the instant path and passes while testing nothing.
 *
 * The enter/leave motion for this menu was verified in Chromium instead. Measured
 * there: computed animation-name `none` (the intrinsic `animate-scale-in` is
 * correctly suppressed by `animate-none`, so the <transition> is the single
 * owner), transition-duration 0.24s, and the panel still painted one frame after
 * close before being removed.
 */
