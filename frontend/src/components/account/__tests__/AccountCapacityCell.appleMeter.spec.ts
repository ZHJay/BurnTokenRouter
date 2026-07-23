import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AccountCapacityCell from '../AccountCapacityCell.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

describe('AccountCapacityCell Apple meter', () => {
  it('renders real concurrency as a compact ratio, percentage, and progress bar', () => {
    const wrapper = mount(AccountCapacityCell, {
      props: {
        account: {
          id: 1042,
          platform: 'openai',
          type: 'oauth',
          concurrency: 40,
          current_concurrency: 34
        } as never
      },
      global: {
        stubs: {
          CapacityBadge: true,
          QuotaBadge: true
        }
      }
    })

    expect(wrapper.get('[data-test="account-concurrency-meter"]').text()).toContain('34/40')
    expect(wrapper.get('[data-test="account-concurrency-percent"]').text()).toBe('85%')
    expect(wrapper.get('[data-test="account-concurrency-bar"]').attributes('style')).toContain(
      'width: 85%'
    )
  })
})
