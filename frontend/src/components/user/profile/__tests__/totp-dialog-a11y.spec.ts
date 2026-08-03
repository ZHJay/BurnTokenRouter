/**
 * TotpSetupModal and TotpDisableDialog were the two TOTP dialogs that focused
 * nothing at all: no role, no aria-modal, no Escape, no focus trap, no focus
 * restore, no scroll lock. Both now render through BaseDialog.
 *
 * Both load their verification method asynchronously, which is why they call
 * BaseDialog's exposed `focusInitial()` again once the fields exist — until then
 * there is nothing for `initial-focus` to match.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import TotpSetupModal from '@/components/user/profile/TotpSetupModal.vue'
import TotpDisableDialog from '@/components/user/profile/TotpDisableDialog.vue'

const mocks = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  getVerificationMethod: vi.fn(),
  sendVerifyCode: vi.fn(),
  initiateSetup: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn()
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showSuccess: mocks.showSuccess, showError: mocks.showError })
}))
vi.mock('@/api', () => ({
  totpAPI: {
    getVerificationMethod: mocks.getVerificationMethod,
    sendVerifyCode: mocks.sendVerifyCode,
    initiateSetup: mocks.initiateSetup,
    enable: mocks.enable,
    disable: mocks.disable
  }
}))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,x') } }))

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
  await nextTick()
}

const panel = () => {
  const el = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (!el) throw new Error('dialog panel not found')
  return el
}

const accessibleName = () =>
  document.getElementById(panel().getAttribute('aria-labelledby') || '')?.textContent?.trim()

const pressEscape = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))

function createAppRoot() {
  const root = document.createElement('div')
  root.id = 'app'
  root.innerHTML = '<button id="invoker">manage 2FA</button>'
  document.body.appendChild(root)
  return root
}

const appRoot = () => document.getElementById('app')!

let wrapper: VueWrapper<any> | null = null

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.getVerificationMethod.mockResolvedValue({ method: 'password' })
  mocks.initiateSetup.mockResolvedValue({
    qr_code_url: 'otpauth://totp/Sub2API:test?secret=ABC123',
    secret: 'ABC123',
    setup_token: 'setup-token'
  })
  mocks.enable.mockResolvedValue({ success: true })
  mocks.disable.mockResolvedValue({ success: true })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  document.body.className = ''
})

describe('TotpSetupModal accessibility', () => {
  it('is a modal dialog named by its own title, and locks the background', async () => {
    createAppRoot()
    wrapper = mount(TotpSetupModal, { attachTo: appRoot() })
    await flush()

    expect(panel().getAttribute('aria-modal')).toBe('true')
    expect(accessibleName()).toBe('profile.totp.setupTitle')
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(appRoot().hasAttribute('inert')).toBe(true)
  })

  it('focuses the verification field once it has loaded, not the close button', async () => {
    createAppRoot()
    wrapper = mount(TotpSetupModal, { attachTo: appRoot() })
    await flush()

    const field = panel().querySelector<HTMLInputElement>('input[type="password"]')
    expect(field).toBeTruthy()
    expect(document.activeElement).toBe(field)
  })

  it('closes on Escape', async () => {
    createAppRoot()
    wrapper = mount(TotpSetupModal, { attachTo: appRoot() })
    await flush()

    pressEscape()
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('releases the background locks and restores focus when unmounted while open', async () => {
    createAppRoot()
    const invoker = document.getElementById('invoker') as HTMLButtonElement
    invoker.focus()

    wrapper = mount(TotpSetupModal, { attachTo: appRoot() })
    await flush()
    expect(document.body.classList.contains('modal-open')).toBe(true)

    // ProfileTotpCard closes this by removing it from the tree, not by a prop.
    wrapper.unmount()
    wrapper = null

    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(appRoot().hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(invoker)
  })

  it('moves focus to the first code cell when the verify step opens', async () => {
    createAppRoot()
    wrapper = mount(TotpSetupModal, { attachTo: appRoot() })
    await flush()

    panel().querySelector<HTMLInputElement>('input[type="password"]')!.value = 'pw'
    panel().querySelector<HTMLInputElement>('input[type="password"]')!.dispatchEvent(new Event('input'))
    await flush()
    panel().querySelector<HTMLButtonElement>('button.btn-primary')!.click()
    await flush()

    // Step 1 -> step 2: the whole body swaps out, so focus has to be re-placed.
    const next = Array.from(panel().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      (b.textContent || '').includes('common.next')
    )
    next!.click()
    await flush()

    const firstCell = panel().querySelector<HTMLInputElement>('[data-otp-cell="0"]')
    expect(firstCell).toBeTruthy()
    expect(document.activeElement).toBe(firstCell)
  })
})

describe('TotpDisableDialog accessibility', () => {
  it('is a modal dialog named by its own title, and locks the background', async () => {
    createAppRoot()
    wrapper = mount(TotpDisableDialog, { attachTo: appRoot() })
    await flush()

    expect(panel().getAttribute('aria-modal')).toBe('true')
    expect(accessibleName()).toBe('profile.totp.disableTitle')
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(appRoot().hasAttribute('inert')).toBe(true)
  })

  it('focuses the password field once it has loaded', async () => {
    createAppRoot()
    wrapper = mount(TotpDisableDialog, { attachTo: appRoot() })
    await flush()

    expect(document.activeElement).toBe(panel().querySelector('input[type="password"]'))
  })

  it('closes on Escape', async () => {
    createAppRoot()
    wrapper = mount(TotpDisableDialog, { attachTo: appRoot() })
    await flush()

    pressEscape()
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('still submits and reports success', async () => {
    createAppRoot()
    wrapper = mount(TotpDisableDialog, { attachTo: appRoot() })
    await flush()

    const field = panel().querySelector<HTMLInputElement>('input[type="password"]')!
    field.value = 'correct horse battery staple'
    field.dispatchEvent(new Event('input'))
    await flush()

    panel().querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true })
    )
    await flush()

    expect(mocks.disable).toHaveBeenCalledWith({ password: 'correct horse battery staple' })
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
})
