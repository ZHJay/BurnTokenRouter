<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { OpsThroughputTrendPoint } from '@/api/admin/ops'
import type { ChartState } from '../types'
import { formatHistoryLabel, sumNumbers } from '../utils/opsFormatters'
import {
  chartAreaFill,
  chartAxisChrome,
  chartAxisFont,
  chartAxisNoGrid,
  chartChrome,
  chartHue,
  chartLegendStyle,
  chartTooltipStyle,
  useChartScheme
} from '@/lib/chart'
import HelpTooltip from '@/components/common/HelpTooltip.vue'
import EmptyState from '@/components/common/EmptyState.vue'

ChartJS.register(Title, Tooltip, Legend, LineElement, LinearScale, PointElement, CategoryScale, Filler)

interface Props {
  points: OpsThroughputTrendPoint[]
  loading: boolean
  timeRange: string
  fullscreen?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()

/**
 * canvas 读不到 CSS 变量，配色只能由 JS 侧驱动 —— `useChartScheme()` 用
 * MutationObserver 盯 `<html class="dark">`，主题切换时让下面的 computed 重新求值。
 * （此前 `isDarkMode` 直接在 computed 里读 DOM：`classList.contains()` 不是响应式源，
 * computed 永不失效，切主题后图表会停在旧配色直到整页刷新。）
 */
const scheme = useChartScheme()
// 切换率用系统青，保留原有色相语义
const colors = computed(() => {
  const chrome = chartChrome(scheme.value)
  return {
    teal: chartHue('teal', scheme.value),
    text: chrome.axis
  }
})

const totalRequests = computed(() => sumNumbers(props.points.map((p) => p.request_count)))

const chartData = computed(() => {
  if (!props.points.length || totalRequests.value <= 0) return null
  return {
    labels: props.points.map((p) => formatHistoryLabel(p.bucket_start, props.timeRange)),
    datasets: [
      {
        label: t('admin.ops.switchRate'),
        data: props.points.map((p) => {
          const requests = p.request_count ?? 0
          const switches = p.switch_count ?? 0
          if (requests <= 0) return 0
          return switches / requests
        }),
        borderColor: colors.value.teal,
        backgroundColor: chartAreaFill(colors.value.teal),
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10
      }
    ]
  }
})

const state = computed<ChartState>(() => {
  if (chartData.value) return 'ready'
  if (props.loading) return 'loading'
  return 'empty'
})

const options = computed(() => {
  const c = colors.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: chartLegendStyle(scheme.value, 'compact')
      },
      tooltip: {
        ...chartTooltipStyle(scheme.value),
        callbacks: {
          label: (context: any) => {
            const value = typeof context?.parsed?.y === 'number' ? context.parsed.y : 0
            return `${t('admin.ops.switchRate')}: ${value.toFixed(3)}`
          }
        }
      }
    },
    scales: {
      x: {
        type: 'category' as const,
        ...chartAxisNoGrid(),
        ticks: {
          color: c.text,
          font: chartAxisFont(),
          maxTicksLimit: 8,
          autoSkip: true,
          autoSkipPadding: 10
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ...chartAxisChrome(scheme.value, true),
        ticks: {
          color: c.text,
          font: chartAxisFont(),
          callback: (value: any) => Number(value).toFixed(3)
        }
      }
    }
  }
})
</script>

<template>
  <!-- 图表卡片保持不透明：数据密集的折线放在毛玻璃上会糊 -->
  <div class="card flex h-full flex-col p-6">
    <div class="mb-4 flex shrink-0 items-center justify-between">
      <h3 class="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">
        <svg class="h-4 w-4" :style="{ color: 'var(--sys-teal)' }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10M7 12h6m-6 5h3" />
        </svg>
        {{ t('admin.ops.switchRateTrend') }}
        <HelpTooltip v-if="!props.fullscreen" :content="t('admin.ops.tooltips.switchRateTrend')" />
      </h3>
    </div>

    <div class="min-h-0 flex-1">
      <!-- vue-chartjs 渲染的是裸 <canvas>（已带 role="img"），不给 aria-label 就是一个无名图形 -->
      <Line
        v-if="state === 'ready' && chartData"
        :data="chartData"
        :options="options"
        :aria-label="t('admin.ops.switchRateTrend')"
      />
      <div v-else class="flex h-full items-center justify-center">
        <div v-if="state === 'loading'" class="animate-pulse text-sm text-gray-400">{{ t('common.loading') }}</div>
        <EmptyState v-else :title="t('common.noData')" :description="t('admin.ops.charts.emptyRequest')" />
      </div>
    </div>
  </div>
</template>
