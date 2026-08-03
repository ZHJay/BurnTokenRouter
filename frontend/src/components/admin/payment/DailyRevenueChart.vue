<template>
  <div class="card p-4">
    <h3 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
      {{ t('payment.admin.dailyRevenue') }}
    </h3>
    <div class="h-64">
      <div v-if="loading" class="flex h-full items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
      <!-- vue-chartjs 渲染的是裸 <canvas>（已带 role="img"），不给 aria-label 就是一个无名图形 -->
      <Line
        v-else-if="chartData"
        :data="chartData"
        :options="chartOptions"
        :aria-label="t('payment.admin.dailyRevenue')"
      />
      <div
        v-else
        class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('payment.admin.noData') }}
      </div>
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
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { DailyPaymentStats } from '@/types/payment'
import {
  chartAxisChrome,
  chartAxisFont,
  chartAxisNoGrid,
  chartChrome,
  chartHue,
  chartLegendStyle,
  chartTooltipStyle,
  useChartScheme,
  withAlpha,
  type ChartHue
} from '@/lib/chart'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const { t } = useI18n()

const props = defineProps<{
  data: DailyPaymentStats[]
  loading?: boolean
}>()

/**
 * 货币色板 —— 取自 `lib/chart` 的共享色相。
 *
 * 多色语义刻意保留：每种货币必须能相互区分。
 * 这里原先自带一份 hex + 四个手写 rgba 填充值（同一批 token 的又一份副本）；
 * 现在只保留「用哪几个色相」这一决定，色值与填充都由共享模块派生。
 */
const CURRENCY_HUES: readonly ChartHue[] = ['blue', 'purple', 'orange', 'red']

/** 订单数走绿色，与金额系列区分 */
const COUNT_HUE: ChartHue = 'green'

/** 面积填充的浓度：深色下要重一点才看得出体量 */
const fillOpacity = (scheme: 'light' | 'dark') => (scheme === 'dark' ? 0.16 : 0.1)

const scheme = useChartScheme()

const chartData = computed(() => {
  if (!props.data || props.data.length === 0) return null
  const currencies = [...new Set(props.data.flatMap(day => Object.keys(day.amount)))].sort()
  const alpha = fillOpacity(scheme.value)
  return {
    labels: props.data.map(d => d.date),
    datasets: [
      ...currencies.map((currency, index) => {
        const color = chartHue(CURRENCY_HUES[index % CURRENCY_HUES.length], scheme.value)
        return {
          label: `${currency} ${t('payment.admin.revenue')}`,
          data: props.data.map(day => day.amount[currency] || 0),
          borderColor: color,
          backgroundColor: withAlpha(color, alpha),
          fill: true,
          tension: 0.3,
          // 与所有同类折线一致：常态无点，hover 才冒出来，命中半径放大到 10
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 10,
        }
      }),
      {
        label: t('payment.admin.orderCount'),
        data: props.data.map(d => d.count),
        borderColor: chartHue(COUNT_HUE, scheme.value),
        backgroundColor: withAlpha(chartHue(COUNT_HUE, scheme.value), alpha),
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 10,
        yAxisID: 'y1',
      }
    ]
  }
})

// 轴/网格/图例也要跟随主题：Chart.js 默认灰在深色下几乎不可见
const chartOptions = computed(() => {
  const chrome = chartChrome(scheme.value)
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: {
        ...chartAxisChrome(scheme.value),
        ticks: { color: chrome.axis, font: chartAxisFont() }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ...chartAxisChrome(scheme.value, true),
        title: { display: true, text: t('payment.admin.revenue'), color: chrome.legend },
        ticks: { color: chrome.axis, font: chartAxisFont() }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        ...chartAxisNoGrid('chartArea'),
        title: { display: true, text: t('payment.admin.orderCount'), color: chrome.legend },
        ticks: { color: chrome.axis, font: chartAxisFont() },
      }
    },
    plugins: {
      legend: { position: 'top' as const, labels: chartLegendStyle(scheme.value) },
      tooltip: chartTooltipStyle(scheme.value)
    }
  }
})
</script>
