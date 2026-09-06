import { describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'

import LandingCapabilities from '../LandingCapabilities.vue'
import LandingComparison from '../LandingComparison.vue'
import LandingConsolePreview from '../LandingConsolePreview.vue'
import LandingCtaBand from '../LandingCtaBand.vue'
import LandingFaq from '../LandingFaq.vue'
import LandingFeatures from '../LandingFeatures.vue'
import LandingHero from '../LandingHero.vue'
import LandingPainPoints from '../LandingPainPoints.vue'
import LandingProviders from '../LandingProviders.vue'
import LandingReveal from '../LandingReveal.vue'
import LandingSection from '../LandingSection.vue'
import LandingSteps from '../LandingSteps.vue'
import LandingTerminal from '../LandingTerminal.vue'

/**
 * i18n 在单测里退化为 identity：t(key) === key。
 * 好处是断言可以直接锁 key 名——谁把 key 拼错或改名，测试立刻红。
 */
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const mountOpts = {
  global: {
    stubs: {
      RouterLink: RouterLinkStub,
      Icon: { template: '<span class="icon-stub" />' },
    },
  },
}

/**
 * 本仓库唯一允许的表格写法是"单元格内再包一层 div"再挂 flex/grid。
 * Phase A 曾因把 flex 直接挂在 td 上，导致某列矮 12px、内容偏移 8px。
 *
 * 用**白名单**而非黑名单：黑名单只能拦住已知的几个类名，
 * 新加一个挂 flex 的类照样能溜过去。白名单反过来要求
 * 每个 td/th 的 class 都是事先登记过的纯样式类。
 */
const ALLOWED_CELL_CLASSES = new Set([
  'is-num',        // 右对齐数字列
  'lp-col-feature',// 对比表首列
  'lp-col-us',     // 对比表"本平台"列（只设 background/color）
  'lp-cell-official',
])

interface CellQueryable {
  findAll(selector: string): Array<{ classes(): string[] }>
}

function assertNoFlexOnCells(wrapper: CellQueryable) {
  const cells = wrapper.findAll('td, th')
  expect(cells.length).toBeGreaterThan(0)

  for (const cell of cells) {
    const unexpected = cell.classes().filter((c) => !ALLOWED_CELL_CLASSES.has(c))
    expect(unexpected).toEqual([])
  }
}

/**
 * ul/ol 的合法子元素只有 li/script/template。中间夹一层 div 会切断
 * 无障碍树里 list → listitem 的归属，读屏可能报「空列表」或丢失条目数，
 * 而视觉上完全看不出来（div 变成了 grid item）——所以必须由测试盯着。
 */
function assertCleanList(wrapper: CellQueryable & {
  findAll(selector: string): Array<unknown>
}, listSelector: string, expectedItems: number) {
  expect(wrapper.findAll(`${listSelector} > li`)).toHaveLength(expectedItems)
  // 列表下不得有任何非 li 的直接子元素
  expect(wrapper.findAll(`${listSelector} > div`)).toHaveLength(0)
  expect(wrapper.findAll(`${listSelector} > *`)).toHaveLength(expectedItems)
}

describe('LandingSection', () => {
  it('renders eyebrow, title and subtitle when provided', () => {
    const wrapper = mount(LandingSection, {
      ...mountOpts,
      props: { eyebrow: 'EB', title: 'TITLE', subtitle: 'SUB' },
    })

    expect(wrapper.get('.lp-eyebrow').text()).toBe('EB')
    expect(wrapper.get('.lp-section-title').text()).toBe('TITLE')
    expect(wrapper.get('.lp-section-sub').text()).toBe('SUB')
  })

  it('omits the header entirely when nothing is passed', () => {
    const wrapper = mount(LandingSection, mountOpts)

    expect(wrapper.find('.lp-section-head').exists()).toBe(false)
  })

  it('renders slotted content', () => {
    const wrapper = mount(LandingSection, {
      ...mountOpts,
      props: { title: 'T' },
      slots: { default: '<p class="probe">body</p>' },
    })

    expect(wrapper.get('.probe').text()).toBe('body')
  })
})

describe('LandingReveal', () => {
  it('always renders its content regardless of reveal state', () => {
    const wrapper = mount(LandingReveal, {
      slots: { default: '<span class="probe">visible</span>' },
    })

    // 内容必须始终在 DOM 里：入场只能由 CSS 类控制，绝不能用 v-if 门控
    expect(wrapper.get('.probe').text()).toBe('visible')
    expect(wrapper.classes()).toContain('lp-reveal')
  })

  it('applies a stagger delay only when asked', () => {
    const plain = mount(LandingReveal, { props: { delay: 0 } })
    expect(plain.attributes('style')).toBeUndefined()

    const delayed = mount(LandingReveal, { props: { delay: 140 } })
    expect(delayed.attributes('style')).toContain('transition-delay: 140ms')
  })

  it('renders a div by default and honours the `as` tag override', () => {
    expect(mount(LandingReveal).element.tagName).toBe('DIV')
    // `as="li"` 是列表语义的关键：默认 div 放在 ul 下即为非法 HTML
    expect(mount(LandingReveal, { props: { as: 'li' } }).element.tagName).toBe('LI')
  })
})

describe('LandingHero', () => {
  const props = {
    siteName: 'Acme Gateway',
    siteSubtitle: 'One key for every model',
    primaryTo: '/register',
    primaryLabel: 'Start now',
    secondaryHref: '#lp-console',
    showNote: true,
    settingsReady: true,
  }

  it('renders the site name as a text wordmark and never an image', () => {
    const wrapper = mount(LandingHero, { ...mountOpts, props })

    expect(wrapper.get('h1').text()).toBe('Acme Gateway')
    expect(wrapper.findAll('img')).toHaveLength(0)
  })

  it('points the primary CTA at the resolved target', () => {
    const wrapper = mount(LandingHero, { ...mountOpts, props })

    const link = wrapper.findComponent(RouterLinkStub)
    expect(link.props('to')).toBe('/register')
    expect(link.text()).toContain('Start now')
  })

  it('keeps the secondary CTA an in-page anchor so it works without JS', () => {
    const wrapper = mount(LandingHero, { ...mountOpts, props })

    expect(wrapper.get('a.lp-cta-secondary').attributes('href')).toBe('#lp-console')
  })

  it('hides the trial-credit note when the caller says registration is closed', () => {
    const wrapper = mount(LandingHero, { ...mountOpts, props: { ...props, showNote: false } })

    // 槽位仍在（高度恒定），只是不可见且不进无障碍树
    const note = wrapper.get('.lp-hero-note')
    expect(note.classes()).toContain('is-hidden')
    expect(note.attributes('aria-hidden')).toBe('true')
  })

  it('shows the note as visible and exposed once registration is confirmed open', () => {
    const note = mount(LandingHero, { ...mountOpts, props }).get('.lp-hero-note')

    expect(note.classes()).not.toContain('is-hidden')
    expect(note.attributes('aria-hidden')).toBeUndefined()
  })

  describe('CTA gating before public settings arrive', () => {
    const pending = { ...props, settingsReady: false, showNote: false }

    it('never shows the resolved CTA label while settings are still loading', () => {
      const wrapper = mount(LandingHero, { ...mountOpts, props: pending })

      // 核心断言：加载完成前绝不出现最终文案，
      // 否则首屏会出现「登录 → 立即开始」的语义跳变
      expect(wrapper.text()).not.toContain('Start now')
      expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false)
    })

    it('renders a same-size placeholder rather than an empty hole', () => {
      const wrapper = mount(LandingHero, { ...mountOpts, props: pending })

      const skeleton = wrapper.get('[data-testid="hero-cta-skeleton"]')
      expect(skeleton.attributes('aria-hidden')).toBe('true')
      // 次要 CTA 不依赖设置，始终渲染，替 CTA 行锚住高度
      expect(wrapper.find('a.lp-cta-secondary').exists()).toBe(true)
    })

    it('swaps placeholder for the real link once settings land, keeping structure stable', () => {
      const loading = mount(LandingHero, { ...mountOpts, props: pending })
      const ready = mount(LandingHero, { ...mountOpts, props })

      // 结构等价 ≈ 布局不跳（jsdom 无排版，故以节点结构近似）
      const rowChildren = (w: typeof loading) => w.get('.lp-hero-cta').element.children.length
      expect(rowChildren(loading)).toBe(rowChildren(ready))

      // note 槽位两态都存在，只是可见性不同
      expect(loading.find('.lp-hero-note').exists()).toBe(true)
      expect(ready.find('.lp-hero-note').exists()).toBe(true)

      expect(loading.find('[data-testid="hero-cta-skeleton"]').exists()).toBe(true)
      expect(ready.find('[data-testid="hero-cta-skeleton"]').exists()).toBe(false)
      expect(ready.findComponent(RouterLinkStub).props('to')).toBe('/register')
    })
  })

  it('keeps the above-the-fold hero free of scroll-in animation', () => {
    const wrapper = mount(LandingHero, { ...mountOpts, props })

    // 公开首页首屏必须立刻可读：入场动效只留给首屏之下的区块
    expect(wrapper.html()).not.toContain('fade-up')
    expect(wrapper.findComponent(LandingReveal).exists()).toBe(false)
  })

  it('renders all three trust chips', () => {
    const wrapper = mount(LandingHero, { ...mountOpts, props })
    const chips = wrapper.findAll('.lp-chip').map((c) => c.text())

    expect(chips).toEqual([
      expect.stringContaining('home.tags.subscriptionToApi'),
      expect.stringContaining('home.tags.stickySession'),
      expect.stringContaining('home.tags.realtimeBilling'),
    ])
  })

  it('exposes the visual slot', () => {
    const wrapper = mount(LandingHero, {
      ...mountOpts,
      props,
      slots: { visual: '<div class="probe-visual" />' },
    })

    expect(wrapper.find('.probe-visual').exists()).toBe(true)
  })
})

describe('LandingTerminal', () => {
  it('keeps the .terminal-container hook and carries an accessible label', () => {
    const wrapper = mount(LandingTerminal, { ...mountOpts, props: { caption: 'routing demo' } })

    // .terminal-container 是既有契约：HomeView.compact.spec.ts 用它判定默认首页分支
    expect(wrapper.find('.terminal-container').exists()).toBe(true)
    expect(wrapper.get('.terminal-container').attributes('aria-label')).toBe('routing demo')
    // 装饰性代码行对读屏隐藏，避免念出一串无意义符号
    expect(wrapper.get('.terminal-body').attributes('aria-hidden')).toBe('true')
  })
})

describe('LandingCapabilities', () => {
  it('renders four capability cells bound to i18n keys', () => {
    const wrapper = mount(LandingCapabilities, mountOpts)

    expect(wrapper.findAll('.lp-cap')).toHaveLength(4)
    expect(wrapper.text()).toContain('home.capabilities.models.value')
    expect(wrapper.text()).toContain('home.capabilities.selfHosted.desc')
  })

  it('emits a clean ul > li list', () => {
    assertCleanList(mount(LandingCapabilities, mountOpts), 'ul.lp-caps', 4)
  })

  it('has no scroll-reveal gate: it sits above the fold', () => {
    const wrapper = mount(LandingCapabilities, mountOpts)

    // 首屏内容不得依赖 IntersectionObserver 才可见
    expect(wrapper.findComponent(LandingReveal).exists()).toBe(false)
    expect(wrapper.html()).not.toContain('lp-reveal')
  })
})

describe('LandingConsolePreview', () => {
  it('renders the site name as text inside the mock nav', () => {
    const wrapper = mount(LandingConsolePreview, { ...mountOpts, props: { siteName: 'Acme' } })

    expect(wrapper.get('.lp-gn-wordmark').text()).toBe('Acme')
    expect(wrapper.findAll('img')).toHaveLength(0)
  })

  it('hides the decorative mock from assistive tech but keeps a text caption', () => {
    const wrapper = mount(LandingConsolePreview, { ...mountOpts, props: { siteName: 'Acme' } })

    expect(wrapper.get('.lp-window').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('figcaption').text()).toBe('home.preview.caption')
  })

  it('never puts a flex/grid class directly on a table cell', () => {
    const wrapper = mount(LandingConsolePreview, { ...mountOpts, props: { siteName: 'Acme' } })

    assertNoFlexOnCells(wrapper)
    // 真正挂 flex 的是单元格内层的 div
    expect(wrapper.find('td .lp-model').exists()).toBe(true)
  })

  it('wraps the mini table in a horizontal scroller', () => {
    const wrapper = mount(LandingConsolePreview, { ...mountOpts, props: { siteName: 'Acme' } })

    expect(wrapper.get('.lp-table-scroll').find('table').exists()).toBe(true)
  })
})

describe('LandingPainPoints', () => {
  it('renders the four pain points from i18n', () => {
    const wrapper = mount(LandingPainPoints, mountOpts)

    expect(wrapper.findAll('.lp-pain')).toHaveLength(4)
    expect(wrapper.text()).toContain('home.painPoints.items.expensive.title')
    expect(wrapper.text()).toContain('home.painPoints.items.noControl.desc')
  })

  it('emits a clean ul > li list', () => {
    assertCleanList(mount(LandingPainPoints, mountOpts), 'ul.lp-pains', 4)
  })
})

describe('LandingFeatures', () => {
  it('renders six features with matching title/description keys', () => {
    const wrapper = mount(LandingFeatures, mountOpts)

    expect(wrapper.findAll('.lp-feature')).toHaveLength(6)
    expect(wrapper.text()).toContain('home.features.unifiedGateway')
    expect(wrapper.text()).toContain('home.features.unifiedGatewayDesc')
    expect(wrapper.text()).toContain('home.features.securityDesc')
  })

  it('emits a clean ul > li list', () => {
    assertCleanList(mount(LandingFeatures, mountOpts), 'ul.lp-features', 6)
  })
})

describe('LandingSteps', () => {
  const props = { baseUrl: 'https://acme.test' }

  it('renders three numbered steps', () => {
    const wrapper = mount(LandingSteps, { ...mountOpts, props })

    expect(wrapper.findAll('.lp-step')).toHaveLength(3)
    expect(wrapper.text()).toContain('home.steps.items.register.title')
    expect(wrapper.text()).toContain('home.steps.items.call.desc')
  })

  it('renders the caller-supplied base URL in the code sample', () => {
    const wrapper = mount(LandingSteps, { ...mountOpts, props })

    expect(wrapper.get('.lp-code-pre').text()).toContain('https://acme.test')
    expect(wrapper.get('.lp-code-pre').text()).toContain('ANTHROPIC_BASE_URL')
  })

  it('keeps the code sample horizontally scrollable', () => {
    const wrapper = mount(LandingSteps, { ...mountOpts, props })

    expect(wrapper.get('.lp-code-scroll').find('pre').exists()).toBe(true)
  })

  it('emits a clean ol > li list', () => {
    assertCleanList(mount(LandingSteps, { ...mountOpts, props }), 'ol.lp-steps', 3)
  })
})

describe('LandingComparison', () => {
  it('renders one row per comparison item with a row header cell', () => {
    const wrapper = mount(LandingComparison, mountOpts)

    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.findAll('tbody th[scope="row"]')).toHaveLength(5)
  })

  it('never puts a flex/grid class directly on a table cell', () => {
    const wrapper = mount(LandingComparison, mountOpts)

    assertNoFlexOnCells(wrapper)
    expect(wrapper.find('thead .lp-us-head').exists()).toBe(true)
    expect(wrapper.find('tbody td .lp-us-cell').exists()).toBe(true)
  })

  it('wraps the table in a scroller so 375px does not overflow the page', () => {
    const wrapper = mount(LandingComparison, mountOpts)

    expect(wrapper.get('.lp-cmp-scroll').find('table').exists()).toBe(true)
  })
})

describe('LandingProviders', () => {
  it('renders four supported providers plus one coming-soon entry', () => {
    const wrapper = mount(LandingProviders, mountOpts)

    expect(wrapper.findAll('.lp-provider')).toHaveLength(5)
    expect(wrapper.findAll('.badge.b-green')).toHaveLength(4)
    expect(wrapper.findAll('.gpill')).toHaveLength(1)
    expect(wrapper.findAll('.lp-provider.is-soon')).toHaveLength(1)
  })

  it('uses text glyphs rather than logo images', () => {
    const wrapper = mount(LandingProviders, mountOpts)

    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.get('.lp-provider-mark').text()).toBe('C')
  })

  it('emits a clean ul > li list', () => {
    assertCleanList(mount(LandingProviders, mountOpts), 'ul.lp-providers', 5)
  })

  it('dims only the decorative glyph on the coming-soon entry', () => {
    const wrapper = mount(LandingProviders, mountOpts)

    // 整个 li 挂 opacity 会把 .gpill 压到约 2.4:1，低于 AA
    expect(wrapper.get('.lp-provider.is-soon').find('.gpill').exists()).toBe(true)
  })
})

describe('LandingFaq', () => {
  it('renders five questions as native details/summary', () => {
    const wrapper = mount(LandingFaq, mountOpts)

    expect(wrapper.findAll('details.lp-faq-item')).toHaveLength(5)
    expect(wrapper.findAll('summary.lp-faq-q')).toHaveLength(5)
    expect(wrapper.text()).toContain('home.faq.items.compat.q')
    expect(wrapper.text()).toContain('home.faq.items.models.a')
  })

  it('exposes each question as a heading', () => {
    const wrapper = mount(LandingFaq, mountOpts)

    // 否则按标题导航的读屏用户完全跳不到这 5 条问题
    expect(wrapper.findAll('summary h3')).toHaveLength(5)
  })
})

describe('LandingCtaBand', () => {
  it('points the primary CTA at the resolved target', () => {
    const wrapper = mount(LandingCtaBand, {
      ...mountOpts,
      props: { primaryTo: '/register', primaryLabel: 'Sign up', docUrl: 'https://docs.test' },
    })

    expect(wrapper.findComponent(RouterLinkStub).props('to')).toBe('/register')
    expect(wrapper.text()).toContain('Sign up')
  })

  it('drops the docs button when no doc URL is configured', () => {
    const wrapper = mount(LandingCtaBand, {
      ...mountOpts,
      props: { primaryTo: '/login', primaryLabel: 'Log in', docUrl: '' },
    })

    expect(wrapper.find('a[target="_blank"]').exists()).toBe(false)
  })

  it('marks the docs link safe for cross-origin opening', () => {
    const wrapper = mount(LandingCtaBand, {
      ...mountOpts,
      props: { primaryTo: '/login', primaryLabel: 'Log in', docUrl: 'https://docs.test' },
    })

    const docs = wrapper.get('a[target="_blank"]')
    expect(docs.attributes('href')).toBe('https://docs.test')
    expect(docs.attributes('rel')).toBe('noopener noreferrer')
  })
})
