import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { GroupPlatform } from '@/types'
import GroupBadge from '../GroupBadge.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ cachedPublicSettings: {} }),
}))

/**
 * `.badge .b-*` 暗色可读性的可执行闸门。
 *
 * 为什么在这里算而不是"看截图觉得够"：`.b-*` 的底色是半透明 rgba()，**声明值不是眼睛
 * 看到的值**——它要合成到 `--bg` / `--bg-elevated` / `--fill` / 甚至自己身上。前景色是
 * 不透明的，所以前景声明值 == 渲染值。于是"取前景声明值 + 按 alpha 合成底色 + 套
 * WCAG 2.1 相对亮度公式"就是一次精确计算，而不是估计。
 *
 * 为什么不用 jsdom 的 getComputedStyle：jsdom 不做层叠、不解析 `var()`、不合成 alpha，
 * 拿不到真实计算色。所以这里直接读 CSS 源文件自己解析 —— 断言的是**设计系统的源头事实**，
 * 组件挂载与否都不影响结论，也不会被组件重构悄悄绕过。
 *
 * 数值已用 Chromium 实测交叉验证（Playwright 采样渲染后的合成像素），35 个测点中
 * 最大偏差 0.14，且实测值**始终不低于**计算值——残差来自采样像素的 8bit 量化，
 * 方向上偏保守，所以本文件的阈值断言不会比真实渲染更宽松。
 *
 * 四种被断言的真实合成底色：
 *   1. `--bg`          暗色 #000000 —— 页面底
 *   2. `--bg-elevated` 暗色 #1c1c1e —— 卡片/表格底（更亮 = 对比更差 = 更接近最坏）
 *   3. 自嵌套 ×2       GroupBadge 会把同一个 `.b-*` 套在外层徽标里（订阅分组走
 *                      `labelClass = badgeClass`），于是同一层 tint 叠两次
 *   4. 行 hover        `.table-card tbody tr:hover` 会先铺一层 `--fill`
 */

const CSS_DIR = resolve(__dirname, '../../..')
const styleCss = readFileSync(resolve(CSS_DIR, 'style.css'), 'utf8')
const tokensCss = readFileSync(resolve(CSS_DIR, 'styles/apple-tokens.css'), 'utf8')

type RGB = [number, number, number]
type RGBA = { rgb: RGB; a: number }

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function declsOf(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const decl of block.split(';')) {
    const m = decl.match(/^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

/**
 * 暗色下生效的 token 表 = `:root` 叠加 `html.dark` 覆盖。
 *
 * 这一层合并是必须的，不是图省事：`--green` / `--orange` / `--red` / `--purple` /
 * `--teal` **只定义在 `:root`**，`html.dark` 没有重定义它们，所以暗色下它们按层叠
 * 继续沿用 `:root` 的值。只读 `html.dark` 会把这些 token 误判成"未定义"。
 */
function darkTokens(): Record<string, string> {
  const css = stripComments(tokensCss)
  const root = css.match(/:root\s*\{([^}]*)\}/)
  const dark = css.match(/html\.dark\s*\{([^}]*)\}/)
  if (!root) throw new Error('apple-tokens.css 缺少 :root token 块')
  if (!dark) throw new Error('apple-tokens.css 缺少 html.dark token 块')
  return { ...declsOf(root[1]), ...declsOf(dark[1]) }
}

const TOKENS = darkTokens()

function parseColor(raw: string): RGBA {
  let v = raw.trim()
  // 只解一层 var()：token 表里没有嵌套 var()，解多层反而会掩盖拼写错误
  const varMatch = v.match(/^var\((--[\w-]+)\)$/)
  if (varMatch) {
    const resolved = TOKENS[varMatch[1]]
    if (!resolved) throw new Error(`token ${varMatch[1]} 在 :root / html.dark 均未定义`)
    v = resolved.trim()
  }
  const hex = v.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 }
  }
  const rgba = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/)
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      a: rgba[4] === undefined ? 1 : Number(rgba[4])
    }
  }
  throw new Error(`无法解析颜色: ${raw}`)
}

/** 抓 `.b-x { ... }` 与 `html.dark .b-x { ... }` 的 background / color */
function badgeRules(): Record<string, { light: Partial<Record<'bg' | 'fg', string>>; dark: Partial<Record<'bg' | 'fg', string>> }> {
  const css = stripComments(styleCss)
  const out: ReturnType<typeof badgeRules> = {}
  const re = /(html\.dark\s+)?\.(b-[\w-]+)\s*\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const isDark = Boolean(m[1])
    const cls = m[2]
    out[cls] ??= { light: {}, dark: {} }
    const slot = isDark ? out[cls].dark : out[cls].light
    const bg = m[3].match(/(?:^|;)\s*background\s*:\s*([^;]+)/)
    const fg = m[3].match(/(?:^|;)\s*color\s*:\s*([^;]+)/)
    if (bg) slot.bg = bg[1].trim()
    if (fg) slot.fg = fg[1].trim()
  }
  return out
}

const RULES = badgeRules()

/** 暗色下该 class 的实际生效值（dark 块覆盖 light 块） */
function effectiveDark(cls: string): { fg: RGBA; bg: RGBA } {
  const r = RULES[cls]
  if (!r) throw new Error(`style.css 未定义 .${cls}`)
  const fgRaw = r.dark.fg ?? r.light.fg
  const bgRaw = r.dark.bg ?? r.light.bg
  if (!fgRaw || !bgRaw) throw new Error(`.${cls} 缺少 color 或 background`)
  return { fg: parseColor(fgRaw), bg: parseColor(bgRaw) }
}

function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrast(fg: RGB, bg: RGB): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

function composite(top: RGBA, under: RGB): RGB {
  return [0, 1, 2].map((i) => top.rgb[i] * top.a + under[i] * (1 - top.a)) as RGB
}

const DARK_BG = parseColor(TOKENS['--bg']).rgb
const DARK_ELEVATED = parseColor(TOKENS['--bg-elevated']).rgb
const DARK_FILL = parseColor(TOKENS['--fill'])

/** 四种真实场景下的对比度 */
function surfaces(cls: string): Record<string, number> {
  const { fg, bg } = effectiveDark(cls)
  const stack = (base: RGB, layers: number, fill: boolean): RGB => {
    let acc = fill ? composite(DARK_FILL, base) : base
    for (let i = 0; i < layers; i += 1) acc = composite(bg, acc)
    return acc
  }
  return {
    'on --bg': contrast(fg.rgb, stack(DARK_BG, 1, false)),
    'on --bg-elevated': contrast(fg.rgb, stack(DARK_ELEVATED, 1, false)),
    'nested x2 on elevated': contrast(fg.rgb, stack(DARK_ELEVATED, 2, false)),
    'row hover': contrast(fg.rgb, stack(DARK_ELEVATED, 1, true)),
    'nested x2 + row hover': contrast(fg.rgb, stack(DARK_ELEVATED, 2, true))
  }
}

const AA = 4.5

/**
 * 本轮补齐暗色覆盖的三个厂商品牌色徽标。要求最严：**五种合成底色全部 ≥ AA**。
 * 这三个是硬编码品牌色（设计系统里 token 化的既有例外），暗值取法 = 保住品牌色相、
 * 只为暗底提亮，并把底色不透明度从 0.12 略抬（暗底上 0.12 偏闷）。
 */
const TUNED = ['b-openai', 'b-gemini', 'b-teal', 'b-pink', 'b-indigo', 'b-cyan'] as const

/**
 * 走品牌色/语义色硬编码、本轮未改动的徽标。它们在主表面（`--bg` / `--bg-elevated`）
 * 达标，但在"自嵌套 + 行 hover"这种叠加场景下会掉到 AA 以下。这是 `.b-*` 体系
 * **既有的**特性（`.b-claude` 是 Phase A 定稿基准），不是本轮引入，所以此处按主表面
 * 达标 + 叠加场景设地板来锁定，防止继续劣化。
 */
const LEGACY_BRAND = ['b-claude', 'b-grok', 'b-green', 'b-orange'] as const

/**
 * 直接消费语义 token 的徽标。**这三个在暗色下主表面就低于 AA**（实测
 * b-blue 3.86 / b-red 4.26 / b-purple 3.54 on `--bg-elevated`），因为
 * `--blue` / `--red` / `--purple` 是 iOS 系统色、由用户锁定，不能在此擅自改。
 * 已知缺口，此处只设地板防止继续劣化 —— 见本文件末尾的 it.todo。
 */
const TOKEN_DRIVEN = ['b-blue', 'b-red', 'b-purple'] as const

describe('.b-* 暗色模式可读性', () => {
  it('style.css 为本轮品牌色徽标提供了 html.dark 覆盖', () => {
    for (const cls of TUNED) {
      expect(RULES[cls]?.dark.fg, `.${cls} 缺少 html.dark 前景覆盖`).toBeTruthy()
      expect(RULES[cls]?.dark.bg, `.${cls} 缺少 html.dark 底色覆盖`).toBeTruthy()
    }
  })

  it.each(TUNED)('%s 在全部五种合成底色下 >= AA 4.5:1', (cls) => {
    for (const [surface, ratio] of Object.entries(surfaces(cls))) {
      expect(ratio, `.${cls} @ ${surface} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
    }
  })

  it.each(TUNED)('%s 保住品牌色相（暗值只提亮、不换色）', (cls) => {
    // 色相差 <= 12°，以既有 .b-claude(#d97757 -> #e0955f, 实测 10.3°) 为宽容上界
    const { light, dark } = RULES[cls]
    const hue = (c: RGBA): number => {
      const [r, g, b] = c.rgb.map((x) => x / 255)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max === min) return 0
      const d = max - min
      const h =
        max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      return (h * 60 + 360) % 360
    }
    const lightHue = hue(parseColor(light.fg as string))
    const darkHue = hue(parseColor(dark.fg as string))
    const delta = Math.min(Math.abs(lightHue - darkHue), 360 - Math.abs(lightHue - darkHue))
    expect(delta, `.${cls} 色相偏移 ${delta.toFixed(1)}°`).toBeLessThanOrEqual(12)
  })

  it.each(LEGACY_BRAND)('%s 在主表面 >= AA，叠加场景不低于 3.5 地板', (cls) => {
    const s = surfaces(cls)
    expect(s['on --bg'], `.${cls} @ --bg`).toBeGreaterThanOrEqual(AA)
    expect(s['on --bg-elevated'], `.${cls} @ --bg-elevated`).toBeGreaterThanOrEqual(AA)
    for (const [surface, ratio] of Object.entries(s)) {
      expect(ratio, `.${cls} @ ${surface}`).toBeGreaterThanOrEqual(3.5)
    }
  })

  it.each(TOKEN_DRIVEN)('%s 已知低于 AA，锁定当前水位防止继续劣化', (cls) => {
    const s = surfaces(cls)
    expect(s['on --bg'], `.${cls} @ --bg`).toBeGreaterThanOrEqual(4.4)
    expect(s['on --bg-elevated'], `.${cls} @ --bg-elevated`).toBeGreaterThanOrEqual(3.5)
  })

  it.todo(
    'b-blue / b-red / b-purple 暗色主表面低于 AA（--blue/--red/--purple 是用户锁定的 iOS 系统色，需产品决策后才能调）'
  )
})

describe('.b-* 单一事实来源', () => {
  const groupBadge = readFileSync(
    resolve(__dirname, '../GroupBadge.vue'),
    'utf8'
  )

  it('GroupBadge.vue 不得重建 .b-* / .badge / .gpill 的本地副本', () => {
    // scoped 规则带 [data-v-*]，特异性高于全局层，会让全站徽标改动在本组件上静默半失效
    expect(groupBadge).not.toMatch(/<style/)
  })

  it('GroupBadge.vue 引用的每个 .b-* 都在 style.css 有全局定义', () => {
    const referenced = [...groupBadge.matchAll(/'(b-[\w-]+)'/g)].map((m) => m[1])
    expect(referenced.length).toBeGreaterThan(0)
    for (const cls of new Set(referenced)) {
      expect(RULES[cls], `.${cls} 被 GroupBadge 引用但 style.css 无定义`).toBeTruthy()
    }
  })

  it('全站 .b-* 的定义只出现在 style.css（无 .vue scoped 副本）', () => {
    // 这条守的是"下一个人又复制一份"。仅检查随本组件族一起演进的公共徽标消费者。
    const consumers = ['../GroupBadge.vue', '../../payment/OrderStatusBadge.vue']
    for (const rel of consumers) {
      const src = readFileSync(resolve(__dirname, rel), 'utf8')
      const styleBlock = src.match(/<style[\s\S]*?<\/style>/)?.[0] ?? ''
      expect(styleBlock, `${rel} 含 .b-* scoped 定义`).not.toMatch(/\.b-[\w-]+\s*\{/)
    }
  })
})

describe('GroupBadge CN platform classes', () => {
  it.each([
    ['kimi', 'b-pink'],
    ['zhipu', 'b-indigo'],
    ['deepseek', 'b-cyan'],
  ] as const)('%s renders with the shared %s class', (platform, expectedClass) => {
    const wrapper = mount(GroupBadge, {
      props: {
        name: platform,
        platform: platform as GroupPlatform,
        rateMultiplier: 1,
      },
      global: { stubs: { PlatformIcon: true } },
    })

    expect(wrapper.get('.badge').classes()).toContain(expectedClass)
  })
})
