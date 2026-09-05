import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaModelCard from '../PlazaModelCard.vue'
import type { PlazaModel } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key} ${JSON.stringify(params)}` : key
    })
  }
})

function tokenModel(overrides: Partial<PlazaModel> = {}): PlazaModel {
  return {
    name: 'claude-sonnet',
    platform: 'anthropic',
    pricing: {
      billing_mode: 'token',
      input_price: 3e-6,
      output_price: 1.5e-5,
      cache_write_price: 3.75e-6,
      cache_read_price: 3e-7,
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: []
    },
    official_pricing: {
      input_price: 3e-6,
      output_price: 1.5e-5,
      cache_write_price: 3.75e-6,
      cache_write_1h_price: 6e-6,
      cache_read_price: 3e-7
    },
    ...overrides
  }
}

function mountCard(
  model: PlazaModel,
  rateMultiplier: number,
  userRateMultiplier?: number | null,
  extraProps?: {
    platform?: string
    imageRateIndependent?: boolean
    imageRateMultiplier?: number | null
    peakWindow?: string
    peakRateMultiplier?: number | null
  }
) {
  return mount(PlazaModelCard, {
    props: {
      model,
      platform: extraProps?.platform ?? model.platform,
      rateMultiplier,
      userRateMultiplier: userRateMultiplier ?? null,
      imageRateIndependent: extraProps?.imageRateIndependent,
      imageRateMultiplier: extraProps?.imageRateMultiplier,
      peakWindow: extraProps?.peakWindow,
      peakRateMultiplier: extraProps?.peakRateMultiplier
    }
  })
}

describe('PlazaModelCard', () => {
  it('承载模型名 + 平台徽标 + 关键定价(实付价按 $/1M token)', () => {
    const wrapper = mountCard(tokenModel(), 1)

    expect(wrapper.find('.plaza-card-title').text()).toBe('claude-sonnet')
    // 平台徽标走全站 .badge 体系(anthropic → .b-claude)
    const badge = wrapper.find('.badge')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).toContain('b-claude')
    expect(badge.text()).toContain('Anthropic')

    const paid = wrapper.findAll('.plaza-price-paid').map((el) => el.text())
    expect(paid).toEqual(['$3.00', '$15.00'])
    expect(wrapper.text()).toContain('modelPlaza.table.unitPerMillion')
  })

  it('倍率 ≠ 1 时卡片显示折后实付价,并把官方原价划线作对比', () => {
    const wrapper = mountCard(tokenModel(), 0.5)

    const paid = wrapper.findAll('.plaza-price-paid').map((el) => el.text())
    expect(paid).toEqual(['$1.50', '$7.50'])
    // 官方价不乘倍率,作为划线原价展示
    const official = wrapper.findAll('.plaza-price-official').map((el) => el.text())
    expect(official).toEqual(['$3.00', '$15.00'])
    expect(wrapper.find('.plaza-rate-value').text()).toBe('0.50x')
  })

  it('倍率为 1(实付=官方)时不再重复展示官方价,避免划线噪音', () => {
    const wrapper = mountCard(tokenModel(), 1)
    expect(wrapper.findAll('.plaza-price-official')).toHaveLength(0)
  })

  it('专属倍率:划线展示分组原倍率,高亮生效倍率', () => {
    const wrapper = mountCard(tokenModel(), 1, 0.8)

    expect(wrapper.find('.plaza-rate-orig').text()).toBe('1.00x')
    const value = wrapper.find('.plaza-rate-value')
    expect(value.text()).toBe('0.80x')
    expect(value.classes()).toContain('is-custom')
    // 实付按 0.8:3 × 0.8 = 2.4
    expect(wrapper.findAll('.plaza-price-paid')[0].text()).toBe('$2.40')
  })

  it('能力标签:缓存计费 / 阶梯定价', () => {
    const plain = mountCard(tokenModel(), 1)
    expect(plain.findAll('.plaza-tag').map((el) => el.text())).toEqual([
      'modelPlaza.cards.cache'
    ])

    const tiered = mountCard(
      tokenModel({
        pricing: {
          billing_mode: 'token',
          input_price: 3e-6,
          output_price: 1.5e-5,
          cache_write_price: null,
          cache_read_price: null,
          image_input_price: null,
          image_output_price: null,
          per_request_price: null,
          intervals: [
            {
              min_tokens: 0,
              max_tokens: 200000,
              tier_label: '',
              input_price: 3e-6,
              output_price: 1.5e-5,
              cache_write_price: null,
              cache_read_price: null,
              per_request_price: null
            },
            {
              min_tokens: 200000,
              max_tokens: null,
              tier_label: '',
              input_price: 6e-6,
              output_price: 3e-5,
              cache_write_price: null,
              cache_read_price: null,
              per_request_price: null
            }
          ]
        }
      }),
      1
    )
    expect(tiered.findAll('.plaza-tag').map((el) => el.text())).toContain(
      'modelPlaza.cards.tiered'
    )
    // 卡片只展示首档,完整档位留给表格视图
    expect(tiered.findAll('.plaza-price-paid').map((el) => el.text())).toEqual([
      '$3.00',
      '$15.00'
    ])
  })

  it('默认卡片视图披露分时时段、时区、工作日规则及高峰叠加', () => {
    const wrapper = mountCard(
      tokenModel({
        time_pricing: {
          timezone: 'Asia/Shanghai',
          weekdays_only: true,
          periods: [{ start_time: '00:30', end_time: '08:30', multiplier: 0.5 }],
        },
      }),
      1,
      null,
      { peakWindow: '18:00–22:00 UTC+8', peakRateMultiplier: 1.2 },
    )

    const tags = wrapper.findAll('.plaza-tag').map((el) => el.text())
    expect(tags).toContain('modelPlaza.cards.timePricing 00:30–08:30')
    expect(tags).toContain('modelPlaza.cards.weekdaysOnly')
    const timeTag = wrapper.find('.plaza-tag[title]')
    expect(timeTag.attributes('title')).toContain('modelPlaza.table.timePricingRowHintWeekdays')
    expect(timeTag.attributes('title')).toContain('Asia/Shanghai')
    expect(timeTag.attributes('title')).toContain('modelPlaza.table.timePricingRowHintPeak')
    expect(timeTag.attributes('title')).toContain('18:00–22:00 UTC+8')
    expect(timeTag.attributes('title')).toContain('1.2')
  })

  it('按次计费:单行单价 + 单位后缀,不显示 $/1M token 脚注', () => {
    const model = tokenModel({
      name: 'search-tool',
      pricing: {
        billing_mode: 'per_request',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: null,
        per_request_price: 0.04,
        intervals: []
      },
      official_pricing: null
    })
    const wrapper = mountCard(model, 0.5)

    const rows = wrapper.findAll('.plaza-price-row')
    expect(rows).toHaveLength(1)
    // 0.04 × 0.5 = 0.02(不换算 1M)
    expect(wrapper.find('.plaza-price-paid').text()).toBe('$0.02')
    expect(wrapper.text()).toContain('modelPlaza.table.perUnitRequest')
    expect(wrapper.findAll('.plaza-tag').map((el) => el.text())).toContain(
      'modelPlaza.table.perRequest'
    )
    expect(wrapper.text()).not.toContain('modelPlaza.table.unitPerMillion')
  })

  it('生图独立倍率开启时,卡片倍率与实付价都走独立倍率', () => {
    const model = tokenModel({
      name: 'gpt-image-2',
      platform: 'openai',
      pricing: {
        billing_mode: 'image',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: null,
        per_request_price: 0.02,
        intervals: []
      },
      official_pricing: null
    })
    const wrapper = mountCard(model, 0.1, null, {
      imageRateIndependent: true,
      imageRateMultiplier: 1
    })

    // 0.02 × 1(独立倍率),而非 0.02 × 0.1
    expect(wrapper.find('.plaza-price-paid').text()).toBe('$0.02')
    expect(wrapper.find('.plaza-rate-value').text()).toBe('1.00x')
    expect(wrapper.find('.badge').classes()).toContain('b-openai')
  })

  it('生图独立倍率不把用户专属倍率误画成折扣', () => {
    const model = tokenModel({
      name: 'gpt-image-2',
      platform: 'openai',
      pricing: {
        billing_mode: 'image',
        input_price: null,
        output_price: null,
        cache_write_price: null,
        cache_read_price: null,
        image_input_price: null,
        image_output_price: null,
        per_request_price: 0.02,
        intervals: []
      },
      official_pricing: null
    })
    const wrapper = mountCard(model, 0.1, 0.8, {
      imageRateIndependent: true,
      imageRateMultiplier: 1
    })

    expect(wrapper.find('.plaza-rate-orig').exists()).toBe(false)
    expect(wrapper.find('.plaza-rate-value').classes()).not.toContain('is-custom')
    expect(wrapper.find('.plaza-rate-value').text()).toBe('1.00x')
    expect(wrapper.find('.plaza-price-paid').text()).toBe('$0.02')
  })

  it('未知平台回退品牌蓝徽标,不抛错', () => {
    const wrapper = mountCard(tokenModel({ platform: 'somethingnew' }), 1, null, {
      platform: 'somethingnew'
    })
    expect(wrapper.find('.badge').classes()).toContain('b-blue')
  })
})
