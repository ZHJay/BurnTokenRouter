<template>
  <div class="stat-row">
    <!-- Today Revenue -->
    <div class="stat-card">
      <div class="stat-top">
        <div class="stat-icon tint-green">
          <Icon name="dollar" size="md" :stroke-width="2" />
        </div>
      </div>
      <div class="stat-label">{{ t('payment.admin.todayRevenue') }}</div>
      <p v-for="[currency, amount] in sortedAmounts(stats.today_amount)" :key="currency" class="stat-value">
        {{ formatMoney(currency, amount) }}
      </p>
      <div class="stat-trend">{{ stats.today_count }} {{ t('payment.admin.orders') }}</div>
    </div>

    <!-- Total Revenue -->
    <div class="stat-card">
      <div class="stat-top">
        <div class="stat-icon tint-blue">
          <Icon name="creditCard" size="md" :stroke-width="2" />
        </div>
      </div>
      <div class="stat-label">{{ t('payment.admin.totalRevenue') }}</div>
      <p v-for="[currency, amount] in sortedAmounts(stats.total_amount)" :key="currency" class="stat-value">
        {{ formatMoney(currency, amount) }}
      </p>
      <div class="stat-trend">{{ stats.total_count }} {{ t('payment.admin.orders') }}</div>
    </div>

    <!-- Today Orders -->
    <div class="stat-card">
      <div class="stat-top">
        <div class="stat-icon tint-purple">
          <Icon name="chart" size="md" :stroke-width="2" />
        </div>
      </div>
      <div class="stat-label">{{ t('payment.admin.todayOrders') }}</div>
      <div class="stat-value">{{ stats.today_count }}</div>
    </div>

    <!-- Average Amount -->
    <div class="stat-card">
      <div class="stat-top">
        <div class="stat-icon tint-orange">
          <Icon name="chart" size="md" :stroke-width="2" />
        </div>
      </div>
      <div class="stat-label">{{ t('payment.admin.avgAmount') }}</div>
      <p v-for="[currency, amount] in sortedAmounts(stats.avg_amount)" :key="currency" class="stat-value">
        {{ formatMoney(currency, amount) }}
      </p>
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
