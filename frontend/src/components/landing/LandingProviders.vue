<template>
  <ul class="lp-providers" role="list">
    <LandingReveal
      v-for="(item, i) in items"
      :key="item.label"
      as="li"
      class="lp-provider"
      :class="{ 'is-soon': item.soon }"
      :delay="i * 60"
    >
      <span class="lp-provider-mark" :class="item.mark" aria-hidden="true">{{ item.glyph }}</span>
      <span class="lp-provider-name">{{ item.label }}</span>
      <span v-if="item.soon" class="gpill">{{ t('home.providers.soon') }}</span>
      <span v-else class="badge b-green">{{ t('home.providers.supported') }}</span>
    </LandingReveal>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LandingReveal from './LandingReveal.vue'

const { t } = useI18n()

// GPT 是产品专有名词，无 i18n key，直接字面量
const items = computed(() => [
  { label: t('home.providers.claude'), glyph: 'C', mark: 'is-claude', soon: false },
  { label: 'GPT', glyph: 'G', mark: 'is-gpt', soon: false },
  { label: t('home.providers.gemini'), glyph: 'G', mark: 'is-gemini', soon: false },
  { label: t('home.providers.antigravity'), glyph: 'A', mark: 'is-antigravity', soon: false },
  { label: t('home.providers.more'), glyph: '+', mark: 'is-more', soon: true },
])
</script>

<style scoped>
.lp-providers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.lp-provider {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 16px 10px 10px;
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card);
  list-style: none;
}

/*
  「即将推出」只压暗装饰字形，不压文字与徽章。
  整个 li 挂 opacity 会把 .gpill（--text-secondary on --fill）压到约 2.4:1，
  低于 AA 4.5:1——弱化状态不该以牺牲可读性为代价。
*/
.lp-provider.is-soon .lp-provider-mark {
  opacity: 0.55;
}

.lp-provider-mark {
  display: flex;
  width: 32px;
  height: 32px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

/*
  仅**外部厂商识别色**允许字面值（与 Phase B 既有 .provider-mark-* 同一处理）：
  Claude / Gemini / Antigravity 三家确为厂商品牌色。
  GPT 与「更多」原先写的 #34c759 / #6e6e73 其实就是本站的 --green 与
  --text-secondary，并非厂商色，故改回 token——否则这条例外注释是假的。
*/
.lp-provider-mark.is-claude { background: linear-gradient(160deg, #d97757, #c2612f); }
.lp-provider-mark.is-gemini { background: linear-gradient(160deg, #4285f4, #3b76e0); }
.lp-provider-mark.is-antigravity { background: linear-gradient(160deg, #f43f5e, #db2777); }
.lp-provider-mark.is-gpt { background: var(--green); }
.lp-provider-mark.is-more { background: var(--gray-dot); }

.lp-provider-name {
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}
</style>
