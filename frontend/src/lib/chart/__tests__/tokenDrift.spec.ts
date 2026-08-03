/**
 * 令牌漂移守卫。
 *
 * 图表画在 canvas 上，读不到 CSS 自定义属性，所以 `theme.ts` 里全是 style.css 的
 * 字面镜像。镜像的问题不是「会错」，而是「错了没人知道」：改 token 时没有任何
 * 东西会失败，界面就这么静默偏掉。`--label-secondary` 从 0.6 提到 0.74 时正是
 * 如此 —— 四份副本一起停在被否决的旧值上。
 *
 * 这个测试把 style.css 解析出来，逐条比对 `TOKEN_MIRRORS` 声称的对应关系。
 * 合并模块只是把「四处可能出错」收成一处；真正让下一次 token 变更响亮失败的是这个测试。
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss, { type Rule } from 'postcss'
import { TOKEN_MIRRORS } from '../theme'

const CSS_PATH = resolve(__dirname, '../../../style.css')

type Scheme = 'light' | 'dark'

/**
 * 抽出两个基础配色的自定义属性表。
 *
 * 只认最外层 `@layer base` 里的 `:root` / `.dark`，跳过任何嵌在 `@media` 里的规则：
 * `prefers-contrast: more` 与 `prefers-reduced-transparency` 会再次覆盖同名 token
 * （例如把 --label-secondary 提到 0.86），那是偏好档而不是基线，
 * 拿它比对镜像会得到假失败。
 */
function readTokens(css: string): Record<Scheme, Map<string, string>> {
  const root = postcss.parse(css)
  const out: Record<Scheme, Map<string, string>> = { light: new Map(), dark: new Map() }

  const insideMedia = (rule: Rule): boolean => {
    let node = rule.parent
    while (node) {
      if (node.type === 'atrule' && (node as { name?: string }).name === 'media') return true
      node = node.parent
    }
    return false
  }

  root.walkRules((rule) => {
    if (insideMedia(rule)) return
    const selectors = rule.selectors.map((s) => s.trim())
    const targets: Scheme[] = []
    if (selectors.includes(':root')) targets.push('light')
    if (selectors.includes('.dark')) targets.push('dark')
    if (!targets.length) return

    rule.walkDecls(/^--/, (decl) => {
      for (const scheme of targets) {
        // 后写的覆盖先写的，与 CSS 层叠一致
        out[scheme].set(decl.prop, decl.value.trim())
      }
    })
  })

  return out
}

/**
 * 把颜色规范化成 `r,g,b,a`，好让不同书写形式可比。
 *
 * style.css 里同一个概念有三种写法：`#af52de`、`rgba(60, 60, 67, 0.74)`，
 * 以及 Tailwind 变量色用的裸三元组 `109 109 114`（`--c-gray-*`）。
 * 逐字符比较会把 `#6d6d72` 和 `109 109 114` 判成不同。
 */
function normalizeColor(raw: string): string | null {
  const value = raw.trim().toLowerCase()

  const hex6 = /^#([0-9a-f]{6})$/.exec(value)
  if (hex6) {
    const int = Number.parseInt(hex6[1], 16)
    return `${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},1`
  }

  const hex3 = /^#([0-9a-f]{3})$/.exec(value)
  if (hex3) {
    const [r, g, b] = [...hex3[1]].map((c) => Number.parseInt(c + c, 16))
    return `${r},${g},${b},1`
  }

  const fn = /^rgba?\(([^)]+)\)$/.exec(value)
  if (fn) {
    const parts = fn[1].split(/[,/]/).map((p) => p.trim())
    if (parts.length < 3) return null
    const [r, g, b] = parts
    const a = parts[3] ?? '1'
    return `${Number(r)},${Number(g)},${Number(b)},${Number(a)}`
  }

  // 裸三元组：`109 109 114`
  const triplet = value.split(/\s+/)
  if (triplet.length === 3 && triplet.every((p) => /^\d+$/.test(p))) {
    return `${Number(triplet[0])},${Number(triplet[1])},${Number(triplet[2])},1`
  }

  return null
}

describe('chart palette ↔ style.css 令牌一致性', () => {
  const tokens = readTokens(readFileSync(CSS_PATH, 'utf8'))

  it('解析到了两套基础配色', () => {
    // 解析失败会让下面每个断言都「通过」（拿不到 token 就没得比），先钉住这一点
    expect(tokens.light.size).toBeGreaterThan(30)
    expect(tokens.dark.size).toBeGreaterThan(20)
    expect(tokens.light.get('--label-secondary')).toBeDefined()
  })

  it('镜像清单覆盖了每个色相与每个 chrome 键', () => {
    const groups = TOKEN_MIRRORS.map((m) => m.group)
    expect(groups).toContain('SERIES_HUES.blue')
    expect(groups).toContain('SERIES_HUES.gray')
    expect(groups).toContain('CHROME.legend')
    expect(groups).toContain('CHROME.tooltipBg')
    expect(new Set(groups).size).toBe(groups.length)
  })

  it.each(TOKEN_MIRRORS.map((m) => [m.group, m] as const))(
    '%s 与它声称的令牌一致',
    (_group, mirror) => {
      for (const scheme of ['light', 'dark'] as const) {
        const { token, value } = mirror[scheme]
        const declared = tokens[scheme].get(token)

        expect(
          declared,
          `${mirror.group} 声称镜像 ${token}（${scheme}），但 style.css 的 ${scheme} 配色里没有这个 token`
        ).toBeDefined()

        const expected = normalizeColor(declared!)
        const actual = normalizeColor(value)

        expect(expected, `无法解析 style.css 中的 ${token}: ${declared}`).not.toBeNull()
        expect(actual, `无法解析镜像字面量 ${mirror.group}.${scheme}: ${value}`).not.toBeNull()

        expect(
          actual,
          `${mirror.group}.${scheme} = ${value}，但 ${token} 现在是 ${declared}。` +
            `图表画在 canvas 上读不到 CSS 变量，所以这个字面量必须跟着 token 改。`
        ).toBe(expected)
      }
    }
  )

  it('--sys-gray 并不存在，灰色镜像必须挂在真实令牌上', () => {
    // 早先两份主题文件都注释说 #8e8e93 镜像某个 `--sys-*` 灰。并没有这个 token，
    // 于是浅色档实际用了 --c-gray-500 的深色值。这条断言把那个错误钉住：
    // 若有人把 --sys-gray 加进 style.css，这里会失败并提醒把镜像改回去。
    expect(tokens.light.has('--sys-gray')).toBe(false)
    expect(tokens.dark.has('--sys-gray')).toBe(false)

    const gray = TOKEN_MIRRORS.find((m) => m.group === 'SERIES_HUES.gray')
    expect(gray?.light.token).toBe('--c-gray-500')
    expect(gray?.light.value).not.toBe(gray?.dark.value)
  })
})
