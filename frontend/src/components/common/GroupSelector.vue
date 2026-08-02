<template>
  <div>
    <label class="input-label">
      {{ t('admin.users.groups') }}
      <span class="tabular font-normal text-gray-400">{{ t('common.selectedCount', { count: modelValue.length }) }}</span>
    </label>
    <!-- 沉降井：弹窗外壳本身是玻璃，内嵌面板走 .card-inset 而不是再叠一层半透明 -->
    <div class="card-inset overflow-hidden">
      <div v-if="isSearchable" class="hairline-bottom flex items-center gap-2 px-3 py-2">
        <Icon name="search" size="sm" class="shrink-0 text-gray-400" />
        <input
          v-model="searchText"
          type="text"
          :placeholder="t('common.searchPlaceholder')"
          class="group-search-input flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>
      <div class="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto p-2">
        <label
          v-for="group in filteredGroups"
          :key="group.id"
          class="group-option flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 active:scale-[0.98]"
          :title="t('admin.groups.rateAndAccounts', { rate: group.rate_multiplier, count: group.account_count || 0 })"
        >
          <input
            type="checkbox"
            :value="group.id"
            :checked="modelValue.includes(group.id)"
            @change="handleChange(group.id, ($event.target as HTMLInputElement).checked)"
            class="group-checkbox shrink-0"
          />
          <GroupBadge
            :name="group.name"
            :platform="group.platform"
            :subscription-type="group.subscription_type"
            :rate-multiplier="group.rate_multiplier"
            class="min-w-0 flex-1"
          />
          <span class="tabular shrink-0 text-xs text-gray-400">{{ group.account_count || 0 }}</span>
        </label>
        <div
          v-if="filteredGroups.length === 0"
          class="col-span-2 py-2 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {{ t('common.noGroupsAvailable') }}
        </div>
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
.hairline-bottom {
  box-shadow: inset 0 -0.5px 0 var(--separator);
}

.group-search-input {
  color: var(--label);
}

.group-search-input::placeholder {
  color: var(--label-tertiary);
}

/* 井内选项 hover 抬到实色表面，读作从沉降底浮起来 */
.group-option {
  transition:
    background-color 240ms var(--ease-out),
    transform 100ms var(--ease-out);
}

.group-option:hover {
  background-color: var(--surface);
}

/* 原生勾选框跟随强调色（项目未装 @tailwindcss/forms） */
.group-checkbox {
  width: 0.875rem;
  height: 0.875rem;
  cursor: pointer;
  accent-color: var(--accent);
  border-radius: 4px;
}

.group-checkbox:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3.5px var(--accent-tint-strong),
    0 0 0 1px var(--accent);
}
</style>
