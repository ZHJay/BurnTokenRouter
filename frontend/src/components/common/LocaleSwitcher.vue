<template>
  <div class="relative" ref="dropdownRef">
    <button
      @click="toggleDropdown"
      :disabled="switching"
      class="locale-trigger press-feedback flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
      :class="{ 'is-open': isOpen }"
      :title="currentLocale?.name"
    >
      <span class="text-base">{{ currentLocale?.flag }}</span>
      <span class="hidden sm:inline">{{ currentLocale?.code.toUpperCase() }}</span>
      <Icon
        name="chevronDown"
        size="xs"
        class="locale-chevron transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <transition name="dropdown">
      <div
        v-if="isOpen"
        class="material-glass pop-origin-top-right absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-2xl"
        style="box-shadow: var(--shadow-pop)"
      >
        <button
          v-for="locale in availableLocales"
          :key="locale.code"
          :disabled="switching"
          @click="selectLocale(locale.code)"
          class="locale-item flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors"
          :class="{ 'is-active': locale.code === currentLocaleCode }"
        >
          <span class="text-base">{{ locale.flag }}</span>
          <span>{{ locale.name }}</span>
          <Icon v-if="locale.code === currentLocaleCode" name="check" size="sm" class="locale-check ml-auto" />
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
/* Trigger — token-driven neutral text with soft fill on hover/open. */
.locale-trigger {
  color: var(--text-secondary);
}
.locale-trigger:hover:not(:disabled),
.locale-trigger.is-open {
  background: var(--fill);
  color: var(--text-primary);
}

.locale-chevron {
  color: var(--text-tertiary);
}

/* Menu items */
.locale-item {
  color: var(--text-secondary);
}
.locale-item:hover:not(:disabled) {
  background: var(--fill-hover);
  color: var(--text-primary);
}
.locale-item.is-active {
  color: var(--apple-blue);
  background: var(--apple-blue-soft);
}
.locale-check {
  color: var(--apple-blue);
}

/* Dropdown enter/leave — spring pop anchored to the trigger corner. */
.dropdown-enter-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.28s var(--ease-spring);
}
.dropdown-leave-active {
  transition:
    opacity 0.15s ease-in,
    transform 0.18s var(--ease-apple);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(-6px);
}
</style>
