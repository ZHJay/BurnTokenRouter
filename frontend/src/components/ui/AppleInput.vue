<template>
  <div class="w-full">
    <label v-if="label" :for="fieldId" class="input-label">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <div class="relative">
      <div
        v-if="$slots.prefix"
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 dark:text-dark-400"
      >
        <slot name="prefix" />
      </div>
      <input
        :id="fieldId"
        ref="inputRef"
        :type="type"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :required="required"
        :readonly="readonly"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        class="input"
        :class="[
          $slots.prefix ? 'pl-11' : '',
          $slots.suffix ? 'pr-11' : '',
          error ? 'input-error' : ''
        ]"
        @input="onInput"
        @change="emit('change', ($event.target as HTMLInputElement).value)"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
        @keyup.enter="emit('enter', $event)"
      />
      <div
        v-if="$slots.suffix"
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-dark-400"
      >
        <slot name="suffix" />
      </div>
    </div>
    <p v-if="error" class="input-error-text">{{ error }}</p>
    <p v-else-if="hint" class="input-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    type?: string
    label?: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    readonly?: boolean
    error?: string
    hint?: string
    id?: string
    autocomplete?: string
  }>(),
  {
    type: 'text',
    disabled: false,
    required: false,
    readonly: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'blur', event: FocusEvent): void
  (e: 'focus', event: FocusEvent): void
  (e: 'enter', event: KeyboardEvent): void
}>()

const generatedId = useId()
const fieldId = props.id || generatedId
const inputRef = ref<HTMLInputElement | null>(null)

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  select: () => inputRef.value?.select()
})
</script>
