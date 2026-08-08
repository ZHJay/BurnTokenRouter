<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="input-label block">
      {{ label }}
      <span v-if="required" class="required-star">*</span>
    </label>
    <div class="relative">
      <textarea
        :id="id"
        ref="textAreaRef"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        :placeholder="placeholderText"
        :readonly="readonly"
        :rows="rows"
        :class="[
          'input w-full',
          error ? 'input-error' : '',
          disabled ? 'input-disabled' : ''
        ]"
        @input="onInput"
        @change="$emit('change', ($event.target as HTMLTextAreaElement).value)"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      ></textarea>
    </div>
    <!-- Hint / Error Text -->
    <p v-if="error" class="input-error-text">
      {{ error }}
    </p>
    <p v-else-if="hint" class="input-hint">
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  modelValue: string | null | undefined
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  readonly?: boolean
  error?: string
  hint?: string
  id?: string
  rows?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  required: false,
  readonly: false,
  rows: 3
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'blur', event: FocusEvent): void
  (e: 'focus', event: FocusEvent): void
}>()

const textAreaRef = ref<HTMLTextAreaElement | null>(null)
const placeholderText = computed(() => props.placeholder || '')

const onInput = (event: Event) => {
  const value = (event.target as HTMLTextAreaElement).value
  emit('update:modelValue', value)
}

// Expose focus method
defineExpose({
  focus: () => textAreaRef.value?.focus(),
  select: () => textAreaRef.value?.select()
})
</script>

<style scoped>
/* 契约镜像：apple-theme.css 的 textarea.input */
.input {
  min-height: 80px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 0.5px solid var(--separator-strong);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  line-height: 1.5;
  outline: none;
  resize: vertical;
  transition: box-shadow 0.18s var(--ease), border-color 0.18s var(--ease), opacity 0.18s var(--ease);
}

.input::placeholder {
  color: var(--text-tertiary);
}

.input:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.input-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.required-star {
  color: var(--red);
}

.input-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.input-error-text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--red);
}

.input-error {
  border-color: var(--red);
}

.input-error:focus {
  border-color: var(--red);
  box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.12);
}

.input-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
