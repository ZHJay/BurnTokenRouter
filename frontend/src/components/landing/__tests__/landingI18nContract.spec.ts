import { describe, expect, it } from 'vitest'

import en from '@/i18n/locales/en/landing'
import zh from '@/i18n/locales/zh/landing'

/**
 * 为什么需要这个文件：
 *
 * landingSections.spec.ts 把 t() mock 成 identity（t(key) === key），
 * 所以它只能证明"组件请求了哪些 key"，**证明不了这些 key 真的存在**。
 * 而落地页大量使用模板字面量拼 key，例如：
 *     t(`home.capabilities.${item.key}.value`)
 *     t(`home.faq.items.${key}.q`)
 * 这类 key 静态分析抓不到、identity mock 也不会报错。一旦漏写，
 * 生产页面会直接把 "home.capabilities.models.value" 这串点号文本渲染出来，
 * 而全部单测依然是绿的。这里对真实 locale 模块做兑现校验，堵住这个洞。
 */

type Dict = Record<string, unknown>

function resolve(root: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Dict)) {
      return (node as Dict)[part]
    }
    return undefined
  }, root)
}

/** 把嵌套对象摊平成点号路径集合，用于 zh/en 结构对比 */
function flatten(node: unknown, prefix = '', out: string[] = []): string[] {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Dict)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out)
    }
  } else {
    out.push(prefix)
  }
  return out
}

function expand(template: string, tokens: readonly string[]): string[] {
  return tokens.map((token) => template.replace('{}', token))
}

/**
 * 落地页实际消费的全部 key。手工枚举而非静态提取，因为动态拼接的 key
 * 只有运行时才成形；这份清单同时充当"组件 ↔ 文案"的契约文档。
 */
const CAPABILITY_KEYS = ['models', 'protocol', 'billing', 'selfHosted'] as const
const PAIN_KEYS = ['expensive', 'complex', 'unstable', 'noControl'] as const
const FEATURE_KEYS = [
  'unifiedGateway',
  'multiAccount',
  'balanceQuota',
  'observability',
  'session',
  'security',
] as const
const STEP_KEYS = ['register', 'key', 'call'] as const
const COMPARISON_KEYS = ['pricing', 'models', 'management', 'stability', 'control'] as const
const FAQ_KEYS = ['compat', 'billing', 'limit', 'privacy', 'models'] as const
const SECTION_KEYS = [
  'preview',
  'painPoints',
  'solutions',
  'features',
  'comparison',
  'providers',
  'faq',
] as const

const REQUIRED_KEYS: string[] = [
  // 顶栏 / 页脚 / 通用
  'home.viewDocs',
  'home.docs',
  'home.switchToLight',
  'home.switchToDark',
  'home.dashboard',
  'home.login',
  'home.getStarted',
  'home.goToDashboard',
  'home.footer.allRightsReserved',

  // Hero
  'home.hero.eyebrow',
  'home.hero.note',
  'home.hero.secondaryCta',
  'home.hero.visualCaption',
  'home.hero.terminalComment',
  'home.heroDescription',
  'home.tags.subscriptionToApi',
  'home.tags.stickySession',
  'home.tags.realtimeBilling',

  // 控制台预览
  'home.preview.title',
  'home.preview.subtitle',
  'home.preview.caption',
  'home.preview.windowTitle',
  'home.preview.nav.overview',
  'home.preview.nav.keys',
  'home.preview.nav.usage',
  'home.preview.stats.requests',
  'home.preview.stats.tokens',
  'home.preview.stats.cost',
  'home.preview.stats.success',
  'home.preview.chartTitle',
  'home.preview.tableTitle',
  'home.preview.tableHeaders.model',
  'home.preview.tableHeaders.requests',
  'home.preview.tableHeaders.cost',

  // 区块标题
  'home.painPoints.title',
  'home.solutions.title',
  'home.solutions.subtitle',
  'home.comparison.title',
  'home.comparison.headers.feature',
  'home.comparison.headers.official',
  'home.comparison.headers.us',
  'home.providers.title',
  'home.providers.description',
  'home.providers.supported',
  'home.providers.soon',
  'home.providers.claude',
  'home.providers.gemini',
  'home.providers.antigravity',
  'home.providers.more',
  'home.faq.title',
  'home.faq.subtitle',

  // 三步接入
  'home.steps.stepLabel',
  'home.steps.codeCaption',

  // 结尾 CTA
  'home.cta.title',
  'home.cta.description',
  'home.cta.button',
  'home.cta.secondary',

  // 页脚里复用的既有 key（不属于 home 命名空间）
  'keyUsage.title',

  // 动态拼接的 key
  ...expand('home.sections.{}', SECTION_KEYS),
  ...expand('home.capabilities.{}.value', CAPABILITY_KEYS),
  ...expand('home.capabilities.{}.label', CAPABILITY_KEYS),
  ...expand('home.capabilities.{}.desc', CAPABILITY_KEYS),
  ...expand('home.painPoints.items.{}.title', PAIN_KEYS),
  ...expand('home.painPoints.items.{}.desc', PAIN_KEYS),
  ...expand('home.features.{}', FEATURE_KEYS),
  ...FEATURE_KEYS.map((k) => `home.features.${k}Desc`),
  ...expand('home.steps.items.{}.title', STEP_KEYS),
  ...expand('home.steps.items.{}.desc', STEP_KEYS),
  ...expand('home.comparison.items.{}.feature', COMPARISON_KEYS),
  ...expand('home.comparison.items.{}.official', COMPARISON_KEYS),
  ...expand('home.comparison.items.{}.us', COMPARISON_KEYS),
  ...expand('home.faq.items.{}.q', FAQ_KEYS),
  ...expand('home.faq.items.{}.a', FAQ_KEYS),
]

describe.each([
  ['zh', zh as unknown as Dict],
  ['en', en as unknown as Dict],
])('landing i18n contract (%s)', (_locale, bundle) => {
  it.each(REQUIRED_KEYS)('resolves %s to a non-empty string', (key) => {
    const value = resolve(bundle, key)

    expect(typeof value).toBe('string')
    expect((value as string).trim()).not.toBe('')
  })
})

describe('landing i18n zh/en parity', () => {
  it('keeps the home subtree structurally identical across locales', () => {
    const zhKeys = flatten((zh as unknown as Dict).home).sort()
    const enKeys = flatten((en as unknown as Dict).home).sort()

    // 双向差集分别断言：报错信息能直接指出是哪边缺 key
    expect(zhKeys.filter((k) => !enKeys.includes(k))).toEqual([])
    expect(enKeys.filter((k) => !zhKeys.includes(k))).toEqual([])
  })

  it('carries the interpolation placeholder in both locales', () => {
    // stepLabel 是唯一带插值的落地页文案；{index} 丢了会渲染成没有序号的标签
    expect(resolve(zh as unknown as Dict, 'home.steps.stepLabel')).toContain('{index}')
    expect(resolve(en as unknown as Dict, 'home.steps.stepLabel')).toContain('{index}')
  })
})
