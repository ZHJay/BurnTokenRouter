<template>
  <div class="card p-4">
    <h3 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
      {{ t('admin.dashboard.tokenUsageTrend') }}
    </h3>
    <div v-if="loading" class="flex h-48 items-center justify-center">
      <LoadingSpinner />
    </div>
    <div v-else-if="trendData.length > 0 && chartData" class="h-48">
      <Line :data="chartData" :options="lineOptions" />
    </div>
    <div
      v-else
      class="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { TrendDataPoint } from '@/types'
import {
  chartAreaFill,
  chartAxisFont,
  chartChrome,
  chartHue,
  chartLegendStyle,
  chartTooltipStyle,
  useChartScheme,
  withAlpha
} from './chartPalette'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const { t } = useI18n()

const props = defineProps<{
  trendData: TrendDataPoint[]
  loading?: boolean
}>()

/**
 * canvas 读不到 CSS 变量，配色只能由 JS 侧驱动 —— `useChartScheme()` 用
 * MutationObserver 盯 `<html class="dark">`，主题切换时让下面的 computed 重新求值。
 * （此前 `isDarkMode` 直接在 computed 里读 DOM，不会建立依赖，切主题后图表停在旧配色。）
 */
const scheme = useChartScheme()

/**
 * 序列色 —— Apple 系统色，light / dark 各一档。
 *
 * 一序列一色相：五条线必须相互区分，可读性优先于色彩克制。
 * 色相角色沿用 chartPalette 的约定：主序列蓝、输出绿、缓存创建橙、缓存读取青、
 * 比率紫（与右轴同色，读者才知道这条轴属于哪条线）。
 */
const chartColors = computed(() => {
  const chrome = chartChrome(scheme.value)
  return {
    grid: chrome.grid,
    axis: chrome.axis,
    input: chartHue('blue', scheme.value),
    output: chartHue('green', scheme.value),
    cacheCreation: chartHue('orange', scheme.value),
    cacheRead: chartHue('teal', scheme.value),
    cacheHitRate: chartHue('purple', scheme.value)
  }
})

const chartData = computed(() => {
  if (!props.trendData?.length) return null

  return {
    labels: props.trendData.map((d) => d.date),
    datasets: [
      {
        label: 'Input',
        data: props.trendData.map((d) => d.input_tokens),
        borderColor: chartColors.value.input,
        backgroundColor: chartAreaFill(chartColors.value.input),
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10
      },
      {
        label: 'Output',
        data: props.trendData.map((d) => d.output_tokens),
        borderColor: chartColors.value.output,
        backgroundColor: chartAreaFill(chartColors.value.output),
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10
      },
      {
        label: 'Cache Creation',
        data: props.trendData.map((d) => d.cache_creation_tokens),
        borderColor: chartColors.value.cacheCreation,
        backgroundColor: chartAreaFill(chartColors.value.cacheCreation),
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10
      },
      {
        label: 'Cache Read',
        data: props.trendData.map((d) => d.cache_read_tokens),
        borderColor: chartColors.value.cacheRead,
        backgroundColor: chartAreaFill(chartColors.value.cacheRead),
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10
      },
      {
        label: 'Cache Hit Rate',
        data: props.trendData.map((d) => {
          const totalPromptTokens = d.input_tokens + d.cache_read_tokens + d.cache_creation_tokens
          return totalPromptTokens > 0 ? (d.cache_read_tokens / totalPromptTokens) * 100 : 0
        }),
        borderColor: chartColors.value.cacheHitRate,
        // 虚线不填充，backgroundColor 只用于图例圆点
        backgroundColor: withAlpha(chartColors.value.cacheHitRate, 0.2),
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        yAxisID: 'yPercent'
      }
    ]
  }
})

const lineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: chartLegendStyle(scheme.value)
    },
    tooltip: {
      ...chartTooltipStyle(scheme.value),
      callbacks: {
        label: (context: any) => {
          if (context.dataset.yAxisID === 'yPercent') {
            return `${context.dataset.label}: ${context.raw.toFixed(1)}%`
          }
          return `${context.dataset.label}: ${formatTokens(context.raw)}`
        },
        footer: (tooltipItems: any) => {
          const dataIndex = tooltipItems[0]?.dataIndex
          if (dataIndex !== undefined && props.trendData[dataIndex]) {
            const data = props.trendData[dataIndex]
            return `Actual: $${formatCost(data.actual_cost)} | Standard: $${formatCost(data.cost)}`
          }
          return ''
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: chartColors.value.grid
      },
      ticks: {
        color: chartColors.value.axis,
        font: chartAxisFont()
      }
    },
    y: {
      grid: {
        color: chartColors.value.grid
      },
      ticks: {
        color: chartColors.value.axis,
        font: chartAxisFont(),
        callback: (value: string | number) => formatTokens(Number(value))
      }
    },
    yPercent: {
      position: 'right' as const,
      min: 0,
      max: 100,
      grid: {
        drawOnChartArea: false
      },
      ticks: {
        // 右轴刻度沿用该序列色，读者才知道这条轴属于哪条线
        color: chartColors.value.cacheHitRate,
        font: chartAxisFont(),
        callback: (value: string | number) => `${value}%`
      }
    }
  }
}))

const formatTokens = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toLocaleString()
}

const formatCost = (value: number): string => {
  if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K'
  } else if (value >= 1) {
    return value.toFixed(2)
  } else if (value >= 0.01) {
    return value.toFixed(3)
  }
  return value.toFixed(4)
}
</script>
