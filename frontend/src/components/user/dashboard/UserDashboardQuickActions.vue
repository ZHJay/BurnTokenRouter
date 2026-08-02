<template>
  <div class="card">
    <div class="card-header">
      <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">{{ t('dashboard.quickActions') }}</h2>
    </div>
    <div class="space-y-2 p-4">
      <button @click="router.push('/keys')" class="quick-action group card-inset flex w-full items-center gap-3 p-3 text-left">
        <div class="stat-icon stat-icon-primary h-8 w-8 flex-shrink-0 text-base">
          <Icon name="key" size="sm" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-medium text-gray-900 dark:text-white">{{ t('dashboard.createApiKey') }}</p>
          <p class="truncate text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.generateNewKey') }}</p>
        </div>
        <Icon
          name="chevronRight"
          size="sm"
          class="flex-shrink-0 text-gray-400 transition-colors duration-fast ease-apple-out group-hover:text-primary-500 dark:text-dark-500"
        />
      </button>

      <button @click="router.push('/usage')" class="quick-action group card-inset flex w-full items-center gap-3 p-3 text-left">
        <div class="stat-icon stat-icon-success h-8 w-8 flex-shrink-0 text-base">
          <Icon name="chart" size="sm" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-medium text-gray-900 dark:text-white">{{ t('dashboard.viewUsage') }}</p>
          <p class="truncate text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.checkDetailedLogs') }}</p>
        </div>
        <Icon
          name="chevronRight"
          size="sm"
          class="flex-shrink-0 text-gray-400 transition-colors duration-fast ease-apple-out group-hover:text-green-500 dark:text-dark-500"
        />
      </button>

      <button v-if="canUseBatchImage" @click="router.push('/batch-image')" class="quick-action group card-inset flex w-full items-center gap-3 p-3 text-left">
        <div class="stat-icon h-8 w-8 flex-shrink-0 bg-cyan-100 text-base text-cyan-400 dark:bg-cyan-900/30 dark:text-cyan-300">
          <Icon name="sparkles" size="sm" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-medium text-gray-900 dark:text-white">{{ t('dashboard.batchImageAgent') }}</p>
          <p class="truncate text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.batchImageAgentDesc') }}</p>
        </div>
        <Icon
          name="chevronRight"
          size="sm"
          class="flex-shrink-0 text-gray-400 transition-colors duration-fast ease-apple-out group-hover:text-cyan-400 dark:text-dark-500"
        />
      </button>

      <button @click="router.push('/redeem')" class="quick-action group card-inset flex w-full items-center gap-3 p-3 text-left">
        <div class="stat-icon stat-icon-warning h-8 w-8 flex-shrink-0 text-base">
          <Icon name="gift" size="sm" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-medium text-gray-900 dark:text-white">{{ t('dashboard.redeemCode') }}</p>
          <p class="truncate text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.addBalanceWithCode') }}</p>
        </div>
        <Icon
          name="chevronRight"
          size="sm"
          class="flex-shrink-0 text-gray-400 transition-colors duration-fast ease-apple-out group-hover:text-orange-500 dark:text-dark-500"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
const router = useRouter()
const { t } = useI18n()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

onMounted(() => {
  void refreshBatchImageAccess()
})
</script>

<style scoped>
/* 反馈落在 pointer-down：等释放才响应会显得迟钝 */
.quick-action {
  transition:
    background-color 240ms var(--ease-out),
    transform 100ms var(--ease-out);
}

.quick-action:hover {
  background-color: var(--accent-tint);
}

.quick-action:active {
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .quick-action,
  .quick-action:active {
    transform: none;
  }
}
</style>
