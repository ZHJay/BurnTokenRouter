<template>
  <ul class="lp-pains" role="list">
    <LandingReveal
      v-for="(item, i) in items"
      :key="item.key"
      as="li"
      class="lp-pain"
      :delay="i * 70"
    >
      <span class="lp-pain-icon" :class="item.tint">
        <Icon :name="item.icon" size="md" />
      </span>
      <h3 class="lp-pain-title">{{ t(`home.painPoints.items.${item.key}.title`) }}</h3>
      <p class="lp-pain-desc">{{ t(`home.painPoints.items.${item.key}.desc`) }}</p>
    </LandingReveal>
  </ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LandingReveal from './LandingReveal.vue'

const { t } = useI18n()

const items = [
  { key: 'expensive', icon: 'creditCard', tint: 'tint-orange' },
  { key: 'complex', icon: 'key', tint: 'tint-purple' },
  { key: 'unstable', icon: 'exclamationTriangle', tint: 'tint-red' },
  { key: 'noControl', icon: 'chart', tint: 'tint-teal' },
] as const
</script>

<style scoped>
.lp-pains {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.lp-pain {
  height: 100%;
  padding: 22px 20px;
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card);
  list-style: none;
}

.lp-pain-icon {
  display: flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  margin-bottom: 14px;
}

.lp-pain-title {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.lp-pain-desc {
  margin-top: 7px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

@media (min-width: 640px) {
  .lp-pains {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .lp-pains {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
