<template>
  <div class="w-full">
    <label v-if="label" :for="fieldId" class="input-label">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <textarea
      :id="fieldId"
      ref="areaRef"
      :value="modelValue ?? ''"
      :rows="rows"
      :disabled="disabled"
      :required="required"
      :readonly="readonly"
      :placeholder="placeholder"
      class="input resize-y"
      :class="error ? 'input-error' : ''"
      @input="onInput"
      @change="emit('change', ($event.target as HTMLTextAreaElement).value)"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
    />
    <p v-if="error" class="input-error-text">{{ error }}</p>
    <p v-else-if="hint" class="input-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined
    label?: string
    placeholder?: string
    rows?: number
    disabled?: boolean
    required?: boolean
    readonly?: boolean
    error?: string
    hint?: string
    id?: string
  }>(),
  {
    rows: 4,
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
}>()

const generatedId = useId()
const fieldId = props.id || generatedId
const areaRef = ref<HTMLTextAreaElement | null>(null)

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

defineExpose({ focus: () => areaRef.value?.focus() })
</script>
