<template>
  <LandingReveal>
    <div class="lp-cta-band">
      <h2 class="lp-cta-title">{{ t('home.cta.title') }}</h2>
      <p class="lp-cta-desc">{{ t('home.cta.description') }}</p>
      <div class="lp-cta-actions">
        <router-link :to="primaryTo" class="btn btn-primary lp-cta-btn">
          {{ primaryLabel }}
          <Icon name="arrowRight" size="md" :stroke-width="2" />
        </router-link>
        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-secondary lp-cta-btn"
        >
          {{ t('home.cta.secondary') }}
        </a>
      </div>
    </div>
  </LandingReveal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LandingReveal from './LandingReveal.vue'

defineProps<{
  primaryTo: string
  primaryLabel: string
  docUrl: string
}>()

const { t } = useI18n()
</script>

<style scoped>
.lp-cta-band {
  padding: 52px 24px;
  border-radius: var(--r-xl);
  text-align: center;
  background:
    radial-gradient(60rem 20rem at 50% 0%, var(--blue-soft), transparent 70%),
    var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card), var(--glass-highlight);
}

.lp-cta-title {
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.lp-cta-desc {
  margin: 12px auto 0;
  max-width: 520px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.lp-cta-actions {
  margin-top: 26px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.lp-cta-btn {
  height: 46px;
  padding: 0 26px;
  font-size: 15px;
}

@media (max-width: 768px) {
  .lp-cta-band {
    padding: 38px 18px;
  }
}
</style>
