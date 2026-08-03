import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TotpLoginModal from '@/components/auth/TotpLoginModal.vue'

const { showErrorMock } = vi.hoisted(() => ({
  showErrorMock: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    showError: (...args: any[]) => showErrorMock(...args),
  }),
}))

describe('TotpLoginModal', () => {
  let mounted: VueWrapper<any> | null = null

  beforeEach(() => {
    showErrorMock.mockReset()
  })

  afterEach(() => {
    // BaseDialog teleports to <body>; drop the panel so the next test starts clean.
    mounted?.unmount()
    mounted = null
    document.body.innerHTML = ''
    document.body.className = ''
  })

  const panel = () => {
    const el = document.body.querySelector<HTMLElement>('[role="dialog"]')
    if (!el) throw new Error('dialog panel not found in document.body')
    return el
  }

  const mountModal = () => {
    const wrapper = mount(TotpLoginModal, {
      props: {
        tempToken: 'temp-token',
        userEmailMasked: 'u***@example.com'
      },
      attachTo: document.body
    })
    mounted = wrapper
    return wrapper
  }

  it('sends verification errors to toast and does not render inline red text', async () => {
    const wrapper = mountModal()

    ;(wrapper.vm as unknown as { setError: (message: string) => void }).setError('Invalid code')
    await wrapper.vm.$nextTick()

    expect(showErrorMock).toHaveBeenCalledWith('Invalid code')
    expect(panel().textContent).not.toContain('Invalid code')
    expect(panel().querySelector('.bg-red-50')).toBeNull()
  })

  // Task 6: this dialog is on the login path. Before it went through BaseDialog it
  // had no role, no aria-modal, no Escape and no focus restore.
  it('announces itself as a modal dialog named by its own title', () => {
    mountModal()

    const dialog = panel()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // The name has to come from this dialog's title element, not another's.
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const name = dialog.querySelector(`#${labelledBy}`)
    expect(name?.textContent?.trim()).toBe('profile.totp.loginTitle')
  })

  it('puts initial focus on the first OTP cell, not the first focusable element', async () => {
    const wrapper = mountModal()
    await wrapper.vm.$nextTick()

    const firstCell = panel().querySelector<HTMLInputElement>('[data-otp-cell="0"]')
    expect(firstCell).toBeTruthy()
    expect(document.activeElement).toBe(firstCell)
  })

  it('cancels on Escape but not while a code is being verified', async () => {
    const wrapper = mountModal()
    await wrapper.vm.$nextTick()

    ;(wrapper.vm as unknown as { setVerifying: (v: boolean) => void }).setVerifying(true)
    await wrapper.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    // Cancelling mid-verification would abandon an in-flight request.
    expect(wrapper.emitted('cancel')).toBeUndefined()

    ;(wrapper.vm as unknown as { setVerifying: (v: boolean) => void }).setVerifying(false)
    await wrapper.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('still auto-submits the code once six digits are entered', async () => {
    const wrapper = mountModal()
    await wrapper.vm.$nextTick()

    const cells = Array.from(
      panel().querySelectorAll<HTMLInputElement>('[data-otp-cell]')
    )
    expect(cells).toHaveLength(6)

    for (const [index, cell] of cells.entries()) {
      cell.value = String(index + 1)
      cell.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()
    }

    expect(wrapper.emitted('verify')).toEqual([['123456']])
  })

  // The scrim moved onto BaseDialog's .modal-overlay specifically so the
  // prefers-reduced-transparency / prefers-contrast `!important` lists can reach
  // it. As an inline style attribute on a bare div, nothing in the cascade could.
  it('renders its scrim as .modal-overlay with no inline background or blur', () => {
    mountModal()

    const overlay = document.body.querySelector<HTMLElement>('.modal-overlay')
    expect(overlay).toBeTruthy()
    // Asserting on the attribute, not the CSSStyleDeclaration: jsdom does not
    // implement backdrop-filter, so `style.backdropFilter` reads undefined here
    // whether or not the declaration is present.
    expect(overlay!.getAttribute('style')).toBeNull()
    // And no leftover hand-rolled scrim that the preference queries cannot target.
    expect(document.body.querySelector('[style*="backdrop-filter"]')).toBeNull()
  })
})
