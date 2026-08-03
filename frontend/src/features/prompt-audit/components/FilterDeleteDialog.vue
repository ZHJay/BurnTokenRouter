<template>
  <BaseDialog :show="show" :title="t('admin.promptAudit.events.filterDeleteDialogTitle')" width="wide" @close="$emit('close')">
    <div class="space-y-5 text-sm">
      <p class="text-gray-500 dark:text-dark-300">{{ t('admin.promptAudit.events.filterDeleteDialogDesc') }}</p>

      <fieldset>
        <legend class="text-xs font-medium text-gray-600 dark:text-dark-200">{{ t('admin.promptAudit.events.filterTimeRange') }}</legend>
        <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" :aria-label="t('admin.promptAudit.events.filterTimeRange')">
          <label
            v-for="option in DELETE_RANGE_PRESETS"
            :key="option.id"
            class="cursor-pointer"
          >
            <input v-model="preset" type="radio" name="prompt-delete-range" :value="option.id" class="peer sr-only" :data-test="`range-preset-${option.id}`" @change="criteriaChanged" />
            <!-- 危险区选中态保持红色语义：这是删除范围，不是普通筛选 -->
            <span class="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 shadow-[inset_0_0_0_0.5px_var(--hairline)] transition-colors duration-fast ease-apple-out peer-checked:bg-red-50 peer-checked:text-red-700 peer-checked:shadow-[inset_0_0_0_1px_theme(colors.red.500)] peer-focus-visible:ring-2 peer-focus-visible:ring-red-500/30 dark:text-dark-300 dark:peer-checked:bg-red-950/40 dark:peer-checked:text-red-300">
              {{ t(`admin.promptAudit.events.timePresets.${option.id}`) }}
            </span>
          </label>
        </div>
        <p class="mt-2 text-xs text-gray-500 dark:text-dark-400">{{ t('admin.promptAudit.events.filterTimeRangeHint') }}</p>
        <div v-if="preset === 'custom'" class="mt-3 grid gap-3 sm:grid-cols-2" data-test="custom-range">
          <!-- 这两个字段刻意保留原生 datetime-local，而不是换成 DateRangePicker：
               这个对话框划定的是一次**不可逆批量删除**的确切边界。显式录入的时间戳
               比预设驱动的区间更安全 —— 用户看到并确认的就是发给后端的那两个值，
               中间没有"最近 7 天"这类会随打开时刻漂移的间接层。原生控件同时免费
               带来键盘录入与本地化格式（locale 决定 mm/dd 还是 dd/mm）。
               在这唯一的不可回头处，精度优先于视觉一致性。

               另一条硬约束：DateRangePicker 只产出 YYYY-MM-DD，而
               hasExplicitDeleteRange / resolveDeleteRangeFilters 之后要把值交给
               new Date() —— 日期串按 UTC 解析、datetime-local 串按本地时区解析，
               两者混用会让"自定义区间"与预设区间的时区语义不一致。
               color-scheme 已由 style.css 的 .dark .input[type='datetime-local'] 处理。 -->
          <label class="block">
            <span class="input-label">{{ t('admin.promptAudit.events.startAt') }}</span>
            <input v-model="local.start_at" type="datetime-local" class="input h-9 w-full" :aria-label="t('admin.promptAudit.events.startAt')" @change="criteriaChanged" />
          </label>
          <label class="block">
            <span class="input-label">{{ t('admin.promptAudit.events.endAt') }}</span>
            <input v-model="local.end_at" type="datetime-local" class="input h-9 w-full" :aria-label="t('admin.promptAudit.events.endAt')" @change="criteriaChanged" />
          </label>
          <p v-if="!canPreview" class="text-xs sm:col-span-2" :style="{ color: 'var(--sys-red)' }">{{ t('admin.promptAudit.events.customRangeInvalid') }}</p>
        </div>
      </fieldset>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="input-label">{{ t('admin.promptAudit.events.decision') }}</span>
          <Select
            :model-value="local.decision"
            :options="decisionSelectOptions"
            :aria-label="t('admin.promptAudit.events.decision')"
            data-test="delete-decision"
            @update:model-value="setCriteria('decision', $event)"
          />
        </label>
        <label class="block">
          <span class="input-label">{{ t('admin.promptAudit.events.risk') }}</span>
          <Select
            :model-value="local.risk_level"
            :options="riskSelectOptions"
            :aria-label="t('admin.promptAudit.events.risk')"
            data-test="delete-risk"
            @update:model-value="setCriteria('risk_level', $event)"
          />
        </label>
      </div>

      <details class="card-inset rounded-xl px-4 py-3" data-test="more-conditions">
        <summary class="cursor-pointer select-none text-xs font-medium text-gray-600 dark:text-dark-200">{{ t('admin.promptAudit.events.moreConditions') }}</summary>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="input-label">{{ t('admin.promptAudit.events.endpoint') }}</span>
            <input v-model="local.endpoint" type="text" class="input w-full" :aria-label="t('admin.promptAudit.events.endpoint')" @input="criteriaChanged" />
          </label>
          <label class="block">
            <span class="input-label">{{ t('admin.promptAudit.events.keyword') }}</span>
            <input v-model="local.keyword" type="text" class="input w-full" :aria-label="t('admin.promptAudit.events.keyword')" @input="criteriaChanged" />
          </label>
          <label class="block">
            <span class="input-label">{{ t('admin.promptAudit.events.groupId') }}</span>
            <input v-model="local.group_id" type="number" class="input w-full" :aria-label="t('admin.promptAudit.events.groupId')" @input="criteriaChanged" />
          </label>
          <label class="block">
            <span class="input-label">{{ t('admin.promptAudit.events.userId') }}</span>
            <input v-model="local.user_id" type="number" class="input w-full" :aria-label="t('admin.promptAudit.events.userId')" @input="criteriaChanged" />
          </label>
        </div>
      </details>

      <div
        v-if="preview"
        class="rounded-xl px-4 py-3"
        :style="{ background: 'rgb(255 59 48 / 0.1)', boxShadow: 'inset 0 0 0 0.5px var(--hairline)' }"
        data-test="delete-preview-result"
      >
        <p class="tabular text-sm font-semibold" :style="{ color: 'var(--sys-red)' }">{{ t('admin.promptAudit.events.filterDeleteCount', { count: preview.matched_count }) }}</p>
        <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-dark-300">
          <dt>{{ t('admin.promptAudit.events.snapshotMax') }}</dt>
          <dd class="tabular">{{ preview.snapshot_max_id }}</dd>
          <dt>Filter SHA-256</dt>
          <dd class="tabular break-all font-mono">{{ preview.filter_hash }}</dd>
          <dt>{{ t('admin.promptAudit.events.expiresAt') }}</dt>
          <dd class="tabular">{{ formatDate(preview.expires_at) }}</dd>
        </dl>
        <p
          class="mt-2 rounded-lg px-3 py-2 text-xs"
          :style="{ background: 'rgb(255 149 0 / 0.14)', color: 'var(--sys-orange)' }"
        >{{ t('admin.promptAudit.events.filterDeleteWarning') }}</p>
      </div>
      <p v-else class="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-xs text-gray-500 dark:border-dark-600 dark:text-dark-400" data-test="delete-preview-empty">
        {{ t('admin.promptAudit.events.filterDeleteNeedPreview') }}
      </p>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-end gap-3">
        <p v-if="confirmDisabledReason" class="mr-auto text-xs text-gray-500 dark:text-dark-400" data-test="confirm-disabled-reason">
          {{ t(confirmDisabledReason) }}
        </p>
        <button type="button" class="btn btn-secondary" @click="$emit('close')">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-secondary" :disabled="!canPreview || previewing || deleting" data-test="run-delete-preview" @click="requestPreview">
          {{ previewing ? t('admin.promptAudit.events.filterDeletePreviewing') : t('admin.promptAudit.events.filterDeletePreviewAction') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="confirmDisabled"
          :title="confirmDisabledReason ? t(confirmDisabledReason) : undefined"
          data-test="confirm-filter-delete"
          @click="requestConfirm"
        >
          {{ deleting ? t('common.submitting') : t('admin.promptAudit.events.confirmFilterDelete') }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Select from '@/components/common/Select.vue'
import type { PromptDeletePreview, PromptEventFilters } from '../types'
import {
  DELETE_RANGE_PRESETS,
  cloneData,
  decisionOptions,
  emptyEventFilters,
  hasExplicitDeleteRange,
  resolveDeleteRangeFilters,
  riskOptions,
  type DeleteRangePreset,
} from '../viewModel'

const props = defineProps<{
  show: boolean
  initialFilters: PromptEventFilters
  preview: PromptDeletePreview | null
  previewing: boolean
  deleting: boolean
}>()
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'preview', value: PromptEventFilters): void
  (event: 'confirm', value: PromptEventFilters): void
  (event: 'criteria-change'): void
}>()
const { t, locale } = useI18n()

const preset = ref<DeleteRangePreset>('7d')
const local = reactive<PromptEventFilters>(emptyEventFilters())
const decisionSelectOptions = computed(() => decisionOptions(t))
const riskSelectOptions = computed(() => riskOptions(t))

// Select's payload is loosely typed (string | number | boolean | null) while the
// criteria object is all strings; normalise on the way in and keep the old
// <select> behaviour of invalidating a stale preview on every pick.
function setCriteria(key: 'decision' | 'risk_level', value: string | number | boolean | null) {
  local[key] = value == null ? '' : String(value)
  criteriaChanged()
}

watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    const initial = cloneData(props.initialFilters)
    // Only inherit an explicit list-filter range; otherwise default to the
    // seven-day preset so a careless click can never target everything.
    preset.value = hasExplicitDeleteRange(initial) ? 'custom' : '7d'
    Object.assign(local, initial)
  },
  { immediate: true },
)

const canPreview = computed(() => preset.value !== 'custom' || hasExplicitDeleteRange(local))

// One-click flow: a valid criteria selection is enough to confirm — the parent
// mints the server-side confirmation token on the fly. The button stays
// disabled only when the range is invalid, work is in flight, or a fresh
// preview already proved there is nothing to delete.
const confirmDisabled = computed(
  () => !canPreview.value || props.previewing || props.deleting || (props.preview !== null && props.preview.matched_count === 0),
)
const confirmDisabledReason = computed(() => {
  if (props.previewing || props.deleting) return ''
  if (!canPreview.value) return 'admin.promptAudit.events.filterDeleteConfirmInvalidRange'
  if (props.preview && props.preview.matched_count === 0) return 'admin.promptAudit.events.filterDeleteConfirmNoMatches'
  return ''
})

function criteriaChanged() {
  emit('criteria-change')
}
function requestPreview() {
  if (!canPreview.value) return
  emit('preview', resolveDeleteRangeFilters(local, preset.value))
}
function requestConfirm() {
  if (confirmDisabled.value) return
  emit('confirm', resolveDeleteRangeFilters(local, preset.value))
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}
</script>
