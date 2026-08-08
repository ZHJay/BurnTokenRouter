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
    <!-- HTML mode - SECURITY: homeContent is admin-only setting, XSS risk is acceptable -->
    <div v-else v-html="homeContent"></div>
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

  <!-- Default Home Page -->
  <div v-else class="landing">
    <!-- ambient 光斑 -->
    <div class="landing-spot landing-spot-1" aria-hidden="true"></div>
    <div class="landing-spot landing-spot-2" aria-hidden="true"></div>
    <div class="landing-spot landing-spot-3" aria-hidden="true"></div>

    <header class="landing-nav glass">
      <nav class="landing-nav-inner">
        <!-- 纯文字 wordmark(品牌不再渲染 logo 图片) -->
        <div class="flex min-w-0 items-center">
          <span class="wordmark truncate">{{ siteName }}</span>
        </div>

        <div class="flex items-center gap-2">
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
      <!-- Hero: Left/Right Layout -->
      <div class="landing-hero-split">
        <div class="landing-hero">
          <h1 class="landing-title">{{ siteName }}</h1>
          <p class="landing-sub">{{ siteSubtitle }}</p>
          <div class="landing-cta-row">
            <router-link
              :to="isAuthenticated ? dashboardPath : '/login'"
              class="btn btn-primary landing-cta"
            >
              {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}
              <Icon name="arrowRight" size="md" :stroke-width="2" />
            </router-link>
          </div>
        </div>

        <!-- Terminal Animation -->
        <div class="landing-hero-visual">
          <div class="terminal-container">
            <div class="terminal-window">
              <div class="terminal-header">
                <div class="terminal-buttons">
                  <span class="btn-close"></span>
                  <span class="btn-minimize"></span>
                  <span class="btn-maximize"></span>
                </div>
                <span class="terminal-title">terminal</span>
              </div>
              <div class="terminal-body">
                <div class="code-line line-1">
                  <span class="code-prompt">$</span>
                  <span class="code-cmd">curl</span>
                  <span class="code-flag">-X POST</span>
                  <span class="code-url">/v1/messages</span>
                </div>
                <div class="code-line line-2">
                  <span class="code-comment"># Routing to upstream...</span>
                </div>
                <div class="code-line line-3">
                  <span class="code-success">200 OK</span>
                  <span class="code-response">{ "content": "Hello!" }</span>
                </div>
                <div class="code-line line-4">
                  <span class="code-prompt">$</span>
                  <span class="cursor"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Tags -->
      <div class="landing-tags">
        <span class="tag-chip">
          <Icon name="swap" size="sm" class="tag-chip-icon" />
          {{ t('home.tags.subscriptionToApi') }}
        </span>
        <span class="tag-chip">
          <Icon name="shield" size="sm" class="tag-chip-icon" />
          {{ t('home.tags.stickySession') }}
        </span>
        <span class="tag-chip">
          <Icon name="chart" size="sm" class="tag-chip-icon" />
          {{ t('home.tags.realtimeBilling') }}
        </span>
      </div>

      <!-- Features Grid -->
      <div class="landing-grid">
        <div class="card card-hover landing-feature">
          <div class="feature-icon tint-blue">
            <Icon name="server" size="lg" />
          </div>
          <h3 class="feature-title">{{ t('home.features.unifiedGateway') }}</h3>
          <p class="feature-desc">{{ t('home.features.unifiedGatewayDesc') }}</p>
        </div>

        <div class="card card-hover landing-feature">
          <div class="feature-icon tint-purple">
            <Icon name="users" size="lg" />
          </div>
          <h3 class="feature-title">{{ t('home.features.multiAccount') }}</h3>
          <p class="feature-desc">{{ t('home.features.multiAccountDesc') }}</p>
        </div>

        <div class="card card-hover landing-feature">
          <div class="feature-icon tint-green">
            <Icon name="creditCard" size="lg" />
          </div>
          <h3 class="feature-title">{{ t('home.features.balanceQuota') }}</h3>
          <p class="feature-desc">{{ t('home.features.balanceQuotaDesc') }}</p>
        </div>
      </div>

      <!-- Supported Providers -->
      <div class="landing-providers">
        <h2 class="landing-section-title">{{ t('home.providers.title') }}</h2>
        <p class="landing-section-sub">{{ t('home.providers.description') }}</p>

        <div class="provider-list">
          <div class="provider-chip">
            <span class="provider-mark provider-mark-claude">C</span>
            <span class="provider-name">{{ t('home.providers.claude') }}</span>
            <span class="badge b-green">{{ t('home.providers.supported') }}</span>
          </div>
          <div class="provider-chip">
            <span class="provider-mark provider-mark-gpt">G</span>
            <span class="provider-name">GPT</span>
            <span class="badge b-green">{{ t('home.providers.supported') }}</span>
          </div>
          <div class="provider-chip">
            <span class="provider-mark provider-mark-gemini">G</span>
            <span class="provider-name">{{ t('home.providers.gemini') }}</span>
            <span class="badge b-green">{{ t('home.providers.supported') }}</span>
          </div>
          <div class="provider-chip">
            <span class="provider-mark provider-mark-antigravity">A</span>
            <span class="provider-name">{{ t('home.providers.antigravity') }}</span>
            <span class="badge b-green">{{ t('home.providers.supported') }}</span>
          </div>
          <div class="provider-chip provider-chip-soon">
            <span class="provider-mark provider-mark-more">+</span>
            <span class="provider-name">{{ t('home.providers.more') }}</span>
            <span class="gpill">{{ t('home.providers.soon') }}</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="landing-footer-inner">
        <p class="landing-copy">
          &copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}
        </p>
        <div class="flex items-center gap-4">
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
import { useTheme } from '@/composables/useTheme'

const { t } = useI18n()
const { isDark, toggleTheme } = useTheme()

const authStore = useAuthStore()
const appStore = useAppStore()

// Site settings - directly from appStore (already initialized from injected config)
const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API')
const siteSubtitle = computed(() => appStore.cachedPublicSettings?.site_subtitle || 'AI API Gateway Platform')
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
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
const dashboardPath = computed(() => isAdmin.value ? '/admin/dashboard' : '/dashboard')
const userInitial = computed(() => {
  const user = authStore.user
  if (!user || !user.email) return ''
  return user.email.charAt(0).toUpperCase()
})

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

.wordmark {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  white-space: nowrap;
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
  max-width: 1080px;
  margin: 0 auto;
  padding: 64px 20px 32px;
  flex: 1;
}

.landing-main-center {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 40px;
  padding-bottom: 40px;
}

/* Hero */
.landing-hero-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: 48px;
  align-items: center;
  margin-bottom: 56px;
}
@media (min-width: 1024px) {
  .landing-hero-split {
    grid-template-columns: 1.05fr 0.95fr;
    gap: 64px;
  }
}

.landing-hero {
  text-align: center;
}
@media (min-width: 1024px) {
  .landing-hero {
    text-align: left;
  }
}

.landing-title {
  font-size: clamp(40px, 6vw, 68px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.045em;
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
  overflow-wrap: anywhere;
}
@media (min-width: 1024px) {
  .landing-sub { margin-inline: 0; }
}

.landing-cta-row {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}
@media (min-width: 1024px) {
  .landing-cta-row { justify-content: flex-start; }
}

.landing-cta {
  height: 46px;
  padding: 0 30px;
  font-size: 15px;
}

.landing-hero-visual {
  display: flex;
  justify-content: center;
}

/* Feature tags */
.landing-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-bottom: 48px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--r-pill);
  background: var(--fill);
  border: 0.5px solid var(--separator);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.tag-chip-icon {
  color: var(--blue);
}

/* Features grid */
.landing-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  margin-bottom: 56px;
}
@media (min-width: 768px) {
  .landing-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.landing-feature {
  padding: 26px 24px;
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.feature-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.feature-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* Providers */
.landing-providers {
  text-align: center;
  margin-bottom: 24px;
}

.landing-section-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.landing-section-sub {
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.provider-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.provider-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px 10px 10px;
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card);
}

.provider-chip-soon {
  opacity: 0.6;
}

.provider-mark {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

/* 品牌字形配色(Claude/GPT/Gemini/Antigravity 厂商品牌色,保留) */
.provider-mark-claude {
  background: linear-gradient(160deg, #d97757, #c2612f);
}
.provider-mark-gpt {
  background: linear-gradient(160deg, #34c759, #28a745);
}
.provider-mark-gemini {
  background: linear-gradient(160deg, #4285f4, #3b76e0);
}
.provider-mark-antigravity {
  background: linear-gradient(160deg, #f43f5e, #db2777);
}
.provider-mark-more {
  background: linear-gradient(160deg, #6e6e73, #3a3a3c);
}

.provider-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
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

/* =========================================================================
   Terminal 装饰窗(固定深色表面,明暗模式均保持深色终端观感)
   ========================================================================= */
.terminal-container {
  position: relative;
  display: inline-block;
  width: min(420px, 100%);
}

.terminal-window {
  background: linear-gradient(145deg, #1c1c1e 0%, #000000 100%);
  border-radius: var(--r-lg);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-pop), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  overflow: hidden;
  transform: perspective(1000px) rotateX(2deg) rotateY(-2deg);
  transition: transform 0.3s var(--ease);
}

.terminal-window:hover {
  transform: perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(-4px);
}

.terminal-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(28, 28, 30, 0.7);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
}

.terminal-buttons {
  display: flex;
  gap: 8px;
}

.terminal-buttons span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.btn-close {
  background: var(--red);
}
.btn-minimize {
  background: var(--orange);
}
.btn-maximize {
  background: var(--green);
}

.terminal-title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  color: var(--text-tertiary);
  margin-right: 52px;
}

.terminal-body {
  padding: 20px 24px;
  font-family: ui-monospace, 'Fira Code', monospace;
  font-size: 13.5px;
  line-height: 2;
}

.code-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  opacity: 0;
  animation: line-appear 0.5s var(--ease) forwards;
}

.line-1 { animation-delay: 0.3s; }
.line-2 { animation-delay: 1s; }
.line-3 { animation-delay: 1.8s; }
.line-4 { animation-delay: 2.5s; }

@keyframes line-appear {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 语法高亮:全部走 iOS 语义色,明暗模式均保持可读 */
.code-prompt {
  color: var(--green);
  font-weight: bold;
}
.code-cmd {
  color: var(--blue-ios);
}
.code-flag {
  color: var(--purple);
}
.code-url {
  color: var(--teal);
}
.code-comment {
  color: var(--text-tertiary);
  font-style: italic;
}
.code-success {
  color: var(--green);
  background: rgba(52, 199, 89, 0.16);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}
.code-response {
  color: var(--orange);
}

/* Blinking Cursor */
.cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background: var(--green);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

@media (max-width: 768px) {
  .landing-main {
    padding: 40px 16px 24px;
  }
  .landing-title {
    font-size: 38px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-spot,
  .code-line,
  .cursor {
    animation: none;
  }
}
</style>
