<template>
  <div class="space-y-4">
    <!-- Date Range Filter -->
    <div class="card p-3.5">
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium tracking-[0.01em] text-gray-500 dark:text-gray-400">{{ t('dashboard.timeRange') }}:</span>
          <DateRangePicker :start-date="startDate" :end-date="endDate" @update:startDate="$emit('update:startDate', $event)" @update:endDate="$emit('update:endDate', $event)" @change="$emit('dateRangeChange', $event)" />
        </div>
        <button @click="$emit('refresh')" :disabled="loading" class="btn btn-secondary btn-sm">
          {{ t('common.refresh') }}
        </button>
        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs font-medium tracking-[0.01em] text-gray-500 dark:text-gray-400">{{ t('dashboard.granularity') }}:</span>
          <!-- Apple 分段控件：两个互斥选项用 segmented 比下拉更快也更好读 -->
          <div class="tabs" role="tablist">
            <button
              v-for="opt in granularityOptions"
              :key="opt.value"
              type="button"
              role="tab"
              :aria-selected="granularity === opt.value"
              :class="['tab active:scale-[0.96]', granularity === opt.value && 'tab-active']"
              @click="selectGranularity(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- Model Distribution Chart -->
      <div class="card relative min-w-0 overflow-hidden p-4">
        <div v-if="loading" class="glass-thin absolute inset-0 z-10 flex items-center justify-center">
          <LoadingSpinner size="md" />
        </div>
        <h3 class="mb-4 text-[15px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">{{ t('dashboard.modelDistribution') }}</h3>
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <!-- 中心留白放总量：环形图的空心本来就该承载合计值 -->
          <div class="relative h-48 w-48 shrink-0">
            <Doughnut v-if="modelData" :data="modelData" :options="doughnutOptions" />
            <div v-else class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.noDataAvailable') }}</div>
            <div v-if="modelData" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-[19px] font-semibold tabular leading-tight tracking-[-0.02em] text-gray-900 dark:text-white">{{ formatTokens(totalModelTokens) }}</span>
              <span class="text-[11px] font-medium tracking-[0.01em] text-gray-400 dark:text-gray-500">{{ t('dashboard.tokens') }}</span>
            </div>
          </div>
          <div class="max-h-48 w-full min-w-0 flex-1 overflow-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-gray-500 dark:text-gray-400">
                  <th class="pb-2 text-left">{{ t('dashboard.model') }}</th>
                  <th class="pb-2 text-right">{{ t('dashboard.requests') }}</th>
                  <th class="pb-2 text-right">{{ t('dashboard.tokens') }}</th>
                  <th class="pb-2 text-right">{{ t('dashboard.actual') }}</th>
                  <th class="pb-2 text-right">{{ t('dashboard.standard') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(model, i) in models" :key="model.model" class="model-row">
                  <td class="max-w-[110px] py-1.5 font-medium text-gray-900 dark:text-white" :title="model.model">
                    <!-- 图例色点：把表格行和环形图的扇区对应起来 -->
                    <span class="flex min-w-0 items-center gap-1.5">
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ backgroundColor: seriesColor(i) }" />
                      <span class="truncate">{{ model.model }}</span>
                    </span>
                  </td>
                  <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">{{ formatNumber(model.requests) }}</td>
                  <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">{{ formatTokens(model.total_tokens) }}</td>
                  <td class="py-1.5 text-right tabular text-green-600 dark:text-green-400">${{ formatCost(model.actual_cost) }}</td>
                  <td class="py-1.5 text-right tabular text-gray-400 dark:text-gray-500">${{ formatCost(model.cost) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Token Usage Trend Chart -->
      <TokenUsageTrend :trend-data="trend" :loading="loading" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import { Doughnut } from 'vue-chartjs'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import type { TrendDataPoint, ModelStat } from '@/types'
import { formatCostFixed as formatCost, formatNumberLocaleString as formatNumber, formatTokensK as formatTokens } from '@/utils/format'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

const props = defineProps<{ loading: boolean, startDate: string, endDate: string, granularity: string, trend: TrendDataPoint[], models: ModelStat[] }>()
const emit = defineEmits(['update:startDate', 'update:endDate', 'update:granularity', 'dateRangeChange', 'granularityChange', 'refresh'])
const { t } = useI18n()

const granularityOptions = computed(() => [
  { value: 'day', label: t('dashboard.day') },
  { value: 'hour', label: t('dashboard.hour') }
])

// 与原 Select 完全一致的发射顺序：先 update，再 change
const selectGranularity = (value: string) => {
  emit('update:granularity', value)
  emit('granularityChange')
}

/**
 * 环形图色板 —— Apple 系统色。
 *
 * 多色语义刻意保留：每个模型必须能相互区分，图表可读性优先于色彩克制。
 * Chart.js 画在 canvas 上拿不到 CSS 变量，所以这里是 style.css 里
 * `--sys-*` 的字面镜像，light / dark 各一档（系统色在深色下会提亮）。
 */
const MODEL_HUES = [
  { light: '#007aff', dark: '#0a84ff' }, // --sys-blue
  { light: '#af52de', dark: '#bf5af2' }, // --sys-purple
  { light: '#30b0c7', dark: '#40c8e0' }, // --sys-teal
  { light: '#ff9500', dark: '#ff9f0a' }, // --sys-orange
  { light: '#34c759', dark: '#30d158' }, // --sys-green
  { light: '#5856d6', dark: '#5e5ce6' }, // --sys-indigo
  { light: '#ff2d55', dark: '#ff375f' }, // --sys-pink
  { light: '#00c7be', dark: '#63e6e2' }  // --sys-mint
] as const

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

const seriesColor = (index: number) => {
  const hue = MODEL_HUES[index % MODEL_HUES.length]
  return isDark.value ? hue.dark : hue.light
}

const totalModelTokens = computed(() =>
  (props.models ?? []).reduce((sum: number, m: ModelStat) => sum + (m.total_tokens || 0), 0)
)

const modelData = computed(() => !props.models?.length ? null : {
  labels: props.models.map((m: ModelStat) => m.model),
  datasets: [{
    data: props.models.map((m: ModelStat) => m.total_tokens),
    backgroundColor: props.models.map((_: ModelStat, i: number) => seriesColor(i)),
    // 扇区之间留白代替描边：不透明卡片上描边会显脏
    borderWidth: 0,
    spacing: 2,
    hoverOffset: 4
  }]
})

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // 中心留白放合计值
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: isDark.value ? '#2c2c2e' : '#ffffff',
      titleColor: isDark.value ? 'rgba(255, 255, 255, 0.94)' : 'rgba(0, 0, 0, 0.88)',
      bodyColor: isDark.value ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
      borderColor: isDark.value ? 'rgba(84, 84, 88, 0.5)' : 'rgba(60, 60, 67, 0.12)',
      borderWidth: 1,
      cornerRadius: 12,
      padding: 10,
      usePointStyle: true,
      callbacks: {
        label: (context: any) => `${context.label}: ${formatTokens(context.parsed)} tokens`
      }
    }
  }
}))
</script>

<style scoped>
/* 行间用发丝线分隔，而不是 1px 实线框 */
.model-row {
  box-shadow: inset 0 0.5px 0 var(--separator);
}
</style>
