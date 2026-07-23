<template>
  <span class="badge" :class="variantClass">
    <slot name="icon" />
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'primary' | 'success' | 'warning' | 'danger' | 'gray' | 'purple'

const props = withDefaults(defineProps<{ variant?: Variant }>(), { variant: 'gray' })

const variantClass = computed(() => `badge-${props.variant}`)
</script>
