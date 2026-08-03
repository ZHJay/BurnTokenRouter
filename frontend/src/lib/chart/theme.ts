/**
 * 图表主题 —— Apple 系统色的唯一来源。
 *
 * 这里曾是两份文件：`components/charts/chartPalette.ts` 与
 * `views/admin/ops/utils/chartTheme.ts`。后者是前者去掉分布色板后的严格子集，
 * 靠注释「两处色值必须保持一致」手工同步 —— 结果 `--label-secondary` 在两份里
 * 同时错成同一个被否决的旧值。手工同步的副本不会失败，只会一起漂移，
 * 所以合并成一份，并由 `__tests__/tokenDrift.spec.ts` 解析 style.css 做校验。
 *
 * Chart.js 画在 canvas 上，拿不到 CSS 自定义属性，所以下面全是 style.css 中
 * `--sys-*` / `--label-*` / `--separator` / `--surface*` / `--c-gray-*` 的字面镜像。
 * 每条镜像都在 `TOKEN_MIRRORS` 里登记了它声称对应的 token；改 token 而不改镜像
 * （或反之）会让漂移测试失败，不再是静默不一致。
 *
 * 多色语义是刻意保留的：每个模型 / 分组 / 端点 / 序列必须能相互区分，
 * 图表可读性优先于色彩克制。每个色相配 light / dark 两档（系统色在深色下会提亮）。
 */

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { Chart } from 'chart.js'

export type ChartScheme = 'light' | 'dark'

interface HuePair {
  readonly light: string
  readonly dark: string
}

/** 序列色：与 style.css 的 `--sys-*` 一一对应（灰色除外，见下）。 */
const SERIES_HUES = {
  /** --sys-blue：主序列 / 请求数 */
  blue: { light: '#007aff', dark: '#0a84ff' },
  /** --sys-purple：次序列 / Token */
  purple: { light: '#af52de', dark: '#bf5af2' },
  /** --sys-teal：第四序列 / 缓存读取 */
  teal: { light: '#30b0c7', dark: '#40c8e0' },
  /** --sys-orange：警示 / 缓存创建 */
  orange: { light: '#ff9500', dark: '#ff9f0a' },
  /** --sys-green：成功 / 输出 */
  green: { light: '#34c759', dark: '#30d158' },
  /** --sys-indigo：第三序列 / 延迟 */
  indigo: { light: '#5856d6', dark: '#5e5ce6' },
  /** --sys-pink */
  pink: { light: '#ff2d55', dark: '#ff375f' },
  /** --sys-mint */
  mint: { light: '#00c7be', dark: '#63e6e2' },
  /** --sys-yellow */
  yellow: { light: '#ffcc00', dark: '#ffd60a' },
  /** --sys-cyan */
  cyan: { light: '#32ade6', dark: '#64d2ff' },
  /** --sys-red：错误 */
  red: { light: '#ff3b30', dark: '#ff453a' },
  /**
   * 中性序列（「其他」/ 合计兜底 / 虚线基准）：刻意不抢主色。
   *
   * 没有 `--sys-gray` 这个 token —— 早先的注释声称有，于是两档都写了 `#8e8e93`，
   * 那其实只是 `--c-gray-500` 的深色档，浅色下用错了一整档。这里对齐真正存在的
   * `--c-gray-500`（它是唯一分主题取值的中性档）。
   */
  gray: { light: '#6d6d72', dark: '#8e8e93' }
} as const satisfies Record<string, HuePair>

export type ChartHue = keyof typeof SERIES_HUES

/**
 * 环形图 / 排行榜的有序类目色板。
 *
 * 前 8 位是用户仪表盘与管理端分布图共用的顺序 —— 同一份模型列表在两处得到
 * 相同的颜色。之后按色相间距继续排开，相邻扇区因此不会撞色。
 * 灰色不在序列内：它专门留给「其他」这类非真实类目。
 */
const DISTRIBUTION_SEQUENCE: readonly ChartHue[] = [
  'blue',
  'purple',
  'teal',
  'orange',
  'green',
  'indigo',
  'pink',
  'mint',
  'yellow',
  'cyan',
  'red'
]

/** 图表外框（网格 / 轴标签 / 图例 / 浮层）：`--separator`、`--label-*`、`--surface*` 的镜像。 */
const CHROME = {
  /** `--separator` */
  grid: { light: 'rgba(60, 60, 67, 0.12)', dark: 'rgba(84, 84, 88, 0.5)' },
  /** `--label-tertiary` — 轴标签压到第三级，数据本身才是主角 */
  axis: { light: 'rgba(60, 60, 67, 0.36)', dark: 'rgba(235, 235, 245, 0.34)' },
  /**
   * `--label-secondary` — 图例 / 浮层正文要能读，比轴标签重一级。
   *
   * 浅色档必须是 0.74：0.6 在 --surface 上只有 3.44:1，是整个浅色副文字层的
   * 失败点（style.css 里保留了推导）。这一处曾经四份副本一起停在 0.6。
   */
  legend: { light: 'rgba(60, 60, 67, 0.74)', dark: 'rgba(235, 235, 245, 0.6)' },
  /** `--label` */
  label: { light: 'rgba(0, 0, 0, 0.88)', dark: 'rgba(255, 255, 255, 0.94)' },
  /** 浮层比卡片高一级：light 用 `--surface`，dark 用 `--surface-secondary` */
  tooltipBg: { light: '#ffffff', dark: '#2c2c2e' }
} as const satisfies Record<string, HuePair>

/**
 * 镜像清单 —— 给漂移测试用的机器可读版本。
 *
 * 每条记录「这个字面量声称等于哪个 token 的哪一档」。
 * `__tests__/tokenDrift.spec.ts` 解析 style.css 后逐条比对，
 * 于是 token 改了而镜像没跟上会直接失败，而不是静默错到界面上。
 */
export interface TokenMirror {
  /** 镜像的归属，仅用于失败信息 */
  readonly group: string
  /** 浅色档：token 名 + 该档字面量 */
  readonly light: { readonly token: string; readonly value: string }
  /** 深色档：token 名 + 该档字面量。多数情况两档同名，浮层背景是例外。 */
  readonly dark: { readonly token: string; readonly value: string }
}

const HUE_TOKENS: Record<ChartHue, string> = {
  blue: '--sys-blue',
  purple: '--sys-purple',
  teal: '--sys-teal',
  orange: '--sys-orange',
  green: '--sys-green',
  indigo: '--sys-indigo',
  pink: '--sys-pink',
  mint: '--sys-mint',
  yellow: '--sys-yellow',
  cyan: '--sys-cyan',
  red: '--sys-red',
  gray: '--c-gray-500'
}

/**
 * 每档镜像对应的 token。
 *
 * `tooltipBg` 两档不同名是刻意的：浮层要比卡片高一级，浅色下用 `--surface`
 * （纯白），深色下用 `--surface-secondary`（比 `--bg-base` 亮一档）。
 */
const CHROME_TOKENS: Record<keyof typeof CHROME, { light: string; dark: string }> = {
  grid: { light: '--separator', dark: '--separator' },
  axis: { light: '--label-tertiary', dark: '--label-tertiary' },
  legend: { light: '--label-secondary', dark: '--label-secondary' },
  label: { light: '--label', dark: '--label' },
  tooltipBg: { light: '--surface', dark: '--surface-secondary' }
}

export const TOKEN_MIRRORS: readonly TokenMirror[] = [
  ...(Object.keys(SERIES_HUES) as ChartHue[]).map((hue) => ({
    group: `SERIES_HUES.${hue}`,
    light: { token: HUE_TOKENS[hue], value: SERIES_HUES[hue].light },
    dark: { token: HUE_TOKENS[hue], value: SERIES_HUES[hue].dark }
  })),
  ...(Object.keys(CHROME) as (keyof typeof CHROME)[]).map((key) => ({
    group: `CHROME.${key}`,
    light: { token: CHROME_TOKENS[key].light, value: CHROME[key].light },
    dark: { token: CHROME_TOKENS[key].dark, value: CHROME[key].dark }
  }))
]

/** 与 tailwind.config.js 的 sans 栈一致，避免图表退回 canvas 默认字体。 */
export const CHART_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

/** 轴标签 9–10px，小而克制。 */
export const CHART_AXIS_FONT_SIZE = 10

/**
 * 全局字体兜底。
 *
 * Chart.js 的默认字体是 `'Helvetica Neue', Helvetica, Arial, sans-serif`，
 * 任何只写 `font: { size }` 而不写 `family` 的轴 / 图例都会掉进去 ——
 * 既跳出 SF / system 栈，也丢掉中文标签需要的 PingFang SC。
 * 逐处补 family 需要改十几个对象，改一次全局默认更便宜，
 * 且对本仓库以外新加的图表同样生效。
 *
 * 在模块加载时立即执行（见文件末尾）：所有图表都会 import 这个模块，
 * 因此不需要在 main.ts 里额外挂一行。
 */
export function applyChartFontDefaults(): void {
  // 这个函数在模块加载时就会跑（见文件末尾），因此不能假设 `Chart` 是完整实现：
  // 测试里常把 `chart.js` 模块 mock 成只有 `register` 的桩对象。缺 `defaults`
  // 时静默跳过 —— 真实运行时一定有，桩对象也不需要字体默认值。
  const font = (Chart as { defaults?: { font?: { family?: string } } })?.defaults?.font
  if (font) font.family = CHART_FONT
}

export function chartScheme(isDark: boolean): ChartScheme {
  return isDark ? 'dark' : 'light'
}

/** 取某个色相在当前配色下的实际色值。 */
export function chartHue(hue: ChartHue, scheme: ChartScheme): string {
  return SERIES_HUES[hue][scheme]
}

/**
 * 按类目序号取色，超出色板长度后回卷。
 *
 * 回卷而不是留空：类目数量来自后端数据，写死长度会让第 12 个之后的扇区拿到
 * `undefined` 而被 Chart.js 画成透明。
 */
export function distributionColor(index: number, scheme: ChartScheme): string {
  const hue = DISTRIBUTION_SEQUENCE[index % DISTRIBUTION_SEQUENCE.length]
  return chartHue(hue, scheme)
}

/** 「其他」类目的中性色，与真实类目区分。 */
export function neutralColor(scheme: ChartScheme): string {
  return chartHue('gray', scheme)
}

/** 6 位 hex 加透明度；非法输入原样返回，避免图表整条序列变透明。 */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const int = Number.parseInt(m[1], 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 折线下的面积填充：色值 → 透明的竖向渐变。
 *
 * 这是刻意保留渐变的地方 —— 平涂色块会把下方网格压死，
 * 而向下淡出既能标示体量又不遮挡基线。
 */
export function chartAreaFill(color: string, opacity = 0.2) {
  return (context: {
    chart?: { ctx?: CanvasRenderingContext2D | null; chartArea?: { top: number; bottom: number } | null }
  }) => {
    const chart = context?.chart
    const area = chart?.chartArea
    const canvasCtx = chart?.ctx
    // 首帧 chartArea 还没量出来，退回平涂，下一帧自然升级成渐变
    if (!area || !canvasCtx || typeof canvasCtx.createLinearGradient !== 'function') {
      return withAlpha(color, opacity)
    }
    const gradient = canvasCtx.createLinearGradient(0, area.top, 0, area.bottom)
    gradient.addColorStop(0, withAlpha(color, opacity))
    gradient.addColorStop(1, withAlpha(color, 0))
    return gradient
  }
}

/** 网格 / 轴 / 图例 / 浮层的成套色值。 */
export function chartChrome(scheme: ChartScheme) {
  return {
    grid: CHROME.grid[scheme],
    axis: CHROME.axis[scheme],
    legend: CHROME.legend[scheme],
    label: CHROME.label[scheme],
    tooltipBg: CHROME.tooltipBg[scheme]
  }
}

/** 轴 ticks 的统一字体配置。 */
export function chartAxisFont() {
  return { size: CHART_AXIS_FONT_SIZE, family: CHART_FONT }
}

/** 网格线宽：0.5 CSS px ≈ DPR 2 下的 1 物理像素，也就是 Apple 的发丝线。 */
export const CHART_GRID_LINE_WIDTH = 0.5

/**
 * 直角坐标轴的网格 + 轴线。
 *
 * 两件事只能在同一个地方做对：
 *
 * 1. **轴线**。chart.js 4 的 `scale.border` 默认是
 *    `{display: true, width: 1, color: 'rgba(0,0,0,0.1)'}` —— 一条没有任何 token
 *    管得着的黑色半透明实线，浅色下是多余的毛边，深色下直接是错的。关掉它，
 *    让发丝网格自己承担轴的视觉职责。
 * 2. **虚线**。`grid.borderDash` 是 chart.js **v3** 的写法，v4 已经搬到
 *    `scale.border.dash`；v4 会照收 `grid.borderDash` 但完全忽略它
 *    （`Chart.defaults.scale.grid` 里根本没有这个键）。所以「虚线网格」得写在
 *    border 上 —— 而 `border.dash` 影响的正是网格线本身，不是被关掉的那条轴线。
 *
 * @param dashed 是否要虚线网格（趋势图的横向网格用虚线，柱状 / 分类轴通常直接关网格）
 */
export function chartAxisChrome(scheme: ChartScheme, dashed = false) {
  return {
    grid: { color: chartChrome(scheme).grid, lineWidth: CHART_GRID_LINE_WIDTH },
    border: { display: false, ...(dashed ? { dash: [4, 4] } : {}) }
  }
}

/**
 * 不画网格的轴（分类轴 / 副轴）也要显式关掉轴线，否则 `scale.border` 的默认黑线会留在那里。
 *
 * 两种「不画网格」不可互换，所以由调用方点明：
 * - `all`：`grid.display: false` —— 网格线与刻度线一起消失（分类轴、右侧副轴常用）。
 * - `chartArea`：`grid.drawOnChartArea: false` —— 只去掉画布内的网格线，
 *   轴边缘的刻度线保留。把它当作 `all` 会顺手删掉那些刻度线，属于视觉漂移。
 */
export function chartAxisNoGrid(kind: 'all' | 'chartArea' = 'all') {
  return {
    grid: kind === 'all' ? { display: false } : { drawOnChartArea: false },
    border: { display: false }
  }
}

/** 浮层样式：圆角贴齐圆角阶梯，描边用 hairline 而不是实线框。 */
export function chartTooltipStyle(scheme: ChartScheme) {
  const chrome = chartChrome(scheme)
  return {
    backgroundColor: chrome.tooltipBg,
    titleColor: chrome.label,
    bodyColor: chrome.legend,
    borderColor: chrome.grid,
    borderWidth: 1,
    cornerRadius: 12,
    padding: 10,
    displayColors: true,
    usePointStyle: true,
    titleFont: { size: 11, weight: 600, family: CHART_FONT },
    bodyFont: { size: 11, family: CHART_FONT }
  }
}

/**
 * 图例的两档预设。
 *
 * 合并两个模块时这里必须留两档：原 `chartLegendStyle` 是 `padding: 15` + 11px，
 * 原 `opsLegendStyle` 不带 padding（取 chart.js 默认 10）+ 10px。
 * 硬凑成一档会顺手改掉 5 个 Ops 图表的图例间距 —— 那是没人评审过的视觉漂移。
 * `compact` 档刻意不写 padding 键，保证与合并前逐字节等价。
 */
export function chartLegendStyle(scheme: ChartScheme, variant: 'default' | 'compact' = 'default') {
  const base = {
    color: chartChrome(scheme).legend,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    boxWidth: 6,
    boxHeight: 6
  }
  return variant === 'compact'
    ? { ...base, font: { size: CHART_AXIS_FONT_SIZE, family: CHART_FONT } }
    : { ...base, padding: 15, font: { size: 11, family: CHART_FONT } }
}

/**
 * 跟随 `<html class="dark">` 的配色开关。
 *
 * canvas 不会因为 CSS 变量变化而重绘，所以主题切换必须由 JS 侧驱动：
 * 用 MutationObserver 盯 class 变化，让依赖它的 computed 重新求值。
 * （纯 computed 读 DOM 不会建立依赖 —— `classList.contains('dark')` 不是响应式源，
 * computed 因此永不失效，Chart.js continues 用缓存的 options，图表会停在旧配色
 * 直到整页刷新。这是本文件存在的主要原因。）
 */
export function useChartScheme(): Ref<ChartScheme> {
  const hasDom = typeof document !== 'undefined'
  const read = (): ChartScheme =>
    hasDom && document.documentElement.classList.contains('dark') ? 'dark' : 'light'

  const scheme = ref<ChartScheme>(read())
  let observer: MutationObserver | null = null

  onMounted(() => {
    if (!hasDom || typeof MutationObserver === 'undefined') return
    scheme.value = read()
    observer = new MutationObserver(() => {
      scheme.value = read()
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return scheme
}

// 模块副作用：任何 import 本模块的图表都会拿到正确的默认字体族。
applyChartFontDefaults()
