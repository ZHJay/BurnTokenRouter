<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Title, Tooltip } from 'chart.js'
import { Line } from 'vue-chartjs'
import type { ChartComponentRef } from 'vue-chartjs'
import type { OpsThroughputGroupBreakdownItem, OpsThroughputPlatformBreakdownItem, OpsThroughputTrendPoint } from '@/api/admin/ops'
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
import { formatNumber } from '@/utils/format'

ChartJS.register(Title, Tooltip, Legend, LineElement, LinearScale, PointElement, CategoryScale, Filler)

interface Props {
  points: OpsThroughputTrendPoint[]
  loading: boolean
  timeRange: string
  byPlatform?: OpsThroughputPlatformBreakdownItem[]
  topGroups?: OpsThroughputGroupBreakdownItem[]
  fullscreen?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'selectPlatform', platform: string): void
  (e: 'selectGroup', groupId: number): void
  (e: 'openDetails'): void
}>()

const throughputChartRef = ref<ChartComponentRef | null>(null)
watch(
  () => props.timeRange,
  () => {
    setTimeout(() => {
      const chart: any = throughputChartRef.value?.chart
      if (chart && typeof chart.resetZoom === 'function') {
        chart.resetZoom()
      }
    }, 100)
  }
)

/**
 * canvas 读不到 CSS 变量，配色只能由 JS 侧驱动 —— `useChartScheme()` 用
 * MutationObserver 盯 `<html class="dark">`，主题切换时让下面的 computed 重新求值。
 * （此前 `isDarkMode` 直接在 computed 里读 DOM：`classList.contains()` 不是响应式源，
 * computed 永不失效，切主题后图表会停在旧配色直到整页刷新。）
 */
const scheme = useChartScheme()
// QPS 走系统蓝，TPS 走系统紫：两条序列必须一眼分得开
const colors = computed(() => {
  const chrome = chartChrome(scheme.value)
  return {
    blue: chartHue('blue', scheme.value),
    purple: chartHue('purple', scheme.value),
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
        label: 'QPS',
        data: props.points.map((p) => p.qps ?? 0),
        borderColor: colors.value.blue,
        backgroundColor: chartAreaFill(colors.value.blue),
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10
      },
      {
        label: t('admin.ops.tpsK'),
        data: props.points.map((p) => (p.tps ?? 0) / 1000),
        borderColor: colors.value.purple,
        backgroundColor: chartAreaFill(colors.value.purple),
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        yAxisID: 'y1'
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
            let label = context.dataset.label || ''
            if (label) label += ': '
            if (context.raw !== null) label += context.parsed.y.toFixed(1)
            return label
          }
        }
      },
      // Optional: if chartjs-plugin-zoom is installed, these options will enable zoom/pan.
      zoom: {
        pan: { enabled: true, mode: 'x' as const, modifierKey: 'ctrl' as const },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' as const }
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
        ticks: { color: c.text, font: chartAxisFont() }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        ...chartAxisNoGrid(),
        // 右轴刻度沿用该序列色，读者才知道这条轴属于哪条线
        ticks: { color: c.purple, font: chartAxisFont() }
      }
    }
  }
})

function resetZoom() {
  const chart: any = throughputChartRef.value?.chart
  if (chart && typeof chart.resetZoom === 'function') chart.resetZoom()
}

function downloadChart() {
  const chart: any = throughputChartRef.value?.chart
  if (!chart || typeof chart.toBase64Image !== 'function') return
  const url = chart.toBase64Image('image/png', 1)
  const a = document.createElement('a')
  a.href = url
  a.download = `ops-throughput-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
  a.click()
}
</script>

<template>
  <!-- 图表卡片保持不透明：数据密集的折线放在毛玻璃上会糊 -->
  <div class="card flex h-full min-w-0 flex-col p-6">
    <div
      data-testid="throughput-chart-header"
      class="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <h3 class="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">
        <svg class="h-4 w-4" :style="{ color: 'var(--sys-blue)' }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        {{ t('admin.ops.throughputTrend') }}
        <HelpTooltip v-if="!props.fullscreen" :content="t('admin.ops.tooltips.throughputTrend')" />
      </h3>
      <div
        data-testid="throughput-chart-toolbar"
        class="flex w-full min-w-0 flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 sm:w-auto sm:justify-end"
      >
        <span class="flex shrink-0 items-center gap-1">
          <span class="h-2 w-2 rounded-full" :style="{ background: 'var(--sys-blue)' }"></span>QPS
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <span class="h-2 w-2 rounded-full" :style="{ background: 'var(--sys-purple)' }"></span>{{ t('admin.ops.tpsK') }}
        </span>
        <template v-if="!props.fullscreen">
          <button
            type="button"
            class="btn btn-secondary btn-sm shrink-0"
            :disabled="state !== 'ready'"
            :title="t('admin.ops.requestDetails.title')"
            @click="emit('openDetails')"
          >
            {{ t('admin.ops.requestDetails.details') }}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm shrink-0"
            :disabled="state !== 'ready'"
            :title="t('admin.ops.charts.resetZoomHint')"
            @click="resetZoom"
          >
            {{ t('admin.ops.charts.resetZoom') }}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm shrink-0"
            :disabled="state !== 'ready'"
            :title="t('admin.ops.charts.downloadChartHint')"
            @click="downloadChart"
          >
            {{ t('admin.ops.charts.downloadChart') }}
          </button>
        </template>
      </div>
    </div>

    <!-- Drilldown chips (baseline interaction: click to set global filter) -->
    <div v-if="(props.topGroups?.length ?? 0) > 0" class="mb-3 flex flex-wrap gap-2">
      <button
        v-for="g in props.topGroups"
        :key="g.group_id"
        type="button"
        class="btn btn-secondary btn-sm"
        @click="emit('selectGroup', g.group_id)"
      >
        <span class="max-w-[180px] truncate">{{ g.group_name || `#${g.group_id}` }}</span>
        <span class="tabular text-gray-400 dark:text-gray-500">{{ formatNumber(g.request_count) }}</span>
      </button>
    </div>

    <div v-else-if="(props.byPlatform?.length ?? 0) > 0" class="mb-3 flex flex-wrap gap-2">
      <button
        v-for="p in props.byPlatform"
        :key="p.platform"
        type="button"
        class="btn btn-secondary btn-sm"
        @click="emit('selectPlatform', p.platform)"
      >
        <span class="uppercase">{{ p.platform }}</span>
        <span class="tabular text-gray-400 dark:text-gray-500">{{ formatNumber(p.request_count) }}</span>
      </button>
    </div>

    <div class="min-h-0 min-w-0 flex-1">
      <!-- vue-chartjs 渲染的是裸 <canvas>（已带 role="img"），不给 aria-label 就是一个无名图形 -->
      <Line
        v-if="state === 'ready' && chartData"
        ref="throughputChartRef"
        :data="chartData"
        :options="options"
        :aria-label="t('admin.ops.throughputTrend')"
      />
      <div v-else class="flex h-full items-center justify-center">
        <div v-if="state === 'loading'" class="animate-pulse text-sm text-gray-400">{{ t('common.loading') }}</div>
        <EmptyState v-else :title="t('common.noData')" :description="t('admin.ops.charts.emptyRequest')" />
      </div>
    </div>
  </div>
</template>
