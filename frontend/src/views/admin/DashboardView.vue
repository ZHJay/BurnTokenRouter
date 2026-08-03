<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>

      <template v-else-if="stats">
        <!-- Row 1: Core Stats -->
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <!-- Total API Keys -->
          <div class="card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">
                  {{ t('admin.dashboard.apiKeys') }}
                </p>
                <p class="stat-value">
                  {{ stats.total_api_keys }}
                </p>
                <p class="tabular truncate text-xs text-green-600 dark:text-green-400">
                  {{ stats.active_api_keys }} {{ t('common.active') }}
                </p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-blue-500/10 text-base text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Icon name="key" size="sm" :stroke-width="2" />
              </div>
            </div>
          </div>

          <!-- Service Accounts -->
          <div class="card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">
                  {{ t('admin.dashboard.accounts') }}
                </p>
                <p class="stat-value">
                  {{ stats.total_accounts }}
                </p>
                <p class="tabular truncate text-xs">
                  <span class="text-green-600 dark:text-green-400"
                    >{{ stats.normal_accounts }} {{ t('common.active') }}</span
                  >
                  <span v-if="stats.error_accounts > 0" class="ml-1 text-red-500"
                    >{{ stats.error_accounts }} {{ t('common.error') }}</span
                  >
                </p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-purple-500/10 text-base text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                <Icon name="server" size="sm" :stroke-width="2" />
              </div>
            </div>
          </div>

          <!-- Today Requests -->
          <div class="card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">
                  {{ t('admin.dashboard.todayRequests') }}
                </p>
                <p class="stat-value">
                  {{ stats.today_requests }}
                </p>
                <p class="tabular truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ t('common.total') }}: {{ formatNumber(stats.total_requests) }}
                </p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-green-500/10 text-base text-green-600 dark:bg-green-500/20 dark:text-green-400">
                <Icon name="chart" size="sm" :stroke-width="2" />
              </div>
            </div>
          </div>

          <!-- New Users Today -->
          <div class="card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">
                  {{ t('admin.dashboard.users') }}
                </p>
                <p class="stat-value text-emerald-600 dark:text-emerald-400">
                  +{{ stats.today_new_users }}
                </p>
                <p class="tabular truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ t('common.total') }}: {{ formatNumber(stats.total_users) }}
                </p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-emerald-500/10 text-base text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Icon name="userPlus" size="sm" :stroke-width="2" />
              </div>
            </div>
          </div>
        </div>

        <!-- Row 2: Token Stats -->
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <!-- Today Tokens -->
          <div class="card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">
                  {{ t('admin.dashboard.todayTokens') }}
                </p>
                <p class="stat-value">
                  {{ formatTokens(stats.today_tokens) }}
                </p>
                <p class="tabular truncate text-xs">
                  <span
                    class="text-green-600 dark:text-green-400"
                    :title="t('admin.dashboard.actual')"
                    >${{ formatCost(stats.today_actual_cost) }}</span
                  >
                  <span class="text-gray-400 dark:text-gray-500"> / </span>
                  <span
                    class="text-orange-500 dark:text-orange-400"
                    :title="t('admin.dashboard.accountCost')"
                    >${{ formatCost(stats.today_account_cost) }}</span
                  >
                  <span class="text-gray-400 dark:text-gray-500"> / </span>
                  <span
                    class="text-gray-400 dark:text-gray-500"
                    :title="t('admin.dashboard.standard')"
                    >${{ formatCost(stats.today_cost) }}</span
                  >
                </p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-amber-500/10 text-base text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <Icon name="cube" size="sm" :stroke-width="2" />
              </div>
            </div>
          </div>

          <!-- Total Tokens -->
          <div class="card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">
                  {{ t('admin.dashboard.totalTokens') }}
                </p>
                <p class="stat-value">
                  {{ formatTokens(stats.total_tokens) }}
                </p>
                <p class="tabular truncate text-xs">
                  <span
                    class="text-green-600 dark:text-green-400"
                    :title="t('admin.dashboard.actual')"
                    >${{ formatCost(stats.total_actual_cost) }}</span
                  >
                  <span class="text-gray-400 dark:text-gray-500"> / </span>
                  <span
                    class="text-orange-500 dark:text-orange-400"
                    :title="t('admin.dashboard.accountCost')"
                    >${{ formatCost(stats.total_account_cost) }}</span
                  >
                  <span class="text-gray-400 dark:text-gray-500"> / </span>
                  <span
                    class="text-gray-400 dark:text-gray-500"
                    :title="t('admin.dashboard.standard')"
                    >${{ formatCost(stats.total_cost) }}</span
                  >
                </p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-indigo-500/10 text-base text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <Icon name="database" size="sm" :stroke-width="2" />
              </div>
            </div>
          </div>

          <!-- Performance (RPM/TPM) -->
          <div class="card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">
                  {{ t('admin.dashboard.performance') }}
                </p>
                <div class="flex items-baseline gap-2">
                  <p class="stat-value">
                    {{ formatTokens(stats.rpm) }}
                  </p>
                  <span class="text-xs text-gray-500 dark:text-gray-400">RPM</span>
                </div>
                <div class="flex items-baseline gap-2">
                  <p class="tabular text-sm font-semibold tracking-[-0.014em] text-violet-600 dark:text-violet-400">
                    {{ formatTokens(stats.tpm) }}
                  </p>
                  <span class="text-xs text-gray-500 dark:text-gray-400">TPM</span>
                </div>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-violet-500/10 text-base text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                <Icon name="bolt" size="sm" :stroke-width="2" />
              </div>
            </div>
          </div>

          <!-- Avg Response Time -->
          <div class="card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">
                  {{ t('admin.dashboard.avgResponse') }}
                </p>
                <p class="stat-value">
                  {{ formatDuration(stats.average_duration_ms) }}
                </p>
                <p class="tabular truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ stats.active_users }} {{ t('admin.dashboard.activeUsers') }}
                </p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-rose-500/10 text-base text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                <Icon name="clock" size="sm" :stroke-width="2" />
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card p-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('admin.dashboard.quickActions') }}
            </h2>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              v-if="canUseBatchImage"
              type="button"
              class="card-inset group flex items-center gap-3 p-3 text-left transition-transform duration-instant ease-apple-out hover:bg-sky-500/[0.06] active:scale-[0.98] dark:hover:bg-sky-500/10"
              @click="router.push('/batch-image')"
            >
              <span class="stat-icon h-8 w-8 flex-shrink-0 bg-sky-500/10 text-base text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                <Icon name="sparkles" size="sm" :stroke-width="2" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-gray-900 dark:text-white">
                  {{ t('admin.dashboard.batchImage') }}
                </span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.dashboard.batchImageDesc') }}
                </span>
              </span>
              <Icon name="chevronRight" size="sm" class="text-gray-400 group-hover:text-sky-500" />
            </button>
            <button
              type="button"
              class="card-inset group flex items-center gap-3 p-3 text-left transition-transform duration-instant ease-apple-out hover:bg-emerald-500/[0.06] active:scale-[0.98] dark:hover:bg-emerald-500/10"
              @click="router.push('/admin/groups')"
            >
              <span class="stat-icon h-8 w-8 flex-shrink-0 bg-emerald-500/10 text-base text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Icon name="grid" size="sm" :stroke-width="2" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-gray-900 dark:text-white">
                  {{ t('admin.dashboard.groupPricing') }}
                </span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.dashboard.groupPricingDesc') }}
                </span>
              </span>
              <Icon name="chevronRight" size="sm" class="text-gray-400 group-hover:text-emerald-500" />
            </button>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="space-y-6">
          <!-- Date Range Filter -->
          <div class="card p-4">
            <div class="flex flex-wrap items-center gap-4">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >{{ t('admin.dashboard.timeRange') }}:</span
                >
                <DateRangePicker
                  v-model:start-date="startDate"
                  v-model:end-date="endDate"
                  @change="onDateRangeChange"
                />
              </div>
              <button @click="loadDashboardStats" :disabled="chartsLoading" class="btn btn-secondary">
                {{ t('common.refresh') }}
              </button>
              <div class="ml-auto flex items-center gap-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >{{ t('admin.dashboard.granularity') }}:</span
                >
                <div class="w-28">
                  <Select
                    v-model="granularity"
                    :options="granularityOptions"
                    @change="loadChartData"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Charts Grid -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ModelDistributionChart
              :model-stats="modelStats"
              :enable-ranking-view="true"
              :ranking-items="rankingItems"
              :ranking-total-actual-cost="rankingTotalActualCost"
              :ranking-total-requests="rankingTotalRequests"
              :ranking-total-tokens="rankingTotalTokens"
              :loading="chartsLoading"
              :ranking-loading="rankingLoading"
              :ranking-error="rankingError"
              :start-date="startDate"
              :end-date="endDate"
              @ranking-click="goToUserUsage"
            />
            <TokenUsageTrend :trend-data="trendData" :loading="chartsLoading" />
          </div>

          <!-- User Usage Trend (Full Width) -->
          <div class="card p-4">
            <h3 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('admin.dashboard.recentUsage') }} (Top 12)
            </h3>
            <div class="h-64">
              <div v-if="userTrendLoading" class="flex h-full items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
              <!-- vue-chartjs 渲染的是裸 <canvas>（已带 role="img"），不给 aria-label 就是一个无名图形 -->
              <Line
                v-else-if="userTrendChartData"
                :data="userTrendChartData"
                :options="lineOptions"
                :aria-label="`${t('admin.dashboard.recentUsage')} (Top 12)`"
              />
              <div
                v-else
                class="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400"
              >
                {{ t('admin.dashboard.noDataAvailable') }}
              </div>
            </div>

            <!--
              图表的等价替代。12 条线只靠色相 + 线型区分，落到色觉障碍 / 低视力 / 读屏
              场景仍然读不出具体数值；分布图早就配了并排表格，这张最复杂的图反而没有。
              数据现成（userTrend），不额外请求。

              左侧色块同时带上该序列的线型，读者才能把表格行和图上某条线对应起来。
            -->
            <div v-if="userTrendTable" class="mt-4 max-h-48 overflow-auto">
              <table class="w-full text-xs">
                <caption class="sr-only">
                  {{ t('admin.dashboard.recentUsage') }} (Top 12)
                </caption>
                <thead>
                  <tr class="text-gray-500 dark:text-gray-400">
                    <th scope="col" class="sticky left-0 z-10 bg-[color:var(--surface)] pb-2 pr-3 text-left">
                      {{ t('admin.dashboard.spendingRankingUser') }}
                    </th>
                    <th
                      v-for="date in userTrendTable.dates"
                      :key="date"
                      scope="col"
                      class="whitespace-nowrap pb-2 pl-3 text-right font-medium"
                    >
                      {{ date }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in userTrendTable.rows" :key="row.name" class="chart-row">
                    <th
                      scope="row"
                      class="sticky left-0 z-10 max-w-[160px] bg-[color:var(--surface)] py-1.5 pr-3 text-left font-medium text-gray-900 dark:text-white"
                    >
                      <span class="flex min-w-0 items-center gap-1.5">
                        <svg class="h-2 w-4 shrink-0" viewBox="0 0 16 8" aria-hidden="true">
                          <line
                            x1="0"
                            y1="4"
                            x2="16"
                            y2="4"
                            :stroke="row.color"
                            stroke-width="2"
                            :stroke-dasharray="row.dash"
                          />
                        </svg>
                        <span class="truncate" :title="row.name">{{ row.name }}</span>
                      </span>
                    </th>
                    <td
                      v-for="(value, i) in row.values"
                      :key="i"
                      class="whitespace-nowrap py-1.5 pl-3 text-right tabular text-gray-600 dark:text-gray-400"
                    >
                      {{ formatTokens(value) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
import { adminAPI } from '@/api/admin'
import type {
  DashboardStats,
  TrendDataPoint,
  ModelStat,
  UserUsageTrendPoint,
  UserSpendingRankingItem
} from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import Select from '@/components/common/Select.vue'
import ModelDistributionChart from '@/components/charts/ModelDistributionChart.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
import {
  chartAxisChrome,
  chartAxisFont,
  chartHue,
  chartLegendStyle,
  chartTooltipStyle,
  useChartScheme,
  withAlpha,
  type ChartHue
} from '@/lib/chart'

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

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
)

/**
 * 12 条并行用户序列的色板 —— Apple 系统色，light / dark 各一档。
 *
 * 顺序是按「相邻色相尽量拉开」调过的，多色语义刻意保留：12 个用户必须能相互区分。
 *
 * 之前这里只有浅色一档，所以深色模式下 12 条线仍是浅色值（蓝一直是 `0,122,255`），
 * 浅色序列压在深色表面上。另外第 12 位曾写死 `#bf5af2` —— 那是**深色**档的紫，
 * 出现在一个纯浅色数组里，等于和第 5 位的 `#af52de` 撞成同一个色相的两档。
 * 现在第 12 位改用中性灰：它是色板里唯一还没被用掉、且与其余 11 色都拉得开的色相
 * （这张图没有「其他」序列，灰不与任何既有语义冲突）。
 *
 * teal 与 indigo 的相对位置有意与分布色板不同：下面的 borderDash 每 4 条循环一次，
 * 同一种线型内部的三个色相必须互相分得开，而 teal 与 cyan 挨在同一组会撞。
 */
const SERIES_HUES: readonly ChartHue[] = [
  'blue',
  'green',
  'orange',
  'red',
  'purple',
  'pink',
  'indigo',
  'teal',
  'yellow',
  'mint',
  'cyan',
  'gray'
]

/**
 * 第二条区分通道：线型。
 *
 * 12 条线只靠色相区分时，色觉障碍用户（以及任何打印/投影场景）会丢掉全部信息 ——
 * 这是 SC 1.4.1「不能只用颜色传达信息」。4 种线型 × 循环，让每条线除了颜色
 * 还有一个形状特征；配合下方的 <table> 替代，图表不再是唯一的数据入口。
 */
const SERIES_DASHES: readonly number[][] = [[], [6, 3], [2, 2], [8, 3, 2, 3]]

const appStore = useAppStore()
const router = useRouter()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()
const stats = ref<DashboardStats | null>(null)
const loading = ref(false)
const chartsLoading = ref(false)
const userTrendLoading = ref(false)
const rankingLoading = ref(false)
const rankingError = ref(false)

// Chart data
const trendData = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const userTrend = ref<UserUsageTrendPoint[]>([])
const rankingItems = ref<UserSpendingRankingItem[]>([])
const rankingTotalActualCost = ref(0)
const rankingTotalRequests = ref(0)
const rankingTotalTokens = ref(0)
let chartLoadSeq = 0
let usersTrendLoadSeq = 0
let rankingLoadSeq = 0
const rankingLimit = 12

// Helper function to format date in local timezone
const formatLocalDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const getLast24HoursRangeDates = (): { start: string; end: string } => {
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end)
  }
}

// Date range
const granularity = ref<'day' | 'hour'>('hour')
const defaultRange = getLast24HoursRangeDates()
const startDate = ref(defaultRange.start)
const endDate = ref(defaultRange.end)

// Granularity options for Select component
const granularityOptions = computed(() => [
  { value: 'day', label: t('admin.dashboard.day') },
  { value: 'hour', label: t('admin.dashboard.hour') }
])

/**
 * 配色跟随 `<html class="dark">`。
 *
 * canvas 读不到 CSS 自定义属性，所以主题切换必须由 JS 侧驱动 —— `useChartScheme()`
 * 用 MutationObserver 盯 class 变化。（此前 `isDarkMode` 直接在 computed 里读 DOM：
 * `classList.contains()` 不是响应式源，computed 永不失效，Chart.js 继续用缓存的
 * options，图表会停在旧配色直到整页刷新。）
 */
const scheme = useChartScheme()

/**
 * 轴 / 网格色。
 *
 * 这里刻意继续在运行时读真实 CSS 变量，而不是用 `chartChrome()` 的镜像字面量：
 * `@media (prefers-contrast: more)` 会把 `--label-secondary` 提到 0.86，
 * 读真值能自动跟上那一档，镜像不会。镜像只作为兜底（jsdom 下变量解析不出来）。
 */
const readToken = (name: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const chartColors = computed(() => ({
  // --label-secondary / --separator
  text: scheme.value === 'dark'
    ? readToken('--label-secondary', 'rgba(235, 235, 245, 0.6)')
    // 0.6 在 --surface 上只有 3.44:1；token 早已提到 0.74，这个兜底值曾停在被否决的旧值
    : readToken('--label-secondary', 'rgba(60, 60, 67, 0.74)')
}))

// Line chart options (for user trend chart)
const lineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { ...chartLegendStyle(scheme.value), color: chartColors.value.text }
    },
    tooltip: {
      // 原先只给了 callbacks，于是浮层落回 Chart.js 默认的深灰盒子（圆角 6、Helvetica），
      // 与应用里其他浮层明显不是一套。走共享样式。
      ...chartTooltipStyle(scheme.value),
      itemSort: (a: any, b: any) => {
        const aValue = typeof a?.raw === 'number' ? a.raw : Number(a?.parsed?.y ?? 0)
        const bValue = typeof b?.raw === 'number' ? b.raw : Number(b?.parsed?.y ?? 0)
        return bValue - aValue
      },
      callbacks: {
        label: (context: any) => {
          return `${context.dataset.label}: ${formatTokens(context.raw)}`
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
        font: chartAxisFont()
      }
    },
    y: {
      ...chartAxisChrome(scheme.value, true),
      ticks: {
        color: chartColors.value.text,
        font: chartAxisFont(),
        callback: (value: string | number) => formatTokens(Number(value))
      }
    }
  }
}))

// User trend chart data
const userTrendChartData = computed(() => {
  if (!userTrend.value?.length) return null

  const getDisplayName = (point: UserUsageTrendPoint): string => {
    const username = point.username?.trim()
    if (username) {
      return username
    }

    const email = point.email?.trim()
    if (email) {
      return email
    }

    return t('admin.redeem.userPrefix', { id: point.user_id })
  }

  // Group by user_id to avoid merging different users with the same display name
  const userGroups = new Map<number, { name: string; data: Map<string, number> }>()
  const allDates = new Set<string>()

  userTrend.value.forEach((point) => {
    allDates.add(point.date)
    const key = point.user_id
    if (!userGroups.has(key)) {
      userGroups.set(key, { name: getDisplayName(point), data: new Map() })
    }
    userGroups.get(key)!.data.set(point.date, point.tokens)
  })

  const sortedDates = Array.from(allDates).sort()
  const datasets = Array.from(userGroups.values()).map((group, idx) => {
    const color = chartHue(SERIES_HUES[idx % SERIES_HUES.length], scheme.value)
    return {
      label: group.name,
      data: sortedDates.map((date) => group.data.get(date) || 0),
      borderColor: color,
      backgroundColor: withAlpha(color, 0.125),
      // 颜色之外的第二条通道，见 SERIES_DASHES
      borderDash: SERIES_DASHES[idx % SERIES_DASHES.length],
      fill: false,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 0,
      pointHitRadius: 10
    }
  })

  return {
    labels: sortedDates,
    datasets
  }
})

/**
 * 图表的表格替代。
 *
 * 12 条线的折线图在色觉障碍、低视力、读屏等场景下都读不出具体数值，
 * 分布图早就配了并排表格，这张最复杂的图反而没有。数据现成（userTrend），
 * 直接按「用户 × 日期」摊平即可，不额外请求。
 */
const userTrendTable = computed(() => {
  const data = userTrendChartData.value
  if (!data) return null
  return {
    dates: data.labels,
    rows: data.datasets.map((ds) => ({
      name: ds.label,
      color: ds.borderColor,
      dash: ds.borderDash.length ? ds.borderDash.join(' ') : undefined,
      values: ds.data as number[]
    }))
  }
})

// Format helpers
const formatTokens = (value: number | undefined): string => {
  if (value === undefined || value === null) return '0'
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toLocaleString()
}

const toFiniteNumber = (value: unknown): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const formatNumber = (value: number | null | undefined): string => {
  return toFiniteNumber(value).toLocaleString()
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

const formatDuration = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${Math.round(ms)}ms`
}

const goToUserUsage = (item: UserSpendingRankingItem) => {
  void router.push({
    path: '/admin/usage',
    query: {
      user_id: String(item.user_id),
      start_date: startDate.value,
      end_date: endDate.value
    }
  })
}

// Date range change handler
const onDateRangeChange = (range: {
  startDate: string
  endDate: string
  preset: string | null
}) => {
  // Auto-select granularity based on date range
  const start = new Date(range.startDate)
  const end = new Date(range.endDate)
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  // If range is 1 day, use hourly granularity
  if (daysDiff <= 1) {
    granularity.value = 'hour'
  } else {
    granularity.value = 'day'
  }

  loadChartData()
}

// Load data
const loadDashboardSnapshot = async (includeStats: boolean) => {
  const currentSeq = ++chartLoadSeq
  if (includeStats && !stats.value) {
    loading.value = true
  }
  chartsLoading.value = true
  try {
    const response = await adminAPI.dashboard.getSnapshotV2({
      start_date: startDate.value,
      end_date: endDate.value,
      granularity: granularity.value,
      include_stats: includeStats,
      include_trend: true,
      include_model_stats: true,
      include_group_stats: false,
      include_users_trend: false
    })
    if (currentSeq !== chartLoadSeq) return
    if (includeStats && response.stats) {
      stats.value = response.stats
    }
    trendData.value = response.trend || []
    modelStats.value = response.models || []
  } catch (error) {
    if (currentSeq !== chartLoadSeq) return
    appStore.showError(t('admin.dashboard.failedToLoad'))
    console.error('Error loading dashboard snapshot:', error)
  } finally {
    if (currentSeq === chartLoadSeq) {
      loading.value = false
      chartsLoading.value = false
    }
  }
}

const loadUsersTrend = async () => {
  const currentSeq = ++usersTrendLoadSeq
  userTrendLoading.value = true
  try {
    const response = await adminAPI.dashboard.getUserUsageTrend({
      start_date: startDate.value,
      end_date: endDate.value,
      granularity: granularity.value,
      limit: 12
    })
    if (currentSeq !== usersTrendLoadSeq) return
    userTrend.value = response.trend || []
  } catch (error) {
    if (currentSeq !== usersTrendLoadSeq) return
    console.error('Error loading users trend:', error)
    userTrend.value = []
  } finally {
    if (currentSeq === usersTrendLoadSeq) {
      userTrendLoading.value = false
    }
  }
}

const loadUserSpendingRanking = async () => {
  const currentSeq = ++rankingLoadSeq
  rankingLoading.value = true
  rankingError.value = false
  try {
    const response = await adminAPI.dashboard.getUserSpendingRanking({
      start_date: startDate.value,
      end_date: endDate.value,
      limit: rankingLimit
    })
    if (currentSeq !== rankingLoadSeq) return
    rankingItems.value = response.ranking || []
    rankingTotalActualCost.value = response.total_actual_cost || 0
    rankingTotalRequests.value = response.total_requests || 0
    rankingTotalTokens.value = response.total_tokens || 0
  } catch (error) {
    if (currentSeq !== rankingLoadSeq) return
    console.error('Error loading user spending ranking:', error)
    rankingItems.value = []
    rankingTotalActualCost.value = 0
    rankingTotalRequests.value = 0
    rankingTotalTokens.value = 0
    rankingError.value = true
  } finally {
    if (currentSeq === rankingLoadSeq) {
      rankingLoading.value = false
    }
  }
}

const loadDashboardStats = async () => {
  await Promise.all([
    loadDashboardSnapshot(true),
    loadUsersTrend(),
    loadUserSpendingRanking()
  ])
}

const loadChartData = async () => {
  await Promise.all([
    loadDashboardSnapshot(false),
    loadUsersTrend(),
    loadUserSpendingRanking()
  ])
}

onMounted(() => {
  void refreshBatchImageAccess()
  loadDashboardStats()
})
</script>

<style scoped>
/* 行间用发丝线分隔，而不是 1px 实线框 —— 与分布图表里的 .chart-row 同一套值。
   （那份定义在各自组件的 scoped style 里，不会跨组件生效。） */
.chart-row {
  box-shadow: inset 0 0.5px 0 var(--separator);
}
</style>
