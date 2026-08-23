import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { Account } from '@/types'
import CNProviderBalanceCell from '../CNProviderBalanceCell.vue'
import CNProviderQuotaCell from '../CNProviderQuotaCell.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

vi.mock('@/api/admin', () => ({
  adminAPI: {
    cnProviders: { queryQuota: vi.fn(), queryBalance: vi.fn() },
  },
}))

function account(overrides: Partial<Account>): Account {
  return {
    id: 1,
    name: 'CN account',
    platform: 'kimi',
    type: 'apikey',
    proxy_id: null,
    concurrency: 1,
    priority: 1,
    status: 'active',
    error_message: null,
    last_used_at: null,
    expires_at: null,
    auto_pause_on_expired: true,
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
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
  }
}

describe('CN provider cells v3 styling', () => {
  it('keeps every shared quota selector globally defined', () => {
    const styleCss = readFileSync(resolve(__dirname, '../../../style.css'), 'utf8')

    for (const selector of [
      'quota-probe',
      'quota-row',
      'quota-label',
      'quota-meter',
      'quota-value',
      'quota-reset',
      'quota-error',
    ]) {
      expect(styleCss, `style.css 缺少 .${selector}`).toContain(`.${selector} {`)
    }
  })

  it('renders coding quota through the shared probe control and meter', async () => {
    const wrapper = mount(CNProviderQuotaCell, {
      props: {
        account: account({
          credentials: { account_mode: 'coding' },
          extra: {
            kimi_5h_used_percent: 86,
            kimi_weekly_used_percent: 20,
            kimi_usage_updated_at: '2099-01-01T00:00:00Z',
          },
        }),
      },
    })
    await nextTick()

    expect(wrapper.get('button').classes()).toContain('quota-probe')
    expect(wrapper.findAll('.meter .fill')).toHaveLength(2)
    expect(wrapper.find('[data-usage-state="warn"]').exists()).toBe(true)
  })

  it('renders payg balances through a pill and semantic low-balance badge', async () => {
    const wrapper = mount(CNProviderBalanceCell, {
      props: {
        account: account({
          credentials: { account_mode: 'payg' },
          extra: { kimi_balance: 8.5, kimi_balance_currency: 'CNY', kimi_balance_low: true },
        }),
      },
    })
    await nextTick()

    expect(wrapper.get('button').classes()).toContain('quota-probe')
    expect(wrapper.get('button').classes()).toContain('gpill')
    expect(wrapper.get('[data-balance-state="low"]').classes()).toContain('b-red')
  })
})
