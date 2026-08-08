<template>
  <div class="lp-hero">
    <div class="lp-hero-copy">
      <p class="lp-hero-eyebrow">{{ t('home.hero.eyebrow') }}</p>

      <!-- 品牌 = 站点名纯文本 wordmark，不渲染任何 logo 图片 -->
      <h1 class="lp-hero-title">{{ siteName }}</h1>

      <p class="lp-hero-subtitle">{{ siteSubtitle }}</p>
      <p class="lp-hero-desc">{{ t('home.heroDescription') }}</p>

      <div class="lp-hero-cta">
        <!--
          设置未加载完时渲染同尺寸占位，而不是先渲染一个"登录"再跳成"立即开始"。
          理由：registration_enabled 未到位时 `=== true` 恒为 false，直接渲染会让
          首屏 CTA 文案发生语义跳变（登录 → 立即开始），这和「首屏不该等异步状态」
          是同一类问题。占位保持 46px 高度，布局不跳；且生产环境走注入式配置
          （initSettings 同步 applySettings），publicSettingsLoaded 在挂载前即为 true，
          这个占位实际不会出现——它只兜住"从接口拉取"这条路径。
        -->
        <span
          v-if="!settingsReady"
          class="lp-cta-skeleton"
          aria-hidden="true"
          data-testid="hero-cta-skeleton"
        ></span>
        <router-link v-else :to="primaryTo" class="btn btn-primary lp-cta-primary">
          {{ primaryLabel }}
          <Icon name="arrowRight" size="md" :stroke-width="2" />
        </router-link>
        <a :href="secondaryHref" class="btn btn-secondary lp-cta-secondary">
          {{ t('home.hero.secondaryCta') }}
        </a>
      </div>

      <!--
        note 槽位始终占位：否则设置到位后它才出现，会把下面的 chips 推下去。
        用 visibility 而非 v-if，高度在「加载中 / 可注册 / 不可注册」三态完全一致。
      -->
      <p
        class="lp-hero-note"
        :class="{ 'is-hidden': !showNote }"
        :aria-hidden="showNote ? undefined : 'true'"
      >{{ t('home.hero.note') }}</p>

      <ul class="lp-hero-chips">
        <li v-for="chip in chips" :key="chip.key" class="lp-chip">
          <Icon :name="chip.icon" size="sm" class="lp-chip-icon" />
          {{ t(`home.tags.${chip.key}`) }}
        </li>
      </ul>
    </div>

    <div class="lp-hero-visual">
      <slot name="visual" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

defineProps<{
  siteName: string
  siteSubtitle: string
  primaryTo: string
  primaryLabel: string
  /** 页内锚点，无 JS 也可用 */
  secondaryHref: string
  /** 仅在可注册时展示"送试用额度"这类承诺 */
  showNote: boolean
  /** 公开设置是否已就位。false 时主 CTA 渲染同尺寸占位，避免文案跳变 */
  settingsReady: boolean
}>()

const { t } = useI18n()

const chips = [
  { key: 'subscriptionToApi', icon: 'swap' },
  { key: 'stickySession', icon: 'shield' },
  { key: 'realtimeBilling', icon: 'chart' },
] as const
</script>

<style scoped>
.lp-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 44px;
  align-items: center;
}

.lp-hero-copy {
  min-width: 0;
  text-align: center;
}

.lp-hero-eyebrow {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--blue);
}

.lp-hero-title {
  margin-top: 14px;
  font-size: clamp(38px, 6vw, 68px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.045em;
  /* 站点名长度不可预期：允许任意位置断行，绝不溢出 */
  overflow-wrap: anywhere;
  background: linear-gradient(120deg, var(--blue) 10%, var(--purple) 55%, var(--teal) 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lp-hero-subtitle {
  margin-top: 16px;
  font-size: clamp(19px, 2.2vw, 26px);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.025em;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.lp-hero-desc {
  margin-top: 14px;
  font-size: 17px;
  line-height: 1.6;
  color: var(--text-secondary);
  max-width: 520px;
  margin-inline: auto;
  overflow-wrap: anywhere;
}

.lp-hero-cta {
  margin-top: 28px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.lp-cta-primary,
.lp-cta-secondary {
  height: 46px;
  padding: 0 26px;
  font-size: 15px;
}

/* 主 CTA 占位：与 .lp-cta-primary 同高同圆角，纯中性填充，不做闪烁动画 */
.lp-cta-skeleton {
  display: inline-block;
  width: 148px;
  height: 46px;
  border-radius: var(--r-pill);
  background: var(--fill);
  border: 0.5px solid var(--separator);
}

.lp-hero-note {
  margin-top: 14px;
  font-size: 13px;
  color: var(--text-tertiary);
}

/* 保留占位高度但不可见，也不进无障碍树 */
.lp-hero-note.is-hidden {
  visibility: hidden;
}

.lp-hero-chips {
  margin-top: 26px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  list-style: none;
  padding: 0;
}

.lp-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--r-pill);
  background: var(--fill);
  border: 0.5px solid var(--separator);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.lp-chip-icon {
  color: var(--blue);
  flex: none;
}

.lp-hero-visual {
  min-width: 0;
  display: flex;
  justify-content: center;
}

@media (min-width: 1024px) {
  .lp-hero {
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
    gap: 56px;
  }

  .lp-hero-copy {
    text-align: left;
  }

  .lp-hero-desc {
    margin-inline: 0;
  }

  .lp-hero-cta,
  .lp-hero-chips {
    justify-content: flex-start;
  }

  .lp-hero-visual {
    justify-content: flex-end;
  }
}
</style>
