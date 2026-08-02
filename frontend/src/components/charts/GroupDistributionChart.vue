<template>
  <div class="card p-4">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('admin.dashboard.groupDistribution') }}
      </h3>
      <div
        v-if="showMetricToggle"
        class="tabs"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="metric === 'tokens'"
          class="tab px-2.5 py-1 text-xs active:scale-[0.96]"
          :class="metric === 'tokens' && 'tab-active'"
          @click="emit('update:metric', 'tokens')"
        >
          {{ t('admin.dashboard.metricTokens') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="metric === 'actual_cost'"
          class="tab px-2.5 py-1 text-xs active:scale-[0.96]"
          :class="metric === 'actual_cost' && 'tab-active'"
          @click="emit('update:metric', 'actual_cost')"
        >
          {{ t('admin.dashboard.metricActualCost') }}
        </button>
      </div>
    </div>
    <div v-if="loading" class="flex h-48 items-center justify-center">
      <LoadingSpinner />
    </div>
    <div v-else-if="displayGroupStats.length > 0 && chartData" class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div class="h-48 w-48 shrink-0">
        <Doughnut :data="chartData" :options="doughnutOptions" />
      </div>
      <div class="max-h-48 w-full min-w-0 flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 dark:text-gray-400">
              <th class="pb-2 text-left">{{ t('admin.dashboard.group') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.requests') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.tokens') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.actual') }}</th>
              <th v-if="showAccountCost" class="pb-2 text-right">{{ t('admin.dashboard.accountCost') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.standard') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in displayGroupStats" :key="group.group_id">
              <tr
                class="chart-row"
                :class="enableBreakdown && group.group_id > 0 ? 'chart-row-clickable' : ''"
                @click="enableBreakdown && group.group_id > 0 && toggleBreakdown('group', group.group_id)"
              >
                <td
                  class="max-w-[100px] truncate py-1.5 font-medium"
                  :class="enableBreakdown && group.group_id > 0 ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300' : 'text-gray-900 dark:text-white'"
                  :title="group.group_name || String(group.group_id)"
                >
                  <span class="inline-flex items-center gap-1">
                    <svg v-if="enableBreakdown && group.group_id > 0 && expandedKey === `group-${group.group_id}`" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    <svg v-else-if="enableBreakdown && group.group_id > 0" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    {{ group.group_name || t('admin.dashboard.noGroup') }}
                  </span>
                </td>
                <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">
                  {{ formatNumber(group.requests) }}
                </td>
                <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">
                  {{ formatTokens(group.total_tokens) }}
                </td>
                <td class="py-1.5 text-right tabular text-green-600 dark:text-green-400">
                  ${{ formatCost(group.actual_cost) }}
                </td>
                <td v-if="showAccountCost" class="py-1.5 text-right tabular text-orange-500 dark:text-orange-400">
                  ${{ formatCost(group.account_cost) }}
                </td>
                <td class="py-1.5 text-right tabular text-gray-400 dark:text-gray-500">
                  ${{ formatCost(group.cost) }}
                </td>
              </tr>
              <!-- User breakdown sub-rows -->
              <tr v-if="expandedKey === `group-${group.group_id}`">
                <td :colspan="distributionColspan" class="p-0">
                  <UserBreakdownSubTable
                    :items="breakdownItems"
                    :loading="breakdownLoading"
                    :show-account-cost="showAccountCost"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import UserBreakdownSubTable from './UserBreakdownSubTable.vue'
import type { GroupStat, UserBreakdownItem } from '@/types'
import { getUserBreakdown } from '@/api/admin/dashboard'
import { chartTooltipStyle, distributionColor, useChartScheme } from './chartPalette'

ChartJS.register(ArcElement, Tooltip, Legend)

const { t } = useI18n()

type DistributionMetric = 'tokens' | 'actual_cost'

const props = withDefaults(defineProps<{
  groupStats: GroupStat[]
  loading?: boolean
  metric?: DistributionMetric
  showMetricToggle?: boolean
  enableBreakdown?: boolean
  showAccountCost?: boolean
  startDate?: string
  endDate?: string
  filters?: Record<string, any>
}>(), {
  loading: false,
  metric: 'tokens',
  showMetricToggle: false,
  enableBreakdown: true,
  showAccountCost: true,
})

const emit = defineEmits<{
  'update:metric': [value: DistributionMetric]
}>()

const expandedKey = ref<string | null>(null)
const breakdownItems = ref<UserBreakdownItem[]>([])
const breakdownLoading = ref(false)
const showAccountCost = computed(() => props.showAccountCost)
const distributionColspan = computed(() => showAccountCost.value ? 6 : 5)

const toggleBreakdown = async (type: string, id: number | string) => {
  const key = `${type}-${id}`
  if (expandedKey.value === key) {
    expandedKey.value = null
    return
  }
  expandedKey.value = key
  breakdownLoading.value = true
  breakdownItems.value = []
  try {
    const res = await getUserBreakdown({
      ...props.filters,
      start_date: props.startDate,
      end_date: props.endDate,
      group_id: Number(id),
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

const displayGroupStats = computed(() => {
  if (!props.groupStats?.length) return []

  const metricKey = props.metric === 'actual_cost' ? 'actual_cost' : 'total_tokens'
  return [...props.groupStats].sort((a, b) => toFiniteNumber(b[metricKey]) - toFiniteNumber(a[metricKey]))
})

const chartData = computed(() => {
  if (!props.groupStats?.length) return null

  return {
    labels: displayGroupStats.value.map((g) => g.group_name || String(g.group_id)),
    datasets: [
      {
        data: displayGroupStats.value.map((g) => toFiniteNumber(props.metric === 'actual_cost' ? g.actual_cost : g.total_tokens)),
        backgroundColor: sliceColors(displayGroupStats.value.length),
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
  return toFiniteNumber(value).toLocaleString()
}

const toFiniteNumber = (value: unknown): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const formatCost = (value: number | null | undefined): string => {
  const safeValue = toFiniteNumber(value)
  if (safeValue >= 1000) {
    return (safeValue / 1000).toFixed(2) + 'K'
  } else if (safeValue >= 1) {
    return safeValue.toFixed(2)
  } else if (safeValue >= 0.01) {
    return safeValue.toFixed(3)
  }
  return safeValue.toFixed(4)
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
