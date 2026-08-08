<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="modal-overlay"
        :style="zIndexStyle"
        :aria-labelledby="dialogId"
        role="dialog"
        aria-modal="true"
        @click.self="handleClose"
      >
        <!-- Modal panel -->
        <div ref="dialogRef" :class="['modal-content', widthClasses]" @click.stop>
          <!-- Header -->
          <div class="modal-header">
            <h3 :id="dialogId" class="modal-title">
              {{ title }}
            </h3>
            <button
              v-if="showCloseButton"
              @click="emit('close')"
              class="dialog-close"
              aria-label="Close modal"
            >
              <Icon name="x" size="md" />
            </button>
          </div>

          <!-- Body -->
          <div ref="modalBodyRef" class="modal-body">
            <slot></slot>
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, ref, nextTick } from 'vue'
import Icon from '@/components/icons/Icon.vue'

// 生成唯一ID以避免多个对话框时ID冲突
let dialogIdCounter = 0
const dialogId = `modal-title-${++dialogIdCounter}`

// 焦点管理
const dialogRef = ref<HTMLElement | null>(null)
const modalBodyRef = ref<HTMLElement | null>(null)
let previousActiveElement: HTMLElement | null = null

type DialogWidth = 'narrow' | 'normal' | 'wide' | 'extra-wide' | 'full'

interface Props {
  show: boolean
  title: string
  width?: DialogWidth
  closeOnEscape?: boolean
  closeOnClickOutside?: boolean
  showCloseButton?: boolean
  zIndex?: number
}

interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  width: 'normal',
  closeOnEscape: true,
  closeOnClickOutside: false,
  showCloseButton: true,
  zIndex: 50
})

const emit = defineEmits<Emits>()

// Custom z-index style (overrides the default z-50 from CSS)
const zIndexStyle = computed(() => {
  return props.zIndex !== 50 ? { zIndex: props.zIndex } : undefined
})

const widthClasses = computed(() => {
  // Width guidance: narrow=confirm/short prompts, normal=standard forms,
  // wide=multi-section forms or rich content, extra-wide=analytics/tables,
  // full=full-screen or very dense layouts.
  const widths: Record<DialogWidth, string> = {
    narrow: 'max-w-md',
    normal: 'max-w-lg',
    wide: 'w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl',
    'extra-wide': 'w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl',
    full: 'w-full sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl'
  }
  return widths[props.width]
})

const handleClose = () => {
  if (props.closeOnClickOutside) {
    emit('close')
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (props.show && props.closeOnEscape && event.key === 'Escape') {
    emit('close')
  }
}

// Prevent body scroll when modal is open and manage focus
watch(
  () => props.show,
  async (isOpen) => {
    if (isOpen) {
      // 保存当前焦点元素
      previousActiveElement = document.activeElement as HTMLElement
      // 使用CSS类而不是直接操作style,更易于管理多个对话框
      document.body.classList.add('modal-open')

      // 等待DOM更新后设置焦点到对话框
      await nextTick()
      if (modalBodyRef.value) {
        modalBodyRef.value.scrollTop = 0
      }
      if (dialogRef.value) {
        const firstFocusable = dialogRef.value.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        firstFocusable?.focus()
      }
    } else {
      document.body.classList.remove('modal-open')
      // 恢复之前的焦点
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus()
      }
      previousActiveElement = null
    }
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  // 确保组件卸载时移除滚动锁定
  document.body.classList.remove('modal-open')
})
</script>

<style scoped>
/* 契约镜像：apple-theme.css 浮出层规范 —— 不透明面板 + 纱幕压暗（亮 18% / 暗 45% 黑） */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

:global(html.dark) .modal-overlay {
  background: rgba(0, 0, 0, 0.45);
}

.modal-content {
  width: 100%;
  max-height: 95vh;
  background: var(--glass-bg-strong);
  border-radius: var(--r-xl);
  border: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight), var(--shadow-pop);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 24px;
  border-bottom: 0.5px solid var(--separator);
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  color: var(--text-primary);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 24px;
  border-top: 0.5px solid var(--separator);
}

.dialog-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-pill);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease), transform 0.12s var(--ease);
}

.dialog-close:hover {
  background: var(--fill);
  color: var(--text-primary);
}

.dialog-close:active {
  transform: scale(0.92);
}

.dialog-close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

/* 滚动锁回退：保证 B1 全局样式落地前 body.modal-open 依然生效 */
:global(body.modal-open) {
  overflow: hidden;
}

/* 过渡（与现有类名一致，本地回退） */
.modal-enter-active {
  transition: opacity 250ms var(--ease);
}

.modal-leave-active {
  transition: opacity 200ms var(--ease);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content {
  transition: transform 250ms var(--ease), opacity 250ms var(--ease);
}

.modal-leave-active .modal-content {
  transition: transform 200ms var(--ease), opacity 200ms var(--ease);
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}

.modal-enter-to .modal-content,
.modal-leave-from .modal-content {
  transform: scale(1) translateY(0);
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal-content,
  .modal-leave-active .modal-content {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }

  .modal-enter-from .modal-content,
  .modal-leave-to .modal-content {
    transform: none;
  }
}
</style>
