<template>
  <div class="relative w-full">
    <!-- 前缀几何与配色逐字对齐 Input.vue 的 #prefix 插槽（pl-3.5 + 输入框 pl-11），
         两者常常并排出现在同一筛选行里，图标不同缩进会读作错位。 -->
    <div
      class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 dark:text-dark-400"
    >
      <Icon name="search" size="md" />
    </div>
    <input
      :value="modelValue"
      type="text"
      class="input pl-11"
      :placeholder="placeholder"
      @input="handleInput"
    />
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import Icon from '@/components/icons/Icon.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  debounceMs?: number
}>(), {
  placeholder: 'Search...',
  debounceMs: 300
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search', value: string): void
}>()

const debouncedEmitSearch = useDebounceFn((value: string) => {
  emit('search', value)
}, props.debounceMs)

const handleInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
  debouncedEmitSearch(value)
}
</script>
