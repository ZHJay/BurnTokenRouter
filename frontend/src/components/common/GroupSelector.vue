<template>
  <div>
    <label class="gs-label">
      {{ t('admin.users.groups') }}
      <span class="font-normal text-gray-400">{{ t('common.selectedCount', { count: modelValue.length }) }}</span>
    </label>
    <div
      v-if="isSearchable"
      class="gs-search"
    >
      <Icon name="search" size="sm" class="gs-search-icon" />
      <input
        v-model="searchText"
        type="text"
        :placeholder="t('common.searchPlaceholder')"
        class="gs-search-input"
      />
    </div>
    <div
      class="gs-list"
      :class="{ 'gs-list-searchable': isSearchable }"
    >
      <label
        v-for="group in filteredGroups"
        :key="group.id"
        class="gs-item"
        :title="t('admin.groups.rateAndAccounts', { rate: group.rate_multiplier, count: group.account_count || 0 })"
      >
        <input
          type="checkbox"
          :value="group.id"
          :checked="modelValue.includes(group.id)"
          @change="handleChange(group.id, ($event.target as HTMLInputElement).checked)"
          class="gs-checkbox"
        />
        <GroupBadge
          :name="group.name"
          :platform="group.platform"
          :subscription-type="group.subscription_type"
          :rate-multiplier="group.rate_multiplier"
          class="min-w-0 flex-1"
        />
        <span class="shrink-0 text-xs text-gray-400">{{ group.account_count || 0 }}</span>
      </label>
      <div
        v-if="filteredGroups.length === 0"
        class="gs-empty"
      >
        {{ t('common.noGroupsAvailable') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GroupBadge from './GroupBadge.vue'
import Icon from '@/components/icons/Icon.vue'
import type { AdminGroup, GroupPlatform } from '@/types'

const { t } = useI18n()

interface Props {
  modelValue: number[]
  groups: AdminGroup[]
  platform?: GroupPlatform // Optional platform filter
  mixedScheduling?: boolean // For antigravity accounts: allow anthropic/gemini groups
  searchable?: boolean | 'auto'
}

const props = withDefaults(defineProps<Props>(), {
  searchable: 'auto'
})
const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const searchText = ref('')

const isSearchable = computed(() => {
  if (props.searchable === 'auto') return props.groups.length > 5
  return props.searchable
})

// Filter groups by platform if specified
const filteredGroups = computed(() => {
  let result: AdminGroup[] = props.groups
  if (props.platform) {
    // antigravity 账户启用混合调度后，可选择 anthropic/gemini 分组
    if (props.platform === 'antigravity' && props.mixedScheduling) {
      result = result.filter(
        (g) => g.platform === 'antigravity' || g.platform === 'anthropic' || g.platform === 'gemini' || g.platform === 'composite'
      )
    } else {
      // 默认：只能选择同 platform 的分组；composite 分组可接收任意具体平台账号
      result = result.filter((g) => g.platform === props.platform || g.platform === 'composite')
    }
  }
  if (isSearchable.value && searchText.value) {
    const q = searchText.value.toLowerCase()
    result = result.filter(
      (g) => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    )
  }
  return result
})

const handleChange = (groupId: number, checked: boolean) => {
  const newValue = checked
    ? [...props.modelValue, groupId]
    : props.modelValue.filter((id) => id !== groupId)
  emit('update:modelValue', newValue)
}
</script>

<style scoped>
.gs-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.gs-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 0.5px solid var(--separator-strong);
  border-bottom: none;
  border-radius: var(--r-md) var(--r-md) 0 0;
  background: var(--fill);
}

.gs-search-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.gs-search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--text-primary);
  font-family: inherit;
}

.gs-search-input::placeholder {
  color: var(--text-tertiary);
}

.gs-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  max-height: 128px;
  overflow-y: auto;
  padding: 8px;
  border: 0.5px solid var(--separator-strong);
  border-radius: var(--r-md);
  background: var(--fill);
}

.gs-list-searchable {
  border-radius: 0 0 var(--r-md) var(--r-md);
  border-top: none;
}

.gs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: var(--r-sm);
  padding: 6px 8px;
  cursor: pointer;
  transition: background 0.15s var(--ease);
}

.gs-item:hover {
  background: var(--bg-elevated);
}

.gs-checkbox {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  accent-color: var(--blue);
  border-radius: 4px;
}

.gs-empty {
  grid-column: span 2;
  padding: 8px;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
