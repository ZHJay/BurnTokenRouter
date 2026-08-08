<template>
  <div class="lp-faq">
    <LandingReveal v-for="(key, i) in items" :key="key" :delay="i * 60">
      <!--
        原生 details/summary：无 JS 也可展开，键盘可达、读屏可识别，
        比自己用 button + v-if 造手风琴更稳（不必手写 aria-expanded/roving focus）。
      -->
      <details class="lp-faq-item">
        <!-- 问题用 h3 承载：否则按标题导航的读屏用户完全跳不到这 5 条问题 -->
        <summary class="lp-faq-q">
          <h3 class="lp-faq-q-text">{{ t(`home.faq.items.${key}.q`) }}</h3>
          <Icon name="chevronDown" size="sm" class="lp-faq-chevron" />
        </summary>
        <div class="lp-faq-a">{{ t(`home.faq.items.${key}.a`) }}</div>
      </details>
    </LandingReveal>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LandingReveal from './LandingReveal.vue'

const { t } = useI18n()

const items = ['compat', 'billing', 'limit', 'privacy', 'models'] as const
</script>

<style scoped>
.lp-faq {
  max-width: 760px;
  margin: 0 auto;
  display: grid;
  gap: 12px;
}

.lp-faq-item {
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.lp-faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 17px 20px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  list-style: none;
  transition: background 0.18s var(--ease);
}

/* 去掉默认三角（Safari 需要 ::-webkit-details-marker） */
.lp-faq-q::-webkit-details-marker {
  display: none;
}

.lp-faq-q:hover {
  background: var(--fill);
}

/*
  焦点环用实心 outline，不用 --blue-soft。
  --blue-soft 是 10% 蓝，叠在 --bg-elevated 上只有约 1.1:1，
  而 summary 是本区块唯一可键盘操作的控件——焦点看不见等于不可用。
*/
.lp-faq-q:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: -2px;
}

.lp-faq-q-text {
  min-width: 0;
  overflow-wrap: anywhere;
  /* h3 语义 + 继承 summary 的排版，不引入额外字号层级 */
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  color: inherit;
}

.lp-faq-chevron {
  flex: none;
  color: var(--text-tertiary);
  transition: transform var(--dur) var(--ease);
}

.lp-faq-item[open] .lp-faq-chevron {
  transform: rotate(180deg);
}

.lp-faq-a {
  padding: 0 20px 18px;
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: reduce) {
  .lp-faq-chevron,
  .lp-faq-q {
    transition: none;
  }
}
</style>
