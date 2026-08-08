<template>
  <!--
    role="list" 是必要的：list-style:none 会让 WebKit 去掉 list 语义。
    本区块**刻意不做入场动效**——它属于首屏，公开页首屏必须立刻可读，
    不能把可见性押在 JS + IntersectionObserver 上。
  -->
  <ul class="lp-caps" role="list">
    <li v-for="item in items" :key="item.key" class="lp-cap">
      <p class="lp-cap-value">{{ t(`home.capabilities.${item.key}.value`) }}</p>
      <p class="lp-cap-label">{{ t(`home.capabilities.${item.key}.label`) }}</p>
      <p class="lp-cap-desc">{{ t(`home.capabilities.${item.key}.desc`) }}</p>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const items = [
  { key: 'models' },
  { key: 'protocol' },
  { key: 'billing' },
  { key: 'selfHosted' },
] as const
</script>

<style scoped>
.lp-caps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.lp-cap {
  height: 100%;
  padding: 20px 18px;
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card);
  list-style: none;
}

.lp-cap-value {
  font-size: clamp(22px, 2.4vw, 28px);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--blue);
  overflow-wrap: anywhere;
}

.lp-cap-label {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.lp-cap-desc {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

@media (min-width: 1024px) {
  .lp-caps {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
