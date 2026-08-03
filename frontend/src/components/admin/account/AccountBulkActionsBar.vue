<template>
  <!-- 批量操作条（原型基准）：pill 圆角 + --accent-tint 底 + 强调色计数 + 玻璃动作按钮。
       计数用 primary-800/300 而非裸 --accent：--accent 在这张 tint 底上只有 3.54:1，
       过不了 AA；primary-800 亮色 5.11:1、primary-300 暗色 7.25:1，同样读作强调色。 -->
  <div class="mb-4 flex items-center justify-between rounded-full bg-[var(--accent-tint)] py-2 pl-3.5 pr-2.5 shadow-[inset_0_0_0_0.5px_var(--hairline)]">
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="allResultsSelected" class="tabular text-sm font-semibold text-primary-800 dark:text-primary-300">
        {{ t('admin.accounts.bulkActions.selectedAll', { count: selectedIds.length }) }}
      </span>
      <span v-else-if="selectedIds.length > 0" class="tabular text-sm font-semibold text-primary-800 dark:text-primary-300">
        {{ t('admin.accounts.bulkActions.selected', { count: selectedIds.length }) }}
      </span>
      <span v-else class="text-sm font-semibold text-primary-800 dark:text-primary-300">
        {{ t('admin.accounts.bulkEdit.title') }}
      </span>
      <template v-if="selectedIds.length > 0">
        <button
          @click="$emit('select-page')"
          class="rounded-full text-xs font-medium tracking-[0.01em] text-primary-700 transition-[color,transform] duration-fast ease-apple-out hover:text-primary-800 focus-visible:outline-none focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)] active:scale-[0.96] dark:text-primary-300 dark:hover:text-primary-200"
        >
          {{ t('admin.accounts.bulkActions.selectCurrentPage') }}
        </button>
      </template>
      <template v-if="!allResultsSelected && totalResults > selectedIds.length">
        <span v-if="selectedIds.length > 0" class="text-gray-300 dark:text-primary-800">•</span>
        <button
          :disabled="selectingAll"
          @click="$emit('select-all-results')"
          class="rounded-full text-xs font-medium tracking-[0.01em] text-primary-700 transition-[color,transform] duration-fast ease-apple-out hover:text-primary-800 focus-visible:outline-none focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 dark:text-primary-300 dark:hover:text-primary-200"
        >
          {{
            selectingAll
              ? t('admin.accounts.bulkActions.selectingAll')
              : t('admin.accounts.bulkActions.selectAllResults', { count: totalResults })
          }}
        </button>
      </template>
      <template v-if="selectedIds.length > 0">
        <span class="text-gray-300 dark:text-primary-800">•</span>
        <button
          @click="$emit('clear')"
          class="rounded-full text-xs font-medium tracking-[0.01em] text-primary-700 transition-[color,transform] duration-fast ease-apple-out hover:text-primary-800 focus-visible:outline-none focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)] active:scale-[0.96] dark:text-primary-300 dark:hover:text-primary-200"
        >
          {{ t('admin.accounts.bulkActions.clear') }}
        </button>
      </template>
    </div>
    <div class="flex gap-2">
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

defineProps<{
  selectedIds: number[]
  totalResults: number
  selectingAll: boolean
  allResultsSelected: boolean
}>()

defineEmits([
  'delete',
  'edit-selected',
  'edit-filtered',
  'clear',
  'select-page',
  'select-all-results',
  'toggle-schedulable',
  'reset-status',
  'refresh-token',
  'probe-upstream-billing'
])

const { t } = useI18n()
</script>
