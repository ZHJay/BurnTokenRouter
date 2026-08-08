import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { ModelPlazaGroup, ModelPlazaResponse, PlazaModel } from '@/api/modelPlaza'

/**
 * 两种形态的功能正确性（比视觉更要紧）：
 *
 * 1. 独立形态是「未登录可访问的公开页」——卡片上不得出现需要鉴权才有的字段。
 *    后端匿名请求不返回 user_rate_multiplier（专属倍率）与专属分组，卡片必须
 *    如实降级，不能凭 `?? rate_multiplier` 之类的兜底把它渲染成「有专属折扣」。
 * 2. `?embedded=1` 但未登录时自动降级为独立形态，降级后布局不能错乱
 *    （必须拿到 PlazaNavBar + .page 外壳，而不是掉进没有外壳的裸内容）。
 */

const h = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string>,
  authState: { isAuthenticated: false, isAdmin: false },
  payload: { value: null as ModelPlazaResponse | null },
  fetchPublicSettings: vi.fn()
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: h.routeQuery })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => h.authState
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    fetchPublicSettings: h.fetchPublicSettings,
    cachedPublicSettings: { site_name: 'QA 站点', server_utc_offset: '+08:00' },
    siteName: 'QA 站点'
  })
}))

vi.mock('@/api/modelPlaza', () => ({
  getModelPlaza: vi.fn(() => Promise.resolve(h.payload.value))
}))

import ModelPlazaView from '@/views/ModelPlazaView.vue'

function tokenModel(name: string): PlazaModel {
  return {
    name,
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
}

function group(overrides: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id: 1,
    name: 'Claude 标准组',
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
    models: [tokenModel('claude-sonnet-4-5')],
    ...overrides
  }
}

/** 匿名响应：后端不下发 user_rate_multiplier，也不下发专属分组。 */
function anonymousPayload(): ModelPlazaResponse {
  return { description: '', groups: [group()] }
}

/** 已登录响应：带专属倍率。 */
function authedPayload(): ModelPlazaResponse {
  return { description: '', groups: [group({ user_rate_multiplier: 0.6 })] }
}

const stubs = {
  AppLayout: { name: 'AppLayout', template: '<div class="stub-app-layout"><slot /></div>' },
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' }
}

async function mountView() {
  const wrapper = mount(ModelPlazaView, { global: { stubs } })
  await flushPromises()
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  for (const key of Object.keys(h.routeQuery)) delete h.routeQuery[key]
  h.authState.isAuthenticated = false
  h.authState.isAdmin = false
  h.payload.value = anonymousPayload()
  localStorage.removeItem('model-plaza-view')
})

describe('ModelPlaza 外壳形态', () => {
  it('未登录 + 无 embedded：独立形态(PlazaNavBar + .page 外壳)', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('.plaza-nav').exists()).toBe(true)
    expect(wrapper.find('.stub-app-layout').exists()).toBe(false)
    expect(wrapper.find('main.page').exists()).toBe(true)
    // 独立形态展示页头，且卡片视图正常渲染
    expect(wrapper.find('.page-title').exists()).toBe(true)
    expect(wrapper.find('.plaza-card-grid').exists()).toBe(true)
    expect(wrapper.findAll('.plaza-card')).toHaveLength(1)
  })

  it('?embedded=1 但未登录：降级为独立形态,外壳与卡片布局不错乱', async () => {
    h.routeQuery.embedded = '1'
    const wrapper = await mountView()

    // 降级后必须仍有导航条与 .page 外壳，而不是裸内容
    expect(wrapper.find('.plaza-nav').exists()).toBe(true)
    expect(wrapper.find('main.page').exists()).toBe(true)
    expect(wrapper.find('.stub-app-layout').exists()).toBe(false)
    expect(wrapper.find('.page-title').exists()).toBe(true)
    expect(wrapper.find('.plaza-card-grid').exists()).toBe(true)
    expect(wrapper.findAll('.plaza-card')).toHaveLength(1)
    // 视图切换在降级形态下同样可用
    expect(wrapper.find('.segmented [data-view="table"]').exists()).toBe(true)
  })

  it('?embedded=1 且已登录：套 AppLayout,页头交给全局布局', async () => {
    h.routeQuery.embedded = '1'
    h.authState.isAuthenticated = true
    h.payload.value = authedPayload()
    const wrapper = await mountView()

    expect(wrapper.find('.stub-app-layout').exists()).toBe(true)
    expect(wrapper.find('.plaza-nav').exists()).toBe(false)
    // embedded 形态隐藏自带页头（避免与 GlobalNav 的标题重复）
    expect(wrapper.find('.page-title').exists()).toBe(false)
    expect(wrapper.find('.plaza-card-grid').exists()).toBe(true)
  })

  it('两种形态都能切到密集表格视图', async () => {
    for (const embedded of [false, true]) {
      if (embedded) {
        h.routeQuery.embedded = '1'
        h.authState.isAuthenticated = true
      }
      const wrapper = await mountView()
      await wrapper.find('.segmented [data-view="table"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.find('.plaza-card-grid').exists()).toBe(false)
      localStorage.removeItem('model-plaza-view')
    }
  })
})

describe('匿名访问不泄露鉴权字段', () => {
  it('匿名响应无 user_rate_multiplier 时,卡片不渲染专属倍率(无划线/无高亮)', async () => {
    const wrapper = await mountView()

    expect(wrapper.findAll('.plaza-rate-orig')).toHaveLength(0)
    expect(wrapper.findAll('.plaza-rate-value.is-custom')).toHaveLength(0)
    // 倍率如实显示分组默认值
    expect(wrapper.find('.plaza-rate-value').text()).toBe('1.00x')
    // 匿名提示可见（告知登录后才有专属倍率）
    expect(wrapper.text()).toContain('modelPlaza.anonymousHint')
  })

  it('对照：已登录且后端下发专属倍率时才出现划线原倍率(断言非空转)', async () => {
    h.authState.isAuthenticated = true
    h.payload.value = authedPayload()
    const wrapper = await mountView()

    expect(wrapper.findAll('.plaza-rate-orig')).toHaveLength(1)
    expect(wrapper.find('.plaza-rate-orig').text()).toBe('1.00x')
    expect(wrapper.find('.plaza-rate-value').text()).toBe('0.60x')
    expect(wrapper.text()).not.toContain('modelPlaza.anonymousHint')
  })

  it('匿名形态下表格视图同样不渲染专属倍率划线', async () => {
    const wrapper = await mountView()
    await wrapper.find('.segmented [data-view="table"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.findAll('td .line-through')).toHaveLength(0)
  })
})
