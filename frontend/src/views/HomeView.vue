<template>
  <!-- Custom Home Content: Full Page Mode -->
  <div v-if="hasHomeContent" class="min-h-screen">
    <!-- iframe mode -->
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <!-- HTML mode - homeContent 经 marked + DOMPurify 默认 config 消毒（与公告/法律路径一致） -->
    <div v-else v-html="homeContentHtml"></div>
  </div>

  <!-- Compact Home Page -->
  <div
    v-else-if="compactHomeEnabled"
    data-testid="compact-home"
    class="landing-compact"
  >
    <header class="landing-nav glass">
      <nav class="landing-nav-inner">
        <div class="flex min-w-0 flex-1 items-center">
          <span class="wordmark truncate">{{ siteName }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="icon-btn"
            :aria-label="t('home.viewDocs')"
            :title="t('home.viewDocs')"
          >
            <Icon name="book" size="md" />
          </a>
          <router-link
            v-if="showModelPlazaEntry"
            to="/model-plaza"
            class="icon-btn"
            :aria-label="t('nav.modelPlaza')"
            :title="t('nav.modelPlaza')"
          >
            <Icon name="grid" size="md" />
          </router-link>
          <button
            class="icon-btn"
            :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="sun" size="md" />
            <Icon v-else name="moon" size="md" />
          </button>
          <router-link
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="btn btn-primary btn-sm"
          >
            {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
          </router-link>
        </div>
      </nav>
    </header>

    <main class="landing-main landing-main-center">
      <div class="landing-hero">
        <h1 class="landing-title">{{ siteName }}</h1>
        <p class="landing-sub">{{ siteSubtitle }}</p>
        <div class="landing-cta-row">
          <router-link
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="btn btn-primary landing-cta"
          >
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}
          </router-link>
        </div>
      </div>
    </main>

    <footer class="landing-footer">
      <div class="landing-footer-inner landing-footer-inner-center">
        <p class="landing-copy">&copy; {{ currentYear }} {{ siteName }}</p>
      </div>
    </footer>
  </div>

  <!-- Default Home Page: apple.com 产品页式营销落地页 -->
  <div v-else class="landing" data-testid="landing-full">
    <!-- ambient 光斑（玻璃质感三处保留位之一：ambient 环境渐变） -->
    <div class="landing-spot landing-spot-1" aria-hidden="true"></div>
    <div class="landing-spot landing-spot-2" aria-hidden="true"></div>
    <div class="landing-spot landing-spot-3" aria-hidden="true"></div>

    <header class="landing-nav glass">
      <nav class="landing-nav-inner">
        <!-- 纯文字 wordmark（品牌不渲染 logo 图片）。
             flex: 0 1 auto + min-width:0 让它可截断但不会被压成单字符。 -->
        <div class="landing-brand">
          <span class="wordmark">{{ siteName }}</span>
        </div>

        <div class="landing-nav-actions">
          <LocaleSwitcher />

          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="icon-btn landing-nav-docs"
            :aria-label="t('home.viewDocs')"
            :title="t('home.viewDocs')"
          >
            <Icon name="book" size="md" />
          </a>
          <router-link
            v-if="showModelPlazaEntry"
            to="/model-plaza"
            class="icon-btn"
            :aria-label="t('nav.modelPlaza')"
            :title="t('nav.modelPlaza')"
          >
            <Icon name="grid" size="md" />
          </router-link>

          <button
            class="icon-btn"
            :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="sun" size="md" />
            <Icon v-else name="moon" size="md" />
          </button>

          <router-link
            v-if="isAuthenticated"
            :to="dashboardPath"
            class="btn btn-primary btn-sm"
          >
            <span class="avatar-mini">{{ userInitial }}</span>
            {{ t('home.dashboard') }}
          </router-link>
          <router-link v-else to="/login" class="btn btn-primary btn-sm">
            {{ t('home.login') }}
          </router-link>
        </div>
      </nav>
    </header>

    <main class="landing-main">
      <!--
        首屏刻意零入场动效：这是未登录可访问的公开首页，也是全站第一印象，
        必须立刻可读，不能把可见性押在 JS + IntersectionObserver 上。
        入场动效只存在于首屏之下的区块（见各 LandingSection 内的 LandingReveal）。
      -->
      <section class="lp-hero-section">
        <div class="lp-shell">
          <LandingHero
            :site-name="siteName"
            :site-subtitle="siteSubtitle"
            :primary-to="primaryCtaTo"
            :primary-label="heroCtaLabel"
            secondary-href="#lp-console"
            :show-note="showHeroNote"
            :settings-ready="settingsReady"
          >
            <template #visual>
              <LandingTerminal :caption="t('home.hero.visualCaption')" />
            </template>
          </LandingHero>

          <div class="lp-caps-wrap">
            <LandingCapabilities />
          </div>
        </div>
      </section>

      <!-- 首屏之下：全部走 LandingReveal 入场，尊重 prefers-reduced-motion -->
      <LandingSection
        id="lp-console"
        divider
        :eyebrow="t('home.sections.preview')"
        :title="t('home.preview.title')"
        :subtitle="t('home.preview.subtitle')"
      >
        <LandingReveal>
          <LandingConsolePreview :site-name="siteName" />
        </LandingReveal>
      </LandingSection>

      <LandingSection
        divider
        :eyebrow="t('home.sections.painPoints')"
        :title="t('home.painPoints.title')"
      >
        <LandingPainPoints />
      </LandingSection>

      <LandingSection
        divider
        :eyebrow="t('home.sections.features')"
        :title="t('home.solutions.title')"
      >
        <LandingFeatures />
      </LandingSection>

      <LandingSection
        divider
        :eyebrow="t('home.sections.solutions')"
        :title="t('home.solutions.subtitle')"
      >
        <LandingSteps :base-url="baseUrl" />
      </LandingSection>

      <LandingSection
        divider
        :eyebrow="t('home.sections.comparison')"
        :title="t('home.comparison.title')"
      >
        <LandingComparison />
      </LandingSection>

      <LandingSection
        divider
        :eyebrow="t('home.sections.providers')"
        :title="t('home.providers.title')"
        :subtitle="t('home.providers.description')"
      >
        <LandingProviders />
      </LandingSection>

      <LandingSection
        divider
        :eyebrow="t('home.sections.faq')"
        :title="t('home.faq.title')"
        :subtitle="t('home.faq.subtitle')"
      >
        <LandingFaq />
      </LandingSection>

      <section class="lp-cta-section">
        <div class="lp-shell">
          <LandingCtaBand
            :primary-to="primaryCtaTo"
            :primary-label="bandCtaLabel"
            :doc-url="docUrl"
          />
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="landing-footer-inner">
        <p class="landing-copy">
          &copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}
        </p>
        <div class="landing-footer-links">
          <router-link to="/key-usage" class="landing-link">
            {{ t('keyUsage.title') }}
          </router-link>
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="landing-link"
          >
            {{ t('home.docs') }}
          </a>
          <a
            :href="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="landing-link"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'
import { renderMarkdown } from '@/utils/markdown'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { useTheme } from '@/composables/useTheme'
import LandingHero from '@/components/landing/LandingHero.vue'
import LandingTerminal from '@/components/landing/LandingTerminal.vue'
import LandingCapabilities from '@/components/landing/LandingCapabilities.vue'
import LandingSection from '@/components/landing/LandingSection.vue'
import LandingReveal from '@/components/landing/LandingReveal.vue'
import LandingConsolePreview from '@/components/landing/LandingConsolePreview.vue'
import LandingPainPoints from '@/components/landing/LandingPainPoints.vue'
import LandingFeatures from '@/components/landing/LandingFeatures.vue'
import LandingSteps from '@/components/landing/LandingSteps.vue'
import LandingComparison from '@/components/landing/LandingComparison.vue'
import LandingProviders from '@/components/landing/LandingProviders.vue'
import LandingFaq from '@/components/landing/LandingFaq.vue'
import LandingCtaBand from '@/components/landing/LandingCtaBand.vue'

const { t } = useI18n()
const { isDark, toggleTheme } = useTheme()

const authStore = useAuthStore()
const appStore = useAppStore()

// Site settings - directly from appStore (already initialized from injected config)
const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API')
const siteSubtitle = computed(() => appStore.cachedPublicSettings?.site_subtitle || 'AI API Gateway Platform')
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
// 管理员配置的 markdown/HTML 内容，渲染前一律过 DOMPurify（S2：此前是全站唯一未消毒的 v-html 点）
const homeContentHtml = computed(() => renderMarkdown(homeContent.value))
const hasHomeContent = computed(() => homeContent.value.trim().length > 0)
const compactHomeEnabled = computed(() => appStore.cachedPublicSettings?.compact_home_enabled === true)

// Check if homeContent is a URL (for iframe display)
const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

// GitHub URL
const githubUrl = 'https://github.com/Wei-Shaw/sub2api'

// Auth state
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))
const modelPlazaRequiresAuth = computed(
  () => appStore.cachedPublicSettings?.model_plaza_require_auth === true
)
const showModelPlazaEntry = computed(
  () => modelPlazaEnabled.value && (isAuthenticated.value || !modelPlazaRequiresAuth.value)
)
const dashboardPath = computed(() => isAdmin.value ? '/admin/dashboard' : '/dashboard')
const userInitial = computed(() => {
  const user = authStore.user
  if (!user || !user.email) return ''
  return user.email.charAt(0).toUpperCase()
})

/**
 * 注册开关：registration_enabled 是既有公开设置（src/types/index.ts）。
 * 关闭时把主 CTA 指回 /login，避免把访客送到一个"注册已关闭"的死路上，
 * 同时不展示"送试用额度"这类承诺。
 */
const registrationEnabled = computed(
  () => appStore.cachedPublicSettings?.registration_enabled === true
)

/**
 * 公开设置是否已就位。用于门控首屏主 CTA：设置未到位时
 * registrationEnabled 恒为 false，若直接渲染会出现「登录 → 立即开始」的文案跳变。
 * 生产环境从 window.__APP_CONFIG__ 同步注入，挂载前即为 true。
 */
const settingsReady = computed(() => appStore.publicSettingsLoaded)

/** 主 CTA 目标：已登录 → 控制台；可注册 → 注册页；否则 → 登录页 */
const primaryCtaTo = computed(() => {
  if (isAuthenticated.value) return dashboardPath.value
  return registrationEnabled.value ? '/register' : '/login'
})

const heroCtaLabel = computed(() => {
  if (isAuthenticated.value) return t('home.goToDashboard')
  return registrationEnabled.value ? t('home.getStarted') : t('home.login')
})

const bandCtaLabel = computed(() => {
  if (isAuthenticated.value) return t('home.goToDashboard')
  return registrationEnabled.value ? t('home.cta.button') : t('home.login')
})

const showHeroNote = computed(
  () => settingsReady.value && !isAuthenticated.value && registrationEnabled.value
)

/** 代码示例里的 Base URL：用当前站点来源，比写死示例域名更可信 */
const baseUrl = computed(() =>
  typeof window === 'undefined' ? 'https://your-domain.example' : window.location.origin
)

// Current year for footer
const currentYear = computed(() => new Date().getFullYear())

onMounted(() => {
  // Check auth state
  authStore.checkAuth()

  // Ensure public settings are loaded (will use cache if already loaded from injected config)
  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
})
</script>

<style scoped>
/* =========================================================================
   Landing · Apple 落地页外壳(组件样式来自全局设计系统 style.css)
   ========================================================================= */

.landing,
.landing-compact {
  position: relative;
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  flex-direction: column;
  background: var(--bg);
  color: var(--text-primary);
  overflow-x: clip;
}

/* ambient 光斑(与登录页同语言) */
.landing-spot {
  position: fixed;
  z-index: 0;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform;
}
.landing-spot-1 {
  width: 480px;
  height: 480px;
  top: -160px;
  left: -140px;
  background: var(--blue);
  opacity: 0.13;
  filter: blur(100px);
  animation: landingDrift1 26s var(--ease) infinite alternate;
}
.landing-spot-2 {
  width: 440px;
  height: 440px;
  top: 5%;
  right: -160px;
  background: var(--purple);
  opacity: 0.1;
  filter: blur(100px);
  animation: landingDrift2 30s var(--ease) infinite alternate;
}
.landing-spot-3 {
  width: 480px;
  height: 480px;
  bottom: -200px;
  left: 25%;
  background: var(--teal);
  opacity: 0.09;
  filter: blur(110px);
  animation: landingDrift3 34s var(--ease) infinite alternate;
}
:global(html.dark) .landing-spot-1 { opacity: 0.2; }
:global(html.dark) .landing-spot-2 { opacity: 0.16; }
:global(html.dark) .landing-spot-3 { opacity: 0.14; }

@keyframes landingDrift1 {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(90px, 70px, 0) scale(1.15); }
}
@keyframes landingDrift2 {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(-80px, 60px, 0) scale(1.1); }
}
@keyframes landingDrift3 {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(-70px, -50px, 0) scale(1.12); }
}

/* 48px 磨砂顶栏(与全局 GlobalNav 同语言) */
.landing-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  height: var(--gn-height, 48px);
  border-bottom: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight);
}

.landing-nav-inner {
  max-width: 1080px;
  height: 100%;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/*
  品牌区取剩余空间并允许省略号截断；操作簇 flex:none 永不收缩。
  Phase B 教训 #7：site_name 长度不可预期，绝不能让它成为唯一可压缩项被压成 "S"。
*/
.landing-brand {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}

.landing-nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

/*
  极窄屏隐藏文档图标：操作簇是 flex:none，宽度只增不减，
  留给品牌名的空间会被它挤没。收掉这个**可选**入口，
  比给 wordmark 加 min-width 更安全——后者只是把溢出从品牌名转移到整行。
  文档入口在页脚仍然可达，不会丢失。
*/
@media (max-width: 420px) {
  .landing-nav-docs {
    display: none;
  }
}

.wordmark {
  max-width: 100%;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-mini {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
  font-size: 10px;
  font-weight: 700;
}

.landing-main {
  position: relative;
  z-index: 1;
  width: 100%;
  flex: 1;
}

/* 紧凑首页保留自己的内容盒；完整落地页由各 section 自带内边距 */
.landing-main-center {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 20px;
}

/* -------- 完整落地页版式骨架 -------- */
.lp-shell {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 20px;
}

.lp-hero-section {
  padding: 64px 0 8px;
}

.lp-caps-wrap {
  margin-top: 56px;
}

.lp-cta-section {
  padding: 24px 0 88px;
}

/* 锚点：留出磨砂顶栏的高度，避免标题被压在栏下 */
#lp-console {
  scroll-margin-top: calc(var(--gn-height, 48px) + 16px);
}

/* -------- 紧凑首页专用（.landing-compact 分支） -------- */
.landing-hero {
  text-align: center;
}

.landing-title {
  font-size: clamp(40px, 6vw, 68px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.045em;
  overflow-wrap: anywhere;
  background: linear-gradient(120deg, var(--blue) 10%, var(--purple) 55%, var(--teal) 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.landing-sub {
  margin-top: 18px;
  font-size: 17px;
  line-height: 1.6;
  color: var(--text-secondary);
  max-width: 520px;
  margin-inline: auto;
  overflow-wrap: anywhere;
}

.landing-cta-row {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}

.landing-cta {
  height: 46px;
  padding: 0 30px;
  font-size: 15px;
}

/* Footer */
.landing-footer {
  position: relative;
  z-index: 1;
  border-top: 0.5px solid var(--separator);
}

.landing-footer-inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
@media (min-width: 640px) {
  .landing-footer-inner {
    flex-direction: row;
    text-align: left;
  }
}

.landing-footer-inner-center {
  justify-content: center;
}

.landing-footer-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.landing-copy {
  font-size: 13px;
  color: var(--text-tertiary);
}

.landing-link {
  font-size: 13px;
  color: var(--text-tertiary);
  transition: color 0.18s var(--ease);
}
.landing-link:hover {
  color: var(--text-primary);
  text-decoration: none;
}

/* 终端装饰窗的样式已随组件迁到 components/landing/LandingTerminal.vue */

@media (max-width: 768px) {
  .lp-shell {
    padding: 0 16px;
  }
  .lp-hero-section {
    padding: 40px 0 8px;
  }
  .lp-caps-wrap {
    margin-top: 40px;
  }
  .lp-cta-section {
    padding: 16px 0 64px;
  }
  .landing-main-center {
    padding: 40px 16px;
  }
  .landing-title {
    font-size: 38px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-spot {
    animation: none;
  }
}
</style>
