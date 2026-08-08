/**
 * 全站图表主题 —— 唯一事实来源（B4 落地）。
 *
 * 设计契约：
 * - 分类色板基于 iOS 系统色（蓝/绿/橙/红/紫/青/粉/靛/薄荷/金/棕/灰），
 *   亮/暗两套取值，保证在 `--bg-elevated`（亮 #ffffff / 暗 #1c1c1e）上
 *   每个扇区/线条都可区分、可辨识。
 * - 坐标轴 / 网格 / 提示框颜色消费设计 token（`--text-secondary`、
 *   `--separator` 等）的亮暗取值，跟随 `useTheme().isDark` 响应式变化，
 *   主题切换时所有消费方 computed 自动重算并触发 chart.js 重绘。
 *
 * 铁律：chart.js 是 canvas 渲染，无法吃 CSS 变量，因此这里集中了
 * 唯一的十六进制颜色来源；组件里禁止再散落硬编码图表色。
 */
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useTheme } from '@/composables/useTheme'

/** 品牌蓝（platformColors 等非 Vue 模块也引用） */
export const IOS_BLUE = '#0071e3'
export const IOS_BLUE_DARK = '#0a84ff'

/**
 * iOS 分类色板（亮/暗）。每一行是同一种色相的两档亮度：
 * 暗色档整体提亮，避免在 #1c1c1e 上发闷；亮色档保持足够的饱和度。
 * 色相分布刻意拉开（蓝绿橙红紫青粉靛薄荷金棕灰），
 * 相邻扇区靠「色相 + 明度」双维度区分，不只依赖颜色（图例/表格同时给出标签）。
 */
const CATEGORICAL_LIGHT: readonly string[] = [
  '#0071e3', // 蓝 blue
  '#34c759', // 绿 green
  '#ff9f0a', // 橙 orange
  '#ff3b30', // 红 red
  '#af52de', // 紫 purple
  '#30b0c7', // 青 teal
  '#ff2d55', // 粉 pink
  '#5856d6', // 靛 indigo
  '#00c7be', // 薄荷 mint
  '#d9a400', // 金 gold（暗黄，与橙拉开明度）
  '#a2845e', // 棕 brown
  '#8e8e93'  // 灰 gray
]

const CATEGORICAL_DARK: readonly string[] = [
  '#0a84ff', // 蓝
  '#30d158', // 绿
  '#ff9f0a', // 橙
  '#ff453a', // 红
  '#bf5af2', // 紫
  '#40c8e0', // 青
  '#ff375f', // 粉
  '#7080f0', // 靛
  '#63e6e2', // 薄荷
  '#ffd60a', // 金
  '#d0a36f', // 棕
  '#636366'  // 灰
]

/** 中性「其他」色（聚合项，刻意比分类色弱一档，语义上不参与排行） */
export const NEUTRAL_LIGHT = '#8e8e93'
export const NEUTRAL_DARK = '#636366'

/** iOS 语义色（健康分/告警等有明确语义的场景，非分类色板） */
export const SEMANTIC_LIGHT = {
  green: '#34c759',
  orange: '#ff9f0a',
  red: '#ff3b30',
  gray: '#8e8e93'
} as const

export const SEMANTIC_DARK = {
  green: '#30d158',
  orange: '#ff9f0a',
  red: '#ff453a',
  gray: '#8e8e93'
} as const

export interface ChartTooltipColors {
  backgroundColor: string
  titleColor: string
  bodyColor: string
  borderColor: string
}

export interface ChartThemeColors {
  /** 当前主题是否为暗色 */
  isDark: boolean
  /** 分类色板（按需 slice） */
  categorical: readonly string[]
  /** 中性「其他」色 */
  neutral: string
  /** iOS 语义色（绿/橙/红/灰） */
  semantic: { green: string; orange: string; red: string; gray: string }
  /** 坐标轴刻度/图例文字（--text-secondary 的亮暗取值） */
  axisText: string
  /** 网格线（发丝分隔线的 canvas 等价物） */
  grid: string
  /** 饼图/环形图扇区间隔线（用浮起面颜色做 1.5px 分隔，iOS 风格） */
  sliceBorder: string
  /** 工具提示配色（不透明浮起面 + 三级文字） */
  tooltip: ChartTooltipColors
}

const LIGHT: ChartThemeColors = {
  isDark: false,
  categorical: CATEGORICAL_LIGHT,
  neutral: NEUTRAL_LIGHT,
  semantic: SEMANTIC_LIGHT,
  axisText: '#6e6e73', // --text-secondary 亮
  grid: '#e5e5ea', // systemGray5 亮
  sliceBorder: '#ffffff', // --bg-elevated 亮
  tooltip: {
    backgroundColor: '#ffffff', // --bg-elevated 亮
    titleColor: '#1d1d1f', // --text-primary 亮
    bodyColor: '#48484a',
    borderColor: 'rgba(0, 0, 0, 0.08)'
  }
}

const DARK: ChartThemeColors = {
  isDark: true,
  categorical: CATEGORICAL_DARK,
  neutral: NEUTRAL_DARK,
  semantic: SEMANTIC_DARK,
  axisText: '#aeaeb2', // --text-secondary 暗
  grid: '#38383a', // systemGray5 暗
  sliceBorder: '#1c1c1e', // --bg-elevated 暗
  tooltip: {
    backgroundColor: '#1c1c1e', // --bg-elevated 暗
    titleColor: '#f5f5f7', // --text-primary 暗
    bodyColor: '#d1d1d6',
    borderColor: 'rgba(255, 255, 255, 0.12)'
  }
}

/**
 * 响应式图表主题。组件里 `const theme = useChartTheme()`，
 * 在 `computed` 中消费 `theme.value.*`，主题切换即自动重绘。
 */
export function useChartTheme(): ComputedRef<ChartThemeColors> {
  const { isDark } = useTheme()
  return computed(() => (isDark.value ? DARK : LIGHT))
}

/** 给 #rrggbb 加透明度，返回 #rrggbbaa（chart.js 原生支持 8 位 hex） */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const full =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized.slice(0, 6)
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${full}${a}`
}
