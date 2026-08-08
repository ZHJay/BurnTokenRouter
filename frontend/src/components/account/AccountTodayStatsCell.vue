<template>
  <div>
    <!-- Loading state -->
    <div v-if="props.loading && !props.stats" class="space-y-1">
      <div class="h-3 w-12 animate-pulse rounded-full bg-[color:var(--fill)]"></div>
      <div class="h-3 w-16 animate-pulse rounded-full bg-[color:var(--fill)]"></div>
      <div class="h-3 w-10 animate-pulse rounded-full bg-[color:var(--fill)]"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="props.error && !props.stats" class="text-xs" style="color: var(--red)">
      {{ props.error }}
    </div>

    <!-- Stats data -->
    <div v-else-if="props.stats" class="today-cell">
      <!-- Requests -->
      <div class="t-req">
        {{ t('admin.accounts.stats.requests') }} {{ formatNumber(props.stats.requests) }}
      </div>
      <!-- Tokens -->
      <div class="t-tok">
        {{ t('admin.accounts.stats.tokens') }} {{ formatTokens(props.stats.tokens) }}
      </div>
      <!-- Cost (Account) -->
      <div class="t-tok">
        {{ t('usage.accountBilled') }} {{ formatCurrency(props.stats.cost) }}
      </div>
      <!-- Cost (User/API Key) -->
      <div v-if="props.stats.user_cost != null" class="t-tok">
        {{ t('usage.userBilled') }} {{ formatCurrency(props.stats.user_cost) }}
      </div>
    </div>

    <!-- No data -->
    <div v-else class="muted text-xs">-</div>
  </div>
</template>

<script setup lang="ts">
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
/* 契约镜像：demo 的 .today-cell（请求数 + token 两行小字） */
.today-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: nowrap;
}

.t-req {
  font-family: "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.t-tok {
  font-size: 11px;
  color: var(--text-tertiary);
}
</style>
