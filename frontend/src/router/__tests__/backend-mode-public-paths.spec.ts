import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * 用真实 router（含 beforeEach 守卫）锁住 backend mode 的公共路径行为：
 *  ① backend mode 下未登录用户可访问 Landing 首页（'/home'，'/' 会 redirect 过去）；
 *  ② backend mode 下未登录用户访问受保护路径仍被拦到 /login（防止修复过头）。
 */
const authStore = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  isAuthenticated: false,
  isAdmin: false,
  isSimpleMode: false,
  hasPendingAuthSession: false,
}))

const appStore = vi.hoisted(() => ({
  siteName: 'Sub2API',
  backendModeEnabled: true,
  publicSettingsLoaded: false,
  cachedPublicSettings: null as null | Record<string, unknown>,
  fetchPublicSettings: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStore,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appStore,
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({
    customMenuItems: [],
  }),
}))

vi.mock('@/composables/useNavigationLoading', () => ({
  useNavigationLoadingState: () => ({
    startNavigation: vi.fn(),
    endNavigation: vi.fn(),
    isLoading: { value: false },
  }),
}))

vi.mock('@/composables/useRoutePrefetch', () => ({
  useRoutePrefetch: () => ({
    triggerPrefetch: vi.fn(),
    cancelPendingPrefetch: vi.fn(),
    resetPrefetchState: vi.fn(),
  }),
}))

// 只测守卫行为，不加载真实页面组件（其他 agent 正在并行改视图文件）
vi.mock('@/views/HomeView.vue', () => ({ default: { name: 'MockHome', render: () => null } }))
vi.mock('@/views/auth/LoginView.vue', () => ({ default: { name: 'MockLogin', render: () => null } }))
vi.mock('@/views/ModelPlazaView.vue', () => ({ default: { name: 'MockPlaza', render: () => null } }))

async function navigate(router: any, to: string) {
  await router.push(to)
  return router.currentRoute.value
}

describe('backend mode 公共路径（真实 router 守卫）', () => {
  beforeEach(() => {
    // jsdom 未实现 window.scrollTo，vue-router 的 scrollBehavior 会触发告警
    window.scrollTo = vi.fn()
    authStore.checkAuth.mockClear()
    appStore.fetchPublicSettings.mockClear()
    appStore.backendModeEnabled = true
    authStore.isAuthenticated = false
    authStore.isAdmin = false
    authStore.hasPendingAuthSession = false
  })

  it('未登录访问 / 经 redirect 后停留在 Landing 首页（/home）', async () => {
    const { default: router } = await import('@/router')
    const route = await navigate(router, '/')
    expect(route.path).toBe('/home')
    expect(route.redirectedFrom?.path).toBe('/')
  })

  it('未登录直接访问 /home 允许通过', async () => {
    const { default: router } = await import('@/router')
    const route = await navigate(router, '/home')
    expect(route.path).toBe('/home')
  })

  it('未登录访问受保护路由 /admin/dashboard 被拦到 /login 且保留 redirect 参数', async () => {
    const { default: router } = await import('@/router')
    const route = await navigate(router, '/admin/dashboard')
    expect(route.path).toBe('/login')
    expect(route.query.redirect).toBe('/admin/dashboard')
  })

  it('未登录访问受保护路由 /keys 被拦到 /login', async () => {
    const { default: router } = await import('@/router')
    const route = await navigate(router, '/keys')
    expect(route.path).toBe('/login')
  })

  it('未登录访问公开但不在白名单的 /model-plaza 仍被拦到 /login（防止修复过头）', async () => {
    const { default: router } = await import('@/router')
    const route = await navigate(router, '/model-plaza')
    expect(route.path).toBe('/login')
  })

  it('非 backend mode 下未登录访问 /home 照常放行', async () => {
    appStore.backendModeEnabled = false
    const { default: router } = await import('@/router')
    const route = await navigate(router, '/home')
    expect(route.path).toBe('/home')
  })
})
