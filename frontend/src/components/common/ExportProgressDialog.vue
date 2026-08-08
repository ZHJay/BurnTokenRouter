<template>
  <BaseDialog :show="show" :title="t('usage.exporting')" width="narrow" @close="handleCancel">
    <div class="space-y-4">
      <div class="export-text">
        {{ t('usage.exportingProgress') }}
      </div>
      <div class="export-count">
        <span>{{ t('usage.exportedCount', { current, total }) }}</span>
        <span class="export-pct">{{ normalizedProgress }}%</span>
      </div>
      <div class="export-track">
        <div
          role="progressbar"
          :aria-valuenow="normalizedProgress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`${t('usage.exportingProgress')}: ${normalizedProgress}%`"
          class="export-fill"
          :style="{ width: `${normalizedProgress}%` }"
        ></div>
      </div>
      <div v-if="estimatedTime" class="export-eta" aria-live="polite" aria-atomic="true">
        {{ t('usage.estimatedTime', { time: estimatedTime }) }}
      </div>
    </div>

    <template #footer>
      <button
        @click="handleCancel"
        type="button"
        class="btn btn-secondary"
      >
        {{ t('usage.cancelExport') }}
      </button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from './BaseDialog.vue'

interface Props {
  show: boolean
  progress: number
  current: number
  total: number
  estimatedTime: string
}

interface Emits {
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const normalizedProgress = computed(() => {
  const value = Number.isFinite(props.progress) ? props.progress : 0
  return Math.min(100, Math.max(0, Math.round(value)))
})

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
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

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 0.5px solid var(--separator-strong);
  box-shadow: var(--shadow-card);
}

.btn-secondary:hover {
  background: var(--fill);
}

.export-text,
.export-count {
  font-size: 14px;
  color: var(--text-secondary);
}

.export-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.export-pct {
  font-weight: 600;
  color: var(--text-primary);
}

/* 契约镜像：apple-theme.css 的 .meter .track/.fill */
.export-track {
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--fill);
  overflow: hidden;
}

.export-fill {
  height: 100%;
  border-radius: var(--r-pill);
  background: var(--blue);
  transition: width 0.3s var(--ease);
}

.export-eta {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
