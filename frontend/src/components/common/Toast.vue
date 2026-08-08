<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed right-4 top-4 z-[9999] space-y-3"
      aria-live="polite"
      aria-atomic="true"
    >
      <TransitionGroup
        enter-active-class="transition ease-out duration-300"
        enter-from-class="opacity-0 translate-x-full"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-full"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="[`toast-${toast.type}`]"
        >
          <div class="p-4">
            <div class="flex items-start gap-3">
              <!-- Icon -->
              <div class="mt-0.5 flex-shrink-0">
                <Icon
                  :name="getToastIconName(toast.type)"
                  size="md"
                  class="toast-icon"
                  aria-hidden="true"
                />
              </div>

              <!-- Content -->
              <div class="min-w-0 flex-1">
                <p v-if="toast.title" class="toast-title">
                  {{ toast.title }}
                </p>
                <p
                  class="toast-message"
                  :class="{ 'with-title': !!toast.title }"
                >
                  {{ toast.message }}
                </p>
              </div>

              <!-- Close button -->
              <button
                @click="removeToast(toast.id)"
                class="toast-close"
                aria-label="Close notification"
              >
                <Icon name="x" size="sm" />
              </button>
            </div>
          </div>

          <!-- Progress bar -->
          <div v-if="toast.duration" class="toast-progress-track">
            <div
              class="toast-progress"
              :style="{ animationDuration: `${toast.duration}ms` }"
            ></div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const toasts = computed(() => appStore.toasts)

const getToastIconName = (type: string): 'checkCircle' | 'xCircle' | 'exclamationTriangle' | 'infoCircle' => {
  switch (type) {
    case 'success':
      return 'checkCircle'
    case 'error':
      return 'xCircle'
    case 'warning':
      return 'exclamationTriangle'
    case 'info':
    default:
      return 'infoCircle'
  }
}

const removeToast = (id: string) => {
  appStore.hideToast(id)
}
</script>

<style scoped>
/* 契约镜像：不透明浮起卡片 + iOS 语义色（B1 全局类落地前的本地回退） */
.toast {
  pointer-events: auto;
  min-width: 320px;
  max-width: 420px;
  overflow: hidden;
  background: var(--glass-bg-strong);
  border: 0.5px solid var(--separator);
  border-radius: var(--r-lg);
  box-shadow: var(--glass-highlight), var(--shadow-pop);
  --toast-accent: var(--blue);
}

.toast-success {
  --toast-accent: var(--green);
}

.toast-error {
  --toast-accent: var(--red);
}

.toast-warning {
  --toast-accent: var(--orange);
}

.toast-info {
  --toast-accent: var(--blue);
}

.toast-icon {
  color: var(--toast-accent);
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.toast-message {
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--text-primary);
}

.toast-message.with-title {
  margin-top: 4px;
  color: var(--text-secondary);
}

.toast-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-pill);
  color: var(--text-tertiary);
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}

.toast-close:hover {
  background: var(--fill);
  color: var(--text-primary);
}

.toast-close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.toast-progress-track {
  height: 3px;
  background: var(--fill);
}

.toast-progress {
  width: 100%;
  height: 100%;
  background: var(--toast-accent);
  animation-name: toast-progress-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes toast-progress-shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-progress {
    animation: none;
  }
}
</style>
