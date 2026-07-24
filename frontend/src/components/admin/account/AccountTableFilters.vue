<template>
  <div class="account-table-filters">
    <SearchInput
      :model-value="searchQuery"
      :placeholder="t('admin.accounts.searchAccounts')"
      class="account-filter-search"
      @update:model-value="$emit('update:searchQuery', $event)"
      @search="$emit('change')"
    />

    <Select
      :model-value="filters.group"
      class="account-filter-select account-filter-select--primary"
      data-filter="group"
      :aria-label="t('admin.accounts.allGroups')"
      :options="gOpts"
      @update:model-value="updateGroup"
      @change="$emit('change')"
    />
    <Select
      :model-value="filters.status"
      class="account-filter-select account-filter-select--primary"
      data-filter="status"
      :aria-label="t('admin.accounts.allStatus')"
      :options="sOpts"
      @update:model-value="updateStatus"
      @change="$emit('change')"
    />

    <button
      type="button"
      class="account-advanced-filters-toggle"
      data-test="account-advanced-filters-toggle"
      :aria-expanded="showAdvancedFilters"
      @click="showAdvancedFilters = !showAdvancedFilters"
    >
      <Icon name="filter" size="sm" />
      <span>{{ t('common.filter') }}</span>
      <span v-if="activeAdvancedFilterCount" class="account-advanced-filters-count">
        {{ activeAdvancedFilterCount }}
      </span>
      <Icon
        name="chevronDown"
        size="xs"
        class="transition-transform duration-200"
        :class="showAdvancedFilters ? 'rotate-180' : ''"
      />
    </button>

    <Transition name="account-advanced-filters">
      <div v-if="showAdvancedFilters" class="account-advanced-filters" data-test="account-advanced-filters">
        <Select
          :model-value="filters.platform"
          class="account-filter-select"
          data-filter="platform"
          :aria-label="t('admin.accounts.allPlatforms')"
          :options="pOpts"
          @update:model-value="updatePlatform"
          @change="$emit('change')"
        />
        <Select
          :model-value="filters.type"
          class="account-filter-select"
          data-filter="type"
          :aria-label="t('admin.accounts.allTypes')"
          :options="tOpts"
          @update:model-value="updateType"
          @change="$emit('change')"
        />
        <Select
          :model-value="filters.privacy_mode"
          class="account-filter-select"
          data-filter="privacy"
          :aria-label="t('admin.accounts.allPrivacyModes')"
          :options="privacyOpts"
          @update:model-value="updatePrivacyMode"
          @change="$emit('change')"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import Select from '@/components/common/Select.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import type { AdminGroup } from '@/types'

const props = defineProps<{
  searchQuery: string
  filters: Record<string, any>
  groups?: AdminGroup[]
}>()

const emit = defineEmits(['update:searchQuery', 'update:filters', 'change'])
const { t } = useI18n()
const showAdvancedFilters = ref(
  Boolean(props.filters.platform || props.filters.type || props.filters.privacy_mode)
)

const updatePlatform = (value: string | number | boolean | null) => {
  emit('update:filters', { ...props.filters, platform: value })
}
const updateType = (value: string | number | boolean | null) => {
  emit('update:filters', { ...props.filters, type: value })
}
const updateStatus = (value: string | number | boolean | null) => {
  emit('update:filters', { ...props.filters, status: value })
}
const updatePrivacyMode = (value: string | number | boolean | null) => {
  emit('update:filters', { ...props.filters, privacy_mode: value })
}
const updateGroup = (value: string | number | boolean | null) => {
  emit('update:filters', { ...props.filters, group: value })
}

const activeAdvancedFilterCount = computed(() =>
  [props.filters.platform, props.filters.type, props.filters.privacy_mode].filter(Boolean).length
)

const pOpts = computed(() => [
  { value: '', label: t('admin.accounts.allPlatforms') },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'grok', label: 'Grok' }
])
const tOpts = computed(() => [
  { value: '', label: t('admin.accounts.allTypes') },
  { value: 'oauth', label: t('admin.accounts.oauthType') },
  { value: 'setup-token', label: t('admin.accounts.setupToken') },
  { value: 'apikey', label: t('admin.accounts.apiKey') },
  { value: 'bedrock', label: 'AWS Bedrock' }
])
const sOpts = computed(() => [
  { value: '', label: t('admin.accounts.allStatus') },
  { value: 'active', label: t('admin.accounts.status.active') },
  { value: 'inactive', label: t('admin.accounts.status.inactive') },
  { value: 'error', label: t('admin.accounts.status.error') },
  { value: 'rate_limited', label: t('admin.accounts.status.rateLimited') },
  { value: 'temp_unschedulable', label: t('admin.accounts.status.tempUnschedulable') },
  { value: 'unschedulable', label: t('admin.accounts.status.unschedulable') }
])
const privacyOpts = computed(() => [
  { value: '', label: t('admin.accounts.allPrivacyModes') },
  { value: '__unset__', label: t('admin.accounts.privacyUnset') },
  { value: 'training_off', label: 'Privacy' },
  { value: 'training_set_cf_blocked', label: 'CF' },
  { value: 'training_set_failed', label: 'Fail' }
])
const gOpts = computed(() => [
  { value: '', label: t('admin.accounts.allGroups') },
  { value: 'ungrouped', label: t('admin.accounts.ungroupedGroup') },
  ...(props.groups || []).map(group => ({ value: String(group.id), label: group.name }))
])
</script>

<style scoped>
.account-table-filters {
  @apply flex min-w-0 flex-1 flex-wrap items-center gap-2.5;
}

.account-filter-search {
  @apply w-full sm:w-64 lg:w-[16.25rem];
}

.account-filter-select {
  @apply w-[9.25rem] flex-none;
}

.account-filter-select--primary {
  @apply w-[8.75rem];
}

.account-advanced-filters-toggle {
  @apply inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3.5;
  @apply border border-black/[0.08] bg-white/80 text-[13px] font-medium text-gray-700 shadow-sm;
  @apply transition-colors hover:bg-black/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50;
  @apply dark:border-white/10 dark:bg-dark-800/75 dark:text-gray-200 dark:hover:bg-white/[0.08];
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
}

.account-advanced-filters-count {
  @apply inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-semibold text-white;
}

.account-advanced-filters {
  @apply flex w-full flex-wrap items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white/55 p-2.5;
  @apply dark:border-white/[0.08] dark:bg-dark-900/55;
}

.account-table-filters :deep(.input),
.account-table-filters :deep(.select-trigger) {
  min-height: 2.25rem;
  padding-top: 0.4375rem;
  padding-bottom: 0.4375rem;
  border-radius: 9999px;
  border-color: rgb(0 0 0 / 0.08);
  background: rgb(255 255 255 / 0.82);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.03);
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
}

/*
 * `:global(.dark) .account-table-filters :deep(...)` collapses to a bare
 * `.dark { ... }` rule under Vue's scoped-CSS transform (the descendant part
 * is dropped), so these dark overrides never applied and the light pill
 * backgrounds bled through in dark mode. Use `.dark` with a scope-preserving
 * descendant instead.
 */
.dark .account-table-filters :deep(.input),
.dark .account-table-filters :deep(.select-trigger) {
  border-color: var(--separator);
  background: rgba(44, 44, 46, 0.72);
  color: var(--text-primary);
  box-shadow: none;
}

.dark .account-table-filters :deep(.input)::placeholder {
  color: var(--text-tertiary);
}

.account-advanced-filters-enter-active,
.account-advanced-filters-leave-active {
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

.account-advanced-filters-enter-from,
.account-advanced-filters-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 639px) {
  .account-filter-select--primary,
  .account-advanced-filters-toggle {
    width: calc(50% - 0.3125rem);
  }

  .account-advanced-filters .account-filter-select {
    width: 100%;
  }
}
</style>
