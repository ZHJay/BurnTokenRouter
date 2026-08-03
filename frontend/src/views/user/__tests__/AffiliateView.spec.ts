import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AffiliateView from '../AffiliateView.vue'

const { copyToClipboard, getAffiliateDetail } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
  getAffiliateDetail: vi.fn(),
}))

vi.mock('@/api/user', () => ({
  default: {
    getAffiliateDetail,
    transferAffiliateQuota: vi.fn(),
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    refreshUser: vi.fn(),
  }),
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

describe('AffiliateView', () => {
  const affiliateCode = 'affiliate-code-that-is-long-enough-to-overflow-a-mobile-viewport'

  beforeEach(() => {
    vi.clearAllMocks()
    copyToClipboard.mockResolvedValue(true)
    getAffiliateDetail.mockResolvedValue({
      user_id: 1,
      aff_code: affiliateCode,
      inviter_id: null,
      aff_count: 0,
      aff_quota: 0,
      aff_frozen_quota: 0,
      aff_history_quota: 0,
      effective_rebate_rate_percent: 10,
      invitees: [],
    })
  })

  function mountView() {
    return mount(AffiliateView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
  }

  const STAT_IDS = [
    'affiliate-stat-rebate-rate',
    'affiliate-stat-invited-users',
    'affiliate-stat-available-quota',
    'affiliate-stat-total-quota',
  ] as const

  it('renders all four stat cards as one family with identical internal structure', async () => {
    const wrapper = mountView()
    await flushPromises()

    for (const id of STAT_IDS) {
      const card = wrapper.get(`[data-testid="${id}"]`)
      // p-4 matches the shipped stat card; p-5 broke the rhythm.
      expect(card.classes()).toEqual(expect.arrayContaining(['card', 'card-hover', 'p-4']))
      expect(card.classes()).not.toContain('p-5')

      const row = card.get('div')
      expect(row.classes()).toEqual(
        expect.arrayContaining(['flex', 'items-start', 'justify-between', 'gap-3']),
      )

      const left = row.get('div')
      expect(left.classes()).toEqual(
        expect.arrayContaining(['min-w-0', 'flex-1', 'space-y-1']),
      )
      expect(card.find('.stat-label').exists()).toBe(true)
      expect(card.find('.stat-value').exists()).toBe(true)

      // Every card carries a tile — previously only card 1 had an icon, and it
      // was inline inside the label.
      const tile = card.get('.stat-icon')
      expect(tile.classes()).toEqual(
        expect.arrayContaining(['h-8', 'w-8', 'shrink-0', 'text-base']),
      )
    }
  })

  it('moves tone into the tiles and leaves exactly one coloured value', async () => {
    getAffiliateDetail.mockResolvedValue({
      user_id: 1,
      aff_code: affiliateCode,
      inviter_id: null,
      aff_count: 7,
      aff_quota: 34.82,
      aff_frozen_quota: 6.5,
      aff_history_quota: 128.44,
      effective_rebate_rate_percent: 12,
      invitees: [],
    })

    const wrapper = mountView()
    await flushPromises()

    const tileClasses = (id: string) =>
      wrapper.get(`[data-testid="${id}"]`).get('.stat-icon').classes()
    expect(tileClasses('affiliate-stat-rebate-rate')).toContain('stat-icon-primary')
    expect(tileClasses('affiliate-stat-invited-users')).toEqual(
      expect.arrayContaining([
        'bg-teal-100',
        'text-teal-500',
        'dark:bg-teal-900/30',
        'dark:text-teal-300',
      ]),
    )
    expect(tileClasses('affiliate-stat-available-quota')).toContain('stat-icon-success')
    expect(tileClasses('affiliate-stat-total-quota')).toEqual(
      expect.arrayContaining([
        'bg-purple-100',
        'text-purple-500',
        'dark:bg-purple-900/30',
        'dark:text-purple-400',
      ]),
    )

    // Only "available quota" keeps a coloured value: money you can act on.
    const valueClasses = (id: string) =>
      wrapper.get(`[data-testid="${id}"]`).get('.stat-value').classes()
    expect(valueClasses('affiliate-stat-available-quota')).toEqual(
      expect.arrayContaining(['text-green-600', 'dark:text-green-400']),
    )
    for (const id of ['affiliate-stat-rebate-rate', 'affiliate-stat-invited-users', 'affiliate-stat-total-quota']) {
      const classes = valueClasses(id)
      expect(classes).toEqual(['stat-value'])
    }

    // The frozen sub-line keeps its amber warning tone.
    const frozen = wrapper.get('[data-testid="affiliate-stat-total-quota"]').get('.text-amber-600')
    expect(frozen.classes()).toContain('dark:text-amber-400')
  })

  it('demotes the percent sign to a subordinate unit and unnests it from the label', async () => {
    const wrapper = mountView()
    await flushPromises()

    const card = wrapper.get('[data-testid="affiliate-stat-rebate-rate"]')
    // No inline icon inside the label any more.
    expect(card.get('.stat-label').findAll('*')).toHaveLength(0)

    const unit = card.get('.stat-value span')
    expect(unit.text()).toBe('%')
    expect(unit.classes()).toEqual(
      expect.arrayContaining([
        'text-sm',
        'font-medium',
        'text-gray-500',
        'dark:text-gray-400',
      ]),
    )
    expect(unit.classes()).not.toContain('text-base')
  })

  it('uses the shipped card-title convention for section headings', async () => {
    const wrapper = mountView()
    await flushPromises()

    const headings = wrapper.findAll('h3')
    expect(headings.length).toBeGreaterThanOrEqual(3)
    for (const heading of headings) {
      expect(heading.classes()).toEqual(
        expect.arrayContaining(['text-sm', 'font-semibold', 'text-gray-900', 'dark:text-white']),
      )
      expect(heading.classes()).not.toContain('text-[15px]')
    }
  })

  it('makes How It Works an opaque inset panel instead of a blue-on-blue tint', async () => {
    const wrapper = mountView()
    await flushPromises()

    const panel = wrapper.get('[data-testid="affiliate-how-it-works"]')
    expect(panel.classes()).toEqual(expect.arrayContaining(['card-inset', 'p-4']))
    // primary-700 on primary-50 was 4.23:1; dark was a translucent tint over the wash.
    expect(panel.classes()).not.toContain('bg-primary-50')
    expect(panel.classes()).not.toContain('dark:bg-primary-900/20')

    expect(panel.get('p').classes()).toEqual(
      expect.arrayContaining(['text-sm', 'font-semibold', 'text-gray-900', 'dark:text-white']),
    )
    expect(panel.get('ul').classes()).toEqual(
      expect.arrayContaining(['text-sm', 'text-gray-600', 'dark:text-gray-300', 'space-y-1']),
    )
  })

  it('swaps the horizontally-scrolling invitee table for a card list on small screens', async () => {
    getAffiliateDetail.mockResolvedValue({
      user_id: 1,
      aff_code: affiliateCode,
      inviter_id: null,
      aff_count: 1,
      aff_quota: 0,
      aff_frozen_quota: 0,
      aff_history_quota: 18.2,
      effective_rebate_rate_percent: 12,
      invitees: [
        {
          user_id: 9,
          email: 'grace@example.com',
          username: 'grace',
          total_rebate: 18.2,
          created_at: '2026-05-05T09:24:00Z',
        },
      ],
    })

    const wrapper = mountView()
    await flushPromises()

    const desktop = wrapper.get('[data-testid="desktop-invitees"]')
    // The 560px min-width forced a horizontal scroll on a phone.
    expect(desktop.classes()).not.toContain('min-w-[560px]')
    expect(desktop.element.parentElement?.className).toContain('hidden')
    expect(desktop.element.parentElement?.className).toContain('lg:block')

    const mobile = wrapper.get('[data-testid="mobile-invitees"]')
    expect(mobile.classes()).toContain('lg:hidden')
    // Same row rendered both ways, so nothing is only reachable by dragging.
    expect(mobile.text()).toContain('grace@example.com')
    expect(mobile.text()).toContain('grace')
  })

  it('stacks long values and copy controls on mobile while retaining desktop rows', async () => {
    const wrapper = mountView()

    await flushPromises()

    const values = wrapper.findAll('code')
    expect(values).toHaveLength(2)
    for (const value of values) {
      expect(value.classes()).toEqual(expect.arrayContaining([
        'min-w-0',
        'break-all',
        'sm:flex-1',
        'sm:truncate',
      ]))
      expect(Array.from(value.element.parentElement?.classList ?? [])).toEqual(expect.arrayContaining([
        'flex-col',
        'items-stretch',
        'sm:flex-row',
        'sm:items-center',
      ]))
    }

    const copyButtons = wrapper.findAll('button').filter((button) =>
      ['affiliate.copyCode', 'affiliate.copyLink'].includes(button.text()),
    )
    expect(copyButtons).toHaveLength(2)
    for (const button of copyButtons) {
      expect(button.classes()).toEqual(expect.arrayContaining([
        'w-full',
        'sm:w-auto',
        'sm:shrink-0',
      ]))
      // Sizing stays global: a `@media (pointer: coarse)` rule for .btn-sm lands
      // in style.css, so these only need to carry the class for it to reach them.
      expect(button.classes()).toContain('btn-sm')
    }

    await copyButtons[0].trigger('click')
    await copyButtons[1].trigger('click')
    await flushPromises()

    expect(copyToClipboard).toHaveBeenNthCalledWith(1, affiliateCode, 'affiliate.codeCopied')
    expect(copyToClipboard).toHaveBeenNthCalledWith(
      2,
      `${window.location.origin}/register?aff=${encodeURIComponent(affiliateCode)}`,
      'affiliate.linkCopied',
    )
  })
})
