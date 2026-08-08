/**
 * GlobalNav behavior spec — replaces the deleted AppSidebar.spec.ts.
 *
 * Covers the things most likely to silently regress during the sidebar → top
 * nav rewrite: feature-flag filtering, simple-mode filtering, custom menu
 * items, active-route highlighting, backend-mode hiding, onboarding tour
 * anchors, and the re-homed header action cluster. Prefers asserting real
 * rendered output over mocking internals.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useAppStore, useAuthStore, useAdminSettingsStore } from '@/stores'
import type { CustomMenuItem, PublicSettings, User } from '@/types'
import { useTheme } from '@/composables/useTheme'
import { resetBodyScrollLock } from '@/composables/useCommandPalette'
import {
  ADMIN_FLYOUT_GROUPS,
  applyFeatureFlags,
  buildAdminNavItems,
  buildCommandEntries,
  buildSelfNavItems,
  finalizeNav,
  groupAdminNav,
  isPathActive,
  type NavDeps,
} from '@/components/layout/navItems'
import GlobalNav from '@/components/layout/GlobalNav.vue'

/* ------------------------------------------------------------------ mocks */

// The app pins vue-i18n to the runtime build (no message compiler), which
// cannot compile plain messages inside vitest — so resolve keys against the
// real zh locale object instead of mocking t() as an identity function.
vi.mock('vue-i18n', async () => {
  const zhMessages = (await import('@/i18n/locales/zh')).default
  const t = (key: string): string => {
    const parts = key.split('.')
    let node: unknown = zhMessages
    for (const part of parts) {
      if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[part]
      } else {
        return key
      }
    }
    return typeof node === 'string' ? node : key
  }
  return {
    useI18n: () => ({ t }),
    // stores/app.ts and router/title.ts import { i18n } via '@/i18n'
    createI18n: () => ({
      global: { t, locale: { value: 'zh' }, setLocaleMessage: () => {}, getLocaleMessage: () => ({}) },
    }),
  }
})

vi.mock('@/components/common/AnnouncementBell.vue', () => ({
  default: { name: 'AnnouncementBellStub', template: '<div data-testid="announcement-bell" />' },
}))
vi.mock('@/components/common/LocaleSwitcher.vue', () => ({
  default: { name: 'LocaleSwitcherStub', template: '<div data-testid="locale-switcher" />' },
}))
vi.mock('@/components/common/SubscriptionProgressMini.vue', () => ({
  default: { name: 'SubProgressStub', template: '<div data-testid="sub-progress" />' },
}))
vi.mock('@/components/common/VersionBadge.vue', () => ({
  default: { name: 'VersionBadgeStub', template: '<div data-testid="version-badge" />' },
}))

// Admin settings store fetches on mount for admins — keep it deterministic and
// per-test configurable through these mutable fixtures.
const mockAdminSettings = vi.hoisted(() => ({
  ops_monitoring_enabled: true,
  custom_menu_items: [],
}))
const mockPaymentConfig = vi.hoisted(() => ({ data: { enabled: false } }))
const mockCurrentUser = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
}))
vi.mock('@/api/admin/settings', () => ({
  default: { getSettings: vi.fn().mockResolvedValue(mockAdminSettings) },
  settingsAPI: { getSettings: vi.fn().mockResolvedValue(mockAdminSettings) },
}))
vi.mock('@/api/admin/payment', () => ({
  default: { getConfig: vi.fn().mockResolvedValue(mockPaymentConfig) },
  adminPaymentAPI: { getConfig: vi.fn().mockResolvedValue(mockPaymentConfig) },
}))
vi.mock('@/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/auth')>()
  return {
    ...actual,
    authAPI: {
      ...actual.authAPI,
      getCurrentUser: vi.fn().mockResolvedValue(mockCurrentUser),
    },
  }
})
vi.mock('@/api/keys', () => ({
  keysAPI: { list: vi.fn().mockResolvedValue({ items: [], pages: 1 }) },
  default: { list: vi.fn().mockResolvedValue({ items: [], pages: 1 }) },
}))

/**
 * Public settings fixture. Feature-flag keys are intentionally OMITTED unless
 * explicitly overridden, so the registry's opt-in/opt-out fallback semantics
 * are exercised exactly like a backend that hasn't injected them yet.
 */
function makeSettings(overrides: Partial<PublicSettings> = {}): PublicSettings {
  return {
    registration_enabled: false,
    email_verify_enabled: false,
    force_email_on_third_party_signup: false,
    registration_email_suffix_whitelist: [],
    promo_code_enabled: false,
    password_reset_enabled: false,
    invitation_code_enabled: false,
    turnstile_enabled: false,
    turnstile_site_key: '',
    site_name: 'TestSite',
    site_logo: '',
    site_subtitle: '',
    api_base_url: '',
    contact_info: '',
    doc_url: '',
    home_content: '',
    compact_home_enabled: false,
    hide_ccs_import_button: false,
    table_default_page_size: 10,
    table_page_size_options: [10, 20, 50],
    custom_menu_items: [],
    custom_endpoints: [],
    linuxdo_oauth_enabled: false,
    wechat_oauth_enabled: false,
    wechat_oauth_open_enabled: false,
    wechat_oauth_mp_enabled: false,
    wechat_oauth_mobile_enabled: false,
    oidc_oauth_enabled: false,
    oidc_oauth_provider_name: '',
    github_oauth_enabled: false,
    google_oauth_enabled: false,
    backend_mode_enabled: false,
    version: '1.0.0',
    balance_low_notify_enabled: false,
    account_quota_notify_enabled: false,
    balance_low_notify_threshold: 10,
    ...overrides,
  } as unknown as PublicSettings
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'tester',
    email: 'tester@sub2api.dev',
    role: 'user',
    balance: 100,
    frozen_balance: 0,
    concurrency: 1,
    ...overrides,
  }
}

interface MountOptions {
  path?: string
  admin?: boolean
  simple?: boolean
  user?: User | null
  settings?: Partial<PublicSettings>
  adminCustomItems?: CustomMenuItem[]
  opsMonitoring?: boolean
  paymentEnabled?: boolean
}

async function mountNav(options: MountOptions = {}): Promise<{
  wrapper: VueWrapper
  router: Router
  appStore: ReturnType<typeof useAppStore>
  authStore: ReturnType<typeof useAuthStore>
  adminSettingsStore: ReturnType<typeof useAdminSettingsStore>
}> {
  const pinia = createPinia()
  setActivePinia(pinia)
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const adminSettingsStore = useAdminSettingsStore()

  // The admin settings store re-fetches on mount and overwrites these refs,
  // so drive them through the API fixtures instead.
  if (options.opsMonitoring !== undefined) mockAdminSettings.ops_monitoring_enabled = options.opsMonitoring
  if (options.paymentEnabled !== undefined) mockPaymentConfig.data.enabled = options.paymentEnabled
  if (options.adminCustomItems) mockAdminSettings.custom_menu_items = options.adminCustomItems

  const settings = makeSettings(options.settings)
  appStore.cachedPublicSettings = settings
  // Header features read these from app store refs (set by initFromInjectedConfig
  // in production) — mirror the settings fixture so the render paths are real.
  appStore.docUrl = settings.doc_url
  appStore.contactInfo = settings.contact_info
  appStore.siteName = settings.site_name || 'Sub2API'
  appStore.siteVersion = settings.version

  if (options.user !== null) {
    const user = options.user ?? makeUser({ role: options.admin ? 'admin' : 'user' })
    mockCurrentUser.data = {
      ...user,
      run_mode: options.simple ? 'simple' : 'standard',
    }
    await authStore.setToken('test-token')
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:pathMatch(.*)*', component: defineComponent({ name: 'RouteStub', template: '<div />' }) },
    ],
  })
  await router.push(options.path ?? '/dashboard')
  await router.isReady()

  const wrapper = mount(GlobalNav, {
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return { wrapper, router, appStore, authStore, adminSettingsStore }
}

/** Desktop nav links only (the mobile menu duplicates the same paths). */
function link(wrapper: VueWrapper, href: string) {
  return wrapper.find(`.gn-links a[href="${href}"]`)
}

/* ------------------------------------------------- command palette helpers */

/** The bar's search button — the palette's pointer entry point. */
function searchButton(wrapper: VueWrapper) {
  return wrapper.find('button[aria-label="搜索"]')
}

async function openCommandPalette(wrapper: VueWrapper) {
  await searchButton(wrapper).trigger('click')
  await nextTick()
}

function paletteInput(wrapper: VueWrapper) {
  return wrapper.find('input[role="combobox"]')
}

/** Every path currently offered by the palette, in render order. */
function palettePaths(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.gn-cmdk-option').map((row) => row.attributes('href') ?? '')
}

function paletteGroupTitles(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.gn-cmdk-group-title').map((el) => el.text())
}

/* ------------------------------------------------------- pure-module tests */

const allFlagsOn = (): NavDeps['flags'] => ({
  channelMonitor: () => true,
  payment: () => true,
  availableChannels: () => true,
  affiliate: () => true,
  riskControl: () => true,
  opsMonitoring: () => true,
  adminPayment: () => true,
  batchImageAccess: () => true,
})

const deps = (overrides: Partial<NavDeps> = {}): NavDeps => ({
  isSimpleMode: false,
  customMenuItemsForUser: [],
  customMenuItemsForAdmin: [],
  flags: allFlagsOn(),
  ...overrides,
})

describe('navItems module — filtering', () => {
  it('applyFeatureFlags hides items whose flag is false and recurses into children', () => {
    const items = [
      { path: '/a', labelKey: 'nav.a' },
      { path: '/b', labelKey: 'nav.b', featureFlag: () => false as boolean | undefined },
      {
        path: '/c',
        labelKey: 'nav.c',
        featureFlag: () => false as boolean | undefined,
        children: [
          { path: '/c/1', labelKey: 'nav.c1' },
          { path: '/c/2', labelKey: 'nav.c2' },
        ],
      },
      { path: '/d', labelKey: 'nav.d', featureFlag: () => undefined as boolean | undefined },
    ]
    const filtered = applyFeatureFlags(items)
    expect(filtered.map((i) => i.path)).toEqual(['/a', '/d'])
  })

  it('finalizeNav drops hideInSimpleMode items only in simple mode, after flags', () => {
    const items = [
      { path: '/a', labelKey: 'nav.a' },
      { path: '/b', labelKey: 'nav.b', hideInSimpleMode: true },
      { path: '/c', labelKey: 'nav.c', featureFlag: () => false as boolean | undefined },
    ]
    expect(finalizeNav(items, false).map((i) => i.path)).toEqual(['/a', '/b'])
    expect(finalizeNav(items, true).map((i) => i.path)).toEqual(['/a'])
  })

  it('buildSelfNavItems preserves the original order and flag wiring', () => {
    const items = buildSelfNavItems(deps(), true)
    expect(items.map((i) => i.path)).toEqual([
      '/dashboard',
      '/keys',
      '/batch-image',
      '/usage',
      '/available-channels',
      '/monitor',
      '/subscriptions',
      '/purchase',
      '/orders',
      '/redeem',
      '/affiliate',
      '/profile',
    ])
    expect(items.find((i) => i.path === '/purchase')?.featureFlag?.()).toBe(true)
    expect(items.find((i) => i.path === '/available-channels')?.hideInSimpleMode).toBe(true)
  })

  it('buildAdminNavItems appends /keys + settings + admin customs in simple mode', () => {
    const simple = buildAdminNavItems(
      deps({
        isSimpleMode: true,
        customMenuItemsForAdmin: [
          { id: 'x', label: 'X', icon_svg: '', url: '', visibility: 'admin', sort_order: 1 },
        ],
      }),
    )
    const paths = simple.map((i) => i.path)
    expect(paths).toContain('/keys')
    expect(paths).toContain('/admin/settings')
    expect(paths).toContain('/custom/x')
    expect(paths).not.toContain('/admin/users')
    expect(paths).not.toContain('/admin/groups')

    const normal = buildAdminNavItems(deps())
    expect(normal.map((i) => i.path)).not.toContain('/keys')
    expect(normal.map((i) => i.path)).toContain('/admin/settings')
  })

  it('groupAdminNav keeps every surviving admin entry reachable in the flyout spec', () => {
    const grouped = groupAdminNav(buildAdminNavItems(deps()))
    const placed = new Set<string>()
    for (const g of grouped.groups) {
      for (const c of g.columns) {
        for (const i of c.items) placed.add(i.path)
      }
    }
    for (const i of grouped.topLevel) placed.add(i.path)
    for (const i of grouped.extra) placed.add(i.path)

    // Every flat entry (except container paths covered by children) must land somewhere.
    for (const item of buildAdminNavItems(deps())) {
      if (item.children?.length) {
        for (const child of item.children) expect(placed.has(child.path)).toBe(true)
      } else {
        expect(placed.has(item.path)).toBe(true)
      }
    }
    expect(grouped.extra).toEqual([])
  })

  it('isPathActive matches exact and prefix paths only', () => {
    expect(isPathActive('/keys', '/keys')).toBe(true)
    expect(isPathActive('/keys', '/keys/123')).toBe(true)
    expect(isPathActive('/keys', '/keyspace')).toBe(false)
    expect(isPathActive('/admin/orders', '/admin/orders/dashboard')).toBe(true)
  })
})

/* ----------------------------------------------------- rendered-nav tests */

describe('GlobalNav — feature-flag filtering (rendered)', () => {
  it('opt-out flags show items when settings are missing', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', settings: {} })
    // channelMonitor + payment are opt-out → visible without settings
    expect(link(wrapper, '/monitor').exists()).toBe(true)
    expect(link(wrapper, '/purchase').exists()).toBe(true)
    // availableChannels + affiliate are opt-in → hidden without settings
    expect(link(wrapper, '/available-channels').exists()).toBe(false)
    expect(link(wrapper, '/affiliate').exists()).toBe(false)
  })

  it('opt-out flags hide items when the backend explicitly disables them', async () => {
    const { wrapper } = await mountNav({
      path: '/dashboard',
      settings: { channel_monitor_enabled: false, payment_enabled: false },
    })
    expect(link(wrapper, '/monitor').exists()).toBe(false)
    expect(link(wrapper, '/purchase').exists()).toBe(false)
    expect(link(wrapper, '/orders').exists()).toBe(false)
  })

  it('opt-in flags show items only when explicitly enabled', async () => {
    const { wrapper } = await mountNav({
      path: '/dashboard',
      settings: { available_channels_enabled: true, affiliate_enabled: true },
    })
    expect(link(wrapper, '/available-channels').exists()).toBe(true)
    expect(link(wrapper, '/affiliate').exists()).toBe(true)
  })

  it('admin ops/payment flags come from the admin settings store', async () => {
    const { wrapper } = await mountNav({
      path: '/admin/dashboard',
      admin: true,
      opsMonitoring: false,
      paymentEnabled: false,
    })
    expect(link(wrapper, '/admin/ops').exists()).toBe(false)
    // Orders group hidden entirely (dashboard + orders + plans)
    expect(link(wrapper, '/admin/orders').exists()).toBe(false)
    expect(link(wrapper, '/admin/orders/plans').exists()).toBe(false)
    expect(link(wrapper, '/admin/orders/dashboard').exists()).toBe(false)
  })

  it('admin ops/payment items appear when the store enables them', async () => {
    const { wrapper } = await mountNav({
      path: '/admin/dashboard',
      admin: true,
      opsMonitoring: true,
      paymentEnabled: true,
    })
    expect(link(wrapper, '/admin/ops').exists()).toBe(true)
    expect(link(wrapper, '/admin/orders').exists()).toBe(true)
    expect(link(wrapper, '/admin/orders/dashboard').exists()).toBe(true)
  })
})

describe('GlobalNav — simple-mode filtering (rendered)', () => {
  it('user simple mode drops hideInSimpleMode items', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', simple: true })
    expect(link(wrapper, '/dashboard').exists()).toBe(true)
    expect(link(wrapper, '/keys').exists()).toBe(true)
    expect(link(wrapper, '/profile').exists()).toBe(true)
    expect(link(wrapper, '/usage').exists()).toBe(false)
    expect(link(wrapper, '/subscriptions').exists()).toBe(false)
    expect(link(wrapper, '/purchase').exists()).toBe(false)
    expect(link(wrapper, '/redeem').exists()).toBe(false)
    expect(link(wrapper, '/batch-image').exists()).toBe(false)
  })

  it('admin simple mode keeps a flat list and re-appends /keys + settings', async () => {
    const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true, simple: true })
    expect(link(wrapper, '/admin/dashboard').exists()).toBe(true)
    expect(link(wrapper, '/admin/accounts').exists()).toBe(true)
    expect(link(wrapper, '/admin/announcements').exists()).toBe(true)
    expect(link(wrapper, '/admin/proxies').exists()).toBe(true)
    expect(link(wrapper, '/admin/usage').exists()).toBe(true)
    expect(link(wrapper, '/keys').exists()).toBe(true)
    expect(link(wrapper, '/admin/settings').exists()).toBe(true)
    expect(link(wrapper, '/admin/users').exists()).toBe(false)
    expect(link(wrapper, '/admin/groups').exists()).toBe(false)
    expect(link(wrapper, '/admin/subscriptions').exists()).toBe(false)
    expect(link(wrapper, '/admin/redeem').exists()).toBe(false)
    // No flyout groups in simple mode
    expect(wrapper.findAll('[data-flyout]')).toHaveLength(0)
  })

  it('admin standard mode renders the flyout mega-menu groups', async () => {
    const { wrapper } = await mountNav({
      path: '/admin/dashboard',
      admin: true,
      settings: { risk_control_enabled: true, affiliate_enabled: true },
    })
    const flyouts = wrapper.findAll('[data-flyout]')
    expect(flyouts.map((f) => f.attributes('data-flyout-key'))).toEqual(
      ADMIN_FLYOUT_GROUPS.map((g) => g.key),
    )
    expect(link(wrapper, '/admin/accounts').exists()).toBe(true)
    expect(link(wrapper, '/admin/risk-control').exists()).toBe(true)
    expect(link(wrapper, '/admin/prompt-audit').exists()).toBe(true)
    expect(link(wrapper, '/admin/affiliates/transfers').exists()).toBe(true)
  })
})

describe('GlobalNav — custom menu items (rendered)', () => {
  it('user custom items are sorted by sort_order, visibility-filtered, appended last', async () => {
    const custom: CustomMenuItem[] = [
      { id: 'alpha', label: 'Alpha', icon_svg: '', url: '', visibility: 'user', sort_order: 2 },
      { id: 'beta', label: 'Beta', icon_svg: '', url: '', visibility: 'user', sort_order: 1 },
      { id: 'admin-only', label: 'AdminOnly', icon_svg: '', url: '', visibility: 'admin', sort_order: 0 },
    ]
    const { wrapper } = await mountNav({
      path: '/dashboard',
      settings: { custom_menu_items: custom },
    })
    const customLinks = wrapper.findAll('.gn-links a[href^="/custom/"]')
    expect(customLinks.map((a) => a.attributes('href'))).toEqual(['/custom/beta', '/custom/alpha'])
    expect(customLinks[0].text()).toContain('Beta')
  })

  it('admin custom items are appended after settings, user items are not shown', async () => {
    const userCustom: CustomMenuItem[] = [
      { id: 'user-one', label: 'UserOne', icon_svg: '', url: '', visibility: 'user', sort_order: 1 },
    ]
    const adminCustom: CustomMenuItem[] = [
      { id: 'admin-one', label: 'AdminOne', icon_svg: '', url: '', visibility: 'admin', sort_order: 1 },
    ]
    const { wrapper } = await mountNav({
      path: '/admin/dashboard',
      admin: true,
      settings: { custom_menu_items: userCustom },
      adminCustomItems: adminCustom,
    })
    expect(link(wrapper, '/custom/admin-one').exists()).toBe(true)
    expect(link(wrapper, '/custom/user-one').exists()).toBe(false)
  })
})

describe('GlobalNav — active-route highlighting (rendered)', () => {
  it('top-level links highlight on exact and prefix matches', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', settings: {} })
    expect(link(wrapper, '/dashboard').classes()).toContain('active')
    expect(link(wrapper, '/keys').classes()).not.toContain('active')
  })

  it('a flyout group highlights when one of its children is the current route', async () => {
    const { wrapper } = await mountNav({ path: '/admin/accounts', admin: true })
    const resources = wrapper.find('[data-flyout-key="resources"]')
    expect(resources.exists()).toBe(true)
    expect(resources.find('button.gn-link').classes()).toContain('active')
    expect(link(wrapper, '/admin/accounts').classes()).toContain('active')
    // unrelated groups stay inactive
    expect(wrapper.find('[data-flyout-key="operations"]').find('button.gn-link').classes()).not.toContain('active')
  })

  it('flyout leaves use exact matching (orders vs orders/dashboard)', async () => {
    const { wrapper } = await mountNav({ path: '/admin/orders/dashboard', admin: true, paymentEnabled: true })
    expect(link(wrapper, '/admin/orders/dashboard').classes()).toContain('active')
    // the /admin/orders leaf lives in Operations and must NOT highlight
    expect(link(wrapper, '/admin/orders').classes()).not.toContain('active')
    expect(wrapper.find('[data-flyout-key="analytics"]').find('button.gn-link').classes()).toContain('active')
  })

  it('simple-mode admin flat links highlight', async () => {
    const { wrapper } = await mountNav({ path: '/admin/accounts', admin: true, simple: true })
    expect(link(wrapper, '/admin/accounts').classes()).toContain('active')
  })
})

describe('GlobalNav — backend mode / bare nav', () => {
  it('non-admin users in backend mode see no nav links at all', async () => {
    const { wrapper } = await mountNav({
      path: '/dashboard',
      settings: { backend_mode_enabled: true },
    })
    expect(wrapper.findAll('.gn-links a')).toHaveLength(0)
    expect(wrapper.findAll('.gn-burger')).toHaveLength(0)
    expect(wrapper.find('.gn-wordmark').exists()).toBe(true)
  })
})

describe('GlobalNav — onboarding tour anchors', () => {
  it('carries the sidebar tour ids onto the equivalent flyout links', async () => {
    const accounts = await mountNav({ path: '/admin/accounts', admin: true })
    expect(accounts.wrapper.find('#sidebar-channel-manage').exists()).toBe(true)
    accounts.wrapper.unmount()

    const groups = await mountNav({ path: '/admin/groups', admin: true })
    expect(groups.wrapper.find('#sidebar-group-manage').exists()).toBe(true)
    groups.wrapper.unmount()

    const redeem = await mountNav({ path: '/admin/redeem', admin: true })
    expect(redeem.wrapper.find('#sidebar-wallet').exists()).toBe(true)
    redeem.wrapper.unmount()
  })

  it('carries data-tour="sidebar-my-keys" for user /keys and admin dropdown /keys', async () => {
    const user = await mountNav({ path: '/keys', settings: {} })
    expect(user.wrapper.find('[data-tour="sidebar-my-keys"]').exists()).toBe(true)
    user.wrapper.unmount()

    const admin = await mountNav({ path: '/admin/dashboard', admin: true })
    await admin.wrapper.find('.gn-avatar').trigger('click')
    expect(admin.wrapper.find('[data-tour="sidebar-my-keys"]').exists()).toBe(true)
    admin.wrapper.unmount()
  })
})

describe('GlobalNav — re-homed header action cluster', () => {
  it('renders bell / sub-progress / balance / dropdown only for authenticated users', async () => {
    const anon = await mountNav({ path: '/dashboard', user: null })
    expect(anon.wrapper.find('[data-testid="announcement-bell"]').exists()).toBe(false)
    expect(anon.wrapper.find('[data-testid="sub-progress"]').exists()).toBe(false)
    expect(anon.wrapper.find('.gn-balance').exists()).toBe(false)
    expect(anon.wrapper.find('.gn-avatar').exists()).toBe(false)
    anon.wrapper.unmount()

    const authed = await mountNav({ path: '/dashboard' })
    expect(authed.wrapper.find('[data-testid="announcement-bell"]').exists()).toBe(true)
    expect(authed.wrapper.find('[data-testid="sub-progress"]').exists()).toBe(true)
    expect(authed.wrapper.find('[data-testid="locale-switcher"]').exists()).toBe(true)
    expect(authed.wrapper.find('.gn-balance').text()).toContain('$100.00')
    expect(authed.wrapper.find('.gn-avatar').exists()).toBe(true)
  })

  it('docs and model plaza links appear when configured', async () => {
    const { wrapper } = await mountNav({
      path: '/dashboard',
      settings: { doc_url: 'https://docs.example.com', model_plaza_enabled: true },
    })
    expect(wrapper.find('a[href^="https://docs.example.com"]').exists()).toBe(true)
    const plaza = wrapper.find('a[href="/model-plaza?embedded=1"]')
    expect(plaza.exists()).toBe(true)
  })

  it('user dropdown contains profile, keys, contact support and logout', async () => {
    const { wrapper } = await mountNav({
      path: '/dashboard',
      settings: { contact_info: 'support@example.com' },
    })
    await wrapper.find('.gn-avatar').trigger('click')
    expect(wrapper.find('.gn-pop').exists()).toBe(true)
    expect(link(wrapper, '/profile').exists()).toBe(true)
    expect(link(wrapper, '/keys').exists()).toBe(true)
    expect(wrapper.text()).toContain('support@example.com')
    expect(wrapper.text()).toContain('退出登录')
    // balance shown inside the dropdown for mobile
    expect(wrapper.find('.gn-pop-mobile-balance').exists()).toBe(true)
  })

  it('admin dropdown adds the GitHub link and replay-guide button', async () => {
    const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })
    await wrapper.find('.gn-avatar').trigger('click')
    expect(wrapper.find('a[href="https://github.com/Wei-Shaw/sub2api"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('GitHub')
  })

  it('theme toggle drives the real useTheme composable (html.dark + localStorage)', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', user: null })
    const themeBtn = wrapper.find('button[aria-label="深色模式"]')
    expect(themeBtn.exists()).toBe(true)
    await themeBtn.trigger('click')
    expect(useTheme().isDark.value).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(wrapper.find('button[aria-label="浅色模式"]').exists()).toBe(true)
  })

  it('flyout opens on trigger click and search bar expands', async () => {
    const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })
    const trigger = wrapper.find('[data-flyout-key="resources"] button.gn-link')
    await trigger.trigger('click')
    expect(wrapper.find('[data-flyout-key="resources"]').classes()).toContain('open')

    await wrapper.find('button[aria-label="搜索"]').trigger('click')
    expect(wrapper.find('.gn-search-bar').classes()).toContain('open')
  })

  /**
   * Flyout open/close is driven by three input paths (hover, focus, click) that
   * the browser fires in one fixed order for a single physical gesture:
   *
   *   pointerenter -> pointerdown -> focusin -> pointerup -> click
   *
   * A naive `openFlyout` toggle self-cancels under that ordering: hover opens
   * the flyout and the trailing click closes it, so a touch tap can never open
   * a flyout at desktop widths (.gn-links only hides below 768px). These tests
   * pin the intended behaviour of each path so that regression cannot return
   * silently.
   */
  describe('flyout interaction contract', () => {
    const RESOURCES = '[data-flyout-key="resources"]'

    const isOpen = (wrapper: VueWrapper) =>
      wrapper.find(RESOURCES).classes().includes('open')

    /** Replay the browser's full event sequence for one tap/click. */
    async function gesture(wrapper: VueWrapper, pointerType: 'mouse' | 'touch') {
      const item = wrapper.find(RESOURCES)
      const button = wrapper.find(`${RESOURCES} button.gn-link`)
      await item.trigger('pointerenter', { pointerType })
      await button.trigger('pointerdown', { pointerType })
      await item.trigger('focusin')
      await button.trigger('click')
    }

    it('a touch tap opens the flyout (hover path must not cancel the click)', async () => {
      const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })
      expect(isOpen(wrapper)).toBe(false)

      await gesture(wrapper, 'touch')
      expect(isOpen(wrapper)).toBe(true)
    })

    it('a second tap closes the flyout', async () => {
      const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })
      await gesture(wrapper, 'touch')
      expect(isOpen(wrapper)).toBe(true)

      await gesture(wrapper, 'touch')
      expect(isOpen(wrapper)).toBe(false)
    })

    it('mouse hover reveals the flyout and clicking pins it open', async () => {
      const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })
      const item = wrapper.find(RESOURCES)

      await item.trigger('pointerenter', { pointerType: 'mouse' })
      expect(isOpen(wrapper)).toBe(true)

      // Clicking what hover already revealed must keep it open, not toggle it shut.
      await gesture(wrapper, 'mouse')
      expect(isOpen(wrapper)).toBe(true)

      // Pinned by the click, so it survives the cursor leaving.
      await item.trigger('mouseleave')
      expect(isOpen(wrapper)).toBe(true)
    })

    it('a hover-only flyout closes when the cursor leaves', async () => {
      const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })
      const item = wrapper.find(RESOURCES)

      await item.trigger('pointerenter', { pointerType: 'mouse' })
      expect(isOpen(wrapper)).toBe(true)

      await item.trigger('mouseleave')
      expect(isOpen(wrapper)).toBe(false)
    })

    it('keyboard focus opens the flyout and Escape closes it', async () => {
      const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })

      await wrapper.find(RESOURCES).trigger('focusin')
      expect(isOpen(wrapper)).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await nextTick()
      expect(isOpen(wrapper)).toBe(false)
    })

    it('exposes flyout state through aria-expanded', async () => {
      const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })
      const button = wrapper.find(`${RESOURCES} button.gn-link`)
      expect(button.attributes('aria-expanded')).toBe('false')

      await gesture(wrapper, 'touch')
      expect(button.attributes('aria-expanded')).toBe('true')
    })
  })
})

/* ------------------------------------------------------- module regression */

/**
 * Command palette (⌘K) integration — Phase C.
 *
 * The unit-level behavior (fuzzy matching, arrow keys, focus trap, scroll lock)
 * is covered in components/command/__tests__/CommandPalette.spec.ts. What can
 * only be verified here is the part that is a *functional* contract rather than
 * a visual one: the palette's command source must inherit the bar's
 * `featureFlag` / `hideInSimpleMode` filtering, so a feature that is switched
 * off for this deployment — or hidden for this user's mode — cannot be found
 * and navigated to through search.
 */
describe('GlobalNav — command palette (⌘K)', () => {
  const pressShortcut = () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true }),
    )

  it('⌘K opens the palette and Escape closes it', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', settings: {} })

    expect(wrapper.find('.gn-cmdk-inner').exists()).toBe(false)

    pressShortcut()
    await nextTick()
    expect(wrapper.find('.gn-cmdk').classes()).toContain('open')
    expect(paletteInput(wrapper).exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('.gn-cmdk').classes()).not.toContain('open')
    expect(wrapper.find('.gn-cmdk-inner').exists()).toBe(false)

    wrapper.unmount()
  })

  it('the bar search button toggles the palette and reports state via aria', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', settings: {} })
    const button = searchButton(wrapper)

    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.attributes('aria-haspopup')).toBe('dialog')

    await openCommandPalette(wrapper)
    expect(searchButton(wrapper).attributes('aria-expanded')).toBe('true')

    await searchButton(wrapper).trigger('click')
    await nextTick()
    expect(searchButton(wrapper).attributes('aria-expanded')).toBe('false')

    wrapper.unmount()
  })

  it('offers exactly the user nav the bar renders, grouped', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', settings: {} })
    await openCommandPalette(wrapper)

    expect(palettePaths(wrapper)).toEqual([
      '/dashboard',
      '/keys',
      '/usage',
      '/monitor',
      '/subscriptions',
      '/purchase',
      '/orders',
      '/redeem',
      '/profile',
    ])
    expect(paletteGroupTitles(wrapper)).toEqual(['页面'])

    wrapper.unmount()
  })

  it('does NOT expose feature-flagged-off pages (opt-out flags disabled)', async () => {
    const { wrapper } = await mountNav({
      path: '/dashboard',
      settings: { channel_monitor_enabled: false, payment_enabled: false },
    })
    await openCommandPalette(wrapper)

    const paths = palettePaths(wrapper)
    // Same three paths the bar drops for these flags.
    expect(paths).not.toContain('/monitor')
    expect(paths).not.toContain('/purchase')
    expect(paths).not.toContain('/orders')
    // ...and the rest is still searchable.
    expect(paths).toContain('/keys')
    expect(paths).toContain('/usage')

    wrapper.unmount()
  })

  it('does NOT expose opt-in pages the backend never enabled', async () => {
    const off = await mountNav({ path: '/dashboard', settings: {} })
    await openCommandPalette(off.wrapper)
    expect(palettePaths(off.wrapper)).not.toContain('/available-channels')
    expect(palettePaths(off.wrapper)).not.toContain('/affiliate')
    off.wrapper.unmount()

    const on = await mountNav({
      path: '/dashboard',
      settings: { available_channels_enabled: true, affiliate_enabled: true },
    })
    await openCommandPalette(on.wrapper)
    expect(palettePaths(on.wrapper)).toContain('/available-channels')
    expect(palettePaths(on.wrapper)).toContain('/affiliate')
    on.wrapper.unmount()
  })

  it('does NOT expose admin pages whose store flags are off', async () => {
    const { wrapper } = await mountNav({
      path: '/admin/dashboard',
      admin: true,
      opsMonitoring: false,
      paymentEnabled: false,
    })
    await openCommandPalette(wrapper)

    const paths = palettePaths(wrapper)
    expect(paths).not.toContain('/admin/ops')
    expect(paths).not.toContain('/admin/orders')
    expect(paths).not.toContain('/admin/orders/plans')
    expect(paths).not.toContain('/admin/orders/dashboard')
    expect(paths).toContain('/admin/accounts')

    wrapper.unmount()
  })

  it('does NOT expose hideInSimpleMode pages in user simple mode', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', simple: true })
    await openCommandPalette(wrapper)

    const paths = palettePaths(wrapper)
    expect(paths).toEqual(['/dashboard', '/keys', '/monitor', '/profile'])
    for (const hidden of ['/usage', '/subscriptions', '/purchase', '/redeem', '/batch-image']) {
      expect(paths).not.toContain(hidden)
    }

    wrapper.unmount()
  })

  it('does NOT expose hideInSimpleMode pages in admin simple mode', async () => {
    const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true, simple: true })
    await openCommandPalette(wrapper)

    const paths = palettePaths(wrapper)
    expect(paths).toContain('/admin/accounts')
    expect(paths).toContain('/admin/settings')
    expect(paths).toContain('/keys')
    for (const hidden of [
      '/admin/users',
      '/admin/groups',
      '/admin/subscriptions',
      '/admin/redeem',
      '/admin/audit-logs',
    ]) {
      expect(paths).not.toContain(hidden)
    }

    wrapper.unmount()
  })

  it('groups admin results to mirror the flyout mega-menu, account pages last', async () => {
    const { wrapper } = await mountNav({
      path: '/admin/dashboard',
      admin: true,
      settings: { risk_control_enabled: true, affiliate_enabled: true },
    })
    await openCommandPalette(wrapper)

    expect(paletteGroupTitles(wrapper)).toEqual(['页面', '资源', '运营', '分析', '我的账户'])
    // Container paths are not navigable and must not appear as rows.
    const paths = palettePaths(wrapper)
    expect(paths).not.toContain('/admin/channels')
    expect(paths).not.toContain('/admin/security-audit')
    expect(paths).not.toContain('/admin/affiliates')
    expect(paths).toContain('/admin/channels/pricing')
    expect(paths).toContain('/admin/risk-control')

    wrapper.unmount()
  })

  it('fuzzy-matches labels and navigates on Enter', async () => {
    const { wrapper, router } = await mountNav({ path: '/admin/dashboard', admin: true })
    await openCommandPalette(wrapper)

    // "账管" is a non-adjacent subsequence of 账号管理 (Accounts).
    await paletteInput(wrapper).setValue('账管')
    expect(palettePaths(wrapper)).toEqual(['/admin/accounts'])

    await paletteInput(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/admin/accounts')
    expect(wrapper.find('.gn-cmdk-inner').exists()).toBe(false)

    wrapper.unmount()
  })

  it('arrow keys pick a lower result and Enter navigates there', async () => {
    const { wrapper, router } = await mountNav({ path: '/dashboard', settings: {} })
    await openCommandPalette(wrapper)

    await paletteInput(wrapper).trigger('keydown', { key: 'ArrowDown' })
    await paletteInput(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Row 0 is /dashboard, row 1 is /keys.
    expect(router.currentRoute.value.path).toBe('/keys')

    wrapper.unmount()
  })

  it('raises the curtain and locks body scroll while open', async () => {
    const { wrapper } = await mountNav({ path: '/dashboard', settings: {} })
    expect(wrapper.find('.gn-curtain').classes()).not.toContain('open')
    expect(document.body.style.overflow).toBe('')

    await openCommandPalette(wrapper)
    expect(wrapper.find('.gn-curtain').classes()).toContain('open')
    expect(document.body.style.overflow).toBe('hidden')

    await searchButton(wrapper).trigger('click')
    await nextTick()
    expect(wrapper.find('.gn-curtain').classes()).not.toContain('open')
    expect(document.body.style.overflow).toBe('')

    wrapper.unmount()
  })

  it('opening the palette closes an open flyout', async () => {
    const { wrapper } = await mountNav({ path: '/admin/dashboard', admin: true })
    await wrapper.find('[data-flyout-key="resources"] button.gn-link').trigger('click')
    expect(wrapper.find('[data-flyout-key="resources"]').classes()).toContain('open')

    await openCommandPalette(wrapper)
    expect(wrapper.find('[data-flyout-key="resources"]').classes()).not.toContain('open')
    expect(wrapper.find('.gn-cmdk').classes()).toContain('open')

    wrapper.unmount()
  })

  it('closes on route change', async () => {
    const { wrapper, router } = await mountNav({ path: '/dashboard', settings: {} })
    await openCommandPalette(wrapper)
    expect(wrapper.find('.gn-cmdk').classes()).toContain('open')

    await router.push('/keys')
    await flushPromises()

    expect(wrapper.find('.gn-cmdk').classes()).not.toContain('open')
    expect(document.body.style.overflow).toBe('')

    wrapper.unmount()
  })

  it('is absent entirely when the user has no nav (backend mode)', async () => {
    const { wrapper } = await mountNav({
      path: '/dashboard',
      settings: { backend_mode_enabled: true },
    })

    expect(searchButton(wrapper).exists()).toBe(false)
    expect(wrapper.find('.gn-cmdk').exists()).toBe(false)

    // The shortcut must be a no-op rather than opening an empty palette.
    pressShortcut()
    await nextTick()
    expect(wrapper.find('.gn-cmdk').exists()).toBe(false)

    wrapper.unmount()
  })
})

describe('navItems — flyout spec regression (admin grouping)', () => {
  it('buildCommandEntries flattens groups, drops containers and dedupes paths', () => {
    const entries = buildCommandEntries(
      [
        {
          key: 'pages',
          labelKey: 'nav.commandGroupPages',
          items: [
            { path: '/admin/dashboard', labelKey: 'nav.dashboard' },
            // expandOnly containers have no navigable route — never emit them,
            // but their children must still be reachable.
            {
              path: '/admin/channels',
              labelKey: 'nav.channelManagement',
              expandOnly: true,
              children: [{ path: '/admin/channels/pricing', labelKey: 'nav.channelPricing' }],
            },
          ],
        },
        {
          key: 'account',
          labelKey: 'nav.commandGroupAccount',
          items: [
            // duplicate of a path already claimed by the first group
            { path: '/admin/dashboard', labelKey: 'nav.dashboard' },
            { path: '/keys', labelKey: 'nav.apiKeys' },
            { path: '/custom/x', label: 'Literal Label' },
          ],
        },
      ],
      (key) => key,
    )

    expect(entries.map((e) => e.path)).toEqual([
      '/admin/dashboard',
      '/admin/channels/pricing',
      '/keys',
      '/custom/x',
    ])
    // first group wins the duplicate
    expect(entries.find((e) => e.path === '/admin/dashboard')?.groupKey).toBe('pages')
    expect(entries.find((e) => e.path === '/keys')?.groupKey).toBe('account')
    // custom items keep their literal (untranslated) label
    expect(entries.find((e) => e.path === '/custom/x')?.label).toBe('Literal Label')
  })

  it('maps every admin route to its handoff group and column', () => {
    const expected = new Map<string, string>([
      // resources
      ['/admin/accounts', 'resources'],
      ['/admin/groups', 'resources'],
      ['/admin/proxies', 'resources'],
      ['/admin/channels/pricing', 'resources'],
      ['/admin/channels/monitor', 'resources'],
      // operations
      ['/admin/users', 'operations'],
      ['/admin/subscriptions', 'operations'],
      ['/admin/orders', 'operations'],
      ['/admin/orders/plans', 'operations'],
      ['/admin/redeem', 'operations'],
      ['/admin/promo-codes', 'operations'],
      ['/admin/announcements', 'operations'],
      ['/admin/affiliates/invites', 'operations'],
      ['/admin/affiliates/rebates', 'operations'],
      ['/admin/affiliates/transfers', 'operations'],
      // analytics
      ['/admin/usage', 'analytics'],
      ['/admin/ops', 'analytics'],
      ['/admin/orders/dashboard', 'analytics'],
      ['/admin/risk-control', 'analytics'],
      ['/admin/prompt-audit', 'analytics'],
      ['/admin/audit-logs', 'analytics'],
    ])
    const grouped = groupAdminNav(buildAdminNavItems(deps()))
    const actual = new Map<string, string>()
    for (const g of grouped.groups) {
      for (const c of g.columns) {
        for (const i of c.items) actual.set(i.path, g.key)
      }
    }
    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(expected))
    // top-level: dashboard + settings (+ customs)
    expect(grouped.topLevel.map((i) => i.path)).toEqual(['/admin/dashboard', '/admin/settings'])
  })
})

beforeEach(() => {
  mockAdminSettings.ops_monitoring_enabled = true
  mockAdminSettings.custom_menu_items = []
  mockPaymentConfig.data.enabled = false
  useTheme().setTheme('light')
  document.documentElement.classList.remove('dark')
  document.body.style.overflow = ''
  resetBodyScrollLock()
})
