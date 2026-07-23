<template>
  <Teleport to="body">
    <Transition name="apple-modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        @click.self="onOverlayClick"
      >
        <div
          class="modal-content"
          :class="sizeClass"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <div v-if="title || $slots.header" class="modal-header">
            <slot name="header">
              <h3 class="modal-title">{{ title }}</h3>
            </slot>
            <button
              v-if="closable"
              type="button"
              class="btn-ghost btn-icon"
              :aria-label="'Close'"
              @click="close"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    closable?: boolean
    closeOnOverlay?: boolean
  }>(),
  {
    size: 'md',
    closable: true,
    closeOnOverlay: true
  }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'close'): void }>()

const sizeClass = computed(
  () =>
    ({
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl'
    })[props.size]
)

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onOverlayClick() {
  if (props.closeOnOverlay) close()
}
</script>

<style scoped>
.apple-modal-enter-active,
.apple-modal-leave-active {
  transition: opacity 0.22s ease;
}
.apple-modal-enter-from,
.apple-modal-leave-to {
  opacity: 0;
}
.apple-modal-enter-active :deep(.modal-content),
.apple-modal-leave-active :deep(.modal-content) {
  transition:
    transform 0.24s ease,
    opacity 0.24s ease;
}
.apple-modal-enter-from :deep(.modal-content),
.apple-modal-leave-to :deep(.modal-content) {
  transform: scale(0.96);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .apple-modal-enter-active :deep(.modal-content),
  .apple-modal-leave-active :deep(.modal-content) {
    transform: none;
  }
}
</style>
