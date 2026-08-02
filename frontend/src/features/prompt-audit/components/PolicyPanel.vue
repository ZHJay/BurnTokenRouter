<template>
  <section aria-labelledby="prompt-policy-title" class="py-6">
    <div>
      <h2 id="prompt-policy-title" class="text-base font-semibold text-gray-950 dark:text-white">{{ t('admin.promptAudit.policy.title') }}</h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-dark-300">{{ t('admin.promptAudit.policy.description') }}</p>
    </div>

    <div class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
      <div class="card p-4 sm:p-5">
        <fieldset>
          <legend class="text-sm font-medium text-gray-900 dark:text-white">{{ t('admin.promptAudit.policy.scope') }}</legend>
          <div class="mt-3 flex flex-wrap gap-5 text-sm text-gray-700 dark:text-dark-200">
            <label class="flex items-center gap-2">
              <input type="radio" name="prompt-audit-scope" :checked="draft.all_groups" @change="patch({ all_groups: true, group_ids: [] })" />
              {{ t('admin.promptAudit.policy.allGroups') }}
            </label>
            <label class="flex items-center gap-2">
              <input type="radio" name="prompt-audit-scope" :checked="!draft.all_groups" @change="patch({ all_groups: false })" />
              {{ t('admin.promptAudit.policy.selectedGroups') }}
            </label>
          </div>
        </fieldset>

        <div v-if="!draft.all_groups" class="mt-4">
          <label class="block text-sm text-gray-700 dark:text-dark-200">
            <span>{{ t('admin.promptAudit.policy.searchGroups') }}</span>
            <input v-model="groupSearch" type="search" class="input mt-1.5 w-full" :aria-label="t('admin.promptAudit.policy.searchGroups')" />
          </label>
          <div class="card-inset mt-3 max-h-52 overflow-y-auto p-2">
            <label v-for="group in filteredGroups" :key="group.id" class="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-[background-color,color,transform] duration-instant ease-apple-out active:scale-[0.98] hover:bg-[var(--surface-hover)]">
              <span class="flex items-center gap-2 text-gray-800 dark:text-dark-100">
                <input type="checkbox" :checked="draft.group_ids.includes(group.id)" @change="toggleGroup(group.id)" />
                {{ group.name }}
              </span>
              <span class="text-xs text-gray-500 dark:text-dark-400">{{ group.platform }} · {{ group.status }}</span>
            </label>
            <p v-if="filteredGroups.length === 0" class="px-2 py-4 text-center text-sm text-gray-500">{{ t('admin.promptAudit.policy.noGroups') }}</p>
          </div>
          <div
            v-if="missingGroupIds.length"
            class="tabular mt-3 rounded-lg px-3 py-2 text-sm"
            :style="{ background: 'rgb(255 149 0 / 0.12)', color: 'var(--sys-orange)' }"
          >
            {{ t('admin.promptAudit.policy.missingGroups') }}: {{ missingGroupIds.join(', ') }}
          </div>
          <p class="tabular mt-2 text-xs text-gray-500 dark:text-dark-400">{{ t('admin.promptAudit.policy.selectedCount', { count: draft.group_ids.length }) }}</p>
        </div>

        <fieldset class="mt-5 pt-5 shadow-[inset_0_0.5px_0_var(--separator)]">
          <legend class="text-sm font-medium text-gray-900 dark:text-white">{{ t('admin.promptAudit.policy.scanners') }}</legend>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            <label v-for="scanner in SCANNER_CATALOG" :key="scanner.id" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 transition-colors duration-instant ease-apple-out hover:bg-[var(--surface-hover)] dark:text-dark-200">
              <input type="checkbox" :checked="draft.scanners.includes(scanner.id)" :aria-label="scannerLabel(scanner.id)" @change="toggleScanner(scanner.id)" />
              <span>{{ scannerLabel(scanner.id) }}</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div class="card space-y-4 p-4 sm:p-5">
        <label class="block text-sm text-gray-700 dark:text-dark-200">
          <span>{{ t('admin.promptAudit.policy.workerCount') }}</span>
          <input :value="draft.worker_count" type="number" min="1" max="32" class="input mt-1.5 w-full" :aria-label="t('admin.promptAudit.policy.workerCount')" @input="patch({ worker_count: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <label class="block text-sm text-gray-700 dark:text-dark-200">
          <span>{{ t('admin.promptAudit.policy.queueCapacity') }}</span>
          <input :value="draft.queue_capacity" type="number" min="1" max="100000" class="input mt-1.5 w-full" :aria-label="t('admin.promptAudit.policy.queueCapacity')" @input="patch({ queue_capacity: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <div class="card-inset px-4 py-3 text-sm text-gray-600 dark:text-dark-300">
          <p class="font-medium text-gray-800 dark:text-dark-100">{{ t('admin.promptAudit.policy.strategy') }}</p>
          <p class="mt-1">priority · {{ t('admin.promptAudit.policy.strategyHint') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PromptAuditDraft, PromptAuditGroup } from '../types'
import { cloneData, SCANNER_CATALOG } from '../viewModel'

const props = defineProps<{ draft: PromptAuditDraft; groups: PromptAuditGroup[] }>()
const emit = defineEmits<{ (event: 'update:draft', value: PromptAuditDraft): void }>()
const { t } = useI18n()
const groupSearch = ref('')

const filteredGroups = computed(() => {
  const query = groupSearch.value.trim().toLowerCase()
  if (!query) return props.groups
  return props.groups.filter((group) => `${group.name} ${group.id} ${group.platform}`.toLowerCase().includes(query))
})
const knownGroupIds = computed(() => new Set(props.groups.map((group) => group.id)))
const missingGroupIds = computed(() => props.draft.group_ids.filter((id) => !knownGroupIds.value.has(id)))

function patch(value: Partial<PromptAuditDraft>) {
  emit('update:draft', { ...cloneData(props.draft), ...value })
}
function toggleGroup(id: number) {
  const selected = new Set(props.draft.group_ids)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  patch({ group_ids: [...selected].sort((a, b) => a - b) })
}
function toggleScanner(id: string) {
  const selected = new Set(props.draft.scanners)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  patch({ scanners: SCANNER_CATALOG.map((item) => item.id).filter((item) => selected.has(item)) })
}
function scannerLabel(id: string): string {
  return t(`admin.promptAudit.scanners.${id}`)
}
</script>
