<template>
  <div class="segmented" role="group" :aria-label="t('modelPlaza.view.label')">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :class="{ active: modelValue === opt.value }"
      :aria-pressed="modelValue === opt.value"
      :data-view="opt.value"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlazaViewMode } from './viewMode'

defineProps<{
  modelValue: PlazaViewMode
}>()

defineEmits<{
  'update:modelValue': [value: PlazaViewMode]
}>()

const { t } = useI18n()

const options = computed<Array<{ value: PlazaViewMode; label: string }>>(() => [
  { value: 'cards', label: t('modelPlaza.view.cards') },
  { value: 'table', label: t('modelPlaza.view.table') }
])
</script>

<style scoped>
/* 全站 .segmented 未定义 :active 缩放，按锁定决策补上（按钮 :active 0.97） */
.segmented button {
  transition: background 0.2s var(--ease), color 0.2s var(--ease), transform 0.2s var(--ease);
  white-space: nowrap;
}

.segmented button:active {
  transform: scale(0.97);
}
</style>
