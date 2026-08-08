<template>
  <header class="plaza-nav glass sticky top-0 z-30">
    <div class="plaza-nav-inner">
      <!-- 左:纯文字 wordmark(品牌不再渲染 logo 图片) -->
      <div class="flex min-w-0 items-center gap-3">
        <template v-if="settings">
          <span class="plaza-wordmark truncate">{{ siteName }}</span>
        </template>
        <template v-else>
          <span class="h-5 w-28 animate-pulse rounded bg-gray-200 dark:bg-dark-700" aria-hidden="true"></span>
        </template>
      </div>

      <!-- 右:登录 / 回到后台 -->
      <RouterLink
        v-if="isAuthenticated"
        :to="backTarget"
        class="btn btn-primary"
      >
        {{ t('modelPlaza.nav.backToDashboard') }}
      </RouterLink>
      <RouterLink
        v-else
        :to="{ path: '/login', query: { redirect: '/model-plaza' } }"
        class="btn btn-primary"
      >
        {{ t('modelPlaza.nav.login') }}
      </RouterLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()

const settings = computed(() => appStore.cachedPublicSettings)
const siteName = computed(() => settings.value?.site_name || appStore.siteName || 'Sub2API')
const isAuthenticated = computed(() => authStore.isAuthenticated)
const backTarget = computed(() => (authStore.isAdmin ? '/admin/dashboard' : '/dashboard'))
</script>

<style scoped>
/* 独立模型广场导航条:与全局 GlobalNav 同语言的 48px 磨砂条 */
.plaza-nav {
  height: var(--gn-height, 48px);
  border-bottom: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight);
}

.plaza-nav-inner {
  max-width: 1080px;
  height: 100%;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.plaza-wordmark {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  white-space: nowrap;
}
</style>
