<template>
  <Teleport to="body">
    <Transition name="apple-dialog">
      <div v-if="modelValue" class="dialog-overlay" @click.self="onOverlayClick">
        <div
          class="dialog-container"
          :class="sizeClass"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <div v-if="title || $slots.header" class="dialog-header">
            <slot name="header">
              <h3 class="modal-title">{{ title }}</h3>
            </slot>
          </div>
          <div class="dialog-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="dialog-footer">
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
    size?: 'sm' | 'md' | 'lg'
    closeOnOverlay?: boolean
  }>(),
  {
    size: 'md',
    closeOnOverlay: true
  }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'close'): void }>()

const sizeClass = computed(
  () => ({ sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' })[props.size]
)

function onOverlayClick() {
  if (props.closeOnOverlay) {
    emit('update:modelValue', false)
    emit('close')
  }
}
</script>

<style scoped>
.apple-dialog-enter-active,
.apple-dialog-leave-active {
  transition: opacity 0.2s ease;
}
.apple-dialog-enter-from,
.apple-dialog-leave-to {
  opacity: 0;
}
.apple-dialog-enter-active :deep(.dialog-container),
.apple-dialog-leave-active :deep(.dialog-container) {
  transition:
    transform 0.22s ease,
    opacity 0.22s ease;
}
.apple-dialog-enter-from :deep(.dialog-container),
.apple-dialog-leave-to :deep(.dialog-container) {
  transform: scale(0.96);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .apple-dialog-enter-active :deep(.dialog-container),
  .apple-dialog-leave-active :deep(.dialog-container) {
    transform: none;
  }
}
</style>
