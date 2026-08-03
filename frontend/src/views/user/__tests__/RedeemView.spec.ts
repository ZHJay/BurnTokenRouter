import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RedeemView from '../RedeemView.vue'

const { redeem, getHistory, getPublicSettings, refreshUser, showError, showSuccess } = vi.hoisted(
  () => ({
    redeem: vi.fn(),
    getHistory: vi.fn(),
    getPublicSettings: vi.fn(),
    refreshUser: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn(),
  }),
)

vi.mock('@/api', () => ({
  redeemAPI: { redeem, getHistory },
  authAPI: { getPublicSettings },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { balance: 248.74, concurrency: 16 },
    refreshUser,
  }),
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess, showWarning: vi.fn() }),
}))

vi.mock('@/stores/subscriptions', () => ({
  useSubscriptionStore: () => ({ fetchActiveSubscriptions: vi.fn() }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

function mountView() {
  return mount(RedeemView, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        Icon: true,
      },
    },
  })
}

describe('RedeemView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getHistory.mockResolvedValue([])
    getPublicSettings.mockResolvedValue({ contact_info: 'support@example.com' })
    refreshUser.mockResolvedValue(undefined)
  })

  it('renders the balance hero as an opaque content card, not a saturated fill', async () => {
    const wrapper = mountView()
    await flushPromises()

    const hero = wrapper.get('[data-testid="redeem-balance-card"]')
    // Opaque elevation: content cards are `.card`, glass/colour-flood is reserved
    // for chrome. `bg-primary-600` on this surface put white text at 4.02:1.
    expect(hero.classes()).toEqual(expect.arrayContaining(['card', 'p-4']))
    const heroMarkup = hero.html()
    expect(heroMarkup).not.toContain('bg-primary-600')
    expect(heroMarkup).not.toContain('bg-primary-500')
    expect(heroMarkup).not.toContain('bg-primary-400')
    expect(heroMarkup).not.toContain('text-primary-100')
    expect(heroMarkup).not.toContain('text-white')
    expect(heroMarkup).not.toContain('text-4xl')

    // Same skeleton as the shipped UserDashboardStats balance card.
    expect(hero.get('div').classes()).toEqual(
      expect.arrayContaining(['flex', 'items-start', 'justify-between', 'gap-3']),
    )
    expect(hero.get('.stat-label').text()).toBe('redeem.currentBalance')

    const value = hero.get('.stat-value')
    expect(value.text()).toBe('$248.74')
    // A real per-theme pair, so dark mode is not a near-identical blue.
    expect(value.classes()).toEqual(
      expect.arrayContaining(['text-green-600', 'dark:text-green-400']),
    )

    const tile = hero.get('.stat-icon')
    expect(tile.classes()).toEqual(
      expect.arrayContaining(['stat-icon-success', 'h-8', 'w-8', 'shrink-0', 'text-base']),
    )
  })

  it('gives the disabled CTA an inert opaque state instead of faint blue', async () => {
    const wrapper = mountView()
    await flushPromises()

    const cta = wrapper.get('button[type="submit"]')
    // btn-lg is 44px by definition, so the py-3 override is gone.
    expect(cta.classes()).toEqual(
      expect.arrayContaining(['btn', 'btn-primary', 'btn-lg', 'w-full']),
    )
    expect(cta.classes()).not.toContain('py-3')

    // .btn's base disabled:opacity-40 measured 1.26:1 on both layers.
    expect(cta.classes()).toEqual(
      expect.arrayContaining([
        'disabled:opacity-100',
        'disabled:bg-[var(--surface-secondary)]',
        'disabled:text-[var(--label-tertiary)]',
        'disabled:shadow-none',
      ]),
    )
    expect(cta.attributes('disabled')).toBeDefined()

    await wrapper.get('input#code').setValue('CODE-1')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('keeps the informational panel neutral and opaque', async () => {
    const wrapper = mountView()
    await flushPromises()

    const info = wrapper.get('[data-testid="redeem-info-card"]')
    // primary-700 on primary-50 was 4.23:1 — blue-on-blue and failing.
    expect(info.classes()).toEqual(expect.arrayContaining(['card-inset', 'p-4']))
    expect(info.html()).not.toContain('bg-primary-50')
    expect(info.html()).not.toContain('text-primary-700')

    expect(info.get('h3').classes()).toEqual(
      expect.arrayContaining(['text-sm', 'font-semibold', 'text-gray-900', 'dark:text-white']),
    )
    expect(info.get('ul').classes()).toEqual(
      expect.arrayContaining(['text-sm', 'text-gray-600', 'dark:text-gray-300']),
    )
    // Blue survives only as the tinted icon tile.
    expect(info.get('.stat-icon').classes()).toEqual(
      expect.arrayContaining(['stat-icon-primary', 'h-10', 'w-10']),
    )
  })

  it('keeps semantic state colouring on the success card after a redeem', async () => {
    redeem.mockResolvedValue({
      message: 'ok',
      type: 'balance',
      value: 10,
      new_balance: 258.74,
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('input#code').setValue('GOOD-CODE')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(redeem).toHaveBeenCalledWith('GOOD-CODE')
    expect(refreshUser).toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
    // Emerald tint stays: semantic state colour is correct here and passes.
    expect(wrapper.html()).toContain('redeem.redeemSuccess')
    expect(wrapper.html()).toContain('bg-emerald-50')
    // Input is cleared, so the CTA returns to its inert disabled state.
    expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe('')
  })

  it('renders the error card when redemption fails', async () => {
    redeem.mockRejectedValue({ response: { data: { detail: 'Code already used' } } })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('input#code').setValue('BAD-CODE')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Code already used')
    expect(wrapper.html()).toContain('bg-red-50')
    expect(showError).toHaveBeenCalledWith('redeem.redeemFailed')
  })

  it('drops the oversized input overrides but keeps the icon inset', async () => {
    const wrapper = mountView()
    await flushPromises()

    const input = wrapper.get('input#code')
    expect(input.classes()).toEqual(expect.arrayContaining(['input', 'pl-12']))
    expect(input.classes()).not.toContain('py-3')
    expect(input.classes()).not.toContain('text-lg')
  })
})
