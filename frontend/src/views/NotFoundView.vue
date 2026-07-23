<template>
  <div class="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 dark:bg-black">
    <div class="w-full max-w-md text-center">
      <!-- 404 Display -->
      <div class="mb-10">
        <div class="relative inline-block">
          <span class="text-[9rem] font-semibold leading-none tracking-tight text-gray-200 dark:text-dark-800">404</span>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-[22px] bg-primary-500 shadow-md shadow-primary-500/30">
              <svg
                class="h-10 w-10 text-white"
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
        <h1 class="mb-3 text-3xl font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
          {{ t('errors.pageNotFound') }}
        </h1>
        <p class="text-base text-gray-500 dark:text-dark-400">
          The page you are looking for doesn't exist or has been moved.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <AppleButton variant="secondary" @click="goBack">
          <template #icon><Icon name="arrowLeft" size="md" /></template>
          Go Back
        </AppleButton>
        <AppleButton tag="router-link" :to="'/dashboard'" variant="primary">
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
