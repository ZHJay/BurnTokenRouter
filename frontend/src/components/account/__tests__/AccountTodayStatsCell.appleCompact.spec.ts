import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AccountTodayStatsCell from '../AccountTodayStatsCell.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

describe('AccountTodayStatsCell Apple compact summary', () => {
  it('uses the reference two-line token and request summary', () => {
    const wrapper = mount(AccountTodayStatsCell, {
      props: {
        stats: {
          requests: 86,
          tokens: 12400,
          cost: 1.24,
          standard_cost: 1.32,
          user_cost: 1.28
        }
      }
    })

    expect(wrapper.get('[data-test="today-stats-summary"]').text()).toContain('12.4K')
    expect(wrapper.get('[data-test="today-stats-summary"]').text()).toContain('86')
    expect(wrapper.find('[data-test="today-stats-cost-details"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="today-stats-summary"]').attributes('title')).toContain('$1.24')
  })
})
