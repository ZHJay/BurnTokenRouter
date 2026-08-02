<template>
  <button
    type="button"
    @click="toggle"
    :class="[
      'switch flex-shrink-0 focus-visible:outline-none focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)]',
      modelValue && 'switch-active'
    ]"
    role="switch"
    :aria-checked="modelValue"
  >
    <span class="switch-thumb pointer-events-none" />
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>
