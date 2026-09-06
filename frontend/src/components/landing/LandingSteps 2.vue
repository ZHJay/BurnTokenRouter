<template>
  <div>
    <ol class="lp-steps" role="list">
      <LandingReveal
        v-for="(item, i) in items"
        :key="item.key"
        as="li"
        class="lp-step"
        :delay="i * 80"
      >
        <span class="lp-step-label">{{ t('home.steps.stepLabel', { index: i + 1 }) }}</span>
        <h3 class="lp-step-title">{{ t(`home.steps.items.${item.key}.title`) }}</h3>
        <p class="lp-step-desc">{{ t(`home.steps.items.${item.key}.desc`) }}</p>
      </LandingReveal>
    </ol>

    <LandingReveal :delay="120">
      <figure class="lp-code">
        <div class="lp-code-scroll">
          <pre class="lp-code-pre"><code><span class="lp-c-key">ANTHROPIC_BASE_URL</span><span class="lp-c-op">=</span><span class="lp-c-val">{{ baseUrl }}</span>
<span class="lp-c-key">ANTHROPIC_AUTH_TOKEN</span><span class="lp-c-op">=</span><span class="lp-c-val">sk-••••••••••••</span></code></pre>
        </div>
        <figcaption class="lp-code-caption">{{ t('home.steps.codeCaption') }}</figcaption>
      </figure>
    </LandingReveal>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LandingReveal from './LandingReveal.vue'

defineProps<{
  /** 当前站点来源，由 HomeView 从 window.location.origin 求得 */
  baseUrl: string
}>()

const { t } = useI18n()

const items = [
  { key: 'register' },
  { key: 'key' },
  { key: 'call' },
] as const
</script>

<style scoped>
.lp-steps {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.lp-step {
  height: 100%;
  padding: 22px 20px;
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card);
  list-style: none;
}

.lp-step-label {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 12px;
  font-weight: 600;
}

.lp-step-title {
  margin-top: 13px;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.lp-step-desc {
  margin-top: 7px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

/* 代码示例块 */
.lp-code {
  margin: 22px 0 0;
}

.lp-code-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: var(--r-md);
  background: var(--fill);
  border: 0.5px solid var(--separator);
}

.lp-code-pre {
  margin: 0;
  padding: 16px 18px;
  font-family: "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 13px;
  line-height: 1.85;
}

.lp-c-key { color: var(--purple); }
.lp-c-op { color: var(--text-tertiary); }
.lp-c-val { color: var(--blue); }

.lp-code-caption {
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--text-tertiary);
}

@media (min-width: 768px) {
  .lp-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
