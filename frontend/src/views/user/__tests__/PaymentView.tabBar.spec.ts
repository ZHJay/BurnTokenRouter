/**
 * Behaviour spec for the recharge/subscription tab bar (PaymentView ~11).
 *
 * The bar was hand-rolled `.tabs` / `.tab` / `.tab-active` markup with its own
 * `role="tablist"`, `role="tab"` and `:aria-selected` written at the call site.
 * It now delegates to the shared `Segmented`, which renders those roles itself
 * and paints selection with a travelling thumb instead of a background class.
 *
 * What is worth pinning here is the wiring, not Segmented's internals (those are
 * covered in components/common/__tests__/Segmented.spec.ts): that the segments
 * are real Segmented items, that activating one moves `activeTab` and therefore
 * swaps the visible panel, and that `item-class="flex-1"` still reaches the
 * segments — that class is the whole reason the two tabs fill the width, and it
 * is the one piece of the original layout that survives only as a prop.
 *
 * Mocking mirrors PaymentView.spec.ts (same stores, router, i18n and API), minus
 * the fixtures this file does not need.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import PaymentView from '../PaymentView.vue'
import type { CheckoutInfoResponse, MethodLimit } from '@/types/payment'

const routeState = vi.hoisted(() => ({
  path: '/purchase',
  query: {} as Record<string, unknown>,
}))

const routerReplace = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())
const routerResolve = vi.hoisted(() => vi.fn(() => ({ href: '/payment/stripe?mock=1' })))
const createOrder = vi.hoisted(() => vi.fn())
const refreshUser = vi.hoisted(() => vi.fn())
const fetchActiveSubscriptions = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const showError = vi.hoisted(() => vi.fn())
const showInfo = vi.hoisted(() => vi.fn())
const showWarning = vi.hoisted(() => vi.fn())
const getCheckoutInfo = vi.hoisted(() => vi.fn())

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({ replace: routerReplace, push: routerPush, resolve: routerResolve }),
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { username: 'demo-user', balance: 0 }, refreshUser }),
}))

vi.mock('@/stores/payment', () => ({
  usePaymentStore: () => ({ createOrder }),
}))

vi.mock('@/stores/subscriptions', () => ({
  useSubscriptionStore: () => ({ activeSubscriptions: [], fetchActiveSubscriptions }),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({ showError, showInfo, showWarning }),
}))

vi.mock('@/api/payment', () => ({
  paymentAPI: { getCheckoutInfo },
}))

function checkoutInfoFixture(overrides: Partial<CheckoutInfoResponse> = {}) {
  const wxpayMethod: MethodLimit = {
    daily_limit: 0,
    daily_used: 0,
    daily_remaining: 0,
    single_min: 0,
    single_max: 0,
    fee_rate: 0,
    available: true,
  }
  const data: CheckoutInfoResponse = {
    methods: { wxpay: wxpayMethod },
    global_min: 0,
    global_max: 0,
    plans: [],
    balance_disabled: false,
    balance_recharge_multiplier: 1,
    subscription_usd_to_cny_rate: 0,
    recharge_fee_rate: 0,
    help_text: '',
    help_image_url: '',
    stripe_publishable_key: '',
  }
  return { data: { ...data, ...overrides } }
}

/** Both tabs present (balance enabled) and the view parked in the select phase. */
async function mountTabBar() {
  getCheckoutInfo.mockResolvedValue(checkoutInfoFixture())

  const wrapper = mount(PaymentView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        PaymentStatusPanel: true,
        PaymentMethodSelector: true,
        SubscriptionPlanCard: true,
        AmountInput: true,
        Icon: true,
        Teleport: true,
        Transition: false,
      },
    },
    attachTo: document.body,
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

type TabBarWrapper = Awaited<ReturnType<typeof mountTabBar>>

function tabs(wrapper: TabBarWrapper) {
  return wrapper.get('[role="tablist"]').findAll('[role="tab"]')
}

describe('PaymentView tab bar', () => {
  beforeEach(() => {
    vi.useRealTimers()
    routeState.path = '/purchase'
    routeState.query = {}
    routerReplace.mockReset().mockResolvedValue(undefined)
    routerPush.mockReset().mockResolvedValue(undefined)
    routerResolve.mockClear()
    createOrder.mockReset()
    refreshUser.mockReset()
    fetchActiveSubscriptions.mockReset().mockResolvedValue(undefined)
    showError.mockReset()
    showInfo.mockReset()
    showWarning.mockReset()
    getCheckoutInfo.mockReset()
    window.localStorage.clear()
  })

  it('renders both tabs as Segmented items with recharge selected', async () => {
    const wrapper = await mountTabBar()

    const rendered = tabs(wrapper)
    expect(rendered).toHaveLength(2)
    expect(rendered.every((tab) => tab.classes().includes('segmented-item'))).toBe(true)
    expect(rendered[0].attributes('aria-selected')).toBe('true')
    expect(rendered[1].attributes('aria-selected')).toBe('false')
    // Panel switching, not value picking, so aria-checked must not appear.
    expect(rendered.every((tab) => tab.attributes('aria-checked') === undefined)).toBe(true)
    // A tablist without an accessible name is announced as an unlabelled group.
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBeTruthy()
    expect(wrapper.get('[role="tablist"]').find('.segmented-thumb').exists()).toBe(true)

    wrapper.unmount()
  })

  it('keeps the equal-width layout by passing item-class through to every segment', async () => {
    const wrapper = await mountTabBar()

    // `flex-1` used to be written on the buttons directly. After the migration it
    // only arrives via Segmented's item-class prop, so losing that prop would
    // silently collapse the bar to content width.
    expect(tabs(wrapper).every((tab) => tab.classes().includes('flex-1'))).toBe(true)

    wrapper.unmount()
  })

  it('switches the visible panel on a single click and back again', async () => {
    const wrapper = await mountTabBar()
    const vm = wrapper.vm as unknown as { activeTab: string }

    await tabs(wrapper)[1].trigger('click')
    await flushPromises()

    // One click, one switch: a control firing on both pointerdown and click
    // would land back where it started.
    expect(vm.activeTab).toBe('subscription')
    expect(tabs(wrapper)[1].attributes('aria-selected')).toBe('true')
    expect(tabs(wrapper)[0].attributes('aria-selected')).toBe('false')

    await tabs(wrapper)[0].trigger('click')
    await flushPromises()

    expect(vm.activeTab).toBe('recharge')
    expect(tabs(wrapper)[0].attributes('aria-selected')).toBe('true')

    wrapper.unmount()
  })

  it('hides the bar entirely when balance is disabled and only one tab remains', async () => {
    getCheckoutInfo.mockResolvedValue(checkoutInfoFixture({ balance_disabled: true }))

    const wrapper = mount(PaymentView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          PaymentStatusPanel: true,
          PaymentMethodSelector: true,
          SubscriptionPlanCard: true,
          AmountInput: true,
          Icon: true,
          Teleport: true,
          Transition: false,
        },
      },
    })
    await flushPromises()
    await flushPromises()

    // A one-segment segmented control is a control with nothing to choose.
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
