<template>
  <ul class="lp-features" role="list">
    <LandingReveal
      v-for="(item, i) in items"
      :key="item.key"
      as="li"
      class="lp-feature"
      :delay="(i % 3) * 70"
    >
      <span class="lp-feature-icon" :class="item.tint">
        <Icon :name="item.icon" size="lg" />
      </span>
      <h3 class="lp-feature-title">{{ t(`home.features.${item.key}`) }}</h3>
      <p class="lp-feature-desc">{{ t(`home.features.${item.key}Desc`) }}</p>
    </LandingReveal>
  </ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LandingReveal from './LandingReveal.vue'

const { t } = useI18n()

const items = [
  { key: 'unifiedGateway', icon: 'server', tint: 'tint-blue' },
  { key: 'multiAccount', icon: 'users', tint: 'tint-purple' },
  { key: 'balanceQuota', icon: 'creditCard', tint: 'tint-green' },
  { key: 'observability', icon: 'chartBar', tint: 'tint-teal' },
  { key: 'session', icon: 'link', tint: 'tint-orange' },
  { key: 'security', icon: 'lock', tint: 'tint-red' },
] as const
</script>

<style scoped>
.lp-features {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.lp-feature {
  height: 100%;
  padding: 24px 22px;
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card), var(--glass-highlight);
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
  list-style: none;
}

.lp-feature:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-pop), var(--glass-highlight);
}

.lp-feature-icon {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  margin-bottom: 16px;
}

.lp-feature-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.lp-feature-desc {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

@media (min-width: 640px) {
  .lp-features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .lp-features {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-feature {
    transition: none;
  }

  .lp-feature:hover {
    transform: none;
  }
}
</style>
