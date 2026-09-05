import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PlazaGroupSection from '../PlazaGroupSection.vue'
import PlazaModelCardGrid from '../PlazaModelCardGrid.vue'
import PlazaModelPricingTable from '../PlazaModelPricingTable.vue'
import type { ModelPlazaGroup, PlazaModel } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ cachedPublicSettings: null })
}))

function ladderModel(tiers: number): PlazaModel {
  const intervals = Array.from({ length: tiers }, (_, i) => ({
    min_tokens: i * 272000,
    max_tokens: i === tiers - 1 ? null : (i + 1) * 272000,
    tier_label: '',
    input_price: 5e-6,
    output_price: 3e-5,
    cache_write_price: null,
    cache_read_price: null,
    per_request_price: null
  }))
  return {
    name: 'gpt-5.6-sol',
    platform: 'openai',
    pricing: {
      billing_mode: 'token',
      input_price: 5e-6,
      output_price: 3e-5,
      cache_write_price: null,
      cache_read_price: null,
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: []
    },
    official_pricing: {
      input_price: 5e-6,
      output_price: 3e-5,
      cache_write_price: null,
      cache_read_price: null,
      intervals
    }
  }
}

function group(overrides: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id: 1,
    name: 'g',
    description: '',
    platform: 'openai',
    subscription_type: 'standard',
    rate_multiplier: 1,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    is_exclusive: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    long_context_pricing_enabled: true,
    models: [ladderModel(2)],
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

const NOTE = 'modelPlaza.detail.longContextDisabledNote'

describe('PlazaGroupSection 长上下文说明', () => {
  it('分组关闭阶梯且组内有官方阶梯模型时显示说明', () => {
    const wrapper = mountSection('table', group({ long_context_pricing_enabled: false }))
    expect(wrapper.text()).toContain(NOTE)
  })

  it('分组开启阶梯时不显示', () => {
    const wrapper = mountSection('table', group({ long_context_pricing_enabled: true }))
    expect(wrapper.text()).not.toContain(NOTE)
  })

  it('分组关闭但没有官方阶梯模型时不显示', () => {
    const wrapper = mountSection('table',
      group({ long_context_pricing_enabled: false, models: [ladderModel(1)] })
    )
    expect(wrapper.text()).not.toContain(NOTE)
  })

  it('旧后端缺少开关字段时不显示', () => {
    const g = group()
    delete (g as Partial<ModelPlazaGroup>).long_context_pricing_enabled
    const wrapper = mountSection('table', g)
    expect(wrapper.text()).not.toContain(NOTE)
  })
})

describe('PlazaGroupSection 高峰配置传递', () => {
  it('分组启用高峰时把窗口描述与倍率传给价格表', () => {
    const wrapper = mountSection('table',
      group({
        subscription_type: 'subscription',
        peak_rate_enabled: true,
        peak_start: '14:00',
        peak_end: '18:00',
        peak_rate_multiplier: 1.5
      })
    )
    const table = wrapper.findComponent(PlazaModelPricingTable)
    // appStore mock 无 server_utc_offset,窗口描述不带时区标注
    expect(table.props('peakWindow')).toBe('14:00-18:00 ×1.5')
    expect(table.props('peakRateMultiplier')).toBe(1.5)
  })

  it('分组未启用高峰时窗口描述为空串', () => {
    const wrapper = mountSection('table', group())
    expect(wrapper.findComponent(PlazaModelPricingTable).props('peakWindow')).toBe('')
  })

  it('卡片视图也收到同一份高峰窗口描述与倍率', () => {
    const wrapper = mountSection('cards',
      group({
        subscription_type: 'subscription',
        peak_rate_enabled: true,
        peak_start: '14:00',
        peak_end: '18:00',
        peak_rate_multiplier: 1.5
      })
    )
    const grid = wrapper.findComponent(PlazaModelCardGrid)
    expect(grid.props('peakWindow')).toBe('14:00-18:00 ×1.5')
    expect(grid.props('peakRateMultiplier')).toBe(1.5)
  })
})

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
