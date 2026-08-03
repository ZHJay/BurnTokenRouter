/**
 * Step-up 2FA gates privileged admin actions and is mounted from five places:
 * BackupView, AccountsView, SettingsView, UserEditModal and UserCreateModal.
 * Two of those hosts are themselves BaseDialogs, so this dialog has to work both
 * standalone and stacked on top of an already-open dialog.
 *
 * Before it went through BaseDialog it had no role, no aria-modal, no Escape, no
 * focus trap, no focus restore and no scroll lock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import TotpStepUpDialog from '@/components/auth/TotpStepUpDialog.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { useStepUp } from '@/composables/useStepUp'

const mocks = vi.hoisted(() => ({
  showError: vi.fn(),
  stepUp: vi.fn()
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores', () => ({ useAppStore: () => ({ showError: mocks.showError }) }))
vi.mock('@/api', () => ({ totpAPI: { stepUp: mocks.stepUp } }))

const panels = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="dialog"]'))

/** The step-up panel is the one titled by stepUp.title. */
const stepUpPanel = () => {
  const found = panels().find((p) => {
    const id = p.getAttribute('aria-labelledby')
    return document.getElementById(id || '')?.textContent?.includes('stepUp.title')
  })
  if (!found) throw new Error('step-up panel not found')
  return found
}

const cells = () => Array.from(stepUpPanel().querySelectorAll<HTMLInputElement>('[data-otp-cell]'))

const typeCode = async (code: string) => {
  for (const [index, cell] of cells().entries()) {
    cell.value = code[index] ?? ''
    cell.dispatchEvent(new Event('input'))
    await nextTick()
  }
}

const pressEscape = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))

function createAppRoot() {
  const root = document.createElement('div')
  root.id = 'app'
  root.innerHTML = '<button id="bg-1">background</button>'
  document.body.appendChild(root)
  return root
}

const appRoot = () => document.getElementById('app')!

/** Caller 1: a plain view, e.g. BackupView / AccountsView / SettingsView. */
const ViewHost = defineComponent({
  setup() {
    const stepUp = useStepUp()
    return { stepUp }
  },
  render() {
    return h('div', [
      h('button', { id: 'invoker', onClick: () => this.stepUp.prompt() }, 'export'),
      h(TotpStepUpDialog, { controller: this.stepUp })
    ])
  }
})

/** Caller 2: mounted inside an already-open BaseDialog, e.g. UserEditModal. */
const NestedDialogHost = defineComponent({
  setup() {
    const stepUp = useStepUp()
    return { stepUp }
  },
  render() {
    return h('div', [
      h(
        BaseDialog,
        { show: true, title: 'Edit user', zIndex: 50 },
        {
          default: () => [
            h('input', { id: 'user-name' }),
            h('button', { id: 'save', onClick: () => this.stepUp.prompt() }, 'save')
          ]
        }
      ),
      h(TotpStepUpDialog, { controller: this.stepUp })
    ])
  }
})

let wrappers: VueWrapper<any>[] = []
const track = <T extends VueWrapper<any>>(w: T): T => {
  wrappers.push(w)
  return w
}

beforeEach(() => {
  mocks.showError.mockReset()
  mocks.stepUp.mockReset()
  mocks.stepUp.mockResolvedValue({ success: true })
})

afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
  document.body.innerHTML = ''
  document.body.className = ''
})

describe('TotpStepUpDialog from a view caller', () => {
  it('stays closed until the controller prompts', async () => {
    createAppRoot()
    const wrapper = track(mount(ViewHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    await nextTick()

    expect(panels()).toHaveLength(0)
    expect(document.body.classList.contains('modal-open')).toBe(false)

    ;(wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()

    expect(panels()).toHaveLength(1)
    expect(stepUpPanel().getAttribute('aria-modal')).toBe('true')
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(appRoot().hasAttribute('inert')).toBe(true)
  })

  it('focuses the first OTP cell on open via initialFocus', async () => {
    createAppRoot()
    const wrapper = track(mount(ViewHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    ;(wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()

    // Not the close button, and not the hidden autofill input.
    expect(document.activeElement).toBe(cells()[0])
  })

  it('restores focus to the invoking control after cancelling', async () => {
    createAppRoot()
    const wrapper = track(mount(ViewHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    const invoker = document.getElementById('invoker') as HTMLButtonElement
    invoker.focus()

    ;(wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()
    expect(stepUpPanel().contains(document.activeElement)).toBe(true)

    pressEscape()
    await nextTick()

    expect((wrapper.vm as any).stepUp.visible.value).toBe(false)
    expect(document.activeElement).toBe(invoker)
    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(appRoot().hasAttribute('inert')).toBe(false)
  })

  it('auto-submits six digits and resolves the controller', async () => {
    createAppRoot()
    const wrapper = track(mount(ViewHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    const promise = (wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()

    await typeCode('123456')
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(mocks.stepUp).toHaveBeenCalledWith('123456')
    await expect(promise).resolves.toBe(true)
    expect((wrapper.vm as any).stepUp.visible.value).toBe(false)
  })

  it('reports a rejected code through the toast and keeps the dialog open', async () => {
    mocks.stepUp.mockRejectedValue(new Error('bad code'))
    createAppRoot()
    const wrapper = track(mount(ViewHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } }))
    ;(wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()

    await typeCode('000000')
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(mocks.showError).toHaveBeenCalledWith('bad code')
    expect((wrapper.vm as any).stepUp.visible.value).toBe(true)
    expect(panels()).toHaveLength(1)
  })
})

describe('TotpStepUpDialog stacked on a dialog caller', () => {
  it('stacks above the host dialog with its own accessible name', async () => {
    createAppRoot()
    const wrapper = track(
      mount(NestedDialogHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } })
    )
    await nextTick()
    ;(wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()

    expect(panels()).toHaveLength(2)

    // Each dialog must name itself — the duplicate-id bug made the second one
    // resolve to the first one's title.
    const names = panels().map((p) =>
      document.getElementById(p.getAttribute('aria-labelledby')!)?.textContent?.trim()
    )
    expect(names).toEqual(['Edit user', 'stepUp.title'])
    expect(new Set(names).size).toBe(2)
  })

  it('takes Escape itself and leaves the host dialog open', async () => {
    createAppRoot()
    const wrapper = track(
      mount(NestedDialogHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } })
    )
    await nextTick()
    ;(wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()

    pressEscape()
    await nextTick()

    expect((wrapper.vm as any).stepUp.visible.value).toBe(false)
    // The host dialog is still open, so the page must stay locked and inert.
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(appRoot().hasAttribute('inert')).toBe(true)
  })

  it('does not cancel on Escape while a code is being verified', async () => {
    let release: (value: unknown) => void = () => {}
    mocks.stepUp.mockImplementation(() => new Promise((resolve) => (release = resolve)))

    createAppRoot()
    const wrapper = track(
      mount(NestedDialogHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } })
    )
    await nextTick()
    ;(wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()

    await typeCode('654321')
    await nextTick()

    pressEscape()
    await nextTick()
    // Cancelling here would abandon an in-flight verification.
    expect((wrapper.vm as any).stepUp.visible.value).toBe(true)

    release({ success: true })
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()
    expect((wrapper.vm as any).stepUp.visible.value).toBe(false)
  })

  it('renders its scrim as .modal-overlay with no inline blur declaration', async () => {
    createAppRoot()
    const wrapper = track(
      mount(NestedDialogHost, { attachTo: appRoot(), global: { stubs: { Icon: true } } })
    )
    ;(wrapper.vm as any).stepUp.prompt()
    await nextTick()
    await nextTick()

    // The old inline `backdrop-filter` outranked every rule in the cascade, so
    // neither prefers-reduced-transparency nor prefers-contrast could reach it.
    expect(document.body.querySelector('[style*="backdrop-filter"]')).toBeNull()
    expect(document.body.querySelectorAll('.modal-overlay').length).toBe(2)
  })
})
