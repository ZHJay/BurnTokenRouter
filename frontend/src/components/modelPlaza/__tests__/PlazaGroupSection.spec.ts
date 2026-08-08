import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PlazaGroupSection from '../PlazaGroupSection.vue'
import type { ModelPlazaGroup } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

function group(overrides: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id: 1,
    name: 'Claude 高速组',
    description: '',
    platform: 'anthropic',
    subscription_type: 'standard',
    rate_multiplier: 1,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    is_exclusive: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    models: [
      {
        name: 'claude-sonnet',
        platform: 'anthropic',
        pricing: {
          billing_mode: 'token',
          input_price: 3e-6,
          output_price: 1.5e-5,
          cache_write_price: null,
          cache_read_price: null,
          image_input_price: null,
          image_output_price: null,
          per_request_price: null,
          intervals: []
        },
        official_pricing: null
      }
    ],
    ...overrides
  }
}

function mountSection(view: 'cards' | 'table', g: ModelPlazaGroup = group()) {
  return mount(PlazaGroupSection, {
    props: { group: g, view },
    global: {
      stubs: { GroupBadge: true, Icon: true }
    }
  })
}

describe('PlazaGroupSection 视图切换', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('view=cards 渲染卡片网格,不渲染表格', () => {
    const wrapper = mountSection('cards')
    expect(wrapper.find('.plaza-card-grid').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('view=table 渲染密集定价表,不渲染卡片网格', () => {
    const wrapper = mountSection('table')
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.find('.plaza-card-grid').exists()).toBe(false)
  })

  it('两种视图都保留分组卡容器(发丝线 + 分组头)', () => {
    for (const view of ['cards', 'table'] as const) {
      const wrapper = mountSection(view)
      expect(wrapper.find('.plaza-group').exists()).toBe(true)
      expect(wrapper.find('.plaza-group-head').exists()).toBe(true)
    }
  })

  it('分组无模型时两种视图都显示空态,不渲染空网格/空表格', () => {
    for (const view of ['cards', 'table'] as const) {
      const wrapper = mountSection(view, group({ models: [] }))
      expect(wrapper.find('.plaza-group-empty').exists()).toBe(true)
      expect(wrapper.find('.plaza-card-grid').exists()).toBe(false)
      expect(wrapper.find('table').exists()).toBe(false)
    }
  })
})
