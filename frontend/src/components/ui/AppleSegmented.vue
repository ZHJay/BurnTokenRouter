<template>
  <div
    role="tablist"
    class="inline-flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-dark-800"
  >
    <button
      v-for="opt in normalizedOptions"
      :key="String(opt.value)"
      type="button"
      role="tab"
      :aria-selected="opt.value === modelValue"
      class="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      :class="
        opt.value === modelValue
          ? 'bg-white text-gray-900 shadow-sm dark:bg-dark-700 dark:text-white'
          : 'text-gray-500 hover:text-gray-900 dark:text-dark-400 dark:hover:text-white'
      "
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type OptionValue = string | number
interface SegOption {
  label: string
  value: OptionValue
}

const props = withDefaults(
  defineProps<{
    modelValue: OptionValue
    options?: Array<SegOption | OptionValue>
  }>(),
  { options: () => [] }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: OptionValue): void }>()

const normalizedOptions = computed<SegOption[]>(() =>
  (props.options || []).map((opt) =>
    typeof opt === 'object' ? opt : { label: String(opt), value: opt }
  )
)
</script>
