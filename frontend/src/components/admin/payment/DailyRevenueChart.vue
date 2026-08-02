<template>
  <div class="card p-4">
    <h3 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
      {{ t('payment.admin.dailyRevenue') }}
    </h3>
    <div class="h-64">
      <div v-if="loading" class="flex h-full items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
      <Line v-else-if="chartData" :data="chartData" :options="chartOptions" />
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const { t } = useI18n()

const props = defineProps<{
  data: DailyPaymentStats[]
  loading?: boolean
}>()

/**
 * 货币色板 —— Apple 系统色。
 *
 * 多色语义刻意保留：每种货币必须能相互区分。
 * Chart.js 画在 canvas 上拿不到 CSS 变量，所以这里是 style.css 里
 * `--sys-*` 的字面镜像，light / dark 各一档（系统色在深色下会提亮）。
 */
const CURRENCY_HUES = [
  { light: '#007aff', dark: '#0a84ff', fillLight: 'rgba(0, 122, 255, 0.1)', fillDark: 'rgba(10, 132, 255, 0.16)' }, // --sys-blue
  { light: '#af52de', dark: '#bf5af2', fillLight: 'rgba(175, 82, 222, 0.1)', fillDark: 'rgba(191, 90, 242, 0.16)' }, // --sys-purple
  { light: '#ff9500', dark: '#ff9f0a', fillLight: 'rgba(255, 149, 0, 0.1)', fillDark: 'rgba(255, 159, 10, 0.16)' }, // --sys-orange
  { light: '#ff3b30', dark: '#ff453a', fillLight: 'rgba(255, 59, 48, 0.1)', fillDark: 'rgba(255, 69, 58, 0.16)' } // --sys-red
] as const

// 订单数走绿色，与金额系列区分
const COUNT_HUE = { light: '#34c759', dark: '#30d158' } as const

const isDark = ref(document.documentElement.classList.contains('dark'))
let themeObserver: MutationObserver | null = null

onMounted(() => {
  if (typeof MutationObserver === 'undefined') return
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  themeObserver = null
})

const chartData = computed(() => {
  if (!props.data || props.data.length === 0) return null
  const currencies = [...new Set(props.data.flatMap(day => Object.keys(day.amount)))].sort()
  return {
    labels: props.data.map(d => d.date),
    datasets: [
      ...currencies.map((currency, index) => {
        const hue = CURRENCY_HUES[index % CURRENCY_HUES.length]
        return {
          label: `${currency} ${t('payment.admin.revenue')}`,
          data: props.data.map(day => day.amount[currency] || 0),
          borderColor: isDark.value ? hue.dark : hue.light,
          backgroundColor: isDark.value ? hue.fillDark : hue.fillLight,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        }
      }),
      {
        label: t('payment.admin.orderCount'),
        data: props.data.map(d => d.count),
        borderColor: isDark.value ? COUNT_HUE.dark : COUNT_HUE.light,
        backgroundColor: isDark.value ? 'rgba(48, 209, 88, 0.16)' : 'rgba(52, 199, 89, 0.1)',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        yAxisID: 'y1',
      }
    ]
  }
})

// 轴/网格/图例也要跟随主题：Chart.js 默认灰在深色下几乎不可见
const chartOptions = computed(() => {
  const label = isDark.value ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)'
  const grid = isDark.value ? 'rgba(84, 84, 88, 0.5)' : 'rgba(60, 60, 67, 0.12)'
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: {
        ticks: { color: label },
        grid: { color: grid }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { display: true, text: t('payment.admin.revenue'), color: label },
        ticks: { color: label },
        grid: { color: grid }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: { display: true, text: t('payment.admin.orderCount'), color: label },
        ticks: { color: label },
        grid: { drawOnChartArea: false },
      }
    },
    plugins: {
      legend: { position: 'top' as const, labels: { color: label, usePointStyle: true } },
      tooltip: {
        backgroundColor: isDark.value ? '#2c2c2e' : '#ffffff',
        titleColor: isDark.value ? 'rgba(255, 255, 255, 0.94)' : 'rgba(0, 0, 0, 0.88)',
        bodyColor: label,
        borderColor: grid,
        borderWidth: 1,
        cornerRadius: 12,
        padding: 10,
        usePointStyle: true
      }
    }
  }
})
</script>
