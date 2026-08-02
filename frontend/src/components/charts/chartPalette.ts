/**
 * 分布 / 趋势图表主题 — Apple 系统色。
 *
 * 与 `src/views/admin/ops/utils/chartTheme.ts` 是同一套约定的姊妹文件：
 * ops 那份服务运维视图里的定长序列，这份服务 `components/charts/` 下
 * 「类目数量由数据决定」的环形图与多序列趋势图，因此多了一个按序号取色的
 * 有序色板（`distributionColor`）。两处色值必须保持一致。
 *
 * 多色语义是刻意保留的：每个模型 / 分组 / 端点必须能相互区分，
 * 图表可读性优先于色彩克制。这里只把旧 Tailwind 色换成 Apple 系统色，
 * 并给每个色相配 light / dark 两档（系统色在深色模式下会提亮）。
 *
 * Chart.js 画在 canvas 上，拿不到 CSS 自定义属性，所以这里是 style.css 中
 * `--sys-*` / `--label-*` / `--separator` / `--surface*` 的字面镜像。
 * 改动其中一侧时请同步另一侧。
 */

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export type ChartScheme = 'light' | 'dark'

interface HuePair {
  readonly light: string
  readonly dark: string
}

/** 序列色：与 style.css 的 `--sys-*` 一一对应。 */
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
  /** 中性序列（“其他” / 合计兜底）：两档同值，刻意不抢主色。 */
  gray: { light: '#8e8e93', dark: '#8e8e93' }
} as const satisfies Record<string, HuePair>

export type ChartHue = keyof typeof SERIES_HUES

/**
 * 环形图 / 排行榜的有序类目色板。
 *
 * 前 8 位与 `UserDashboardCharts.vue` 的 `MODEL_HUES` 同序 —— 同一份模型列表
 * 在用户仪表盘和管理端分布图里会得到相同的颜色。之后按色相间距继续排开，
 * 相邻扇区因此不会撞色。灰色不在序列内：它专门留给「其他」这类非真实类目。
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
  /** `--label-secondary` — 图例要能读，比轴标签重一级 */
  legend: { light: 'rgba(60, 60, 67, 0.6)', dark: 'rgba(235, 235, 245, 0.6)' },
  /** `--label` */
  label: { light: 'rgba(0, 0, 0, 0.88)', dark: 'rgba(255, 255, 255, 0.94)' },
  /** 浮层比卡片高一级：light 用 `--surface`，dark 用 `--surface-secondary` */
  tooltipBg: { light: '#ffffff', dark: '#2c2c2e' }
} as const satisfies Record<string, HuePair>

/** 与 tailwind.config.js 的 sans 栈一致，避免图表退回 canvas 默认字体。 */
export const CHART_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

/** 轴标签 9–10px，小而克制。 */
export const CHART_AXIS_FONT_SIZE = 10

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

/** 图例：点状标记 + 二级标签色。 */
export function chartLegendStyle(scheme: ChartScheme) {
  return {
    color: chartChrome(scheme).legend,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    boxWidth: 6,
    boxHeight: 6,
    padding: 15,
    font: { size: 11, family: CHART_FONT }
  }
}

/**
 * 跟随 `<html class="dark">` 的配色开关。
 *
 * canvas 不会因为 CSS 变量变化而重绘，所以主题切换必须由 JS 侧驱动：
 * 用 MutationObserver 盯 class 变化，让依赖它的 computed 重新求值。
 * （纯 computed 读 DOM 不会建立依赖，切主题时图表会停在旧配色。）
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
