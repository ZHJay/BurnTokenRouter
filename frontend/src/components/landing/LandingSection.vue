<template>
  <section class="lp-section" :class="[`is-${align}`, { 'has-divider': divider }]">
    <div class="lp-section-inner">
      <LandingReveal v-if="eyebrow || title || subtitle">
        <header class="lp-section-head">
          <p v-if="eyebrow" class="lp-eyebrow">{{ eyebrow }}</p>
          <h2 v-if="title" class="lp-section-title">{{ title }}</h2>
          <p v-if="subtitle" class="lp-section-sub">{{ subtitle }}</p>
        </header>
      </LandingReveal>
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import LandingReveal from './LandingReveal.vue'

withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  subtitle?: string
  align?: 'center' | 'start'
  divider?: boolean
}>(), { align: 'center', divider: false })
</script>

<style scoped>
.lp-section {
  position: relative;
  width: 100%;
  padding: 72px 0;
}

.lp-section.has-divider {
  border-top: 0.5px solid var(--separator);
}

.lp-section-inner {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 20px;
}

.lp-section-head {
  max-width: 660px;
  margin-bottom: 40px;
}

.lp-section.is-center .lp-section-head {
  margin-inline: auto;
  text-align: center;
}

.lp-eyebrow {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--blue);
  margin-bottom: 12px;
}

.lp-section-title {
  font-size: clamp(26px, 3.4vw, 40px);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.lp-section-sub {
  margin-top: 14px;
  font-size: 17px;
  line-height: 1.6;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .lp-section {
    padding: 52px 0;
  }

  .lp-section-inner {
    padding: 0 16px;
  }

  .lp-section-head {
    margin-bottom: 28px;
  }

  .lp-section-sub {
    font-size: 15px;
  }
}
</style>
