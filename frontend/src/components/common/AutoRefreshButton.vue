<template>
  <div class="relative" ref="dropdownRef">
    <button
      @click="showDropdown = !showDropdown"
      class="ar-trigger"
      :title="t('common.autoRefresh.title')"
    >
      <svg
        class="ar-icon"
        :class="enabled ? 'animate-spin' : ''"
        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      >
        <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.312a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-10.624-2.848a5.5 5.5 0 019.201-2.466l.312.311H11.768a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.537a.75.75 0 00-1.5 0v2.034l-.312-.312A7 7 0 002.628 8.397a.75.75 0 001.449.39z" clip-rule="evenodd" />
      </svg>
      <span>
        {{ enabled
          ? t('common.autoRefresh.countdown', { seconds: countdown })
          : t('common.autoRefresh.title')
        }}
      </span>
    </button>

    <div
      v-if="showDropdown"
      class="ar-pop"
    >
      <div class="ar-pop-inner">
        <button
          @click="$emit('update:enabled', !enabled)"
          class="ar-item"
        >
          <span>{{ t('common.autoRefresh.enable') }}</span>
          <svg v-if="enabled" class="ar-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
          </svg>
        </button>
        <div class="ar-sep"></div>
        <button
          v-for="sec in intervals"
          :key="sec"
          @click="$emit('update:interval', sec)"
          class="ar-item"
        >
          <span>{{ t('common.autoRefresh.seconds', { n: sec }) }}</span>
          <svg v-if="intervalSeconds === sec" class="ar-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  enabled: boolean
  intervalSeconds: number
  countdown: number
  intervals: readonly number[]
}>()

defineEmits<{
  (e: 'update:enabled', value: boolean): void
  (e: 'update:interval', value: number): void
}>()

const { t } = useI18n()
const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.ar-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  border: 0.5px solid var(--separator-strong);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease);
}

.ar-trigger:hover {
  background: var(--fill);
  color: var(--text-primary);
}

.ar-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.ar-icon {
  width: 14px;
  height: 14px;
}

.ar-pop {
  position: absolute;
  right: 0;
  z-index: 20;
  margin-top: 6px;
  width: 176px;
  background: var(--glass-bg-strong);
  border: 0.5px solid var(--separator);
  border-radius: var(--r-lg);
  box-shadow: var(--glass-highlight), var(--shadow-pop);
}

.ar-pop-inner {
  padding: 6px;
}

.ar-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  border: none;
  background: transparent;
  border-radius: var(--r-sm);
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s var(--ease);
}

.ar-item:hover {
  background: var(--fill);
}

.ar-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.ar-check {
  width: 16px;
  height: 16px;
  color: var(--blue);
}

.ar-sep {
  height: 0.5px;
  background: var(--separator);
  margin: 4px 8px;
}
</style>
