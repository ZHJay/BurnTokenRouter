<template>
  <BaseDialog :show="show" :title="title" width="narrow" @close="handleCancel">
    <div class="space-y-4">
      <p class="confirm-message">{{ message }}</p>
      <slot></slot>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button
          @click="handleCancel"
          type="button"
          class="btn btn-secondary"
        >
          {{ cancelText }}
        </button>
        <button
          @click="handleConfirm"
          type="button"
          :class="danger ? 'btn btn-danger' : 'btn btn-primary'"
        >
          {{ confirmText }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from './BaseDialog.vue'

const { t } = useI18n()

interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface Emits {
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  danger: false
})

const confirmText = computed(() => props.confirmText || t('common.confirm'))
const cancelText = computed(() => props.cancelText || t('common.cancel'))

const emit = defineEmits<Emits>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
/* 契约镜像：apple-theme.css 的 .btn 家族（B1 全局类落地前的本地回退，数值与契约一致） */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--r-pill);
  font-size: 13.5px;
  font-weight: 500;
  font-family: inherit;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.18s var(--ease), box-shadow 0.18s var(--ease),
    transform 0.12s var(--ease), border-color 0.18s var(--ease);
}

.btn:active {
  transform: scale(0.97);
}

.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.btn-primary {
  background: var(--blue);
  color: #fff;
  box-shadow: var(--shadow-blue);
}

.btn-primary:hover {
  background: var(--blue-hover);
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 0.5px solid var(--separator-strong);
  box-shadow: var(--shadow-card);
}

.btn-secondary:hover {
  background: var(--fill);
}

.btn-danger {
  background: var(--red);
  color: #fff;
}

.btn-danger:hover {
  background: #e02d22;
}

.confirm-message {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}
</style>
