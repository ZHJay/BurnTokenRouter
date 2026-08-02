<template>
  <div class="card p-4">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 :id="titleId" class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ title || t('usage.endpointDistribution') }}
      </h3>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <div
          v-if="showSourceToggle"
          class="tabs"
          role="radiogroup"
          :aria-labelledby="titleId"
        >
          <button
            type="button"
            role="radio"
            :aria-checked="source === 'inbound'"
            class="tab px-2.5 py-1 text-xs active:scale-[0.96]"
            :class="source === 'inbound' && 'tab-active'"
            @click="emit('update:source', 'inbound')"
            @keydown="handleRadioGroupKeydown"
          >
            {{ t('usage.inbound') }}
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="source === 'upstream'"
            class="tab px-2.5 py-1 text-xs active:scale-[0.96]"
            :class="source === 'upstream' && 'tab-active'"
            @click="emit('update:source', 'upstream')"
            @keydown="handleRadioGroupKeydown"
          >
            {{ t('usage.upstream') }}
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="source === 'path'"
            class="tab px-2.5 py-1 text-xs active:scale-[0.96]"
            :class="source === 'path' && 'tab-active'"
            @click="emit('update:source', 'path')"
            @keydown="handleRadioGroupKeydown"
          >
            {{ t('usage.path') }}
          </button>
        </div>

        <div
          v-if="showMetricToggle"
          class="tabs"
          role="radiogroup"
          :aria-labelledby="titleId"
        >
          <button
            type="button"
            role="radio"
            :aria-checked="metric === 'tokens'"
            class="tab px-2.5 py-1 text-xs active:scale-[0.96]"
            :class="metric === 'tokens' && 'tab-active'"
            @click="emit('update:metric', 'tokens')"
            @keydown="handleRadioGroupKeydown"
          >
            {{ t('admin.dashboard.metricTokens') }}
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="metric === 'actual_cost'"
            class="tab px-2.5 py-1 text-xs active:scale-[0.96]"
            :class="metric === 'actual_cost' && 'tab-active'"
            @click="emit('update:metric', 'actual_cost')"
            @keydown="handleRadioGroupKeydown"
          >
            {{ t('admin.dashboard.metricActualCost') }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="loading" class="flex h-48 items-center justify-center">
      <LoadingSpinner />
    </div>
    <div v-else-if="displayEndpointStats.length > 0 && chartData" class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div class="h-48 w-48 shrink-0">
        <Doughnut :data="chartData" :options="doughnutOptions" />
      </div>
      <div class="max-h-48 w-full min-w-0 flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 dark:text-gray-400">
              <th class="pb-2 text-left">{{ t('usage.endpoint') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.requests') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.tokens') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.actual') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.standard') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in displayEndpointStats" :key="item.endpoint">
              <tr
                class="chart-row"
                :class="enableBreakdown ? 'chart-row-clickable' : ''"
                @click="enableBreakdown && toggleBreakdown(item.endpoint)"
              >
                <td class="max-w-[180px] truncate py-1.5 font-medium" :class="enableBreakdown ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300' : 'text-gray-900 dark:text-white'" :title="item.endpoint">
                  <span class="inline-flex items-center gap-1">
                    <svg v-if="enableBreakdown && expandedKey === item.endpoint" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    <svg v-else-if="enableBreakdown" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    {{ item.endpoint }}
                  </span>
                </td>
                <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">
                  {{ formatNumber(item.requests) }}
                </td>
                <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">
                  {{ formatTokens(item.total_tokens) }}
                </td>
                <td class="py-1.5 text-right tabular text-green-600 dark:text-green-400">
                  ${{ formatCost(item.actual_cost) }}
                </td>
                <td class="py-1.5 text-right tabular text-gray-400 dark:text-gray-500">
                  ${{ formatCost(item.cost) }}
                </td>
              </tr>
              <tr v-if="expandedKey === item.endpoint">
                <td colspan="5" class="p-0">
                  <UserBreakdownSubTable
                    :items="breakdownItems"
                    :loading="breakdownLoading"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import UserBreakdownSubTable from './UserBreakdownSubTable.vue'
import type { EndpointStat, UserBreakdownItem } from '@/types'
import { getUserBreakdown } from '@/api/admin/dashboard'
import { chartTooltipStyle, distributionColor, useChartScheme } from './chartPalette'
import { handleRadioGroupKeydown } from '@/utils/radioGroupKeyboard'

ChartJS.register(ArcElement, Tooltip, Legend)

const { t } = useI18n()

// 数据源 / 指标分段控件都是「选值」而非切面板，用 radiogroup 语义并从可见标题取无障碍名称。
const titleId = useId()

type DistributionMetric = 'tokens' | 'actual_cost'
type EndpointSource = 'inbound' | 'upstream' | 'path'

const props = withDefaults(
  defineProps<{
    endpointStats: EndpointStat[]
    upstreamEndpointStats?: EndpointStat[]
    endpointPathStats?: EndpointStat[]
    loading?: boolean
    title?: string
    metric?: DistributionMetric
    source?: EndpointSource
    showMetricToggle?: boolean
    showSourceToggle?: boolean
    enableBreakdown?: boolean
    startDate?: string
    endDate?: string
    filters?: Record<string, any>
  }>(),
  {
    upstreamEndpointStats: () => [],
    endpointPathStats: () => [],
    loading: false,
    title: '',
    metric: 'tokens',
    source: 'inbound',
    showMetricToggle: false,
    showSourceToggle: false,
    enableBreakdown: true
  }
)

const emit = defineEmits<{
  'update:metric': [value: DistributionMetric]
  'update:source': [value: EndpointSource]
}>()

const expandedKey = ref<string | null>(null)
const breakdownItems = ref<UserBreakdownItem[]>([])
const breakdownLoading = ref(false)

const toggleBreakdown = async (endpoint: string) => {
  if (expandedKey.value === endpoint) {
    expandedKey.value = null
    return
  }
  expandedKey.value = endpoint
  breakdownLoading.value = true
  breakdownItems.value = []
  try {
    const res = await getUserBreakdown({
      ...props.filters,
      start_date: props.startDate,
      end_date: props.endDate,
      endpoint,
      endpoint_type: props.source,
    })
    breakdownItems.value = res.users || []
  } catch {
    breakdownItems.value = []
  } finally {
    breakdownLoading.value = false
  }
}

/**
 * canvas 读不到 CSS 变量，配色只能由 JS 侧驱动 —— `useChartScheme()` 用
 * MutationObserver 盯 `<html class="dark">`，主题切换时让下面的 computed 重新求值。
 */
const scheme = useChartScheme()

/** 扇区色板：Apple 系统色，按类目序号取色，light / dark 各一档。 */
const sliceColors = (count: number) =>
  Array.from({ length: count }, (_, i) => distributionColor(i, scheme.value))

const displayEndpointStats = computed(() => {
  const sourceStats = props.source === 'upstream'
    ? props.upstreamEndpointStats
    : props.source === 'path'
      ? props.endpointPathStats
      : props.endpointStats
  if (!sourceStats?.length) return []

  const metricKey = props.metric === 'actual_cost' ? 'actual_cost' : 'total_tokens'
  return [...sourceStats].sort((a, b) => b[metricKey] - a[metricKey])
})

const chartData = computed(() => {
  if (!displayEndpointStats.value?.length) return null

  return {
    labels: displayEndpointStats.value.map((item) => item.endpoint),
    datasets: [
      {
        data: displayEndpointStats.value.map((item) =>
          props.metric === 'actual_cost' ? item.actual_cost : item.total_tokens
        ),
        backgroundColor: sliceColors(displayEndpointStats.value.length),
        // 扇区之间留白代替描边：不透明卡片上描边会显脏
        borderWidth: 0,
        spacing: 2,
        hoverOffset: 4
      }
    ]
  }
})

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      ...chartTooltipStyle(scheme.value),
      callbacks: {
        label: (context: any) => {
          const value = context.raw as number
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          const formattedValue = props.metric === 'actual_cost'
            ? `$${formatCost(value)}`
            : formatTokens(value)
          return `${context.label}: ${formattedValue} (${percentage}%)`
        }
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

const formatNumber = (value: number): string => {
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

<style scoped>
/* 行间用发丝线分隔，而不是 1px 实线框 */
.chart-row {
  box-shadow: inset 0 0.5px 0 var(--separator);
  transition:
    background-color 240ms var(--ease-out),
    transform 100ms var(--ease-out);
}

/* hover / active 用设计令牌，不用手搓的半透明工具类 —— 与 .table tbody tr 同一套值 */
.chart-row-clickable {
  cursor: pointer;
}

.chart-row-clickable:hover {
  background-color: var(--surface-hover);
}

.chart-row-clickable:active {
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .chart-row {
    transition: none;
  }

  .chart-row-clickable:active {
    transform: none;
  }
}
</style>
