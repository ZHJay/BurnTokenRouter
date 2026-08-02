<template>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <!-- Today Revenue -->
    <div class="card card-hover p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-1">
          <p class="stat-label">{{ t('payment.admin.todayRevenue') }}</p>
          <p v-for="[currency, amount] in sortedAmounts(stats.today_amount)" :key="currency" class="stat-value">
            {{ formatMoney(currency, amount) }}
          </p>
          <p class="tabular truncate text-xs text-gray-500 dark:text-gray-400">
            {{ stats.today_count }} {{ t('payment.admin.orders') }}
          </p>
        </div>
        <div class="stat-icon stat-icon-success h-8 w-8 shrink-0 text-base">
          <Icon name="dollar" size="sm" :stroke-width="2" />
        </div>
      </div>
    </div>

    <!-- Total Revenue -->
    <div class="card card-hover p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-1">
          <p class="stat-label">{{ t('payment.admin.totalRevenue') }}</p>
          <p v-for="[currency, amount] in sortedAmounts(stats.total_amount)" :key="currency" class="stat-value">
            {{ formatMoney(currency, amount) }}
          </p>
          <p class="tabular truncate text-xs text-gray-500 dark:text-gray-400">
            {{ stats.total_count }} {{ t('payment.admin.orders') }}
          </p>
        </div>
        <div class="stat-icon stat-icon-primary h-8 w-8 shrink-0 text-base">
          <Icon name="creditCard" size="sm" :stroke-width="2" />
        </div>
      </div>
    </div>

    <!-- Today Orders -->
    <div class="card card-hover p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-1">
          <p class="stat-label">{{ t('payment.admin.todayOrders') }}</p>
          <p class="stat-value">{{ stats.today_count }}</p>
        </div>
        <div class="stat-icon h-8 w-8 shrink-0 bg-purple-100 text-base text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
          <Icon name="chart" size="sm" :stroke-width="2" />
        </div>
      </div>
    </div>

    <!-- Average Amount -->
    <div class="card card-hover p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-1">
          <p class="stat-label">{{ t('payment.admin.avgAmount') }}</p>
          <p v-for="[currency, amount] in sortedAmounts(stats.avg_amount)" :key="currency" class="stat-value">
            {{ formatMoney(currency, amount) }}
          </p>
        </div>
        <div class="stat-icon stat-icon-warning h-8 w-8 shrink-0 text-base">
          <Icon name="chart" size="sm" :stroke-width="2" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { CurrencyAmounts, DashboardStats } from '@/types/payment'

const { t } = useI18n()

defineProps<{
  stats: DashboardStats
}>()

function sortedAmounts(amounts: CurrencyAmounts): [string, number][] {
  return Object.entries(amounts).sort(([left], [right]) => left.localeCompare(right))
}

function formatMoney(currency: string, amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}
</script>
