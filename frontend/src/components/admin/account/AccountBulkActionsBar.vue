<template>
  <div
    class="account-bulk-bar"
    :class="selectedIds.length > 0 ? 'account-bulk-bar--selected' : 'account-bulk-bar--idle'"
  >
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <span v-if="selectedIds.length > 0" class="text-sm font-medium text-primary-900 dark:text-primary-100">
        {{ t('admin.accounts.bulkActions.selected', { count: selectedIds.length }) }}
      </span>
      <span v-else class="text-sm font-medium text-primary-900 dark:text-primary-100">
        {{ t('admin.accounts.bulkEdit.title') }}
      </span>
      <template v-if="selectedIds.length > 0">
      <button
        @click="$emit('select-page')"
        class="text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
      >
        {{ t('admin.accounts.bulkActions.selectCurrentPage') }}
      </button>
      <span class="account-bulk-divider" aria-hidden="true"></span>
      <button
        @click="$emit('clear')"
        class="text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
      >
        {{ t('admin.accounts.bulkActions.clear') }}
      </button>
      </template>
    </div>
    <div class="account-bulk-actions">
      <template v-if="selectedIds.length > 0">
        <button @click="$emit('delete')" class="btn btn-danger btn-sm">{{ t('admin.accounts.bulkActions.delete') }}</button>
        <button @click="$emit('reset-status')" class="btn btn-secondary btn-sm">{{ t('admin.accounts.bulkActions.resetStatus') }}</button>
        <button @click="$emit('refresh-token')" class="btn btn-secondary btn-sm">{{ t('admin.accounts.bulkActions.refreshToken') }}</button>
        <button @click="$emit('probe-upstream-billing')" class="btn btn-secondary btn-sm">{{ t('admin.accounts.bulkActions.probeUpstreamBilling') }}</button>
        <button @click="$emit('toggle-schedulable', true)" class="btn btn-success btn-sm">{{ t('admin.accounts.bulkActions.enableScheduling') }}</button>
        <button @click="$emit('toggle-schedulable', false)" class="btn btn-warning btn-sm">{{ t('admin.accounts.bulkActions.disableScheduling') }}</button>
        <button @click="$emit('edit-selected')" class="btn btn-primary btn-sm">{{ t('admin.accounts.bulkActions.edit') }}</button>
      </template>
      <button @click="$emit('edit-filtered')" class="btn btn-primary btn-sm">
        {{ t('admin.accounts.bulkEdit.submit') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ selectedIds: number[] }>()
defineEmits([
  'delete',
  'edit-selected',
  'edit-filtered',
  'clear',
  'select-page',
  'toggle-schedulable',
  'reset-status',
  'refresh-token',
  'probe-upstream-billing'
])

const { t } = useI18n()
</script>

<style scoped>
.account-bulk-bar {
  @apply flex flex-wrap items-center justify-between gap-3 px-5 py-1.5;
  @apply border-b border-black/[0.06] dark:border-white/[0.08];
  transition:
    background-color 220ms cubic-bezier(0.32, 0.72, 0, 1),
    border-color 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.account-bulk-bar--selected {
  @apply bg-primary-50/80 dark:bg-primary-900/20;
}

.account-bulk-bar--idle {
  @apply bg-gray-50/60 dark:bg-dark-900/60;
}

.account-bulk-divider {
  @apply h-4 w-px bg-primary-200 dark:bg-primary-800;
}

.account-bulk-actions {
  @apply flex flex-wrap items-center justify-end gap-2;
}

.account-bulk-actions :deep(.btn) {
  min-height: 2rem;
}

@media (max-width: 767px) {
  .account-bulk-bar {
    @apply rounded-2xl border px-4 py-3;
  }

  .account-bulk-actions {
    @apply w-full justify-start;
  }
}
</style>
