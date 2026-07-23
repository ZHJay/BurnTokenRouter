<template>
  <span class="apple-tooltip" tabindex="0">
    <slot />
    <span v-if="content || $slots.content" class="apple-tooltip__bubble" role="tooltip">
      <slot name="content">{{ content }}</slot>
    </span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ content?: string }>()
</script>

<style scoped>
.apple-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  outline: none;
}

.apple-tooltip__bubble {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  white-space: nowrap;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  line-height: 1.2;
  color: #fff;
  background: rgba(30, 30, 32, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
  z-index: 60;
}

.apple-tooltip:hover .apple-tooltip__bubble,
.apple-tooltip:focus-visible .apple-tooltip__bubble {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .apple-tooltip__bubble {
    transition: opacity 0.18s ease;
    transform: translateX(-50%);
  }
}
</style>
