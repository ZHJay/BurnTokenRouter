<template>
  <BaseDialog
    :show="show"
    :title="t('admin.accounts.usageStatistics')"
    width="extra-wide"
    @close="handleClose"
  >
    <div class="space-y-6">
      <!-- Account Info Header -->
      <div
        v-if="account"
        class="flex items-center justify-between rounded-xl bg-[var(--accent-tint)] p-3 shadow-[inset_0_0_0_0.5px_var(--hairline)]"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]"
          >
            <Icon name="chartBar" size="md" class="text-white" />
          </div>
          <div>
            <div class="font-semibold text-gray-900 dark:text-gray-100">{{ account.name }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.last30DaysUsage') }}
            </div>
          </div>
        </div>
        <span
          :class="['badge', account.status === 'active' ? 'badge-success' : 'badge-gray']"
        >
          {{ account.status }}
        </span>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>

      <template v-else-if="stats">
        <!-- Row 1: Main Stats Cards -->
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <!-- 30-Day Total Cost -->
          <div class="card p-4">
            <div class="mb-2 flex items-center justify-between">
              <span class="stat-label">{{
                t('admin.accounts.stats.totalCost')
              }}</span>
              <div class="shrink-0 rounded-lg bg-emerald-100 p-1.5 dark:bg-emerald-900/30">
                <Icon name="dollar" size="sm" class="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p class="stat-value">
              ${{ formatCost(stats.summary.total_cost) }}
            </p>
            <p class="tabular mt-1 text-xs tracking-[0.01em] text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.stats.accumulatedCost') }}
              <span class="text-gray-400 dark:text-gray-500">
                ({{ t('usage.userBilled') }}: ${{ formatCost(stats.summary.total_user_cost) }} ·
                {{ t('admin.accounts.stats.standardCost') }}: ${{
                  formatCost(stats.summary.total_standard_cost)
                }})
              </span>
            </p>
          </div>

          <!-- 30-Day Total Requests -->
          <div class="card p-4">
            <div class="mb-2 flex items-center justify-between">
              <span class="stat-label">{{
                t('admin.accounts.stats.totalRequests')
              }}</span>
              <div class="shrink-0 rounded-lg bg-blue-100 p-1.5 dark:bg-blue-900/30">
                <Icon name="bolt" size="sm" class="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p class="stat-value">
              {{ formatNumber(stats.summary.total_requests) }}
            </p>
            <p class="mt-1 text-xs tracking-[0.01em] text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.stats.totalCalls') }}
            </p>
          </div>

          <!-- Daily Average Cost -->
          <div class="card p-4">
            <div class="mb-2 flex items-center justify-between">
              <span class="stat-label">{{
                t('admin.accounts.stats.avgDailyCost')
              }}</span>
              <div class="shrink-0 rounded-lg bg-amber-100 p-1.5 dark:bg-amber-900/30">
                <Icon
                  name="calculator"
                  size="sm"
                  class="text-amber-600 dark:text-amber-400"
                />
              </div>
            </div>
            <p class="stat-value">
              ${{ formatCost(stats.summary.avg_daily_cost) }}
            </p>
             <p class="tabular mt-1 text-xs tracking-[0.01em] text-gray-500 dark:text-gray-400">
              {{
                t('admin.accounts.stats.basedOnActualDays', {
                  days: stats.summary.actual_days_used
                })
              }}
              <span class="text-gray-400 dark:text-gray-500">
                ({{ t('usage.userBilled') }}: ${{ formatCost(stats.summary.avg_daily_user_cost) }})
              </span>
            </p>
          </div>

          <!-- Daily Average Requests -->
          <div class="card p-4">
            <div class="mb-2 flex items-center justify-between">
              <span class="stat-label">{{
                t('admin.accounts.stats.avgDailyRequests')
              }}</span>
              <div class="shrink-0 rounded-lg bg-purple-100 p-1.5 dark:bg-purple-900/30">
                <svg
                  class="h-4 w-4 text-purple-600 dark:text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
              </div>
            </div>
            <p class="stat-value">
              {{ formatNumber(Math.round(stats.summary.avg_daily_requests)) }}
            </p>
            <p class="mt-1 text-xs tracking-[0.01em] text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.stats.avgDailyUsage') }}
            </p>
          </div>
        </div>

        <!-- Row 2: Today, Highest Cost, Highest Requests -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <!-- Today Overview -->
          <div class="card p-4">
            <div class="mb-3 flex items-center gap-2">
              <div class="rounded-lg bg-cyan-100 p-1.5 dark:bg-cyan-900/30">
                <Icon name="clock" size="sm" class="text-cyan-600 dark:text-cyan-400" />
              </div>
              <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                t('admin.accounts.stats.todayOverview')
              }}</span>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('usage.accountBilled') }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white"
                  >${{ formatCost(stats.summary.today?.cost || 0) }}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('usage.userBilled') }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white"
                  >${{ formatCost(stats.summary.today?.user_cost || 0) }}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.requests')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  formatNumber(stats.summary.today?.requests || 0)
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.tokens')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  formatTokens(stats.summary.today?.tokens || 0)
                }}</span>
              </div>
            </div>
          </div>

          <!-- Highest Cost Day -->
          <div class="card p-4">
            <div class="mb-3 flex items-center gap-2">
              <div class="rounded-lg bg-orange-100 p-1.5 dark:bg-orange-900/30">
                <Icon name="fire" size="sm" class="text-orange-600 dark:text-orange-400" />
              </div>
              <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                t('admin.accounts.stats.highestCostDay')
              }}</span>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.date')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  stats.summary.highest_cost_day?.label || '-'
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('usage.accountBilled') }}</span>
                <span class="tabular text-sm font-semibold text-orange-600 dark:text-orange-400"
                  >${{ formatCost(stats.summary.highest_cost_day?.cost || 0) }}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('usage.userBilled') }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white"
                  >${{ formatCost(stats.summary.highest_cost_day?.user_cost || 0) }}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.requests')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  formatNumber(stats.summary.highest_cost_day?.requests || 0)
                }}</span>
              </div>
            </div>
          </div>

          <!-- Highest Request Day -->
          <div class="card p-4">
            <div class="mb-3 flex items-center gap-2">
              <div class="rounded-lg bg-indigo-100 p-1.5 dark:bg-indigo-900/30">
                <Icon
                  name="trendingUp"
                  size="sm"
                  class="text-indigo-600 dark:text-indigo-400"
                />
              </div>
              <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                t('admin.accounts.stats.highestRequestDay')
              }}</span>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.date')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  stats.summary.highest_request_day?.label || '-'
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.requests')
                }}</span>
                <span class="tabular text-sm font-semibold text-indigo-600 dark:text-indigo-400">{{
                  formatNumber(stats.summary.highest_request_day?.requests || 0)
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('usage.accountBilled') }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white"
                  >${{ formatCost(stats.summary.highest_request_day?.cost || 0) }}</span
                >
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('usage.userBilled') }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white"
                  >${{ formatCost(stats.summary.highest_request_day?.user_cost || 0) }}</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Row 3: Token Stats -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <!-- Accumulated Tokens -->
          <div class="card p-4">
            <div class="mb-3 flex items-center gap-2">
              <div class="rounded-lg bg-teal-100 p-1.5 dark:bg-teal-900/30">
                <Icon name="cube" size="sm" class="text-teal-600 dark:text-teal-400" />
              </div>
              <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                t('admin.accounts.stats.accumulatedTokens')
              }}</span>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.totalTokens')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  formatTokens(stats.summary.total_tokens)
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.dailyAvgTokens')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  formatTokens(Math.round(stats.summary.avg_daily_tokens))
                }}</span>
              </div>
            </div>
          </div>

          <!-- Performance -->
          <div class="card p-4">
            <div class="mb-3 flex items-center gap-2">
              <div class="rounded-lg bg-rose-100 p-1.5 dark:bg-rose-900/30">
                <Icon name="bolt" size="sm" class="text-rose-600 dark:text-rose-400" />
              </div>
              <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                t('admin.accounts.stats.performance')
              }}</span>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.avgResponseTime')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  formatDuration(stats.summary.avg_duration_ms)
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.daysActive')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white"
                  >{{ stats.summary.actual_days_used }} / {{ stats.summary.days }}</span
                >
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="card p-4">
            <div class="mb-3 flex items-center gap-2">
              <div class="rounded-lg bg-lime-100 p-1.5 dark:bg-lime-900/30">
                <Icon
                  name="clipboard"
                  size="sm"
                  class="text-lime-600 dark:text-lime-400"
                />
              </div>
              <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                t('admin.accounts.stats.recentActivity')
              }}</span>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.todayRequests')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  formatNumber(stats.summary.today?.requests || 0)
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.todayTokens')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white">{{
                  formatTokens(stats.summary.today?.tokens || 0)
                }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  t('admin.accounts.stats.todayCost')
                }}</span>
                <span class="tabular text-sm font-semibold text-gray-900 dark:text-white"
                  >${{ formatCost(stats.summary.today?.cost || 0) }}</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Usage Trend Chart -->
        <div class="card p-4">
          <h3 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('admin.accounts.stats.usageTrend') }}
          </h3>
          <div class="h-64">
            <!-- vue-chartjs 渲染的是裸 <canvas>（已带 role="img"），不给 aria-label 就是一个无名图形 -->
            <Line
              v-if="trendChartData"
              :data="trendChartData"
              :options="lineChartOptions"
              :aria-label="t('admin.accounts.stats.usageTrend')"
            />
            <div
              v-else
              class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400"
            >
              {{ t('admin.dashboard.noDataAvailable') }}
            </div>
          </div>
        </div>

        <!-- Model Distribution -->
        <ModelDistributionChart :model-stats="stats.models" :loading="false" />

        <EndpointDistributionChart
          :endpoint-stats="stats.endpoints || []"
          :loading="false"
          :title="t('usage.inboundEndpoint')"
        />

        <EndpointDistributionChart
          :endpoint-stats="stats.upstream_endpoints || []"
          :loading="false"
          :title="t('usage.upstreamEndpoint')"
        />
      </template>

      <!-- No Data State -->
      <div
        v-else-if="!loading"
        class="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400"
      >
        <Icon name="chartBar" size="xl" class="mb-4 h-12 w-12" />
        <p class="text-sm">{{ t('admin.accounts.stats.noData') }}</p>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <button
          @click="handleClose"
          class="btn btn-secondary btn-md"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
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
import BaseDialog from '@/components/common/BaseDialog.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ModelDistributionChart from '@/components/charts/ModelDistributionChart.vue'
import EndpointDistributionChart from '@/components/charts/EndpointDistributionChart.vue'
import Icon from '@/components/icons/Icon.vue'
import { adminAPI } from '@/api/admin'
import type { Account, AccountUsageStatsResponse } from '@/types'
import {
  chartAxisChrome,
  chartAxisFont,
  chartAxisNoGrid,
  chartChrome,
  chartHue,
  chartLegendStyle,
  chartTooltipStyle,
  useChartScheme,
  withAlpha
} from '@/lib/chart'

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
  show: boolean
  account: Account | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)
const stats = ref<AccountUsageStatsResponse | null>(null)

/**
 * 配色跟随 `<html class="dark">`。
 *
 * 多色语义须保留：账号计费 = 蓝，用户计费 = 绿，请求数 = 橙。
 * 色值取自 `lib/chart` 的共享色相 —— 这里原先自带一份 hex 镜像与一套手写填充色。
 *
 * 弹窗每次打开都会重挂，所以原来那个「在 computed 里读 DOM」的写法后果较轻；
 * 但打开期间切主题一样不会重绘，因此同样换成 `useChartScheme()`。
 */
const scheme = useChartScheme()

const seriesAccountCost = computed(() => chartHue('blue', scheme.value))
const seriesUserCost = computed(() => chartHue('green', scheme.value))
const seriesRequests = computed(() => chartHue('orange', scheme.value))

/** 面积填充的浓度：深色下要重一点才看得出体量 */
const fillAlpha = computed(() => (scheme.value === 'dark' ? 0.16 : 0.1))

const chartColors = computed(() => {
  const chrome = chartChrome(scheme.value)
  return { text: chrome.axis, legend: chrome.legend }
})

// Line chart data
const trendChartData = computed(() => {
  if (!stats.value?.history?.length) return null

  return {
    labels: stats.value.history.map((h) => h.label),
    datasets: [
      {
        label: t('usage.accountBilled') + ' (USD)',
        data: stats.value.history.map((h) => h.actual_cost),
        borderColor: seriesAccountCost.value,
        backgroundColor: withAlpha(seriesAccountCost.value, fillAlpha.value),
        fill: true,
        tension: 0.3,
        yAxisID: 'y'
      },
      {
        label: t('usage.userBilled') + ' (USD)',
        data: stats.value.history.map((h) => h.user_cost),
        borderColor: seriesUserCost.value,
        backgroundColor: withAlpha(seriesUserCost.value, fillAlpha.value),
        fill: false,
        tension: 0.3,
        borderDash: [5, 5],
        yAxisID: 'y'
      },
      {
        label: t('admin.accounts.stats.requests'),
        data: stats.value.history.map((h) => h.requests),
        borderColor: seriesRequests.value,
        backgroundColor: withAlpha(seriesRequests.value, fillAlpha.value),
        fill: false,
        tension: 0.3,
        yAxisID: 'y1'
      }
    ]
  }
})

// Line chart options with dual Y-axis
const lineChartOptions = computed(() => ({
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
      // 原先只给了 callbacks，于是浮层落回 Chart.js 默认的深灰盒子（圆角 6、Helvetica），
      // 与应用里其他浮层明显不是一套。走共享样式。
      ...chartTooltipStyle(scheme.value),
      callbacks: {
        label: (context: any) => {
          const label = context.dataset.label || ''
          const value = context.raw
          if (label.includes('USD')) {
            return `${label}: $${formatCost(value)}`
          }
          return `${label}: ${formatNumber(value)}`
        }
      }
    }
  },
  scales: {
    x: {
      // 网格从 --separator-opaque（实色分隔线）换到 --separator（发丝线），与其余图表一致
      ...chartAxisChrome(scheme.value),
      ticks: {
        color: chartColors.value.text,
        font: chartAxisFont(),
        maxRotation: 45,
        minRotation: 0
      }
    },
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      ...chartAxisChrome(scheme.value, true),
      ticks: {
        color: seriesAccountCost.value,
        font: chartAxisFont(),
        callback: (value: string | number) => '$' + formatCost(Number(value))
      },
      title: {
        display: true,
        text: t('usage.accountBilled') + ' (USD)',
        color: seriesAccountCost.value,
        font: { size: 11, family: chartAxisFont().family }
      }
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      ...chartAxisNoGrid('chartArea'),
      ticks: {
        color: seriesRequests.value,
        font: chartAxisFont(),
        callback: (value: string | number) => formatNumber(Number(value))
      },
      title: {
        display: true,
        text: t('admin.accounts.stats.requests'),
        color: seriesRequests.value,
        font: { size: 11, family: chartAxisFont().family }
      }
    }
  }
}))

// Load stats when modal opens
watch(
  () => props.show,
  async (newVal) => {
    if (newVal && props.account) {
      await loadStats()
    } else {
      stats.value = null
    }
  }
)

const loadStats = async () => {
  if (!props.account) return

  loading.value = true
  try {
    stats.value = await adminAPI.accounts.getStats(props.account.id, 30)
  } catch (error) {
    console.error('Failed to load account stats:', error)
    stats.value = null
  } finally {
    loading.value = false
  }
}

const handleClose = () => {
  emit('close')
}

// Format helpers
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

const formatNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M'
  } else if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K'
  }
  return value.toLocaleString()
}

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

const formatDuration = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${Math.round(ms)}ms`
}
</script>
