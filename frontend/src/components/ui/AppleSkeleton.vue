<template>
  <div
    class="skeleton"
    :class="rounded ? 'rounded-full' : 'rounded-xl'"
    :style="{ width, height }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    rounded?: boolean
  }>(),
  {
    width: '100%',
    height: '1rem',
    rounded: false
  }
)
</script>
