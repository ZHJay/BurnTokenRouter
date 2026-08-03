<template>
  <section aria-labelledby="prompt-events-title" class="py-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="prompt-events-title" class="text-base font-semibold text-gray-950 dark:text-white">{{ t('admin.promptAudit.events.title') }}</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-dark-300">{{ t('admin.promptAudit.events.description') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-secondary btn-sm" :disabled="selectedIds.length === 0" @click="$emit('batch-delete')">
          {{ t('admin.promptAudit.events.deleteSelected', { count: selectedIds.length }) }}
        </button>
        <!-- 描边红而不是实心红：这颗按钮只打开 FilterDeleteDialog 的预览，
             真正不可逆的提交是那个对话框里的实心 .btn-danger。style.css 的
             .btn-outline-danger 注释写明了这条升级链的分工。 -->
        <button type="button" class="btn btn-outline-danger btn-sm" data-test="filter-delete" @click="$emit('preview-delete')">
          {{ t('admin.promptAudit.events.deleteByFilter') }}
        </button>
      </div>
    </div>

    <!-- 12 格：11 个字段 + 1 格动作，在 2 / 3 / 6 列下分别是 6 / 4 / 2 整行，
         没有半行残留。原先 lg:grid-cols-4 xl:grid-cols-5 会把"结束时间"挤到
         单独一行（11 % 4 = 3，动作块的 sm:col-span-2 又放不进剩下的 1 格）。 -->
    <form class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" @submit.prevent="applyFilters">
      <label class="block">
        <span class="input-label">{{ t('admin.promptAudit.events.decision') }}</span>
        <Select
          :model-value="localFilters.decision"
          :options="decisionSelectOptions"
          :aria-label="t('admin.promptAudit.events.decision')"
          data-test="filter-decision"
          @update:model-value="setFilter('decision', $event)"
        />
      </label>
      <label class="block">
        <span class="input-label">{{ t('admin.promptAudit.events.risk') }}</span>
        <Select
          :model-value="localFilters.risk_level"
          :options="riskSelectOptions"
          :aria-label="t('admin.promptAudit.events.risk')"
          data-test="filter-risk"
          @update:model-value="setFilter('risk_level', $event)"
        />
      </label>
      <FilterInput v-model="localFilters.endpoint" :label="t('admin.promptAudit.events.endpoint')" @change="filtersChanged" />
      <FilterInput v-model="localFilters.group_id" :label="t('admin.promptAudit.events.groupId')" type="number" @change="filtersChanged" />
      <FilterInput v-model="localFilters.user_id" :label="t('admin.promptAudit.events.userId')" type="number" @change="filtersChanged" />
      <FilterInput v-model="localFilters.api_key_id" :label="t('admin.promptAudit.events.apiKeyId')" type="number" @change="filtersChanged" />
      <FilterInput v-model="localFilters.request_id" :label="t('admin.promptAudit.events.requestId')" @change="filtersChanged" />
      <FilterInput v-model="localFilters.prompt_hash" :label="t('admin.promptAudit.events.promptHash')" @change="filtersChanged" />
      <FilterInput v-model="localFilters.keyword" :label="t('admin.promptAudit.events.keyword')" @change="filtersChanged" />
      <!-- 这两个字段保持原生 datetime-local，没有换成 DateRangePicker。
           DateRangePicker 只产出日期（YYYY-MM-DD），而这条筛选链是分钟级的：
             · viewModel.toISO() 把值交给 new Date() 再 toISOString()，
               'YYYY-MM-DD' 按 UTC 解析、'YYYY-MM-DDTHH:mm' 按本地时区解析，
               同一天在 Asia/Shanghai 会差 8 小时（实测 -8h）；
             · 后端 parseTimeQuery 只认 RFC3339，SQL 是
               created_at >= start AND created_at <= end 的闭区间，不做任何
               "补到当天 23:59:59" 的展开。日期粒度的 end_at 因此等于当天
               00:00:00Z，会把用户选中的最后一天整天排除在外；
             · 表格本身以秒显示 created_at（timeStyle: 'medium'），同一秒内可以
               有多条事件 —— 事故复盘要框的是"某分钟前后"，不是"某天"。
           把精度降到日只会静默改变查询语义，所以两处都留原生控件。 -->
      <label class="block">
        <span class="input-label">{{ t('admin.promptAudit.events.startAt') }}</span>
        <input v-model="localFilters.start_at" type="datetime-local" class="input h-9 w-full" :aria-label="t('admin.promptAudit.events.startAt')" @change="filtersChanged" />
      </label>
      <label class="block">
        <span class="input-label">{{ t('admin.promptAudit.events.endAt') }}</span>
        <input v-model="localFilters.end_at" type="datetime-local" class="input h-9 w-full" :aria-label="t('admin.promptAudit.events.endAt')" @change="filtersChanged" />
      </label>
      <!-- 搜索/重置是这个筛选块的提交动作，不是表格行内控件，用整档 .btn。
           items-end 让它们与同行字段的输入框底边对齐（label 占了上面一行）。 -->
      <div class="flex items-end gap-2">
        <button type="submit" class="btn btn-primary">{{ t('common.search') }}</button>
        <button type="button" class="btn btn-ghost" @click="resetFilters">{{ t('common.reset') }}</button>
      </div>
    </form>
    <div
      v-if="error"
      role="alert"
      class="mt-4 rounded-lg px-4 py-3 text-sm"
      :style="{ background: 'rgb(255 59 48 / 0.1)', color: 'var(--sys-red)' }"
    >{{ error }}</div>
    <div class="card mt-5 overflow-x-auto">
      <table class="table min-w-[1120px]">
        <thead>
          <tr>
            <th class="w-10"><input type="checkbox" :checked="allSelected" :aria-label="t('admin.promptAudit.events.selectAll')" @change="toggleAll" /></th>
            <th>{{ t('admin.promptAudit.events.time') }}</th>
            <th>{{ t('admin.promptAudit.events.identity') }}</th>
            <th>{{ t('admin.promptAudit.events.group') }}</th>
            <th>{{ t('admin.promptAudit.events.route') }}</th>
            <th>{{ t('admin.promptAudit.events.result') }}</th>
            <th>{{ t('admin.promptAudit.events.preview') }}</th>
            <th class="text-right">{{ t('admin.promptAudit.common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="px-4 py-12 text-center text-gray-500" aria-busy="true">{{ t('common.loading') }}</td></tr>
          <tr v-else-if="events.length === 0"><td colspan="8" class="px-4 py-12 text-center text-gray-500">{{ t('admin.promptAudit.events.empty') }}</td></tr>
          <tr v-for="event in events" v-else :key="event.id" :data-test="`event-${event.id}`" class="align-top transition-colors duration-instant ease-apple-out hover:bg-[var(--surface-hover)]">
            <td><input type="checkbox" :checked="selectedIds.includes(event.id)" :aria-label="t('admin.promptAudit.events.selectEvent', { id: event.id })" @change="toggleOne(event.id)" /></td>
            <td class="tabular whitespace-nowrap text-xs text-gray-600 dark:text-dark-300">{{ formatDate(event.created_at) }}</td>
            <td>
              <CopyLine :label="t('admin.promptAudit.events.user')" :value="event.snapshot.username" />
              <CopyLine :label="t('admin.promptAudit.events.email')" :value="event.snapshot.user_email" />
              <CopyLine :label="t('admin.promptAudit.events.apiKey')" :value="event.snapshot.api_key_name" />
            </td>
            <td class="text-gray-700 dark:text-dark-200">{{ event.snapshot.group_name || '—' }}</td>
            <td>
              <p class="font-medium text-gray-900 dark:text-white">{{ event.snapshot.endpoint }}</p>
              <p class="mt-1 text-xs text-gray-500">{{ event.snapshot.model }} · {{ event.snapshot.protocol }} · {{ event.snapshot.stage || 'http' }}</p>
            </td>
            <td>
              <span class="badge" :class="decisionClass(event.decision)">{{ formatDecisionRisk(event.decision, event.risk_level) }}</span>
              <p class="mt-2 max-w-48 truncate text-xs text-gray-500" :title="formatCategories(event.categories)">{{ formatCategories(event.categories) }}</p>
            </td>
            <td class="max-w-xs"><p class="line-clamp-2 break-words text-gray-600 dark:text-dark-300">{{ event.snapshot.redacted_preview || '—' }}</p></td>
            <td class="whitespace-nowrap text-right">
              <button type="button" class="btn btn-ghost btn-sm" @click="$emit('view', event.id)">{{ t('common.view') }}</button>
              <button type="button" class="btn btn-ghost btn-sm text-red-600" @click="$emit('delete', event.id)">{{ t('common.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination :total="total" :page="page" :page-size="pageSize" @update:page="$emit('page', $event)" @update:page-size="$emit('page-size', $event)" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Pagination from '@/components/common/Pagination.vue'
import Select from '@/components/common/Select.vue'
import type { PromptAuditEvent, PromptEventFilters } from '../types'
import {
  cloneData,
  decisionOptions,
  DECISION_IDS,
  emptyEventFilters,
  riskOptions,
  RISK_LEVEL_IDS,
  SCANNER_CATALOG,
} from '../viewModel'

const props = defineProps<{
  events: PromptAuditEvent[]; total: number; page: number; pageSize: number
  filters: PromptEventFilters; selectedIds: number[]; loading: boolean; error: string
}>()
const emit = defineEmits<{
  (event: 'filters-change', value: PromptEventFilters): void
  (event: 'search', value: PromptEventFilters): void
  (event: 'selection', value: number[]): void
  (event: 'page', value: number): void
  (event: 'page-size', value: number): void
  (event: 'view', id: number): void
  (event: 'delete', id: number): void
  (event: 'batch-delete'): void
  (event: 'preview-delete'): void
}>()
const { t, locale } = useI18n()
const localFilters = reactive<PromptEventFilters>(cloneData(props.filters))
watch(() => props.filters, (value) => Object.assign(localFilters, cloneData(value)), { deep: true })
const allSelected = computed(() => props.events.length > 0 && props.events.every((event) => props.selectedIds.includes(event.id)))
const decisionSelectOptions = computed(() => decisionOptions(t))
const riskSelectOptions = computed(() => riskOptions(t))

/* Select emits string | number | boolean | null; PromptEventFilters is all
   strings. Normalising here (rather than v-model straight onto the field) keeps
   the filter object's type honest and preserves the old <select> behaviour of
   firing the change handler on every pick. */
function setFilter(key: 'decision' | 'risk_level', value: string | number | boolean | null) {
  localFilters[key] = value == null ? '' : String(value)
  filtersChanged()
}

const FilterInput = defineComponent({
  props: { modelValue: { type: String, required: true }, label: { type: String, required: true }, type: { type: String, default: 'text' } },
  emits: ['update:modelValue', 'change'],
  setup(componentProps, { emit: componentEmit }) {
    return () => h('label', { class: 'block' }, [
      h('span', { class: 'input-label' }, componentProps.label),
      h('input', {
        value: componentProps.modelValue, type: componentProps.type, class: 'input w-full', 'aria-label': componentProps.label,
        onInput: (event: Event) => componentEmit('update:modelValue', (event.target as HTMLInputElement).value),
        onChange: () => componentEmit('change'),
      }),
    ])
  },
})

const CopyLine = defineComponent({
  props: { label: { type: String, required: true }, value: { type: String, default: '' } },
  setup(componentProps) {
    return () => h('div', { class: 'flex max-w-56 items-center gap-1 text-xs' }, [
      h('span', { class: 'w-16 flex-none text-gray-500 dark:text-dark-400' }, componentProps.label),
      h('span', { class: 'min-w-0 flex-1 truncate text-gray-800 dark:text-dark-100' }, componentProps.value || '—'),
      componentProps.value ? h('button', {
        type: 'button',
        class: 'text-primary-600 transition-transform duration-instant ease-apple-out hover:underline active:scale-[0.96] dark:text-primary-400',
        'aria-label': `${t('common.copy')} ${componentProps.label}`,
        onClick: () => navigator.clipboard?.writeText(componentProps.value),
      }, t('common.copy')) : null,
    ])
  },
})

function filtersChanged() {
  emit('filters-change', cloneData(localFilters))
}
function applyFilters() {
  const value = cloneData(localFilters)
  emit('filters-change', value)
  emit('search', value)
}
function resetFilters() {
  Object.assign(localFilters, emptyEventFilters())
  applyFilters()
}
function toggleOne(id: number) {
  const selected = new Set(props.selectedIds)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  emit('selection', [...selected])
}
function toggleAll() {
  emit('selection', allSelected.value ? [] : props.events.map((event) => event.id))
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
}
function decisionClass(decision: string): string {
  if (decision === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
  if (decision === 'flag') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
}
const DECISIONS = new Set<string>(DECISION_IDS)
const RISK_LEVELS = new Set<string>(RISK_LEVEL_IDS)

function translateDecision(decision: string): string {
  return DECISIONS.has(decision) ? t(`admin.promptAudit.decisions.${decision}`) : decision
}
function translateRiskLevel(riskLevel: string): string {
  return RISK_LEVELS.has(riskLevel) ? t(`admin.promptAudit.riskLevels.${riskLevel}`) : riskLevel
}
function translateCategory(category: string): string {
  return SCANNER_CATALOG.some((scanner) => scanner.id === category)
    ? t(`admin.promptAudit.scanners.${category}`)
    : category
}
function formatDecisionRisk(decision: string, riskLevel: string): string {
  return `${translateDecision(decision)} · ${translateRiskLevel(riskLevel)}`
}
function formatCategories(categories: string[]): string {
  if (!categories.length) return '—'
  return categories.map(translateCategory).join(', ')
}
</script>
