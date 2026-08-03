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
          <span :id="granularityLabelId" class="text-xs font-medium tracking-[0.01em] text-gray-500 dark:text-gray-400">{{ t('dashboard.granularity') }}:</span>
          <!-- Apple 分段控件：两个互斥选项用 segmented 比下拉更快也更好读 -->
          <!-- 选粒度是「选值」，不切换面板：radiogroup 模式，方向键遍历由 Segmented 提供 -->
          <Segmented
            :model-value="granularity"
            :options="granularityOptions"
            mode="radiogroup"
            :aria-labelledby="granularityLabelId"
            @update:model-value="selectGranularity"
          />
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
            <!-- vue-chartjs 渲染的是裸 <canvas>（已带 role="img"），不给 aria-label 就是一个无名图形。
                 右侧表格是同一份数据的等价替代，因此这里只需要一个名字。 -->
            <Doughnut
              v-if="modelData"
              :data="modelData"
              :options="doughnutOptions"
              :aria-label="t('dashboard.modelDistribution')"
            />
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
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import Segmented from '@/components/common/Segmented.vue'
import { Doughnut } from 'vue-chartjs'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import type { TrendDataPoint, ModelStat } from '@/types'
import { formatCostFixed as formatCost, formatNumberLocaleString as formatNumber, formatTokensK as formatTokens } from '@/utils/format'
import { chartTooltipStyle, distributionColor, useChartScheme } from '@/lib/chart'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

const props = defineProps<{ loading: boolean, startDate: string, endDate: string, granularity: string, trend: TrendDataPoint[], models: ModelStat[] }>()
const emit = defineEmits(['update:startDate', 'update:endDate', 'update:granularity', 'dateRangeChange', 'granularityChange', 'refresh'])
const { t } = useI18n()

// 分段控件的无障碍名称指向可见的「粒度」标签
const granularityLabelId = useId()

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
 * 配色跟随 `<html class="dark">`。
 *
 * 色板与浮层都取自 `lib/chart` —— 这里原先自带一份 8 色 `MODEL_HUES` 与一整套
 * 手写的浮层色值，是同一批 token 的第三份副本。`distributionColor` 的前 8 位与
 * 那份色板同序，因此前 8 个模型颜色不变，第 9 个之后从「回卷重复」变成继续取新色相，
 * 并与管理端分布图完全一致（那也是原注释想达到的效果）。
 */
const scheme = useChartScheme()

/** 表格行的色点必须与扇区同色，才能把两边对应起来。 */
const seriesColor = (index: number) => distributionColor(index, scheme.value)

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
      ...chartTooltipStyle(scheme.value),
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
