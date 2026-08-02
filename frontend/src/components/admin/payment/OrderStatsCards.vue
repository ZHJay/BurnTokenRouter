<template>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <!-- Today Revenue -->
    <div class="card p-4">
      <div class="flex items-center gap-3">
        <div class="stat-icon stat-icon-success shrink-0">
          <Icon name="dollar" size="md" :stroke-width="2" />
        </div>
        <div>
          <p class="stat-label">{{ t('payment.admin.todayRevenue') }}</p>
          <p v-for="[currency, amount] in sortedAmounts(stats.today_amount)" :key="currency" class="tabular text-xl font-semibold tracking-[-0.026em] text-gray-900 dark:text-white">
            {{ formatMoney(currency, amount) }}
          </p>
          <p class="tabular text-xs tracking-[0.01em] text-gray-500 dark:text-gray-400">
            {{ stats.today_count }} {{ t('payment.admin.orders') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Total Revenue -->
    <div class="card p-4">
      <div class="flex items-center gap-3">
        <div class="stat-icon stat-icon-primary shrink-0">
          <Icon name="creditCard" size="md" :stroke-width="2" />
        </div>
        <div>
          <p class="stat-label">{{ t('payment.admin.totalRevenue') }}</p>
          <p v-for="[currency, amount] in sortedAmounts(stats.total_amount)" :key="currency" class="tabular text-xl font-semibold tracking-[-0.026em] text-gray-900 dark:text-white">
            {{ formatMoney(currency, amount) }}
          </p>
          <p class="tabular text-xs tracking-[0.01em] text-gray-500 dark:text-gray-400">
            {{ stats.total_count }} {{ t('payment.admin.orders') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Today Orders -->
    <div class="card p-4">
      <div class="flex items-center gap-3">
        <div class="stat-icon shrink-0 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
          <Icon name="chart" size="md" :stroke-width="2" />
        </div>
        <div>
          <p class="stat-label">{{ t('payment.admin.todayOrders') }}</p>
          <p class="tabular text-xl font-semibold tracking-[-0.026em] text-gray-900 dark:text-white">{{ stats.today_count }}</p>
        </div>
      </div>
    </div>

    <!-- Average Amount -->
    <div class="card p-4">
      <div class="flex items-center gap-3">
        <div class="stat-icon stat-icon-warning shrink-0">
          <Icon name="chart" size="md" :stroke-width="2" />
        </div>
        <div>
          <p class="stat-label">{{ t('payment.admin.avgAmount') }}</p>
          <p v-for="[currency, amount] in sortedAmounts(stats.avg_amount)" :key="currency" class="tabular text-xl font-semibold tracking-[-0.026em] text-gray-900 dark:text-white">
            {{ formatMoney(currency, amount) }}
          </p>
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
