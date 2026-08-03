<template>
  <div class="card p-4">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 :id="titleId" class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ !enableRankingView || activeView === 'model_distribution'
          ? t('admin.dashboard.modelDistribution')
          : t('admin.dashboard.spendingRankingTitle') }}
      </h3>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <span v-if="showSourceToggle" :id="sourceLabelId" class="sr-only">{{ t('usage.chartDataSource') }}</span>
        <Segmented
          v-if="showSourceToggle"
          :model-value="source"
          :options="sourceOptions"
          mode="radiogroup"
          :aria-labelledby="sourceGroupLabelledBy"
          item-class="px-2.5 py-1 text-xs"
          @update:model-value="emit('update:source', $event)"
        />
        <span v-if="showMetricToggle" :id="metricLabelId" class="sr-only">{{ t('usage.chartMetric') }}</span>
        <Segmented
          v-if="showMetricToggle"
          :model-value="metric"
          :options="metricOptions"
          mode="radiogroup"
          :aria-labelledby="metricGroupLabelledBy"
          item-class="px-2.5 py-1 text-xs"
          @update:model-value="emit('update:metric', $event)"
        />
        <!-- 这一组是真正的面板切换（分布表 ↔ 消费榜），保留 tablist/tab 语义并补齐
             无障碍名称与 tab ↔ tabpanel 的双向关联。 -->
        <template v-if="enableRankingView">
          <span :id="viewLabelId" class="sr-only">{{ t('admin.dashboard.viewSelector') }}</span>
          <Segmented
            v-model="activeView"
            :options="viewOptions"
            mode="tablist"
            :aria-labelledby="viewLabelId"
            item-class="px-2.5 py-1 text-xs"
          />
        </template>
      </div>
    </div>

    <div v-if="activeView === 'model_distribution' && loading" v-bind="distributionPanelAttrs" class="flex h-48 items-center justify-center">
      <LoadingSpinner />
    </div>
    <div
      v-else-if="activeView === 'model_distribution' && displayModelStats.length > 0 && chartData"
      v-bind="distributionPanelAttrs"
      class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6"
    >
      <div class="h-48 w-48 shrink-0">
        <!-- vue-chartjs 渲染的是裸 <canvas>（已带 role="img"），不给 aria-label 就是一个无名图形。
             右侧表格是同一份数据的等价替代，因此这里只需要一个名字。 -->
        <Doughnut
          :data="chartData"
          :options="doughnutOptions"
          :aria-label="t('admin.dashboard.modelDistribution')"
        />
      </div>
      <div class="max-h-48 w-full min-w-0 flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 dark:text-gray-400">
              <th class="pb-2 text-left">{{ t('admin.dashboard.model') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.requests') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.tokens') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.actual') }}</th>
              <th v-if="showAccountCost" class="pb-2 text-right">{{ t('admin.dashboard.accountCost') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.standard') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="model in displayModelStats" :key="model.model">
              <tr
                class="chart-row"
                :class="enableBreakdown ? 'chart-row-clickable' : ''"
                @click="enableBreakdown && toggleBreakdown('model', model.model)"
              >
                <td
                  class="max-w-[100px] truncate py-1.5 font-medium"
                  :class="enableBreakdown ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300' : 'text-gray-900 dark:text-white'"
                  :title="model.model"
                >
                  <span class="inline-flex items-center gap-1">
                    <svg v-if="enableBreakdown && expandedKey === `model-${model.model}`" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    <svg v-else-if="enableBreakdown" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    {{ model.model }}
                  </span>
                </td>
                <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">
                  {{ formatNumber(model.requests) }}
                </td>
                <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">
                  {{ formatTokens(model.total_tokens) }}
                </td>
                <td class="py-1.5 text-right tabular text-green-600 dark:text-green-400">
                  ${{ formatCost(model.actual_cost) }}
                </td>
                <td v-if="showAccountCost" class="py-1.5 text-right tabular text-orange-500 dark:text-orange-400">
                  ${{ formatCost(model.account_cost) }}
                </td>
                <td class="py-1.5 text-right tabular text-gray-400 dark:text-gray-500">
                  ${{ formatCost(model.cost) }}
                </td>
              </tr>
              <tr v-if="expandedKey === `model-${model.model}`">
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
      v-else-if="activeView === 'model_distribution'"
      v-bind="distributionPanelAttrs"
      class="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>

    <div v-else-if="rankingLoading" v-bind="rankingPanelAttrs" class="flex h-48 items-center justify-center">
      <LoadingSpinner />
    </div>
    <div
      v-else-if="rankingError"
      v-bind="rankingPanelAttrs"
      class="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('admin.dashboard.failedToLoad') }}
    </div>
    <div
      v-else-if="rankingDisplayItems.length > 0 && rankingChartData"
      v-bind="rankingPanelAttrs"
      class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6"
    >
      <div class="h-48 w-48 shrink-0">
        <Doughnut
          :data="rankingChartData"
          :options="rankingDoughnutOptions"
          :aria-label="t('admin.dashboard.spendingRankingTitle')"
        />
      </div>
      <div class="max-h-48 w-full min-w-0 flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 dark:text-gray-400">
              <th class="pb-2 text-left">{{ t('admin.dashboard.spendingRankingUser') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.spendingRankingRequests') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.spendingRankingTokens') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.spendingRankingSpend') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in rankingDisplayItems"
              :key="item.isOther ? 'others' : `${item.user_id}-${index}`"
              class="chart-row"
              :class="item.isOther ? 'chart-row-other' : 'chart-row-clickable'"
              @click="item.isOther ? undefined : emit('ranking-click', item)"
            >
              <td class="py-1.5">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="shrink-0 text-[11px] font-semibold tabular text-gray-500 dark:text-gray-400">
                    {{ item.isOther ? 'Σ' : `#${index + 1}` }}
                  </span>
                  <span
                    class="block max-w-[140px] truncate font-medium text-gray-900 dark:text-white"
                    :title="getRankingRowLabel(item)"
                  >
                    {{ getRankingRowLabel(item) }}
                  </span>
                </div>
              </td>
              <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">
                {{ formatNumber(item.requests) }}
              </td>
              <td class="py-1.5 text-right tabular text-gray-600 dark:text-gray-400">
                {{ formatTokens(item.tokens) }}
              </td>
              <td class="py-1.5 text-right tabular text-green-600 dark:text-green-400">
                ${{ formatCost(item.actual_cost) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div
      v-else
      v-bind="rankingPanelAttrs"
      class="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400"
    >
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
import Segmented from '@/components/common/Segmented.vue'
import UserBreakdownSubTable from './UserBreakdownSubTable.vue'
import type { ModelStat, UserSpendingRankingItem, UserBreakdownItem } from '@/types'
import { getUserBreakdown } from '@/api/admin/dashboard'
import {
  chartTooltipStyle,
  distributionColor,
  neutralColor,
  useChartScheme
} from '@/lib/chart'

ChartJS.register(ArcElement, Tooltip, Legend)

const { t } = useI18n()

// 数据源 / 指标分段控件是「选值」而非切面板，用 Segmented 的 radiogroup 模式。
// 两组都只指向 <h3> 会得到同名的无障碍名称，读屏用户无法区分「选数据源」和「选指标」，
// 因此各自再挂一个视觉隐藏标签：名称读作「模型分布 数据来源 / 模型分布 统计指标」。
// activeView 那一组是真正的面板切换，用 tablist 模式，并把 tab ↔ tabpanel 的 id
// 关联通过 option 的 id / panelId 交给组件。
// 这些图表一页可能渲染多次（管理端 UsageView、AccountStatsModal），id 必须用 useId() 生成。
const titleId = useId()
const sourceLabelId = useId()
const metricLabelId = useId()
const sourceGroupLabelledBy = `${titleId} ${sourceLabelId}`
const metricGroupLabelledBy = `${titleId} ${metricLabelId}`
const viewLabelId = useId()
const distributionTabId = useId()
const rankingTabId = useId()
const distributionPanelId = useId()
const rankingPanelId = useId()

type DistributionMetric = 'tokens' | 'actual_cost'
type ModelSource = 'requested' | 'upstream' | 'mapping'
type RankingDisplayItem = UserSpendingRankingItem & { isOther?: boolean }
const props = withDefaults(defineProps<{
  modelStats: ModelStat[]
  upstreamModelStats?: ModelStat[]
  mappingModelStats?: ModelStat[]
  source?: ModelSource
  enableRankingView?: boolean
  rankingItems?: UserSpendingRankingItem[]
  rankingTotalActualCost?: number
  rankingTotalRequests?: number
  rankingTotalTokens?: number
  loading?: boolean
  metric?: DistributionMetric
  showSourceToggle?: boolean
  showMetricToggle?: boolean
  enableBreakdown?: boolean
  showAccountCost?: boolean
  rankingLoading?: boolean
  rankingError?: boolean
  startDate?: string
  endDate?: string
  filters?: Record<string, any>
}>(), {
  upstreamModelStats: () => [],
  mappingModelStats: () => [],
  source: 'requested',
  enableRankingView: false,
  rankingItems: () => [],
  rankingTotalActualCost: 0,
  rankingTotalRequests: 0,
  rankingTotalTokens: 0,
  loading: false,
  metric: 'tokens',
  showSourceToggle: false,
  showMetricToggle: false,
  enableBreakdown: true,
  showAccountCost: true,
  rankingLoading: false,
  rankingError: false
})

const expandedKey = ref<string | null>(null)
const breakdownItems = ref<UserBreakdownItem[]>([])
const breakdownLoading = ref(false)

const toggleBreakdown = async (type: string, id: string) => {
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
      model: id,
      model_source: props.source,
    })
    breakdownItems.value = res.users || []
  } catch {
    breakdownItems.value = []
  } finally {
    breakdownLoading.value = false
  }
}

const emit = defineEmits<{
  'update:metric': [value: DistributionMetric]
  'update:source': [value: ModelSource]
  'ranking-click': [item: UserSpendingRankingItem]
}>()

const enableRankingView = computed(() => props.enableRankingView)
const showAccountCost = computed(() => props.showAccountCost)
const distributionColspan = computed(() => showAccountCost.value ? 6 : 5)
const activeView = ref<'model_distribution' | 'spending_ranking'>('model_distribution')

const sourceOptions = computed(() => [
  { value: 'requested' as const, label: t('usage.requestedModel') },
  { value: 'upstream' as const, label: t('usage.upstreamModel') },
  { value: 'mapping' as const, label: t('usage.mapping') },
])

const metricOptions = computed(() => [
  { value: 'tokens' as const, label: t('admin.dashboard.metricTokens') },
  { value: 'actual_cost' as const, label: t('admin.dashboard.metricActualCost') },
])

// tablist 模式：`id` 是面板 aria-labelledby 的目标，`panelId` 成为选中 tab 的
// aria-controls，两边共用下面那两个 useId()，关联关系不变。
const viewOptions = computed(() => [
  {
    value: 'model_distribution' as const,
    label: t('admin.dashboard.viewModelDistribution'),
    id: distributionTabId,
    panelId: distributionPanelId,
  },
  {
    value: 'spending_ranking' as const,
    label: t('admin.dashboard.viewSpendingRanking'),
    id: rankingTabId,
    panelId: rankingPanelId,
  },
])

/**
 * tabpanel 关联属性。面板内容用 v-if 链渲染，同一时刻只有一个分支在 DOM 里，
 * 所以把属性收在 computed 里 v-bind 到每个分支，保证无论落在哪个分支（加载 / 有数据 /
 * 空态 / 出错）语义都一致。没有 tablist 时（enableRankingView 为 false）不加这些属性，
 * 否则 aria-labelledby 会指向不存在的 tab。
 */
const distributionPanelAttrs = computed(() =>
  enableRankingView.value
    ? { role: 'tabpanel', id: distributionPanelId, 'aria-labelledby': distributionTabId }
    : {},
)
const rankingPanelAttrs = computed(() =>
  enableRankingView.value
    ? { role: 'tabpanel', id: rankingPanelId, 'aria-labelledby': rankingTabId }
    : {},
)

/**
 * canvas 读不到 CSS 变量，配色只能由 JS 侧驱动 —— `useChartScheme()` 用
 * MutationObserver 盯 `<html class="dark">`，主题切换时让下面的 computed 重新求值。
 */
const scheme = useChartScheme()

/** 扇区色板：Apple 系统色，按类目序号取色，light / dark 各一档。 */
const sliceColors = (count: number) =>
  Array.from({ length: count }, (_, i) => distributionColor(i, scheme.value))

const displayModelStats = computed(() => {
  const sourceStats = props.source === 'upstream'
    ? props.upstreamModelStats
    : props.source === 'mapping'
      ? props.mappingModelStats
      : props.modelStats
  if (!sourceStats?.length) return []

  const metricKey = props.metric === 'actual_cost' ? 'actual_cost' : 'total_tokens'
  return [...sourceStats].sort((a, b) => toFiniteNumber(b[metricKey]) - toFiniteNumber(a[metricKey]))
})

const chartData = computed(() => {
  if (!displayModelStats.value.length) return null

  return {
    labels: displayModelStats.value.map((m) => m.model),
    datasets: [
      {
        data: displayModelStats.value.map((m) => toFiniteNumber(props.metric === 'actual_cost' ? m.actual_cost : m.total_tokens)),
        backgroundColor: sliceColors(displayModelStats.value.length),
        // 扇区之间留白代替描边：不透明卡片上描边会显脏
        borderWidth: 0,
        spacing: 2,
        hoverOffset: 4
      }
    ]
  }
})

const rankingChartData = computed(() => {
  if (!props.rankingItems?.length) return null

  const labels = props.rankingItems.map((item, index) => `#${index + 1} ${getRankingUserLabel(item)}`)
  const data = props.rankingItems.map((item) => toFiniteNumber(item.actual_cost))
  const backgroundColor = sliceColors(props.rankingItems.length)

  if (otherRankingItem.value) {
    labels.push(t('admin.dashboard.spendingRankingOther'))
    data.push(otherRankingItem.value.actual_cost)
    // 「其他」用中性色，与真实类目区分
    backgroundColor.push(neutralColor(scheme.value))
  }

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor,
        borderWidth: 0,
        spacing: 2,
        hoverOffset: 4
      }
    ]
  }
})

const otherRankingItem = computed<RankingDisplayItem | null>(() => {
  if (!props.rankingItems?.length) return null

  const rankedActualCost = props.rankingItems.reduce((sum, item) => sum + toFiniteNumber(item.actual_cost), 0)
  const rankedRequests = props.rankingItems.reduce((sum, item) => sum + toFiniteNumber(item.requests), 0)
  const rankedTokens = props.rankingItems.reduce((sum, item) => sum + toFiniteNumber(item.tokens), 0)

  const otherActualCost = Math.max((props.rankingTotalActualCost || 0) - rankedActualCost, 0)
  const otherRequests = Math.max((props.rankingTotalRequests || 0) - rankedRequests, 0)
  const otherTokens = Math.max((props.rankingTotalTokens || 0) - rankedTokens, 0)

  if (otherActualCost <= 0.000001 && otherRequests <= 0 && otherTokens <= 0) return null

  return {
    user_id: 0,
    email: '',
    actual_cost: otherActualCost,
    requests: otherRequests,
    tokens: otherTokens,
    isOther: true
  }
})

const rankingDisplayItems = computed<RankingDisplayItem[]>(() => {
  if (!props.rankingItems?.length) return []
  return otherRankingItem.value
    ? [...props.rankingItems, otherRankingItem.value]
    : [...props.rankingItems]
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

const rankingDoughnutOptions = computed(() => ({
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
          return `${context.label}: $${formatCost(value)} (${percentage}%)`
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

const getRankingUserLabel = (item: UserSpendingRankingItem): string => {
  if (item.email) return item.email
  return t('admin.redeem.userPrefix', { id: item.user_id })
}

const getRankingRowLabel = (item: RankingDisplayItem): string => {
  if (item.isOther) return t('admin.dashboard.spendingRankingOther')
  return getRankingUserLabel(item)
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

/* 「其他」汇总行：不透明的二级表面，不叠半透明 */
.chart-row-other {
  background-color: var(--surface-secondary);
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
