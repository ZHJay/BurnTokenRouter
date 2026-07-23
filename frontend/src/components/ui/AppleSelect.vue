<template>
  <div class="w-full">
    <label v-if="label" :for="fieldId" class="input-label">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <div class="relative">
      <select
        :id="fieldId"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        class="input appearance-none pr-10"
        :class="error ? 'input-error' : ''"
        @change="onChange"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="opt in normalizedOptions" :key="String(opt.value)" :value="opt.value">
          {{ opt.label }}
        </option>
        <slot />
      </select>
      <span
        class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-dark-400"
        aria-hidden="true"
      >
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </div>
    <p v-if="error" class="input-error-text">{{ error }}</p>
    <p v-else-if="hint" class="input-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

type OptionValue = string | number
interface SelectOption {
  label: string
  value: OptionValue
}

const props = withDefaults(
  defineProps<{
    modelValue: OptionValue | null | undefined
    options?: Array<SelectOption | OptionValue>
    label?: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    error?: string
    hint?: string
    id?: string
  }>(),
  {
    options: () => [],
    disabled: false,
    required: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: OptionValue): void
  (e: 'change', value: OptionValue): void
}>()

const generatedId = useId()
const fieldId = props.id || generatedId

const normalizedOptions = computed<SelectOption[]>(() =>
  (props.options || []).map((opt) =>
    typeof opt === 'object' ? opt : { label: String(opt), value: opt }
  )
)

const onChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('update:modelValue', value)
  emit('change', value)
}
</script>
