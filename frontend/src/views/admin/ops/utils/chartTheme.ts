/**
 * Ops 图表主题 — Apple 系统色。
 *
 * 多色语义是刻意保留的：吞吐 / 延迟 / 错误各条序列必须能相互区分，
 * 图表的可读性优先于色彩克制。这里只把色值换成 Apple 系统色，
 * 并给每个色相配 light / dark 两档（系统色在深色模式下会提亮）。
 *
 * Chart.js 画在 canvas 上，拿不到 CSS 变量，所以这里是 style.css 中
 * `--sys-*` / `--label-*` / `--separator` 的字面镜像。改动其中一侧时请同步另一侧。
 */

export type OpsChartScheme = 'light' | 'dark'

/** 序列色：与 style.css 的 `--sys-*` 一一对应。 */
const SERIES_HUES = {
  blue: { light: '#007aff', dark: '#0a84ff' },
  purple: { light: '#af52de', dark: '#bf5af2' },
  teal: { light: '#30b0c7', dark: '#40c8e0' },
  orange: { light: '#ff9500', dark: '#ff9f0a' },
  green: { light: '#34c759', dark: '#30d158' },
  indigo: { light: '#5856d6', dark: '#5e5ce6' },
  red: { light: '#ff3b30', dark: '#ff453a' },
  /** 中性序列（虚线基准 / “其他”分类）：两档同值，刻意不抢主色。 */
  gray: { light: '#8e8e93', dark: '#8e8e93' }
} as const

export type OpsChartHue = keyof typeof SERIES_HUES

/** 图表外框（网格 / 轴标签 / 浮层）：`--separator`、`--label-*`、`--surface*` 的镜像。 */
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
} as const

/** 与 tailwind.config.js 的 sans 栈一致，避免图表退回 canvas 默认字体。 */
export const OPS_CHART_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

/** 轴标签 9–10px，小而克制。 */
export const OPS_AXIS_FONT_SIZE = 10

export function opsScheme(isDark: boolean): OpsChartScheme {
  return isDark ? 'dark' : 'light'
}

/** 取某个色相在当前配色下的实际色值。 */
export function opsHue(hue: OpsChartHue, scheme: OpsChartScheme): string {
  return SERIES_HUES[hue][scheme]
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
export function opsAreaFill(color: string, opacity = 0.2) {
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
export function opsChartChrome(scheme: OpsChartScheme) {
  return {
    grid: CHROME.grid[scheme],
    axis: CHROME.axis[scheme],
    legend: CHROME.legend[scheme],
    label: CHROME.label[scheme],
    tooltipBg: CHROME.tooltipBg[scheme]
  }
}

/** 轴 ticks 的统一字体配置。 */
export function opsAxisFont() {
  return { size: OPS_AXIS_FONT_SIZE, family: OPS_CHART_FONT }
}

/**
 * 浮层样式：圆角贴齐圆角阶梯，描边用 hairline 而不是实线框。
 */
export function opsTooltipStyle(scheme: OpsChartScheme) {
  const chrome = opsChartChrome(scheme)
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
    titleFont: { size: 11, weight: 600, family: OPS_CHART_FONT },
    bodyFont: { size: 11, family: OPS_CHART_FONT }
  }
}

/** 图例：点状标记 + 二级标签色。 */
export function opsLegendStyle(scheme: OpsChartScheme) {
  return {
    color: opsChartChrome(scheme).legend,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    boxWidth: 6,
    boxHeight: 6,
    font: { size: OPS_AXIS_FONT_SIZE, family: OPS_CHART_FONT }
  }
}
