<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="input-label block">
      {{ label }}
      <span v-if="required" class="required-star">*</span>
    </label>
    <div class="relative">
      <!-- Prefix Icon Slot -->
      <div
        v-if="$slots.prefix"
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 dark:text-dark-400"
      >
        <slot name="prefix"></slot>
      </div>

      <input
        :id="id"
        ref="inputRef"
        :type="type"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        :placeholder="placeholderText"
        :autocomplete="autocomplete"
        :readonly="readonly"
        :class="[
          'input w-full',
          $slots.prefix ? 'pl-11' : '',
          $slots.suffix ? 'pr-11' : '',
          error ? 'input-error' : '',
          disabled ? 'input-disabled' : ''
        ]"
        @input="onInput"
        @change="$emit('change', ($event.target as HTMLInputElement).value)"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
        @keyup.enter="$emit('enter', $event)"
      />

      <!-- Suffix Slot (e.g. Password Toggle or Clear Button) -->
      <div
        v-if="$slots.suffix"
        class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 dark:text-dark-400"
      >
        <slot name="suffix"></slot>
      </div>
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
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  required: false,
  readonly: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'blur', event: FocusEvent): void
  (e: 'focus', event: FocusEvent): void
  (e: 'enter', event: KeyboardEvent): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const placeholderText = computed(() => props.placeholder || '')

const onInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
}

// Expose focus method
defineExpose({
  focus: () => inputRef.value?.focus(),
  select: () => inputRef.value?.select()
})
</script>

<style scoped>
/* 契约镜像：apple-theme.css 的 .input / .field label（B1 全局类落地前的本地回退，数值与契约一致） */
.input {
  height: 44px;
  padding: 0 14px;
  border-radius: var(--r-md);
  border: 0.5px solid var(--separator-strong);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  outline: none;
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
