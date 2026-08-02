<script setup lang="ts">
import { QUOTA_THRESHOLD_TYPE_FIXED, QUOTA_THRESHOLD_TYPE_PERCENTAGE, type QuotaThresholdType } from '@/constants/account'

defineProps<{
  enabled: boolean | null
  threshold: number | null
  thresholdType: QuotaThresholdType | null
}>()

const emit = defineEmits<{
  'update:enabled': [value: boolean | null]
  'update:threshold': [value: number | null]
  'update:thresholdType': [value: QuotaThresholdType | null]
}>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      @click="emit('update:enabled', !enabled)"
      :class="[
        'switch h-5 w-9 flex-shrink-0 focus-visible:outline-none focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)]',
        enabled && 'switch-active'
      ]"
    >
      <!-- 尺寸比标准 switch 小一档，thumb 位移随之收窄。
           .switch-active .switch-thumb 是双类选择器（0-2-0），单类工具类压不过，
           故位移用 ! 提权。 -->
      <span
        :class="[
          'switch-thumb pointer-events-none h-4 w-4',
          enabled ? '!translate-x-4' : 'translate-x-0'
        ]"
      />
    </button>
    <template v-if="enabled">
      <input
        :value="threshold"
        @input="emit('update:threshold', parseFloat(($event.target as HTMLInputElement).value) || null)"
        type="number"
        min="0"
        :max="thresholdType === QUOTA_THRESHOLD_TYPE_PERCENTAGE ? 100 : undefined"
        :step="thresholdType === QUOTA_THRESHOLD_TYPE_PERCENTAGE ? 1 : 0.01"
        class="input py-1 text-sm flex-1 min-w-0"
      />
      <select
        :value="thresholdType || QUOTA_THRESHOLD_TYPE_FIXED"
        @change="emit('update:thresholdType', ($event.target as HTMLSelectElement).value as QuotaThresholdType)"
        class="input py-1 text-xs w-[4.5rem] flex-shrink-0 text-center"
      >
        <option :value="QUOTA_THRESHOLD_TYPE_FIXED">$</option>
        <option :value="QUOTA_THRESHOLD_TYPE_PERCENTAGE">%</option>
      </select>
    </template>
  </div>
</template>
