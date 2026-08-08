<template>
  <div
    :class="[
      'skel',
      variant === 'circle' ? 'rounded-full' : 'rounded-lg',
      customClass
    ]"
    :style="style"
  ></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'rect' | 'circle' | 'text'
  width?: string | number
  height?: string | number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'rect',
  width: '100%'
})

const customClass = computed(() => props.class || '')

const style = computed(() => {
  const s: Record<string, string> = {}
  
  if (props.width) {
    s.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }
  
  if (props.height) {
    s.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  } else if (props.variant === 'text') {
    s.height = '1em'
    s.marginTop = '0.25em'
    s.marginBottom = '0.25em'
  }
  
  return s
})
</script>

<style scoped>
/* neutral shimmer：基于 --fill，尊重 prefers-reduced-motion */
.skel {
  background: var(--fill);
  animation: skel-pulse 1.6s var(--ease) infinite;
}

@keyframes skel-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skel {
    animation: none;
  }
}
</style>
