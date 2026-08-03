/**
 * AppLayout: skip-to-content link and the bottom safe-area inset.
 *
 * jsdom resolves neither media queries nor env(), so the inset is asserted as a
 * class/declaration. It was verified for real in Chromium via the CDP
 * Emulation.setSafeAreaInsetsOverride path recorded in the task report
 * (bottom:34 -> main padding-bottom 50px = 1rem + 34px).
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppLayout from '../AppLayout.vue'

/*
 * Resolve dotted key paths out of the REAL en bundle, and echo anything that
 * misses — which is what vue-i18n itself does for an unresolved key.
 *
 * A real vue-i18n instance cannot stand in here: vite.config.ts aliases the
 * runtime-only build (CSP: no unsafe-eval) and pairs it with
 * `define: { __INTLIFY_JIT_COMPILATION__: true }`, but vitest.config.ts copies
 * only the alias. Without that flag core-base refuses to compile plain-string
 * messages and every t() returns the key path, so a real instance would report
 * a false failure here.
 *
 * Resolving from the bundle rather than hardcoding the string keeps the skip
 * link's label assertion honest: delete common.skipToContent from the locale
 * files and this spec fails.
 */
vi.mock('vue-i18n', async () => {
  const en = (await import('@/i18n/locales/en')).default as Record<string, unknown>

  const t = (key: string): string => {
    const hit = key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        en
      )
    return typeof hit === 'string' ? hit : key
  }

  return {
    createI18n: () => ({ global: { t }, install: () => {} }),
    useI18n: () => ({ t, locale: { value: 'en' } }),
  }
})

vi.mock('@/stores', () => ({
  useAppStore: () => ({ sidebarCollapsed: false }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'admin' } }),
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({ setReplayCallback: vi.fn() }),
}))

vi.mock('@/composables/useOnboardingTour', () => ({
  useOnboardingTour: () => ({ replayTour: vi.fn() }),
}))

vi.mock('@/styles/onboarding.css', () => ({}))

const stubs = {
  AppSidebar: { template: '<aside class="sidebar-stub"><a href="/dashboard">Dashboard</a></aside>' },
  AppHeader: { template: '<header class="header-stub"><h1>Dashboard</h1></header>' },
}

function mountLayout() {
  return mount(AppLayout, {
    attachTo: document.body,
    slots: { default: '<button type="button">In main</button>' },
    global: { stubs },
  })
}

describe('AppLayout skip link (task 5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is the first focusable element in the document', () => {
    const wrapper = mountLayout()

    const focusable = wrapper.findAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    expect(focusable.length).toBeGreaterThan(1)
    // Before this, the first ~28 tab stops on every page were sidebar nav links.
    expect(focusable[0].attributes('href')).toBe('#main-content')

    wrapper.unmount()
  })

  it('points at an id that exists, on the main landmark', () => {
    const wrapper = mountLayout()

    const link = wrapper.get('a[href="#main-content"]')
    const target = wrapper.find('#main-content')

    expect(target.exists()).toBe(true)
    expect(target.element.tagName.toLowerCase()).toBe('main')
    expect(link.attributes('href')).toBe(`#${target.attributes('id')}`)

    wrapper.unmount()
  })

  it('makes the target able to receive focus without joining the tab order', () => {
    const wrapper = mountLayout()

    // Without tabindex="-1" the fragment jump moves scroll but not focus, so the
    // next Tab resumes from the skip link and walks back into the sidebar.
    expect(wrapper.get('#main-content').attributes('tabindex')).toBe('-1')

    wrapper.unmount()
  })

  it('stays visually hidden until focused', () => {
    const wrapper = mountLayout()

    const classes = wrapper.get('a[href="#main-content"]').classes()
    expect(classes).toContain('sr-only')
    expect(classes).toContain('focus:not-sr-only')
    // z-50 clears the header (z-30) and the sidebar once revealed.
    expect(classes).toContain('focus:z-50')

    wrapper.unmount()
  })

  it('renders readable text rather than a raw i18n key', () => {
    const wrapper = mountLayout()

    const text = wrapper.get('a[href="#main-content"]').text()
    expect(text).toBe('Skip to main content')
    expect(text).not.toContain('common.skipToContent')

    wrapper.unmount()
  })

  it('sources that text from the locale bundles, in both locales', async () => {
    const en = (await import('@/i18n/locales/en')).default
    const zh = (await import('@/i18n/locales/zh')).default

    // The label the component actually renders is the en bundle's value, not a
    // literal held in the component.
    const wrapper = mountLayout()
    expect(wrapper.get('a[href="#main-content"]').text()).toBe(en.common.skipToContent)
    wrapper.unmount()

    // zh is asserted at the bundle: this spec pins the mocked locale to en, and
    // the label is now a plain t() call, so zh renders whatever lives here.
    expect(zh.common.skipToContent).toBe('跳转到主要内容')
    expect(zh.common.skipToContent).not.toBe('common.skipToContent')
  })

  it('is focusable and reachable in DOM order ahead of the sidebar', async () => {
    const wrapper = mountLayout()

    const link = wrapper.get('a[href="#main-content"]').element as HTMLElement
    link.focus()
    expect(document.activeElement).toBe(link)

    const sidebarLink = wrapper.get('aside a').element
    expect(link.compareDocumentPosition(sidebarLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    wrapper.unmount()
  })
})

describe('AppLayout bottom safe-area inset (task 2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds the bottom inset to main padding at every breakpoint', () => {
    const wrapper = mountLayout()
    const classes = wrapper.get('main').classes()

    expect(classes).toContain('pb-[calc(1rem+env(safe-area-inset-bottom))]')
    expect(classes).toContain('md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]')
    expect(classes).toContain('lg:pb-[calc(2rem+env(safe-area-inset-bottom))]')

    // The old fixed paddings must be gone, or the later declaration wins and the
    // inset term is silently dropped.
    expect(classes).not.toContain('pb-4')
    expect(classes).not.toContain('md:pb-6')
    expect(classes).not.toContain('lg:pb-8')

    wrapper.unmount()
  })

  it('leaves the header offset padding untouched', () => {
    const wrapper = mountLayout()
    const classes = wrapper.get('main').classes()

    // The top inset is the header's job (AppHeader grows by it); main only ever
    // reserved the 64px bar plus breathing room.
    expect(classes).toContain('pt-[4.5rem]')
    expect(classes).toContain('md:pt-[5rem]')

    wrapper.unmount()
  })
})
