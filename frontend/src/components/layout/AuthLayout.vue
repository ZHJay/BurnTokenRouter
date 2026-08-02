<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
    <!-- Base -->
    <div class="absolute inset-0" style="background-color: var(--bg-base)"></div>

    <!-- Ambient light: what the glass card refracts -->
    <div class="ambient-layer absolute"></div>

    <!-- Apple system-color orbs, soft and low-contrast -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="absolute -right-32 -top-40 h-[32rem] w-[32rem] rounded-full blur-3xl"
        style="background: radial-gradient(circle, rgb(0 122 255 / 0.28), transparent 68%)"
      ></div>
      <div
        class="absolute -bottom-44 -left-36 h-[35rem] w-[35rem] rounded-full blur-3xl"
        style="background: radial-gradient(circle, rgb(88 86 214 / 0.24), transparent 68%)"
      ></div>
      <div
        class="absolute left-2/5 top-1/3 h-96 w-96 rounded-full blur-3xl"
        style="background: radial-gradient(circle, rgb(48 176 199 / 0.18), transparent 70%)"
      ></div>
    </div>

    <!-- Content Container -->
    <div class="relative z-10 w-full max-w-md">
      <!-- Logo/Brand -->
      <div class="mb-8 text-center">
        <!-- Custom Logo or Default Logo -->
        <template v-if="settingsLoaded">
          <div
            class="mb-4 inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl"
            style="
              box-shadow:
                0 8px 28px -6px rgb(0 122 255 / 0.5),
                inset 0 1px 0 rgb(255 255 255 / 0.45);
            "
          >
            <img :src="siteLogo || '/logo.svg'" alt="Logo" class="h-full w-full object-contain" />
          </div>
          <h1 class="mb-1.5 text-3xl font-bold leading-none tracking-[-0.028em] text-gray-900 dark:text-white">
            {{ siteName }}
          </h1>
          <p class="text-[13px] text-gray-500 dark:text-dark-400">
            {{ siteSubtitle }}
          </p>
        </template>
      </div>

      <!-- Card Container: thin material + lens sweep, content lifted above the sheen -->
      <div class="glass-card glass-lens p-7 sm:p-8">
        <div class="relative z-[3]">
          <slot />
        </div>
      </div>

      <!-- Footer Links -->
      <div class="mt-6 text-center text-sm">
        <slot name="footer" />
      </div>

      <!-- Copyright -->
      <div class="mt-8 text-center text-xs text-gray-400 dark:text-dark-500">
        &copy; {{ currentYear }} {{ siteName }}. All rights reserved.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'

const appStore = useAppStore()

const siteName = computed(() => appStore.siteName || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteSubtitle = computed(() => appStore.cachedPublicSettings?.site_subtitle || 'Subscription to API Conversion Platform')
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)

const currentYear = computed(() => new Date().getFullYear())

onMounted(() => {
  appStore.fetchPublicSettings()
})
</script>
