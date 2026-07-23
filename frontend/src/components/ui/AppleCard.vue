<template>
  <div
    class="apple-card"
    :class="[
      glass
        ? 'glass-card'
        : 'bg-white border border-gray-100 shadow-card dark:bg-dark-800/60 dark:border-dark-700/50',
      { 'apple-card--hover hover:-translate-y-0.5 hover:shadow-card-hover dark:hover:border-dark-600': hover },
      paddingClass
    ]"
  >
    <div v-if="$slots.header" class="apple-card__header border-b border-gray-100 dark:border-dark-700">
      <slot name="header" />
    </div>
    <slot />
    <div v-if="$slots.footer" class="apple-card__footer border-t border-gray-100 dark:border-dark-700">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    glass?: boolean
    hover?: boolean
    padding?: 'none' | 'sm' | 'md' | 'lg'
  }>(),
  {
    glass: false,
    hover: false,
    padding: 'md'
  }
)

const paddingClass = computed(
  () =>
    ({
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8'
    })[props.padding]
)
</script>

<style scoped>
.apple-card {
  border-radius: 1rem;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease;
}

.apple-card__header {
  margin: -1.5rem -1.5rem 1.5rem;
  padding: 1rem 1.5rem;
}

.apple-card__footer {
  margin: 1.5rem -1.5rem -1.5rem;
  padding: 1rem 1.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .apple-card--hover:hover {
    transform: none !important;
  }
}
</style>
