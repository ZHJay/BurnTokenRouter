<template>
  <div class="tabs" role="tablist">
    <button
      v-for="tab in normalizedTabs"
      :key="String(tab.value)"
      type="button"
      role="tab"
      :aria-selected="tab.value === modelValue"
      class="tab focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      :class="tab.value === modelValue ? 'tab-active' : ''"
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type TabValue = string | number
interface TabItem {
  label: string
  value: TabValue
}

const props = withDefaults(
  defineProps<{
    modelValue: TabValue
    tabs?: Array<TabItem | TabValue>
  }>(),
  { tabs: () => [] }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: TabValue): void }>()

const normalizedTabs = computed<TabItem[]>(() =>
  (props.tabs || []).map((t) => (typeof t === 'object' ? t : { label: String(t), value: t }))
)
</script>
