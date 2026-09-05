import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaModelCardGrid from '../PlazaModelCardGrid.vue'
import PlazaModelPricingTable from '../PlazaModelPricingTable.vue'
import type { PlazaModel } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

function model(name: string, outputPrice: number | null, billingMode = 'token'): PlazaModel {
  return {
    name,
    platform: 'openai',
    pricing: {
      billing_mode: billingMode,
      input_price: 1e-6,
      output_price: 5e-6,
      cache_write_price: null,
      cache_read_price: null,
      image_input_price: null,
      image_output_price: null,
      per_request_price: billingMode === 'token' ? null : 0.01,
      intervals: []
    },
    official_pricing:
      outputPrice == null
        ? null
        : {
            input_price: 1e-6,
            output_price: outputPrice,
            cache_write_price: null,
            cache_write_1h_price: null,
            cache_read_price: null
          }
  }
}

describe('PlazaModelCardGrid', () => {
  it('每个模型渲染一张卡,网格容器承载布局', () => {
    const wrapper = mount(PlazaModelCardGrid, {
      props: {
        models: [model('a', 1e-5), model('b', 5e-6)],
        platform: 'openai',
        rateMultiplier: 1
      }
    })

    expect(wrapper.find('.plaza-card-grid').exists()).toBe(true)
    expect(wrapper.findAll('.plaza-card')).toHaveLength(2)
  })

  it('卡片顺序与表格视图完全一致(共用 sortPlazaModels)', () => {
    const models = [
      model('cheap', 5e-6),
      model('img-model', 1e-5, 'image'),
      model('no-official', null),
      model('expensive', 7.5e-5)
    ]
    const props = { models, platform: 'openai', rateMultiplier: 1 }

    const grid = mount(PlazaModelCardGrid, { props })
    const table = mount(PlazaModelPricingTable, { props })

    const gridOrder = grid.findAll('.plaza-card-title').map((el) => el.text())
    // 表格首列除模型名外还含计费模式徽章,取名字所在的 span 而非整个单元格文本
    const tableOrder = table.findAll('tbody tr').map((tr) => tr.find('td span').text())

    expect(gridOrder).toEqual(['expensive', 'cheap', 'no-official', 'img-model'])
    expect(gridOrder).toEqual(tableOrder)
  })

  it('卡片与表格对同一模型显示同一个实付价(定价不漂移)', () => {
    const props = { models: [model('m', 1e-5)], platform: 'openai', rateMultiplier: 0.5 }

    const grid = mount(PlazaModelCardGrid, { props })
    const table = mount(PlazaModelPricingTable, { props })

    // 输入 1e-6 × 0.5 × 1M = $0.50,输出 5e-6 × 0.5 × 1M = $2.50
    const cardPaid = grid.findAll('.plaza-price-paid').map((el) => el.text())
    expect(cardPaid).toEqual(['$0.50', '$2.50'])
    cardPaid.forEach((price) => expect(table.text()).toContain(price))
  })

  it('Composite 同名模型按具体平台保留两张稳定卡片', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const anthropic = { ...model('shared-model', 1e-5), platform: 'anthropic' }
    const openai = { ...model('shared-model', 1e-5), platform: 'openai' }
    const wrapper = mount(PlazaModelCardGrid, {
      props: { models: [anthropic, openai], platform: 'composite', rateMultiplier: 1 },
    })

    expect(wrapper.findAll('.plaza-card')).toHaveLength(2)
    expect(wrapper.findAll('.plaza-card .badge').map((badge) => badge.text())).toEqual([
      'Anthropic',
      'OpenAI',
    ])

    await wrapper.setProps({ models: [openai, anthropic] })
    expect(wrapper.findAll('.plaza-card')).toHaveLength(2)
    expect(wrapper.findAll('.plaza-card .badge').map((badge) => badge.text())).toEqual([
      'OpenAI',
      'Anthropic',
    ])
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Duplicate keys')
    warn.mockRestore()
  })
})
