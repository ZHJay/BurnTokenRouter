<template>
  <div class="gn-app-shell">
    <!-- Apple-style global nav (replaces the sidebar + header) -->
    <GlobalNav />

    <!-- Main Content -->
    <main class="gn-main">
      <!-- Page head: was rendered by the old header (title/description) -->
      <header v-if="pageTitle" class="gn-page-head">
        <h1 class="gn-page-title">{{ pageTitle }}</h1>
        <p v-if="pageDescription" class="gn-page-sub">{{ pageDescription }}</p>
      </header>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore, useAdminSettingsStore } from '@/stores'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import GlobalNav from './GlobalNav.vue'

const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const adminSettingsStore = useAdminSettingsStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

/**
 * Page title/description — moved here from the deleted AppHeader so views
 * keep their header-provided title without any view edits.
 */
const pageTitle = computed(() => {
  // For custom pages, use the menu item's label instead of generic "自定义页面"
  if (route.name === 'CustomPage') {
    const id = route.params.id as string
    const publicItems = appStore.cachedPublicSettings?.custom_menu_items ?? []
    const menuItem =
      publicItems.find((item) => item.id === id) ??
      (authStore.isAdmin
        ? adminSettingsStore.customMenuItems.find((item) => item.id === id)
        : undefined)
    if (menuItem?.label) return menuItem.label
  }
  const titleKey = route.meta.titleKey as string
  if (titleKey) {
    return t(titleKey)
  }
  return (route.meta.title as string) || ''
})

const pageDescription = computed(() => {
  const descKey = route.meta.descriptionKey as string
  if (descKey) {
    return t(descKey)
  }
  return (route.meta.description as string) || ''
})

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)
})

defineExpose({ replayTour })
</script>

<style scoped>
.gn-app-shell {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text-primary);
}
.gn-main {
  padding: 16px;
}
@media (min-width: 768px) {
  .gn-main { padding: 24px; }
}
@media (min-width: 1024px) {
  .gn-main { padding: 32px; }
}
</style>
