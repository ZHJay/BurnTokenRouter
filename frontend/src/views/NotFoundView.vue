<template>
  <div
    class="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
    style="background: var(--surface-bg)"
  >
    <!-- Ambient blurred glow, softly anchored behind the glyph -->
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        class="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style="background: radial-gradient(circle, var(--apple-blue-soft) 0%, transparent 70%)"
      ></div>
    </div>

    <div class="relative z-10 w-full max-w-md text-center">
      <!-- 404 Display -->
      <div class="mb-10">
        <div class="relative inline-block">
          <span
            class="select-none text-[9.5rem] font-bold leading-none text-gray-900/10 dark:text-white/10"
            style="letter-spacing: -0.04em"
            >404</span
          >
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="flex h-20 w-20 items-center justify-center rounded-[22px] text-white"
              style="background: var(--apple-blue); box-shadow: var(--shadow-blue)"
            >
              <svg
                class="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Text Content -->
      <div class="mb-9">
        <h1
          class="mb-3 text-4xl font-bold"
          style="letter-spacing: -0.025em; color: var(--text-primary)"
        >
          {{ t('errors.pageNotFound') }}
        </h1>
        <p class="text-base" style="color: var(--text-secondary)">
          The page you are looking for doesn't exist or has been moved.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <AppleButton class="press-feedback" variant="secondary" @click="goBack">
          <template #icon><Icon name="arrowLeft" size="md" /></template>
          Go Back
        </AppleButton>
        <AppleButton class="press-feedback" tag="router-link" :to="'/dashboard'" variant="primary">
          <template #icon><Icon name="home" size="md" /></template>
          Go to Dashboard
        </AppleButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'
import { AppleButton } from '@/components/ui'

const { t } = useI18n()
const router = useRouter()

function goBack(): void {
  router.back()
}
</script>
