<template>
  <div class="status">
    <span :class="['dot', variantClass]"></span>
    <span class="status-label">
      {{ label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  label: string
}>()

const variantClass = computed(() => {
  switch (props.status) {
    case 'active':
    case 'success':
      return 'dot-active'
    case 'disabled':
    case 'inactive':
    case 'warning':
      return 'dot-cooldown'
    case 'error':
    case 'danger':
      return 'dot-error'
    default:
      return 'dot-paused'
  }
})
</script>

<style scoped>
/* 契约镜像：apple-theme.css 的 .status + .dot 体系 */
.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-active {
  background: var(--green);
  box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.18);
}

.dot-cooldown {
  background: var(--orange);
  box-shadow: 0 0 0 3px rgba(255, 159, 10, 0.18);
}

.dot-error {
  background: var(--red);
  box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.18);
}

.dot-paused {
  background: var(--gray-dot);
}
</style>
