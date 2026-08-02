<script setup lang="ts">
defineProps<{
  colorClass: string
  tooltip?: string
  current: string | number
  max: string | number
  suffix?: string
}>()
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[10px] font-[590] leading-tight tracking-[0.01em]',
      colorClass
    ]"
    :title="tooltip"
  >
    <slot />
    <span class="tabular">{{ current }}</span>
    <span class="text-gray-400 dark:text-gray-500">/</span>
    <span class="tabular">{{ max }}</span>
    <span v-if="suffix" class="text-[9px] opacity-60">{{ suffix }}</span>
  </span>
</template>
