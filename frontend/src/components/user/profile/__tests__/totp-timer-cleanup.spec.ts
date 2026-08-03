import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
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

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showSuccess: mocks.showSuccess,
    showError: mocks.showError
  })
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

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

/**
 * Both dialogs now render through BaseDialog, which teleports to <body>, so the
 * panel is outside the wrapper's element tree and `wrapper.find` cannot see it.
 * These helpers query where the markup actually lands.
 */
const panel = () => {
  const el = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (!el) throw new Error('dialog panel not found in document.body')
  return el
}

const panelButton = (text: string) =>
  Array.from(panel().querySelectorAll('button')).find((b) => (b.textContent || '').includes(text))

const setValue = async (el: HTMLInputElement, value: string) => {
  el.value = value
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('TOTP 弹窗定时器清理', () => {
  let intervalSeed = 1000
  let setIntervalSpy: ReturnType<typeof vi.spyOn>
  let clearIntervalSpy: ReturnType<typeof vi.spyOn>
  let mounted: VueWrapper<any> | null = null

  beforeEach(() => {
    intervalSeed = 1000
    mocks.showSuccess.mockReset()
    mocks.showError.mockReset()
    mocks.getVerificationMethod.mockReset()
    mocks.sendVerifyCode.mockReset()
    mocks.initiateSetup.mockReset()
    mocks.enable.mockReset()
    mocks.disable.mockReset()

    mocks.getVerificationMethod.mockResolvedValue({ method: 'email' })
    mocks.sendVerifyCode.mockResolvedValue({ success: true })
    mocks.initiateSetup.mockResolvedValue({
      qr_code_url: 'otpauth://totp/Sub2API:test?secret=ABC123',
      secret: 'ABC123',
      setup_token: 'setup-token'
    })
    mocks.enable.mockResolvedValue({ success: true })
    mocks.disable.mockResolvedValue({ success: true })

    setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler) => {
      void handler
      intervalSeed += 1
      return intervalSeed as unknown as number
    }) as typeof window.setInterval)
    clearIntervalSpy = vi.spyOn(window, 'clearInterval')
  })

  afterEach(() => {
    setIntervalSpy.mockRestore()
    clearIntervalSpy.mockRestore()
    // Teleported panels outlive the wrapper's own element, so unmount explicitly
    // and clear anything left behind before the next test queries <body>.
    mounted?.unmount()
    mounted = null
    document.body.innerHTML = ''
    document.body.className = ''
  })

  it('TotpSetupModal 卸载时清理倒计时定时器', async () => {
    const wrapper = mount(TotpSetupModal)
    mounted = wrapper
    await flushPromises()

    const sendButton = panelButton('profile.totp.sendCode')

    expect(sendButton).toBeTruthy()
    sendButton!.click()
    await flushPromises()

    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    const timerId = setIntervalSpy.mock.results[0]?.value

    wrapper.unmount()
    mounted = null

    expect(clearIntervalSpy).toHaveBeenCalledWith(timerId)
  })

  it('TotpDisableDialog 卸载时清理倒计时定时器', async () => {
    const wrapper = mount(TotpDisableDialog)
    mounted = wrapper
    await flushPromises()

    const sendButton = panelButton('profile.totp.sendCode')

    expect(sendButton).toBeTruthy()
    sendButton!.click()
    await flushPromises()

    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    const timerId = setIntervalSpy.mock.results[0]?.value

    wrapper.unmount()
    mounted = null

    expect(clearIntervalSpy).toHaveBeenCalledWith(timerId)
  })

  it('TotpSetupModal 失败时改用 toast 并不渲染内联错误', async () => {
    mocks.getVerificationMethod.mockResolvedValue({ method: 'password' })
    mocks.initiateSetup.mockRejectedValue({
      response: { data: { message: 'setup failed' } }
    })

    const wrapper = mount(TotpSetupModal)
    mounted = wrapper
    await flushPromises()

    await setValue(
      panel().querySelector<HTMLInputElement>('input[type="password"]')!,
      'correct horse battery staple'
    )
    panel().querySelector<HTMLButtonElement>('button[type="button"].btn-primary')!.click()
    await flushPromises()

    expect(mocks.showError).toHaveBeenCalledWith('setup failed')
    expect(panel().textContent).not.toContain('setup failed')
    expect(panel().querySelector('.bg-red-50')).toBeNull()
  })

  it('TotpDisableDialog 失败时改用 toast 并不渲染内联错误', async () => {
    mocks.getVerificationMethod.mockResolvedValue({ method: 'password' })
    mocks.disable.mockRejectedValue({
      response: { data: { message: 'disable failed' } }
    })

    const wrapper = mount(TotpDisableDialog)
    mounted = wrapper
    await flushPromises()

    await setValue(
      panel().querySelector<HTMLInputElement>('input[type="password"]')!,
      'correct horse battery staple'
    )
    panel().querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true })
    )
    await flushPromises()

    expect(mocks.showError).toHaveBeenCalledWith('disable failed')
    expect(panel().textContent).not.toContain('disable failed')
    expect(panel().querySelector('.bg-red-50')).toBeNull()
  })
})
