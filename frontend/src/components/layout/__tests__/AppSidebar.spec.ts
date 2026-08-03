/**
 * AppSidebar — mounted behaviour.
 *
 * This file used to assert on `readFileSync(AppSidebar.vue)` source text
 * (`expect(componentSource).toContain('ref="sidebarNavRef"')` and friends).
 * That is a change detector: it broke on any refactor while proving nothing
 * about what the component does, and it passed happily while the closed drawer
 * kept 30-odd focusable elements in the tab order. Everything that can be
 * observed on a mounted component is asserted on a mounted component here.
 *
 * jsdom caveats that shape these tests:
 *   - `src/__tests__/setup.ts` stubs `matchMedia` to return `matches: true` for
 *     EVERY query, so the component's `(min-width: 1024px)` check reads as
 *     desktop unless a test overrides it. `mountSidebar({ mobile: true })`
 *     installs a real query-aware stub.
 *   - jsdom does not implement the `inert` property, so Vue writes it as an
 *     attribute. Assertions use `hasAttribute('inert')`, which is true in both
 *     environments (a browser reflects the IDL attribute).
 *   - jsdom has no layout: `offsetParent`/visibility cannot be measured, and
 *     `inert` does not actually remove anything from the tab order. Tab-stop
 *     assertions therefore check the contract the browser acts on (`inert` +
 *     `aria-hidden` on the container), and the real off-screen focus behaviour
 *     is verified in Chromium at 390px, not here.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import AppSidebar from '../AppSidebar.vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

// The composable hits GET /keys on mount to decide whether the Batch Images
// entry is visible. Unmocked it produces an unhandled rejection per test.
vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({
    canUseBatchImage: { value: false },
    batchImageAccessLoaded: { value: true },
    batchImageAccessLoading: { value: false },
    refreshBatchImageAccess: vi.fn().mockResolvedValue(false)
  })
}))

// The admin branch fetches admin settings (for feature-gated nav items) on
// mount, which jsdom turns into a real XHR and an AggregateError in the log.
// Flags left undefined on purpose: `applyFeatureFlags` treats undefined as
// "show", so the admin nav renders in full rather than depending on a fixture.
vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({
    customMenuItems: [],
    fetch: vi.fn().mockResolvedValue(undefined)
  })
}))

const Blank = defineComponent({ render: () => h('div') })

/*
 * Every mount is tracked and unmounted. `attachTo: document.body` plus a bare
 * `body.innerHTML = ''` detaches the nodes but leaves the component instances
 * alive, and a leftover instance keeps its document-level keydown listener and
 * its own watchers running against the previous test's store — which is what
 * made the scrim and Back cases pass alone and fail in the suite.
 */
const mountedWrappers: VueWrapper[] = []

function track<T extends VueWrapper>(wrapper: T): T {
  mountedWrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  document.body.className = ''
  document.body.innerHTML = ''
})

afterEach(() => {
  while (mountedWrappers.length > 0) {
    mountedWrappers.pop()?.unmount()
  }
  document.body.className = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function createTestRouter(): Router {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', redirect: '/dashboard' },
      { path: '/dashboard', component: Blank },
      { path: '/keys', component: Blank },
      { path: '/usage', component: Blank },
      { path: '/admin/dashboard', component: Blank },
      { path: '/admin/accounts', component: Blank },
      { path: '/admin/orders', component: Blank },
      { path: '/admin/orders/plans', component: Blank }
    ]
  })
}

/**
 * Query-aware matchMedia. The global stub answers `matches: true` to
 * everything, which makes the sidebar believe it is always on a desktop
 * viewport; a width-dependent test has to be able to say otherwise.
 *
 * One MediaQueryList per query string, cached: the component registers a
 * `change` listener on the object it gets back, and a test that wants to fire
 * that listener has to be handed the same object.
 */
const mediaQueryLists = new Map<string, MediaQueryList>()

function installMatchMedia(desktop: boolean): void {
  mediaQueryLists.clear()
  window.matchMedia = ((query: string) => {
    const matches = query.includes('min-width: 1024px')
      ? desktop
      : query.includes('prefers-color-scheme: dark')
        ? false
        : true
    const cached = mediaQueryLists.get(query)
    if (cached) return cached
    const mql = {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    } as unknown as MediaQueryList
    mediaQueryLists.set(query, mql)
    return mql
  }) as unknown as typeof window.matchMedia
}

/** Fires the `change` listener the component registered for `query`. */
function emitMediaQueryChange(query: string, matches: boolean): void {
  const mql = mediaQueryLists.get(query)
  const register = mql?.addEventListener as unknown as ReturnType<typeof vi.fn>
  const call = register?.mock.calls.find((args: unknown[]) => args[0] === 'change')
  if (!call) throw new Error(`no change listener registered for ${query}`)
  ;(call[1] as (event: MediaQueryListEvent) => void)({ matches } as MediaQueryListEvent)
}

interface MountOptions {
  /** false => viewport reports < 1024px, i.e. the off-canvas drawer. */
  mobile?: boolean
  admin?: boolean
  route?: string
}

interface MountedSidebar {
  wrapper: VueWrapper
  router: Router
  appStore: ReturnType<typeof useAppStore>
  aside: HTMLElement
}

function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: {} }
  })
}

async function mountSidebar(options: MountOptions = {}): Promise<MountedSidebar> {
  const { mobile = false, admin = false, route = '/dashboard' } = options

  installMatchMedia(!mobile)
  setActivePinia(createPinia())

  const router = createTestRouter()
  await router.push(route)
  await router.isReady()

  const authStore = useAuthStore()
  if (admin) {
    authStore.user = { id: 1, username: 'admin', email: 'a@example.com', role: 'admin' } as never
  }

  const wrapper = track(
    mount(AppSidebar, {
      attachTo: document.body,
      global: {
        plugins: [router, createTestI18n()],
        stubs: {
          // Its admin branch fetches /version on mount and is irrelevant here.
          VersionBadge: true
        }
      }
    })
  )
  await flushPromises()

  return {
    wrapper,
    router,
    appStore: useAppStore(),
    aside: wrapper.get('aside').element as HTMLElement
  }
}

/** Opens the drawer the way the header burger does, and settles the watcher. */
async function openDrawer(mounted: MountedSidebar): Promise<void> {
  mounted.appStore.setMobileOpen(true)
  await nextTick()
  await nextTick()
}

/** Polls until the router has settled on `path`. */
async function waitForPath(router: Router, path: string, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (router.currentRoute.value.path !== path) {
    if (Date.now() > deadline) {
      throw new Error(`router stayed on ${router.currentRoute.value.path}, expected ${path}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
    await flushPromises()
  }
}

describe('AppSidebar closed off-canvas drawer', () => {
  it('is inert and aria-hidden at mobile widths while closed', async () => {
    const { aside } = await mountSidebar({ mobile: true })

    expect(aside.hasAttribute('inert')).toBe(true)
    expect(aside.getAttribute('aria-hidden')).toBe('true')
  })

  it('exposes no reachable tab stops while closed', async () => {
    const { aside } = await mountSidebar({ mobile: true })

    // The drawer is still full of links and buttons — that is exactly the bug:
    // it is only moved off-screen by a transform.
    const focusables = aside.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    expect(focusables.length).toBeGreaterThan(0)

    // Reachability is a property of the container, and both halves are needed:
    // `inert` removes them from the tab order and from hit-testing, while
    // `aria-hidden` removes them from the a11y tree for AT that predates inert.
    expect(aside.hasAttribute('inert')).toBe(true)
    expect(aside.getAttribute('aria-hidden')).toBe('true')

    // Nothing inside carries a positive tabindex that would survive `inert`
    // being unsupported, and none of them is explicitly kept focusable.
    for (const el of focusables) {
      const tabindex = el.getAttribute('tabindex')
      expect(tabindex === null || Number(tabindex) <= 0).toBe(true)
    }
    // jsdom implements neither `inert` nor layout, so it cannot be asked
    // whether these are actually reachable — `focus()` still works here. The
    // real count (0 focusable, first Tab lands outside) is measured in Chromium
    // at 390px; see the browser verification in the PR notes.
  })

  it('drops inert and aria-hidden once open', async () => {
    const mounted = await mountSidebar({ mobile: true })
    await openDrawer(mounted)

    expect(mounted.aside.hasAttribute('inert')).toBe(false)
    expect(mounted.aside.hasAttribute('aria-hidden')).toBe(false)
  })

  it('is never inert at desktop widths, where it is a permanent rail', async () => {
    const { aside } = await mountSidebar({ mobile: false })

    expect(aside.hasAttribute('inert')).toBe(false)
    expect(aside.hasAttribute('aria-hidden')).toBe(false)
    expect(aside.getAttribute('role')).toBeNull()
  })

  it('releases inert when the viewport grows past the drawer breakpoint', async () => {
    const mounted = await mountSidebar({ mobile: true })
    expect(mounted.aside.hasAttribute('inert')).toBe(true)

    emitMediaQueryChange('(min-width: 1024px)', true)
    await nextTick()

    expect(mounted.aside.hasAttribute('inert')).toBe(false)
  })
})

describe('AppSidebar drawer scroll lock', () => {
  it('locks the body while open and releases it on close', async () => {
    const mounted = await mountSidebar({ mobile: true })
    expect(document.body.classList.contains('modal-open')).toBe(false)

    await openDrawer(mounted)
    expect(document.body.classList.contains('modal-open')).toBe(true)

    mounted.appStore.setMobileOpen(false)
    await nextTick()
    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('does not lock the body at desktop widths', async () => {
    const mounted = await mountSidebar({ mobile: false })
    await openDrawer(mounted)

    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('releases the lock when unmounted while open', async () => {
    const mounted = await mountSidebar({ mobile: true })
    await openDrawer(mounted)
    expect(document.body.classList.contains('modal-open')).toBe(true)

    mounted.wrapper.unmount()
    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('leaves a dialog\u2019s lock in place when the drawer closes under it', async () => {
    const mounted = await mountSidebar({ mobile: true })
    await openDrawer(mounted)

    // BaseDialog teleports its overlay to <body> and sets the same class. Two
    // owners of one class is how a page ends up permanently unscrollable, so the
    // drawer must not unlock while a dialog is still up.
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    document.body.appendChild(overlay)

    mounted.appStore.setMobileOpen(false)
    await nextTick()
    expect(document.body.classList.contains('modal-open')).toBe(true)

    overlay.remove()
  })
})

describe('AppSidebar drawer focus management', () => {
  it('moves focus into the drawer on open and restores it to the trigger on close', async () => {
    const mounted = await mountSidebar({ mobile: true })

    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    await openDrawer(mounted)
    expect(mounted.aside.contains(document.activeElement)).toBe(true)

    mounted.appStore.setMobileOpen(false)
    await nextTick()
    expect(document.activeElement).toBe(trigger)

    trigger.remove()
  })

  it('closes on Escape and hands focus back', async () => {
    const mounted = await mountSidebar({ mobile: true })

    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    await openDrawer(mounted)
    expect(mounted.appStore.mobileOpen).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(mounted.appStore.mobileOpen).toBe(false)
    expect(document.activeElement).toBe(trigger)

    trigger.remove()
  })

  it('ignores Escape at desktop widths, where there is nothing to dismiss', async () => {
    const mounted = await mountSidebar({ mobile: false })
    await openDrawer(mounted)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(mounted.appStore.mobileOpen).toBe(true)
  })

  it('announces itself as a modal dialog only while open at mobile width', async () => {
    const mounted = await mountSidebar({ mobile: true })
    expect(mounted.aside.getAttribute('role')).toBeNull()

    await openDrawer(mounted)
    expect(mounted.aside.getAttribute('role')).toBe('dialog')
    expect(mounted.aside.getAttribute('aria-modal')).toBe('true')
    expect(mounted.aside.getAttribute('aria-label')).toBeTruthy()
  })

  it('keeps Tab inside the open drawer', async () => {
    const mounted = await mountSidebar({ mobile: true })
    await openDrawer(mounted)

    const focusables = Array.from(
      mounted.aside.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    )
    const last = focusables[focusables.length - 1]
    last.focus()

    // Tab off the last element wraps to the first instead of escaping into the
    // page behind the scrim.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    await nextTick()
    expect(document.activeElement).toBe(focusables[0])

    // Shift+Tab off the first wraps back to the last.
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    )
    await nextTick()
    expect(document.activeElement).toBe(last)
  })
})

describe('AppSidebar closes on navigation', () => {
  it('closes when the route changes while it stays mounted', async () => {
    const mounted = await mountSidebar({ mobile: true })
    await openDrawer(mounted)
    expect(mounted.appStore.mobileOpen).toBe(true)

    await mounted.router.push('/keys')
    await nextTick()

    expect(mounted.appStore.mobileOpen).toBe(false)
  })

  it('closes on browser Back', async () => {
    const mounted = await mountSidebar({ mobile: true })
    await mounted.router.push('/keys')
    await openDrawer(mounted)
    expect(mounted.appStore.mobileOpen).toBe(true)

    // `router.back()` returns void and popstate is delivered asynchronously, so
    // wait for the route to actually change before asserting.
    mounted.router.back()
    await waitForPath(mounted.router, '/dashboard')
    await nextTick()

    expect(mounted.appStore.mobileOpen).toBe(false)
  })

  it('does not render open after a remount that inherited open state', async () => {
    // AppLayout is per-view, so a route change unmounts and remounts the
    // sidebar while `mobileOpen` lives in the store. A fresh instance must not
    // come up with the drawer over the new page.
    const mounted = await mountSidebar({ mobile: true })
    mounted.appStore.setMobileOpen(true)
    mounted.wrapper.unmount()

    const remounted = track(
      mount(AppSidebar, {
        attachTo: document.body,
        global: { plugins: [mounted.router, createTestI18n()], stubs: { VersionBadge: true } }
      })
    )
    await flushPromises()

    expect(mounted.appStore.mobileOpen).toBe(false)
    expect(remounted.find('.sidebar-scrim').exists()).toBe(false)
  })
})

describe('AppSidebar scrim', () => {
  it('appears only while open and closes the drawer when tapped', async () => {
    const mounted = await mountSidebar({ mobile: true })
    expect(mounted.wrapper.find('.sidebar-scrim').exists()).toBe(false)

    await openDrawer(mounted)
    const scrim = mounted.wrapper.find('.sidebar-scrim')
    expect(scrim.exists()).toBe(true)

    await scrim.trigger('click')
    expect(mounted.appStore.mobileOpen).toBe(false)
  })

  it('sits above the z-30 header and before the drawer in paint order', async () => {
    const mounted = await mountSidebar({ mobile: true })
    await openDrawer(mounted)

    const scrim = mounted.wrapper.get('.sidebar-scrim').element
    // AppHeader is z-30 and renders after AppSidebar in AppLayout, so a z-30
    // scrim lost the tie and left the user menu and subscription pill tappable
    // through the barrier.
    expect(scrim.classList.contains('z-40')).toBe(true)
    expect(scrim.classList.contains('z-30')).toBe(false)

    // .sidebar is also z-40, so within that tie DOM order decides: the scrim
    // has to come first or it would dim the drawer it belongs to.
    expect(scrim.compareDocumentPosition(mounted.aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('AppSidebar navigation semantics', () => {
  it('gives the nav landmark an accessible name', async () => {
    const { wrapper } = await mountSidebar()

    const nav = wrapper.get('nav')
    expect(nav.attributes('aria-label')).toBeTruthy()
  })

  it('reports collapsible group state with aria-expanded and aria-controls', async () => {
    const { wrapper } = await mountSidebar({ admin: true, route: '/admin/dashboard' })

    const groupToggle = wrapper
      .findAll('button.sidebar-link')
      .find((b) => b.attributes('aria-expanded') !== undefined)
    expect(groupToggle).toBeDefined()
    expect(groupToggle!.attributes('aria-expanded')).toBe('false')

    const panelId = groupToggle!.attributes('aria-controls')
    expect(panelId).toBeTruthy()

    await groupToggle!.trigger('click')
    await nextTick()

    expect(groupToggle!.attributes('aria-expanded')).toBe('true')
    // The panel it points at is the one that appears.
    expect(wrapper.find(`#${panelId}`).exists()).toBe(true)
  })
})

describe('AppSidebar scroll position persistence', () => {
  it('saves the nav scroll offset to the store on unmount', async () => {
    const mounted = await mountSidebar()
    const nav = mounted.wrapper.get('nav.sidebar-nav').element as HTMLElement

    // jsdom does not lay out, so scrollTop is not writable through overflow;
    // define it to stand in for a scrolled nav.
    Object.defineProperty(nav, 'scrollTop', { configurable: true, value: 420 })

    mounted.wrapper.unmount()
    expect(mounted.appStore.sidebarScrollTop).toBe(420)
  })

  it('restores the saved offset on mount', async () => {
    setActivePinia(createPinia())
    const appStore = useAppStore()
    appStore.sidebarScrollTop = 300

    installMatchMedia(true)
    const router = createTestRouter()
    await router.push('/dashboard')
    await router.isReady()

    const wrapper = track(
      mount(AppSidebar, {
        attachTo: document.body,
        global: { plugins: [router, createTestI18n()], stubs: { VersionBadge: true } }
      })
    )
    await flushPromises()
    await nextTick()

    const nav = wrapper.get('nav.sidebar-nav').element as HTMLElement
    expect(nav.scrollTop).toBe(300)
  })
})

/*
 * The two style contracts below are the only assertions left that read source
 * text, because they are about CSS that jsdom cannot evaluate: vue-test-utils
 * does not attach scoped SFC styles, so `getComputedStyle` on a mounted node
 * reports nothing about either rule. They assert the absence of specific
 * declarations that broke user-visible behaviour, not the shape of the file.
 */
const dir = dirname(fileURLToPath(import.meta.url))
const componentSource = readFileSync(resolve(dir, '../AppSidebar.vue'), 'utf8')
const styleSource = readFileSync(resolve(dir, '../../../style.css'), 'utf8')

describe('AppSidebar custom SVG icon styles', () => {
  it('renders an uploaded SVG without forcing fill or stroke onto it', async () => {
    const { wrapper } = await mountSidebar()
    // Whatever the sidebar renders, it must not inject colour attributes into a
    // custom icon's markup — that is the half of the contract that is observable.
    for (const holder of wrapper.findAll('.sidebar-svg-icon')) {
      expect(holder.attributes('fill')).toBeUndefined()
      expect(holder.attributes('stroke')).toBeUndefined()
    }

    // The other half lives in scoped CSS: size the icon, inherit the colour,
    // never repaint it.
    const block = componentSource.match(/\.sidebar-svg-icon\s*\{[\s\S]*?\n\}/)?.[0]
    expect(block).toBeTruthy()
    expect(block).toContain('color: currentColor;')
    expect(block).not.toContain('stroke: currentColor;')
    expect(block).not.toContain('fill: none;')
  })
})

describe('AppSidebar header styles', () => {
  it('does not clip the version badge dropdown', () => {
    const sidebarHeaderBlockMatch = styleSource.match(/\.sidebar-header\s*\{[\s\S]*?\n {2}\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\s*\{[\s\S]*?\n\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('@apply overflow-hidden;')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow: hidden;')
  })
})
