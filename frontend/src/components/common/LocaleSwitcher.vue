<template>
  <div class="relative" ref="dropdownRef">
    <button
      @click="toggleDropdown"
      :disabled="switching"
      class="locale-trigger"
      :title="currentLocale?.name"
    >
      <span class="text-base">{{ currentLocale?.flag }}</span>
      <span class="hidden sm:inline">{{ currentLocale?.code.toUpperCase() }}</span>
      <Icon
        name="chevronDown"
        size="xs"
        class="locale-chevron"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <transition name="dropdown">
      <div
        v-if="isOpen"
        class="locale-pop"
      >
        <button
          v-for="locale in availableLocales"
          :key="locale.code"
          :disabled="switching"
          @click="selectLocale(locale.code)"
          class="locale-item"
          :class="{
            'locale-item-active': locale.code === currentLocaleCode
          }"
        >
          <span class="text-base">{{ locale.flag }}</span>
          <span>{{ locale.name }}</span>
          <Icon v-if="locale.code === currentLocaleCode" name="check" size="sm" class="ml-auto locale-check" />
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { setLocale, availableLocales } from '@/i18n'

const { locale } = useI18n()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const switching = ref(false)

const currentLocaleCode = computed(() => locale.value)
const currentLocale = computed(() => availableLocales.find((l) => l.code === locale.value))

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

async function selectLocale(code: string) {
  if (switching.value || code === currentLocaleCode.value) {
    isOpen.value = false
    return
  }
  switching.value = true
  try {
    await setLocale(code)
    isOpen.value = false
  } finally {
    switching.value = false
  }
}

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.locale-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  border: none;
  background: var(--fill);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease);
}

.locale-trigger:hover:not(:disabled) {
  background: var(--fill-hover);
  color: var(--text-primary);
}

.locale-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.locale-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.locale-chevron {
  color: var(--text-tertiary);
  transition: transform 0.2s var(--ease);
}

.locale-pop {
  /* 契约镜像：不透明浮出面板 */
  position: absolute;
  right: 0;
  z-index: 50;
  margin-top: 6px;
  width: 128px;
  overflow: hidden;
  background: var(--glass-bg-strong);
  border: 0.5px solid var(--separator);
  border-radius: var(--r-lg);
  box-shadow: var(--glass-highlight), var(--shadow-pop);
  padding: 6px;
}

.locale-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
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

.locale-item:hover {
  background: var(--fill);
}

.locale-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.locale-item-active {
  background: var(--blue-soft);
  color: var(--blue);
}

.locale-check {
  color: var(--blue);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s var(--ease), transform 0.15s var(--ease);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(-4px);
}
</style>
