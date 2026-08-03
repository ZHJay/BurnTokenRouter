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
import type { OpsErrorTrendPoint } from '@/api/admin/ops'
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
  points: OpsErrorTrendPoint[]
  loading: boolean
  timeRange: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'openRequestErrors'): void
  (e: 'openUpstreamErrors'): void
}>()
const { t } = useI18n()

/**
 * canvas 读不到 CSS 变量，配色只能由 JS 侧驱动 —— `useChartScheme()` 用
 * MutationObserver 盯 `<html class="dark">`，主题切换时让下面的 computed 重新求值。
 * （此前 `isDarkMode` 直接在 computed 里读 DOM：`classList.contains()` 不是响应式源，
 * computed 永不失效，切主题后图表会停在旧配色直到整页刷新。）
 */
const scheme = useChartScheme()
// 请求错误=红，上游错误=紫，业务限流=中性虚线：三类错误的严重度靠色相拉开
const colors = computed(() => {
  const chrome = chartChrome(scheme.value)
  return {
    red: chartHue('red', scheme.value),
    purple: chartHue('purple', scheme.value),
    gray: chartHue('gray', scheme.value),
    text: chrome.axis
  }
})

const totalRequestErrors = computed(() => sumNumbers(props.points.map((p) => p.error_count_sla ?? 0)))

const totalUpstreamErrors = computed(() =>
  sumNumbers(
    props.points.map((p) => (p.upstream_error_count_excl_429_529 ?? 0) + (p.upstream_429_count ?? 0) + (p.upstream_529_count ?? 0))
  )
)

const totalDisplayed = computed(() =>
  sumNumbers(props.points.map((p) => (p.error_count_sla ?? 0) + (p.upstream_error_count_excl_429_529 ?? 0) + (p.business_limited_count ?? 0)))
)

const hasRequestErrors = computed(() => totalRequestErrors.value > 0)
const hasUpstreamErrors = computed(() => totalUpstreamErrors.value > 0)

const chartData = computed(() => {
  if (!props.points.length || totalDisplayed.value <= 0) return null
  return {
    labels: props.points.map((p) => formatHistoryLabel(p.bucket_start, props.timeRange)),
    datasets: [
      {
        label: t('admin.ops.errorsSla'),
        data: props.points.map((p) => p.error_count_sla ?? 0),
        borderColor: colors.value.red,
        backgroundColor: chartAreaFill(colors.value.red),
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10
      },
      {
        label: t('admin.ops.upstreamExcl429529'),
        data: props.points.map((p) => p.upstream_error_count_excl_429_529 ?? 0),
        borderColor: colors.value.purple,
        backgroundColor: chartAreaFill(colors.value.purple),
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10
      },
      {
        label: t('admin.ops.businessLimited'),
        data: props.points.map((p) => p.business_limited_count ?? 0),
        borderColor: colors.value.gray,
        backgroundColor: 'transparent',
        borderDash: [6, 6],
        fill: false,
        tension: 0.35,
        borderWidth: 1.5,
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
      tooltip: chartTooltipStyle(scheme.value)
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
        ticks: { color: c.text, font: chartAxisFont(), precision: 0 }
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
        <svg class="h-4 w-4" :style="{ color: 'var(--sys-red)' }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
          />
        </svg>
        {{ t('admin.ops.errorTrend') }}
        <HelpTooltip :content="t('admin.ops.tooltips.errorTrend')" />
      </h3>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="!hasRequestErrors"
          @click="emit('openRequestErrors')"
        >
          {{ t('admin.ops.errorDetails.requestErrors') }}
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="!hasUpstreamErrors"
          @click="emit('openUpstreamErrors')"
        >
          {{ t('admin.ops.errorDetails.upstreamErrors') }}
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1">
      <!-- vue-chartjs 渲染的是裸 <canvas>（已带 role="img"），不给 aria-label 就是一个无名图形 -->
      <Line
        v-if="state === 'ready' && chartData"
        :data="chartData"
        :options="options"
        :aria-label="t('admin.ops.errorTrend')"
      />
      <div v-else class="flex h-full items-center justify-center">
        <div v-if="state === 'loading'" class="animate-pulse text-sm text-gray-400">{{ t('common.loading') }}</div>
        <EmptyState v-else :title="t('common.noData')" :description="t('admin.ops.charts.emptyError')" />
      </div>
    </div>
  </div>
</template>
