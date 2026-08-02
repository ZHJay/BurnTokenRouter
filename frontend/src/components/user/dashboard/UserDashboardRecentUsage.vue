<template>
  <div class="card">
    <div class="card-header flex items-center justify-between">
      <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">{{ t('dashboard.recentUsage') }}</h2>
      <span class="badge badge-gray">{{ t('dashboard.last7Days') }}</span>
    </div>
    <div class="card-body">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
      <div v-else-if="data.length === 0" class="py-8">
        <EmptyState :title="t('dashboard.noUsageRecords')" :description="t('dashboard.startUsingApi')" />
      </div>
      <div v-else class="space-y-2">
        <div v-for="log in data" :key="log.id" class="card-inset flex items-center justify-between p-3.5 transition-colors duration-fast ease-apple-out hover:bg-gray-100 dark:hover:bg-dark-800">
          <div class="flex min-w-0 items-center gap-3">
            <div class="stat-icon stat-icon-primary h-8 w-8 shrink-0 text-base">
              <Icon name="beaker" size="sm" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-[13px] font-medium text-gray-900 dark:text-white">{{ log.model }}</p>
              <p class="truncate text-xs tabular text-gray-500 dark:text-dark-400">{{ formatDateTime(log.created_at) }}</p>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-[13px] font-semibold tabular tracking-[-0.01em]">
              <span class="text-green-600 dark:text-green-400" :title="t('dashboard.actual')">${{ formatCost(log.actual_cost) }}</span>
              <span class="font-normal text-gray-400 dark:text-gray-500" :title="t('dashboard.standard')"> / ${{ formatCost(log.total_cost) }}</span>
            </p>
            <p class="text-xs tabular text-gray-500 dark:text-dark-400">{{ (log.input_tokens + log.output_tokens).toLocaleString() }} tokens</p>
          </div>
        </div>

        <router-link to="/usage" class="flex items-center justify-center gap-2 py-3 text-[13px] font-medium text-primary-600 transition-colors duration-fast ease-apple-out hover:text-primary-700 active:scale-[0.98] dark:text-primary-400 dark:hover:text-primary-300">
          {{ t('dashboard.viewAllUsage') }}
          <Icon name="arrowRight" size="sm" />
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Icon from '@/components/icons/Icon.vue'
import { formatDateTime } from '@/utils/format'
import type { UsageLog } from '@/types'

defineProps<{
  data: UsageLog[]
  loading: boolean
}>()
const { t } = useI18n()
const formatCost = (c: number) => c.toFixed(4)
</script>
