<template>
  <section class="time-pricing">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="field min-w-0 flex-1 sm:max-w-sm">
        <label class="input-label">
          {{ t('admin.channels.form.timePricing') }}
        </label>
        <label class="input-hint">
          {{ t('admin.channels.form.timezone') }}
        </label>
        <Select
          :model-value="modelValue.timezone"
          :options="timezoneOptions"
          :aria-label="t('admin.channels.form.timezone')"
          searchable
          creatable
          class="mt-1 w-full"
          @update:model-value="updateTimezone"
        />
      </div>
      <button
        type="button"
        class="btn btn-secondary btn-sm self-start sm:self-end"
        data-testid="add-time-period"
        @click="addPeriod"
      >
        + {{ t('admin.channels.form.addTimePeriod') }}
      </button>
    </div>

    <div v-if="modelValue.periods.length > 0" class="mt-3 space-y-3">
      <div
        v-for="(period, index) in modelValue.periods"
        :key="index"
        class="time-pricing-period"
        :data-testid="`time-pricing-period-${index}`"
      >
        <div class="field min-w-0">
          <label :for="`${inputIdPrefix}-start-${index}`">
            {{ t('admin.channels.form.startTime') }}
          </label>
          <input
            :id="`${inputIdPrefix}-start-${index}`"
            :value="period.start_time"
            type="text"
            inputmode="numeric"
            maxlength="8"
            placeholder="HH:mm:ss"
            pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
            autocomplete="off"
            class="input mt-1 w-full text-sm"
            @input="updatePeriod(index, 'start_time', normalizeClockTime(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field min-w-0">
          <label :for="`${inputIdPrefix}-end-${index}`">
            {{ t('admin.channels.form.endTime') }}
          </label>
          <input
            :id="`${inputIdPrefix}-end-${index}`"
            :value="period.end_time"
            type="text"
            inputmode="numeric"
            maxlength="8"
            placeholder="HH:mm:ss"
            pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
            autocomplete="off"
            class="input mt-1 w-full text-sm"
            @input="updatePeriod(index, 'end_time', normalizeClockTime(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field min-w-0">
          <label :for="`${inputIdPrefix}-multiplier-${index}`">
            {{ t('admin.channels.form.multiplier') }}
          </label>
          <input
            :id="`${inputIdPrefix}-multiplier-${index}`"
            :value="period.multiplier"
            type="number"
            min="0.01"
            step="0.01"
            class="input mt-1 w-full text-sm"
            @input="updatePeriod(index, 'multiplier', ($event.target as HTMLInputElement).value)"
            @blur="formatMultiplier(index, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <button
          type="button"
          class="icon-btn danger"
          :title="t('admin.channels.form.removeTimePeriod')"
          :aria-label="t('admin.channels.form.removeTimePeriod')"
          :data-testid="`remove-time-period-${index}`"
          @click="removePeriod(index)"
        >
          <Icon name="trash" size="sm" />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getCurrentInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  COMMON_TIMEZONES,
  formatTimezoneOffset,
  isValidTimePricingMultiplier,
  type TimePricingFormEntry,
  type TimePricingPeriodFormEntry,
} from './types'

const { t } = useI18n()

const props = defineProps<{ modelValue: TimePricingFormEntry }>()
const emit = defineEmits<{ 'update:modelValue': [value: TimePricingFormEntry] }>()
const inputIdPrefix = `time-pricing-${getCurrentInstance()?.uid}`

const timezoneOptions = COMMON_TIMEZONES.map(value => {
  const offset = formatTimezoneOffset(value)
  return { value, label: offset ? `${value} (${offset})` : value }
})

function updateTimezone(value: string | number | boolean | null) {
  emit('update:modelValue', { ...props.modelValue, timezone: String(value ?? '') })
}

function normalizeClockTime(value: string): string {
  const normalized = value.replace(/：/g, ':')
  return normalized === '24:00:00' ? '00:00:00' : normalized
}

function addPeriod() {
  emit('update:modelValue', {
    ...props.modelValue,
    periods: [
      ...props.modelValue.periods,
      { start_time: '', end_time: '', multiplier: '1.00' },
    ],
  })
}

function updatePeriod(index: number, field: keyof TimePricingPeriodFormEntry, value: string) {
  const periods = props.modelValue.periods.map((period, current) =>
    current === index ? { ...period, [field]: value } : period)
  emit('update:modelValue', { ...props.modelValue, periods })
}

function formatMultiplier(index: number, value: string) {
  if (!isValidTimePricingMultiplier(value)) return
  updatePeriod(index, 'multiplier', Number(value).toFixed(2))
}

function removePeriod(index: number) {
  emit('update:modelValue', {
    ...props.modelValue,
    periods: props.modelValue.periods.filter((_period, current) => current !== index),
  })
}
</script>

<style scoped>
.time-pricing {
  margin-top: 14px;
  padding-top: 16px;
  border-top: 0.5px solid var(--separator);
}
.time-pricing .field { margin-bottom: 0; }
.time-pricing-period {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 36px;
  align-items: end;
  gap: 10px;
  padding: 14px;
  border: 0.5px solid var(--separator);
  border-radius: var(--r-md);
  background: var(--fill);
}
.danger:hover { color: var(--red); background: rgba(255, 59, 48, 0.1); }
@media (max-width: 640px) {
  .time-pricing-period { grid-template-columns: 1fr; }
}
</style>
