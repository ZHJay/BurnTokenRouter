<template>
  <div class="nf-page">
    <div class="spot spot-1" aria-hidden="true"></div>
    <div class="spot spot-2" aria-hidden="true"></div>

    <main class="nf-main">
      <p class="nf-code" aria-hidden="true">404</p>
      <div class="nf-icon">
        <Icon name="exclamationTriangle" size="lg" />
      </div>
      <h1 class="nf-title">{{ t('errors.pageNotFound') }}</h1>
      <p class="nf-sub">{{ t('common.pageNotFoundDesc') }}</p>

      <div class="nf-actions">
        <button @click="goBack" class="btn btn-secondary">
          <Icon name="arrowLeft" size="md" />
          {{ t('common.back') }}
        </button>
        <router-link to="/dashboard" class="btn btn-primary">
          <Icon name="home" size="md" />
          {{ t('common.dashboard') }}
        </router-link>
      </div>

      <p class="nf-help">
        <a href="#" class="nf-help-link">{{ t('common.contactSupport') }}</a>
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()
const router = useRouter()

function goBack(): void {
  router.back()
}
</script>

<style scoped>
.nf-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  background: var(--bg);
  color: var(--text-primary);
}

/* ambient 光斑(与登录页同语言) */
.spot {
  position: fixed;
  z-index: 0;
  border-radius: 50%;
  pointer-events: none;
}
.spot-1 {
  width: 420px;
  height: 420px;
  top: -140px;
  left: -120px;
  background: var(--blue);
  opacity: 0.13;
  filter: blur(90px);
}
.spot-2 {
  width: 380px;
  height: 380px;
  bottom: -160px;
  right: -140px;
  background: var(--purple);
  opacity: 0.11;
  filter: blur(90px);
}
:global(html.dark) .spot-1 { opacity: 0.22; }
:global(html.dark) .spot-2 { opacity: 0.18; }

.nf-main {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  text-align: center;
}

.nf-code {
  font-size: 120px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.05em;
  color: var(--separator);
  user-select: none;
}

.nf-icon {
  width: 64px;
  height: 64px;
  margin: -18px auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: var(--blue-soft);
  color: var(--blue);
}

.nf-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.nf-sub {
  margin-top: 10px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.nf-actions {
  margin-top: 28px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.nf-help {
  margin-top: 36px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.nf-help-link {
  color: var(--blue);
  font-weight: 500;
}
</style>
