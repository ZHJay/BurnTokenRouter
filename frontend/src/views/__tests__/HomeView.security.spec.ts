import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'

import HomeView from '../HomeView.vue'

const { appStore, authStore } = vi.hoisted(() => ({
  appStore: {
    cachedPublicSettings: {} as Record<string, unknown>,
    siteName: 'Fallback site',
    siteLogo: '',
    docUrl: '',
    publicSettingsLoaded: true,
    fetchPublicSettings: vi.fn(),
  },
  authStore: {
    isAuthenticated: false,
    isAdmin: false,
    user: null as { email?: string } | null,
    checkAuth: vi.fn(),
  },
}))

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
  useAuthStore: () => authStore,
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

function mountHome(settings: Record<string, unknown> = {}) {
  appStore.cachedPublicSettings = {
    site_name: 'Test site',
    site_subtitle: 'Test subtitle',
    ...settings,
  }

  return mount(HomeView, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        LocaleSwitcher: { template: '<div data-testid="locale-switcher" />' },
        Icon: { template: '<span data-testid="icon" />' },
      },
    },
  })
}

describe('HomeView home_content sanitization (S2)', () => {
  beforeEach(() => {
    authStore.isAuthenticated = false
    authStore.isAdmin = false
    authStore.user = null
    authStore.checkAuth.mockClear()
    appStore.fetchPublicSettings.mockClear()
    localStorage.clear()
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
  })

  it('renders markdown content through DOMPurify, not raw v-html', () => {
    const wrapper = mountHome({
      home_content: '# Big Title\n\n- a\n- b\n\n**bold** and ![pic](https://example.com/p.png)',
    })

    expect(wrapper.html()).toContain('<h1>Big Title</h1>')
    expect(wrapper.html()).toContain('<li>a</li>')
    expect(wrapper.html()).toContain('<strong>bold</strong>')
    expect(wrapper.html()).toContain('example.com/p.png')
  })

  it('strips <script> and event handlers from home_content', () => {
    const wrapper = mountHome({
      home_content: '<script>window.pwned=1</script><img src="x" onerror="window.pwned=1">Hi',
    })

    expect(wrapper.html()).not.toContain('<script')
    expect(wrapper.html()).not.toContain('onerror')
    expect(wrapper.html()).not.toContain('window.pwned')
    expect(wrapper.text()).toContain('Hi')
  })

  it('does not render the raw home_content string', () => {
    const wrapper = mountHome({
      home_content: '<img src="x" onerror="alert(1)">',
    })

    // 若 v-html 直出原始字符串，onerror 会原样出现在 DOM 中
    expect(wrapper.html()).not.toContain('onerror=')
    expect(wrapper.html()).not.toContain('alert(1)')
  })

  it('keeps the iframe URL mode untouched', () => {
    const wrapper = mountHome({
      home_content: 'https://example.com/embed',
    })

    expect(wrapper.get('iframe').attributes('src')).toBe('https://example.com/embed')
  })
})
