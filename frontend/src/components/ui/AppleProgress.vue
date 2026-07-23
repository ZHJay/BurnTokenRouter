<template>
  <div
    class="progress"
    role="progressbar"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="progress-bar" :style="{ width: clamped + '%' }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ value?: number }>(), { value: 0 })

const clamped = computed(() => Math.min(100, Math.max(0, Math.round(props.value))))
</script>
