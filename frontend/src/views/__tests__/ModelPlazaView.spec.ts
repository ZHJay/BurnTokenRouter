import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ModelPlazaView from '../ModelPlazaView.vue'

const routeState = { query: {} as Record<string, string> }
const authState = { isAuthenticated: false }

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({ push: vi.fn() }),
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

vi.mock('@/api/modelPlaza', () => ({
  getModelPlaza: vi.fn().mockResolvedValue({ description: '', groups: [] }),
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    fetchPublicSettings: vi.fn().mockResolvedValue(undefined),
    cachedPublicSettings: null,
    serverTimezone: 'UTC',
    siteName: 'Sub2API',
    siteLogo: '',
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('@/components/layout/AppLayout.vue', () => ({
  default: { name: 'AppLayout', template: '<div class="app-layout-stub"><slot /></div>' },
}))

vi.mock('@/components/modelPlaza/PlazaNavBar.vue', () => ({
  default: { name: 'PlazaNavBar', template: '<header class="glass"></header>' },
}))

vi.mock('@/components/modelPlaza/ModelPlazaContent.vue', () => ({
  default: { name: 'ModelPlazaContent', template: '<div class="plaza-content-stub"></div>' },
}))

async function mountView() {
  const wrapper = mount(ModelPlazaView)
  await flushPromises()
  return wrapper
}

describe('ModelPlazaView standalone shell', () => {
  beforeEach(() => {
    routeState.query = {}
    authState.isAuthenticated = false
  })

  it('渲染 .ambient-layer:PlazaNavBar 是 .glass,背后没有可折射的东西时 backdrop-filter 是空操作', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('.ambient-layer').exists()).toBe(true)
  })

  it('ambient 层是外层容器的第一个子节点,才能垫在导航条与内容之下', async () => {
    const wrapper = await mountView()
    const shell = wrapper.find('div.min-h-screen')
    expect(shell.element.firstElementChild?.classList.contains('ambient-layer')).toBe(true)
  })

  it('外层 relative + 内容 relative z-10:内容压在固定定位的 z-0 光晕之上', async () => {
    const wrapper = await mountView()
    const shell = wrapper.find('div.min-h-screen')
    expect(shell.classes()).toContain('relative')

    const main = wrapper.find('main')
    expect(main.classes()).toContain('relative')
    expect(main.classes()).toContain('z-10')
  })

  it('未登录访客走独立形态(这是全站唯一免登录路由)', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('header.glass').exists()).toBe(true)
    expect(wrapper.find('.app-layout-stub').exists()).toBe(false)
  })

  it('embedded=1 且已登录时套 AppLayout,不重复自己的 ambient 层(AppLayout 已有)', async () => {
    routeState.query = { embedded: '1' }
    authState.isAuthenticated = true
    const wrapper = await mountView()
    expect(wrapper.find('.app-layout-stub').exists()).toBe(true)
    expect(wrapper.find('.ambient-layer').exists()).toBe(false)
  })

  it('embedded=1 但未登录时降级为独立形态,仍然带 ambient 层', async () => {
    routeState.query = { embedded: '1' }
    authState.isAuthenticated = false
    const wrapper = await mountView()
    expect(wrapper.find('.app-layout-stub').exists()).toBe(false)
    expect(wrapper.find('.ambient-layer').exists()).toBe(true)
  })
})
