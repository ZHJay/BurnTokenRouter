import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ModelPlazaContent from '../ModelPlazaContent.vue'
import type { ModelPlazaResponse } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: false }),
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ cachedPublicSettings: null, serverTimezone: 'UTC' }),
}))

function response(overrides: Partial<ModelPlazaResponse> = {}): ModelPlazaResponse {
  return {
    description: '',
    groups: [
      {
        id: 1,
        name: 'Anthropic Pool',
        description: '',
        platform: 'anthropic',
        subscription_type: 'standard',
        rate_multiplier: 1,
        user_rate_multiplier: null,
        models: [],
      },
    ],
    ...overrides,
  } as ModelPlazaResponse
}

function mountContent(props: Record<string, unknown> = {}) {
  return mount(ModelPlazaContent, {
    props: { response: response(), loading: false, ...props },
    shallow: false,
    global: {},
  })
}

describe('ModelPlazaContent heading', () => {
  it('用 .page-title,不再把标题顶到 30px(不在已发布的字号阶上)', () => {
    const wrapper = mountContent()
    const h1 = wrapper.find('h1')
    expect(h1.classes()).toContain('page-title')
    expect(h1.classes()).not.toContain('sm:text-3xl')
  })

  it('描述段落用行内工具类,不用已被删除的 .page-description', () => {
    const wrapper = mountContent()
    const p = wrapper.find('h1 + p')

    expect(p.exists()).toBe(true)
    expect(p.text()).toBe('modelPlaza.description')
    // .page-description 在 Liquid Glass 重构中已从 style.css 删除,挂上去完全无样式。
    expect(p.classes()).not.toContain('page-description')
    // 该规则原本的展开值,也是重构后其余视图的标题/描述写法。
    for (const c of ['mt-1', 'text-sm', 'text-gray-500', 'dark:text-dark-400']) {
      expect(p.classes()).toContain(c)
    }
  })

  it('内嵌形态不重复渲染页头(AppHeader 已有标题)', () => {
    const wrapper = mountContent({ embedded: true })
    expect(wrapper.find('h1').exists()).toBe(false)
  })
})

describe('ModelPlazaContent spacing', () => {
  it('根容器与分组分节都用 space-y-4(16px)', () => {
    const wrapper = mountContent()
    expect(wrapper.find('div').classes()).toContain('space-y-4')
    const sections = wrapper.findAll('div').filter((d) => d.classes().includes('space-y-4'))
    expect(sections.length).toBeGreaterThanOrEqual(2)
  })
})

describe('ModelPlazaContent empty and error states', () => {
  it('空态改用 EmptyState 放进 .card,不再用系统里不存在的 border-dashed 方框', () => {
    const wrapper = mountContent({ response: response({ groups: [] }) })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.empty-state-title').text()).toBe('modelPlaza.empty')
    // 断言在 class 上而不是 html() 上:模板注释也会进入 html(),
    // 注释里提到旧类名会让字符串断言产生假阳性。
    const dashed = wrapper.findAll('div').filter((d) => d.classes().includes('border-dashed'))
    expect(dashed).toHaveLength(0)
  })

  it('搜索无结果时用 noSearchResult 文案', async () => {
    const wrapper = mountContent()
    await wrapper.find('input').setValue('no-such-model')
    expect(wrapper.find('.empty-state-title').text()).toBe('modelPlaza.noSearchResult')
  })

  it('错误态用 .card p-6 + --sys-red-text,不再用 bg-red-50 色块', () => {
    const wrapper = mountContent({ error: true, response: null })
    const panel = wrapper
      .findAll('div')
      .find((d) => d.classes().includes('card') && d.text() === 'modelPlaza.loadFailed')!
    expect(panel.classes()).toContain('p-6')
    expect(panel.classes()).toContain('text-[var(--sys-red-text)]')
    expect(panel.classes()).not.toContain('bg-red-50')
    expect(wrapper.text()).toContain('modelPlaza.loadFailed')
  })
})
