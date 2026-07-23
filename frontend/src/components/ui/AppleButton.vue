<template>
  <component
    :is="tag"
    :type="tag === 'button' ? nativeType : undefined"
    :href="tag === 'a' ? href : undefined"
    :to="tag === 'router-link' ? to : undefined"
    :disabled="tag === 'button' ? isDisabled : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :aria-disabled="tag !== 'button' && isDisabled ? 'true' : undefined"
    class="apple-btn"
    :class="[sizeClass, variantClass, { 'w-full': block, 'pointer-events-none opacity-50': isDisabled && tag !== 'button' }]"
  >
    <span v-if="loading" class="apple-btn__spinner" aria-hidden="true"></span>
    <slot name="icon" />
    <span v-if="$slots.default"><slot /></span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    tag?: 'button' | 'a' | 'router-link'
    nativeType?: 'button' | 'submit' | 'reset'
    href?: string
    to?: RouteLocationRaw
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    tag: 'button',
    nativeType: 'button',
    block: false,
    loading: false,
    disabled: false
  }
)

const isDisabled = computed(() => props.disabled || props.loading)

const sizeClass = computed(
  () =>
    ({
      sm: 'px-3.5 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base'
    })[props.size]
)

// 颜色一律走 token 化的 Tailwind dark: 类（避免 scoped 下 .dark 失效导致对比问题）。
const variantClass = computed(
  () =>
    ({
      primary:
        'bg-primary-500 text-white shadow-md shadow-primary-500/30 hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-500/35 dark:bg-primary-600 dark:hover:bg-primary-500',
      secondary:
        'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 dark:bg-dark-800 dark:text-gray-200 dark:border-dark-600 dark:hover:bg-dark-700 dark:hover:border-dark-500',
      ghost:
        'bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-800',
      danger:
        'bg-red-500 text-white shadow-md shadow-red-500/25 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30',
      success:
        'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30',
      warning:
        'bg-amber-500 text-white shadow-md shadow-amber-500/25 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/30'
    })[props.variant]
)
</script>

<style scoped>
/* 仅结构/排版；颜色见模板中的 token 化 Tailwind 类。 */
.apple-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 9999px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    transform 0.12s ease;
}

.apple-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.4);
}

.apple-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.apple-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.apple-btn__spinner {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: apple-btn-spin 0.6s linear infinite;
}

@keyframes apple-btn-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .apple-btn__spinner {
    animation-duration: 1.2s;
  }
  .apple-btn:active:not(:disabled) {
    transform: none;
  }
}
</style>
