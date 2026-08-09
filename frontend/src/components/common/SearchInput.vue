<template>
  <div class="search">
    <Icon name="search" size="md" aria-hidden="true" />
    <input
      :value="modelValue"
      type="search"
      :placeholder="placeholder"
      :aria-label="placeholder"
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

<style scoped>
/* 契约镜像：apple-theme.css 的 .search 药丸 */
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--r-control);
  background: var(--fill);
  min-width: 240px;
  transition: background 0.18s var(--ease), box-shadow 0.18s var(--ease);
}

.search:focus-within {
  background: var(--bg-elevated);
  box-shadow: 0 0 0 4px var(--blue-soft), var(--shadow-card);
}

.search :deep(svg) {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search input {
  border: none;
  background: transparent;
  outline: none;
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--text-primary);
  font-family: inherit;
}

.search input::placeholder {
  color: var(--text-tertiary);
}

.search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}
</style>
