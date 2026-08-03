<template>
  <div class="min-h-screen">
    <!--
      Skip link. First focusable element in the DOM on purpose (WCAG 2.4.1):
      before this, the first ~28 tab stops on every page were the sidebar's
      navigation, which a sighted keyboard user had to traverse on every single
      route. Screen-reader users could already jump by landmark, so this is
      specifically the sighted-keyboard path.

      Invisible until focused: `sr-only` keeps it out of the visual design,
      `focus:not-sr-only` materialises it in place. z-50 puts it above the header
      (z-30) and the sidebar, which would otherwise cover it once revealed.

      `tabindex="-1"` on <main> is what makes the jump actually work: a fragment
      link moves the scroll position but only moves FOCUS if the target can hold
      it, so without it the next Tab would resume from the skip link and walk
      straight back into the sidebar — the exact traversal this is meant to skip.
      -1 keeps <main> out of the tab order itself.
    -->
    <a
      href="#main-content"
      class="sr-only rounded-b-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:outline-none focus:ring-[3.5px] focus:ring-[color:var(--accent-tint-strong)]"
    >
      {{ t('common.skipToContent') }}
    </a>

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
      <!--
        pt reserves the 64px header plus breathing room.

        pb carries the bottom safe-area inset so the last row of content clears
        the home indicator instead of sitting under it. env() resolves to 0px
        wherever there is no safe area (and without `viewport-fit=cover`), so each
        of these is exactly today's value plus the inset.
      -->
      <main
        id="main-content"
        tabindex="-1"
        class="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[4.5rem] md:px-6 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pt-[5rem] lg:px-8 lg:pb-[calc(2rem+env(safe-area-inset-bottom))]"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const appStore = useAppStore()
const authStore = useAuthStore()
const { t } = useI18n()
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
