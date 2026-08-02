<template>
  <div class="min-h-screen">
    <!--
      Ambient light layer. This is a hard requirement, not decoration: glass only
      reads as glass when there is something behind it to refract. On a flat grey
      or pure black page, backdrop-filter is a no-op and the material collapses
      into a plain panel.
    -->
    <div class="ambient-layer"></div>

    <!-- Sidebar: thick material, floats above content -->
    <AppSidebar />

    <!-- Header: regular material, fixed so content travels underneath it -->
    <AppHeader />

    <!--
      Content is inset with padding rather than pushed with margin, so the
      sidebar and top bar genuinely overlay it. With a margin layout the content
      starts beside the glass instead of under it, leaving nothing to refract.
    -->
    <div
      class="relative min-h-screen transition-all duration-300"
      :class="[sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64']"
    >
      <!-- pt reserves the 64px header plus breathing room -->
      <main class="px-4 pb-4 pt-[4.5rem] md:px-6 md:pb-6 md:pt-[5rem] lg:px-8 lg:pb-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const appStore = useAppStore()
const authStore = useAuthStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const isAdmin = computed(() => authStore.user?.role === 'admin')

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)
})

defineExpose({ replayTour })
</script>
