<template>
  <div>
    <!-- Loading state -->
    <div v-if="props.loading && !props.stats" class="space-y-0.5">
      <div class="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
      <div class="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
      <div class="h-3 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="props.error && !props.stats" class="text-xs text-red-500">
      {{ props.error }}
    </div>

    <!-- Stats data: compact two-line summary; billing detail remains available in the tooltip. -->
    <div
      v-else-if="props.stats"
      data-test="today-stats-summary"
      class="account-today-stats"
      :title="statsTooltip"
    >
      <span class="account-today-stats__tokens">{{ formatTokens(props.stats.tokens) }}</span>
      <span class="account-today-stats__requests">
        {{ formatNumber(props.stats.requests) }} {{ t('admin.accounts.stats.requests') }}
      </span>
    </div>

    <!-- No data -->
    <div v-else class="text-xs text-gray-400">-</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WindowStats } from '@/types'
import { formatNumber, formatCurrency } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    stats?: WindowStats | null
    loading?: boolean
    error?: string | null
  }>(),
  {
    stats: null,
    loading: false,
    error: null
  }
)

const { t } = useI18n()

const statsTooltip = computed(() => {
  if (!props.stats) return ''
  const details = [
    `${t('admin.accounts.stats.tokens')}: ${formatTokens(props.stats.tokens)}`,
    `${t('admin.accounts.stats.requests')}: ${formatNumber(props.stats.requests)}`,
    `${t('usage.accountBilled')}: ${formatCurrency(props.stats.cost)}`
  ]
  if (props.stats.user_cost != null) {
    details.push(`${t('usage.userBilled')}: ${formatCurrency(props.stats.user_cost)}`)
  }
  return details.join(' · ')
})

// Format large token numbers (e.g., 1234567 -> 1.23M)
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}
</script>

<style scoped>
.account-today-stats {
  @apply flex min-w-[4.25rem] flex-col text-xs leading-4 text-gray-500 dark:text-dark-300;
}

.account-today-stats__tokens {
  @apply font-mono font-medium text-gray-700 dark:text-gray-200;
}

.account-today-stats__requests {
  @apply whitespace-nowrap font-mono text-[11px] text-gray-500 dark:text-dark-400;
}
</style>
