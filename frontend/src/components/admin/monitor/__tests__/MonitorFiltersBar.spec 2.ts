import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import MonitorFiltersBar from '@/components/admin/monitor/MonitorFiltersBar.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

function mountBar() {
  return mount(MonitorFiltersBar, {
    props: {
      search: '',
      provider: '',
      enabled: '',
      loading: false,
    },
  })
}

describe('MonitorFiltersBar filter Selects', () => {
  it('两个筛选栏 Select 都带 variant="filter"（与 36px 搜索框同族，不混排 44px）', () => {
    const wrapper = mountBar()
    const triggers = wrapper.findAll('.select-trigger')

    expect(triggers).toHaveLength(2)
    for (const trigger of triggers) {
      expect(trigger.classes()).toContain('select-trigger-filter')
    }
  })
})
