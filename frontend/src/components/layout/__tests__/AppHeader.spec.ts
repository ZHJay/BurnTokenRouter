/**
 * AppHeader: compact-width overflow, user-menu semantics, keyboard dismissal.
 *
 * jsdom has NO layout engine: every getBoundingClientRect() is 0x0 and no media
 * query is ever evaluated against a real width. So the responsive half of this
 * file asserts on the CLASSES that decide visibility, not on geometry — the
 * geometric proof lives in the Playwright run recorded in the task report
 * (rightPastViewport measured at 640/667/768/844/932/1023).
 *
 * Also note src/__tests__/setup.ts stubs matchMedia to return `matches: true`
 * for every query, so any width-dependent JS branch takes the desktop path.
 * Nothing asserted here depends on that, because the header's breakpoints are
 * pure CSS.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppHeader from '../AppHeader.vue'

const componentSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../AppHeader.vue'), 'utf8')
const indexHtmlSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../../index.html'),
  'utf8',
)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ name: 'Dashboard', params: {}, meta: { title: 'Dashboard' } }),
}))

/*
 * createI18n has to be part of the mock even though this spec never calls it:
 * stubbing LocaleSwitcher stops it RENDERING, not its module graph from being
 * imported, and src/i18n/index.ts calls createI18n at module scope.
 */
vi.mock('vue-i18n', () => ({
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
}))

const authUser = {
  id: 1,
  username: 'ada',
  email: 'ada@example.com',
  role: 'admin',
  balance: 10,
  frozen_balance: 0,
  avatar_url: null,
}

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    contactInfo: '',
    docUrl: 'https://docs.example.com',
    sidebarCollapsed: false,
    cachedPublicSettings: { custom_menu_items: [] },
    toggleMobileSidebar: vi.fn(),
  }),
  useAuthStore: () => ({
    user: authUser,
    isAdmin: true,
    isSimpleMode: false,
    logout: vi.fn(),
  }),
  useOnboardingStore: () => ({ replay: vi.fn() }),
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({ customMenuItems: [] }),
}))

vi.mock('@/utils/featureFlags', () => ({
  FeatureFlags: { modelPlaza: 'modelPlaza' },
  isFeatureFlagEnabled: () => true,
}))

/*
 * RouterLink must be stubbed as a real <a>, not left to Vue Test Utils' default.
 * AppHeader uses <router-link> as a globally-registered component, and with the
 * router plugin absent VTU renders an inert <router-link> custom element. That is
 * not focusable, so every focus assertion below saw document.activeElement stay
 * on <body>.
 */
const RouterLinkStub = {
  name: 'RouterLink',
  props: { to: { type: [String, Object], required: true } },
  template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
}

const stubs = {
  RouterLink: RouterLinkStub,
  /*
   * Stub <transition> to a pass-through. The panel is wrapped in a real
   * <transition>, whose LEAVE phase is asynchronous and, in jsdom, never
   * completes: no transitionend event is ever dispatched, so the element stayed
   * mounted after Escape and the dismissal assertion read a stale DOM. Enter was
   * unaffected, which is why only the Escape case failed. The transition wrapper
   * itself is asserted from source in the task-4 block instead.
   */
  transition: true,
  LocaleSwitcher: { template: '<div class="locale-switcher-stub" />' },
  SubscriptionProgressMini: { template: '<div class="subscription-stub" />' },
  AnnouncementBell: { template: '<button class="bell-stub" />' },
  Icon: { props: ['name', 'size'], template: '<span class="icon-stub" />' },
}

// sanitizeUrl() normalises the configured doc URL, which appends a trailing
// slash — match on the attributes that identify the link instead of the href.
const DOCS_LINK = 'a[target="_blank"][rel="noopener noreferrer"]'
const PLAZA_LINK = 'a[href="/model-plaza"]'

function mountHeader() {
  return mount(AppHeader, {
    attachTo: document.body, // focus assertions need a connected, rendered tree
    /*
     * $t as well as useI18n: the onboarding item in the dropdown uses the global
     * `$t` injected by the vue-i18n plugin, which the module mock above does not
     * provide, and its absence surfaced as an unhandled rejection during render.
     */
    global: { stubs, mocks: { $t: (key: string) => key } },
  })
}

describe('AppHeader compact-width action row (task 1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reveals Docs and Model Plaza at lg, not sm', () => {
    const wrapper = mountHeader()

    const docs = wrapper.get(DOCS_LINK)
    const plaza = wrapper.get(PLAZA_LINK)

    for (const link of [docs, plaza]) {
      expect(link.classes()).toContain('hidden')
      expect(link.classes()).toContain('lg:flex')
      // sm:flex is the defect: it put both links on screen from 640px up while
      // the sidebar drawer still owned that navigation, overflowing the row.
      expect(link.classes()).not.toContain('sm:flex')
    }

    wrapper.unmount()
  })

  it('keeps both links out of the 640-1023px band in source, not just at runtime', () => {
    // Guards the regression at the class-string level: a future edit that
    // reintroduces sm:flex on either nav link fails here even if the rendered
    // conditionals change shape.
    const navLinkClasses = componentSource.match(/class="hidden items-center gap-1\.5[^"]*"/g) ?? []
    expect(navLinkClasses).toHaveLength(2)
    for (const cls of navLinkClasses) {
      expect(cls).toContain('lg:flex')
      expect(cls).not.toContain('sm:flex')
    }
  })

  it('lets the action row shrink instead of clipping off-screen', () => {
    const wrapper = mountHeader()

    // The row is the last child of the flex header row.
    const row = wrapper.get('header > div').element.lastElementChild as HTMLElement
    const classes = Array.from(row.classList)

    // shrink-0 is what stranded the user menu: below lg the left group collapses
    // to 0 wide, so a rigid row simply ran past the viewport with no scroller.
    expect(classes).not.toContain('shrink-0')
    expect(classes).toContain('min-w-0')

    wrapper.unmount()
  })

  it('keeps the no-wrap guarantee on the links that used to wrap', () => {
    const wrapper = mountHeader()

    for (const selector of [DOCS_LINK, PLAZA_LINK]) {
      expect(wrapper.get(selector).classes()).toContain('whitespace-nowrap')
    }

    wrapper.unmount()
  })

  it('makes the username the width pressure valve', () => {
    const wrapper = mountHeader()

    const trigger = wrapper.get('button[aria-haspopup="menu"]')
    expect(trigger.classes()).toContain('min-w-0')
    // Truncation only engages when an ancestor can actually shrink.
    expect(trigger.html()).toContain('truncate')

    wrapper.unmount()
  })

  it('spaces the bell and language switcher far enough apart to tap', () => {
    const wrapper = mountHeader()

    const row = wrapper.get('header > div').element.lastElementChild as HTMLElement
    // gap-1 measured 4.0px between the bell and the language switcher.
    expect(Array.from(row.classList)).toContain('gap-2')
    expect(Array.from(row.classList)).not.toContain('gap-1')

    wrapper.unmount()
  })

  it('exposes no sm:-revealed control in the action row', () => {
    /*
     * The width claim, expressed the only way jsdom can: by inventory.
     *
     * jsdom has no layout, so "the row does not exceed 667/768/844px" cannot be
     * measured here — it was measured in Chromium (rightPastViewport went from
     * +45/+66/-10 to -16/-24/-24, table in the task report). What this asserts is
     * the invariant that produced those numbers: below lg the left group collapses
     * to 0 wide, so anything revealed at sm lands in a row that starts at x≈24 and
     * has the full viewport to overrun. Adding another sm:-revealed control to
     * this row is how the overflow comes back, and it fails here.
     *
     * The balance pill is the deliberate exception: it is sm:flex, and at 268px it
     * is the single widest item in the row. It stays because the fix removed
     * ~196px of duplicated navigation, which is enough headroom for it, and
     * because the drawer does not carry the balance — the dropdown does.
     */
    const wrapper = mountHeader()
    const row = wrapper.get('header > div').element.lastElementChild as HTMLElement

    const smRevealed = Array.from(row.children).filter((el) =>
      Array.from(el.classList).some((c) => /^sm:(flex|inline|block|grid)$/.test(c)),
    )
    const described = smRevealed.map((el) => el.className)

    expect(described).toHaveLength(1)
    expect(described[0]).toContain('rounded-full') // the balance pill
    expect(described[0]).toContain('sm:flex')

    wrapper.unmount()
  })
})

describe('AppHeader safe-area inset (task 2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opts the document into the full display so env() can resolve', () => {
    // Without viewport-fit=cover every safe-area-inset-* is 0px unconditionally,
    // which would make the padding below a no-op on a notched device.
    const meta = indexHtmlSource.match(/<meta name="viewport" content="([^"]+)"/)
    expect(meta).not.toBeNull()
    expect(meta![1]).toContain('viewport-fit=cover')
    expect(meta![1]).toContain('width=device-width')
  })

  it('pads the header by the top inset and grows its height to match', () => {
    /*
     * Asserted on the source, not on getComputedStyle: jsdom does not resolve
     * env(), and headless Chromium reports 0 for every safe-area inset, so
     * neither environment can measure this. Confirmed by CDP inset override in
     * the Playwright run (top:59 -> padding-top 59px, height 123px).
     */
    const scoped = componentSource.match(/\.app-header\s*\{[\s\S]*?\}/)
    expect(scoped).not.toBeNull()
    expect(scoped![0]).toContain('padding-top: env(safe-area-inset-top)')
    expect(scoped![0]).toContain('height: calc(4rem + env(safe-area-inset-top))')
  })

  it('carries the hook class the inset rule targets', () => {
    const wrapper = mountHeader()
    expect(wrapper.get('header').classes()).toContain('app-header')
    wrapper.unmount()
  })
})

describe('AppHeader user menu semantics (task 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes aria-haspopup and toggles aria-expanded', async () => {
    const wrapper = mountHeader()
    const trigger = wrapper.get('button[aria-haspopup="menu"]')

    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    wrapper.unmount()
  })

  it('gives the panel role=menu and every item role=menuitem', async () => {
    const wrapper = mountHeader()
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')

    const menu = wrapper.get('[role="menu"]')
    expect(menu.classes()).toContain('dropdown')

    const items = menu.findAll('[role="menuitem"]')
    expect(items.length).toBeGreaterThanOrEqual(4)

    // role=menu only permits menuitem-ish children; the presentational wrappers
    // must be neutralised or the tree is invalid.
    const unroledChildren = Array.from(menu.element.children).filter((el) => !el.getAttribute('role'))
    expect(unroledChildren).toHaveLength(0)

    wrapper.unmount()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mountHeader()
    const trigger = wrapper.get('button[aria-haspopup="menu"]')

    await trigger.trigger('click')
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)

    // Move focus into the panel first: Escape has to work from an item, and the
    // panel is v-if, so focus would otherwise fall to <body>.
    const firstItem = wrapper.get('[role="menuitem"]').element as HTMLElement
    firstItem.focus()
    expect(document.activeElement).toBe(firstItem)

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)

    wrapper.unmount()
  })

  it('moves focus between items with the arrow keys and wraps', async () => {
    const wrapper = mountHeader()
    const trigger = wrapper.get('button[aria-haspopup="menu"]')

    await trigger.trigger('click')
    const items = wrapper.findAll('[role="menuitem"]').map((w) => w.element as HTMLElement)

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[0])

    // Wrap backwards off the first item.
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])

    wrapper.unmount()
  })

  it('opens from the closed trigger with ArrowDown and lands on the first item', async () => {
    const wrapper = mountHeader()
    const trigger = wrapper.get('button[aria-haspopup="menu"]')

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('[role="menuitem"]').element)

    wrapper.unmount()
  })
})

describe('AppHeader dropdown animation (task 4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('suppresses the intrinsic animate-scale-in inside the transition', async () => {
    const wrapper = mountHeader()
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')

    const panel = wrapper.get('[role="menu"]')
    // .dropdown carries animate-scale-in in style.css; without animate-none the
    // keyframe and the <transition> both drive transform on enter, at different
    // scales. Same fix as AccountGroupsCell.vue.
    expect(panel.classes()).toContain('dropdown')
    expect(panel.classes()).toContain('animate-none')

    wrapper.unmount()
  })

  it('still wraps that same element in the dropdown transition', () => {
    /*
     * Source-level, because <transition> is stubbed out at mount (its leave phase
     * never resolves in jsdom). This is the half the runtime assertion above
     * cannot see: the defect only exists when BOTH the transition and the
     * intrinsic keyframe apply to the same element, so a future edit that drops
     * animate-none while keeping the transition has to fail somewhere.
     */
    const transitionBlock = componentSource.match(/<transition name="dropdown">[\s\S]*?<div[^>]*>/)
    expect(transitionBlock).not.toBeNull()
    expect(transitionBlock![0]).toContain('class="dropdown right-0 mt-2 w-56 animate-none"')
  })
})

describe('AppHeader page heading (task 6)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps the h1 in the DOM below lg instead of display:none', () => {
    const wrapper = mountHeader()

    const h1 = wrapper.get('h1')
    expect(h1.exists()).toBe(true)

    const titleBlock = h1.element.parentElement as HTMLElement
    const classes = Array.from(titleBlock.classList)
    // `hidden` removed the only h1 on the page from the accessibility tree under
    // 1024px; sr-only keeps it exposed while staying invisible.
    expect(classes).toContain('sr-only')
    expect(classes).toContain('lg:not-sr-only')
    expect(classes).not.toContain('hidden')

    wrapper.unmount()
  })
})

describe('AppHeader touch targets (task 7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('gives every header button a real button class', () => {
    const wrapper = mountHeader()

    // The global (pointer: coarse) min-height rule in style.css keys off .btn /
    // .btn-icon, so a bespoke button silently opts out of it.
    const buttons = wrapper.findAll('header button').filter((b) => !b.classes().includes('bell-stub'))
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button.classes()).toContain('btn')
    }

    wrapper.unmount()
  })

  it('keeps the drawer toggle on the icon-button size ramp', () => {
    const wrapper = mountHeader()

    const toggle = wrapper.get('button.lg\\:hidden')
    expect(toggle.classes()).toContain('btn')
    expect(toggle.classes()).toContain('btn-icon')

    wrapper.unmount()
  })
})
