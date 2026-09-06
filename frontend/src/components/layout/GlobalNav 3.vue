<!--
  `.gn-user` is set for non-admin navKinds: the user nav renders 11-12
  self-service links (~1128px of min-content) which cannot share the 1360px
  measure with the full action cluster, so the class switches the bar to the
  compact-cluster / burger layout described in global-nav.css ("User nav
  bands").
-->
<template>
  <nav
    class="gn"
    :class="{ 'gn-switching': flyoutSwitching, 'gn-user': navKind === 'user' }"
    :aria-label="t('nav.mainNavigation')"
    ref="navRef"
  >
    <div class="gn-inner">
      <!-- Mobile burger -->
      <button
        v-if="hasNavItems"
        class="gn-icon-btn gn-burger"
        :aria-label="t('common.toggleMenu')"
        :aria-expanded="mobileOpen"
        :aria-controls="mobileMenuId"
        @click="toggleMobileMenu"
      >
        <Icon :name="mobileOpen ? 'x' : 'menu'" />
      </button>

      <!-- Wordmark: plain-text site name, no logo image anywhere -->
      <router-link class="gn-wordmark" :to="homePath" @click="handleWordmarkClick">
        {{ siteName }}
      </router-link>

      <!-- Centered links + flyout mega-menus -->
      <div v-if="desktopTopLinks.length > 0 || desktopGroups.length > 0" class="gn-links">
        <template v-for="group in desktopGroups" :key="group.key">
          <div
            class="gn-item"
            data-flyout
            :data-flyout-key="group.key"
            :class="{ open: openFlyout === group.key }"
            @pointerenter="handleFlyoutPointerEnter(group.key, $event)"
            @mouseleave="handleFlyoutMouseLeave(group.key)"
            @focusin="openFlyoutByFocus(group.key)"
            @focusout="handleFlyoutFocusOut(group.key, $event)"
          >
            <button
              type="button"
              class="gn-link"
              :class="{ active: isGroupActive(group) }"
              :aria-haspopup="true"
              :aria-expanded="openFlyout === group.key"
              @pointerdown="handleFlyoutPointerDown(group.key)"
              @click="toggleFlyout(group.key)"
            >
              {{ t(group.labelKey) }}
              <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div class="gn-flyout" role="region" :aria-label="t(group.labelKey)">
              <div class="gn-flyout-inner">
                <div v-for="column in group.columns" :key="column.titleKey" class="gn-flyout-col">
                  <h4>{{ t(column.titleKey) }}</h4>
                  <router-link
                    v-for="item in column.items"
                    :key="item.path"
                    :to="item.path"
                    :id="tourIdFor(item.path)"
                    :class="{ active: isFlyoutLeafActive(item) }"
                    @click="handleLinkClick(item)"
                  >
                    <span v-if="item.iconSvg" class="fl-ico gn-svg-icon" v-html="sanitizeSvg(item.iconSvg)"></span>
                    <Icon v-else-if="hasFlyoutIcon(item.path)" :name="flyoutIcon(item.path)" class="fl-ico" />
                    {{ resolveNavLabel(item, t) }}
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-for="item in desktopTopLinks" :key="item.path" class="gn-item">
          <router-link
            class="gn-link"
            :class="{ active: isActive(item.path) }"
            :to="item.path"
            :data-tour="item.path === '/keys' && navKind === 'user' ? 'sidebar-my-keys' : undefined"
            :id="tourIdFor(item.path)"
            @click="handleLinkClick(item)"
          >
            <span v-if="item.iconSvg" class="gn-svg-icon" v-html="sanitizeSvg(item.iconSvg)"></span>
            {{ resolveNavLabel(item, t) }}
          </router-link>
        </div>
      </div>

      <!-- Right action cluster -->
      <div class="gn-actions">
        <button
          type="button"
          class="gn-icon-btn"
          v-if="commandEntries.length > 0"
          :aria-label="t('nav.search')"
          :title="`${t('nav.search')} · ${commandShortcut}`"
          aria-haspopup="dialog"
          :aria-expanded="paletteOpen"
          aria-keyshortcuts="Meta+K Control+K"
          @click="togglePalette"
        >
          <Icon name="search" />
        </button>

        <AnnouncementBell v-if="user" />

        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="gn-link gn-header-link"
          :aria-label="t('nav.docs')"
          :title="t('nav.docs')"
        >
          <Icon name="book" />
          <span class="gn-header-label">{{ t('nav.docs') }}</span>
        </a>

        <router-link
          v-if="user && modelPlazaEnabled"
          :to="{ path: '/model-plaza', query: { embedded: '1' } }"
          class="gn-link gn-header-link"
          :aria-label="t('nav.modelPlaza')"
          :title="t('nav.modelPlaza')"
        >
          <Icon name="grid" />
          <span class="gn-header-label">{{ t('nav.modelPlaza') }}</span>
        </router-link>

        <LocaleSwitcher />

        <SubscriptionProgressMini v-if="user" />

        <!-- Balance chip with hover breakdown -->
        <div v-if="user" class="gn-balance-wrap">
          <div class="gn-balance">
            <svg class="gn-balance-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            <span class="amount">{{ formatHeaderMoney(availableBalance) }}</span>
            <span v-if="frozenBalance > 0" class="frozen-chip">{{ balanceFrozenLabel }}</span>
            <div class="gn-balance-pop" role="tooltip">
              <div class="gn-balance-row">
                <span class="label">{{ balanceAvailableText }}</span>
                <span class="value">{{ formatHeaderMoney(availableBalance) }}</span>
              </div>
              <div class="gn-balance-row">
                <span class="label">{{ balanceFrozenText }}</span>
                <span class="value frozen">{{ formatHeaderMoney(frozenBalance) }}</span>
              </div>
              <div class="gn-balance-row total">
                <span class="label">{{ balanceTotalText }}</span>
                <span class="value">{{ formatHeaderMoney(totalBalance) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Theme toggle (B1 composable is the single source of truth) -->
        <button
          type="button"
          class="gn-icon-btn"
          :aria-label="isDark ? t('nav.lightMode') : t('nav.darkMode')"
          @click="toggleTheme"
        >
          <Icon :name="isDark ? 'sun' : 'moon'" />
        </button>

        <!-- User dropdown -->
        <div v-if="user" class="gn-pop-wrap" :class="{ open: dropdownOpen }" ref="dropdownRef">
          <button
            type="button"
            class="gn-avatar"
            :aria-label="t('common.userMenu')"
            :aria-haspopup="true"
            :aria-expanded="dropdownOpen"
            @click="toggleDropdown"
          >
            <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="gn-avatar-img" />
            <span v-else>{{ userInitials }}</span>
          </button>

          <div class="gn-pop" role="menu">
            <div class="gn-pop-head">
              <div class="name">{{ displayName }}</div>
              <div class="mail">{{ user.email }}</div>
            </div>

            <!-- Balance (mobile only) -->
            <div class="gn-pop-mobile-balance">
              <div class="label">{{ t('common.balance') }}</div>
              <div class="amount">{{ formatHeaderMoney(availableBalance) }}</div>
              <div v-if="frozenBalance > 0" class="frozen">
                {{ balanceFrozenText }} {{ formatHeaderMoney(frozenBalance) }}
              </div>
            </div>

            <router-link to="/profile" class="gn-pop-item" role="menuitem" @click="closeDropdown">
              <Icon name="user" />
              {{ t('nav.profile') }}
            </router-link>

            <router-link
              to="/keys"
              class="gn-pop-item"
              role="menuitem"
              :data-tour="showOnboardingButton ? 'sidebar-my-keys' : undefined"
              @click="closeDropdown"
            >
              <Icon name="key" />
              {{ t('nav.apiKeys') }}
            </router-link>

            <a
              v-if="authStore.isAdmin"
              href="https://github.com/Wei-Shaw/sub2api"
              target="_blank"
              rel="noopener noreferrer"
              class="gn-pop-item"
              role="menuitem"
              @click="closeDropdown"
            >
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              {{ t('nav.github') }}
            </a>

            <div v-if="contactInfo" class="gn-pop-contact">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
              <span>
                <span class="gn-pop-contact-label">{{ t('common.contactSupport') }}:</span>
                <span class="gn-pop-contact-value">{{ contactInfo }}</span>
              </span>
            </div>

            <div v-if="showOnboardingButton" class="gn-pop-foot">
              <button type="button" class="gn-pop-item" role="menuitem" @click="handleReplayGuide">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 14a1 1 0 110 2 1 1 0 010-2zm1.07-7.75c0-.6-.49-1.25-1.32-1.25-.7 0-1.22.4-1.43 1.02a1 1 0 11-1.9-.62A3.41 3.41 0 0111.8 5c2.02 0 3.25 1.4 3.25 2.9 0 2-1.83 2.55-2.43 3.12-.43.4-.47.75-.47 1.23a1 1 0 01-2 0c0-1 .16-1.82 1.1-2.7.69-.64 1.82-1.05 1.82-2.06z" />
                </svg>
                {{ t('onboarding.restartTour') }}
              </button>
            </div>

            <div class="gn-pop-foot">
              <VersionBadge :version="siteVersion" />
              <button type="button" class="gn-pop-item danger" role="menuitem" @click="handleLogout">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                {{ t('nav.logout') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!--
      Global command palette (⌘K / Ctrl+K). Lives inside `<nav>` so the existing
      outside-click handler treats it as part of the bar; its root carries
      `.gn-search-bar`, which is the panel contract the QA harnesses assert on.
    -->
    <CommandPalette
      v-if="commandEntries.length > 0"
      v-model:open="paletteOpen"
      :entries="commandEntries"
      @select="handleCommandSelect"
    />
  </nav>

  <!-- Curtain: dims the page behind an open flyout or the command palette -->
  <div
    class="gn-curtain"
    :class="{ open: openFlyout !== null || paletteOpen }"
    aria-hidden="true"
  ></div>

  <!-- Mobile fullscreen menu -->
  <div
    :id="mobileMenuId"
    class="gn-mobile"
    :class="{ open: mobileOpen }"
    ref="mobileRef"
    @keydown="handleMobileKeydown"
  >
    <template v-for="item in mobileTopLinks" :key="item.path">
      <router-link class="gn-m-link" :class="{ active: isActive(item.path) }" :to="item.path" @click="handleLinkClick(item)">
        {{ resolveNavLabel(item, t) }}
      </router-link>
    </template>
    <details v-for="group in mobileGroups" :key="group.key">
      <summary>
        {{ t(group.labelKey) }}
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <router-link
        v-for="item in group.flatItems"
        :key="item.path"
        :to="item.path"
        :class="{ active: isActive(item.path) }"
        @click="handleLinkClick(item)"
      >
        {{ resolveNavLabel(item, t) }}
      </router-link>
    </details>

    <!--
      Docs and Model Plaza are hidden from the bar below 768px (no room for eight
      action items), so they are re-homed here. Without this they would be
      unreachable on mobile, which would be a silent feature loss.
    -->
    <router-link
      v-if="user && modelPlazaEnabled"
      class="gn-m-link"
      :to="{ path: '/model-plaza', query: { embedded: '1' } }"
      @click="closeMobileMenu"
    >
      {{ t('nav.modelPlaza') }}
    </router-link>
    <a
      v-if="docUrl"
      class="gn-m-link"
      :href="docUrl"
      target="_blank"
      rel="noopener noreferrer"
      @click="closeMobileMenu"
    >
      {{ t('nav.docs') }}
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import '@/styles/global-nav.css'
import { useAdminSettingsStore, useAppStore, useAuthStore, useOnboardingStore } from '@/stores'
import AnnouncementBell from '@/components/common/AnnouncementBell.vue'
import CommandPalette from '@/components/command/CommandPalette.vue'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import SubscriptionProgressMini from '@/components/common/SubscriptionProgressMini.vue'
import VersionBadge from '@/components/common/VersionBadge.vue'
import Icon from '@/components/icons/Icon.vue'
import { useTheme } from '@/composables/useTheme'
import {
  commandShortcutLabel,
  lockBodyScroll,
  unlockBodyScroll,
} from '@/composables/useCommandPalette'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
import { sanitizeSvg } from '@/utils/sanitize'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled, makeSidebarFlag } from '@/utils/featureFlags'
import {
  buildAdminNavItems,
  buildCommandEntries,
  buildSelfNavItems,
  finalizeNav,
  groupAdminNav,
  isPathActive,
  resolveNavLabel,
  sortCustomItems,
  type NavDeps,
  type CommandEntry,
  type CommandGroupSource,
  type GroupedAdminFlyout,
} from './navItems'

type NavIconName =
  | 'globe' | 'users' | 'server' | 'shield' | 'dollar' | 'chart'
  | 'creditCard' | 'document' | 'gift' | 'bell' | 'link'

/** SF-Symbols-style icon per admin flyout leaf (demo parity). */
const FLYOUT_ICONS: Record<string, NavIconName> = {
  '/admin/accounts': 'globe',
  '/admin/groups': 'users',
  '/admin/channels': 'server',
  '/admin/proxies': 'shield',
  '/admin/channels/pricing': 'dollar',
  '/admin/channels/monitor': 'chart',
  '/admin/users': 'users',
  '/admin/subscriptions': 'creditCard',
  '/admin/orders': 'document',
  '/admin/orders/plans': 'creditCard',
  '/admin/redeem': 'gift',
  '/admin/promo-codes': 'gift',
  '/admin/announcements': 'bell',
  '/admin/affiliates': 'users',
  '/admin/affiliates/invites': 'users',
  '/admin/affiliates/rebates': 'creditCard',
  '/admin/affiliates/transfers': 'creditCard',
  '/admin/usage': 'chart',
  '/admin/ops': 'chart',
  '/admin/orders/dashboard': 'chart',
  '/admin/risk-control': 'shield',
  '/admin/prompt-audit': 'document',
  '/admin/audit-logs': 'shield',
}

/** Onboarding tour anchors carried over from the deleted sidebar. */
const TOUR_IDS: Record<string, string> = {
  '/admin/accounts': 'sidebar-channel-manage',
  '/admin/groups': 'sidebar-group-manage',
  '/admin/redeem': 'sidebar-wallet',
}

/** Path → tour selector used to advance interactive tour steps (from AppSidebar). */
const TOUR_SELECTOR_MAP: Record<string, string> = {
  '/admin/groups': '#sidebar-group-manage',
  '/admin/accounts': '#sidebar-channel-manage',
  '/keys': '[data-tour="sidebar-my-keys"]',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const onboardingStore = useOnboardingStore()
const adminSettingsStore = useAdminSettingsStore()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()
const { isDark, toggleTheme } = useTheme()

/* ---------------- Feature flags (identical to the old sidebar) ---------------- */
const flagChannelMonitor = makeSidebarFlag(FeatureFlags.channelMonitor)
const flagPayment = makeSidebarFlag(FeatureFlags.payment)
const flagAvailableChannels = makeSidebarFlag(FeatureFlags.availableChannels)
const flagAffiliate = makeSidebarFlag(FeatureFlags.affiliate)
const flagRiskControl = makeSidebarFlag(FeatureFlags.riskControl)
const flagOpsMonitoring = () => adminSettingsStore.opsMonitoringEnabled
const flagAdminPayment = () => adminSettingsStore.paymentEnabled
const flagBatchImageAccess = () => canUseBatchImage.value

const customMenuItemsForUser = computed(() =>
  sortCustomItems(appStore.cachedPublicSettings?.custom_menu_items ?? []).filter(
    (item) => item.visibility === 'user',
  ),
)

const customMenuItemsForAdmin = computed(() =>
  sortCustomItems(adminSettingsStore.customMenuItems).filter(
    (item) => item.visibility === 'admin',
  ),
)

const navDeps = computed<NavDeps>(() => ({
  isSimpleMode: authStore.isSimpleMode,
  customMenuItemsForUser: customMenuItemsForUser.value,
  customMenuItemsForAdmin: customMenuItemsForAdmin.value,
  flags: {
    channelMonitor: flagChannelMonitor,
    payment: flagPayment,
    availableChannels: flagAvailableChannels,
    affiliate: flagAffiliate,
    riskControl: flagRiskControl,
    opsMonitoring: flagOpsMonitoring,
    adminPayment: flagAdminPayment,
    batchImageAccess: flagBatchImageAccess,
  },
}))

/* ---------------- Nav model ---------------- */
const isAdmin = computed(() => authStore.isAdmin)
const isSimpleMode = computed(() => authStore.isSimpleMode)

const userNavItems = computed(() => finalizeNav(buildSelfNavItems(navDeps.value, true), authStore.isSimpleMode))
const personalNavItems = computed(() => finalizeNav(buildSelfNavItems(navDeps.value, false), authStore.isSimpleMode))
const adminNavItems = computed(() => buildAdminNavItems(navDeps.value))

/**
 * Non-admin users in backend mode see no nav at all (old sidebar behavior).
 * Admin simple mode renders a flat link list (no flyouts).
 */
const navKind = computed<'admin' | 'user' | 'none'>(() => {
  if (isAdmin.value) return 'admin'
  if (appStore.backendModeEnabled) return 'none'
  return 'user'
})

const groupedAdmin = computed(() =>
  navKind.value === 'admin' && !isSimpleMode.value ? groupAdminNav(adminNavItems.value) : null,
)

const desktopTopLinks = computed(() => {
  if (navKind.value === 'user') return userNavItems.value
  if (navKind.value === 'none') return []
  if (groupedAdmin.value) return [...groupedAdmin.value.topLevel, ...groupedAdmin.value.extra]
  return adminNavItems.value
})

const desktopGroups = computed(() => groupedAdmin.value?.groups ?? [])

const mobileTopLinks = computed(() => desktopTopLinks.value)
const mobileGroups = computed(() =>
  (groupedAdmin.value?.groups ?? []).map((group) => ({
    key: group.key,
    labelKey: group.labelKey,
    flatItems: group.columns.flatMap((column) => column.items),
  })),
)

const hasNavItems = computed(
  () => desktopTopLinks.value.length > 0 || desktopGroups.value.length > 0,
)

/* ---------------- Misc computed (from AppSidebar / AppHeader) ---------------- */
const siteName = computed(
  () => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API',
)
const siteVersion = computed(() => appStore.siteVersion)
const homePath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/dashboard'))
const user = computed(() => authStore.user)
const docUrl = computed(() => sanitizeUrl(appStore.docUrl))
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))
const contactInfo = computed(() => appStore.contactInfo)
const avatarUrl = computed(() => user.value?.avatar_url?.trim() || '')
const availableBalance = computed(() => Number(user.value?.balance || 0))
const frozenBalance = computed(() => Number(user.value?.frozen_balance || 0))
const totalBalance = computed(() => availableBalance.value + frozenBalance.value)
const balanceAvailableText = computed(() =>
  t('common.availableBalance') === 'common.availableBalance' ? '可用余额' : t('common.availableBalance'),
)
const balanceFrozenText = computed(() =>
  t('common.frozenBalance') === 'common.frozenBalance' ? '冻结金额' : t('common.frozenBalance'),
)
const balanceTotalText = computed(() =>
  t('common.totalBalance') === 'common.totalBalance' ? '总余额' : t('common.totalBalance'),
)
const balanceFrozenLabel = computed(
  () => `${balanceFrozenText.value} ${formatHeaderMoney(frozenBalance.value)}`,
)

/** Replay guide only for standard-mode admins (verbatim from AppHeader). */
const showOnboardingButton = computed(
  () => !authStore.isSimpleMode && user.value?.role === 'admin',
)

const userInitials = computed(() => {
  if (!user.value) return ''
  if (user.value.username) {
    return user.value.username.substring(0, 2).toUpperCase()
  }
  if (user.value.email) {
    return user.value.email.split('@')[0].substring(0, 2).toUpperCase()
  }
  return ''
})

const displayName = computed(() => {
  if (!user.value) return ''
  return user.value.username || user.value.email?.split('@')[0] || ''
})

/* ---------------- Flyout / popover / search / mobile state ---------------- */
/**
 * Flyout open state is split by *intent*, because a single ref cannot survive
 * the browser's event ordering (see the Flyout interactions block below).
 *  - `pinnedFlyout`  : explicitly opened by click or keyboard focus; survives
 *                      the cursor leaving.
 *  - `hoverFlyout`   : transiently opened by a mouse hover; closes on leave.
 *
 * `hoverFlyout` is only ever written through the hover-timing helpers below
 * (open-intent delay / close grace period), never straight from a handler.
 */
const pinnedFlyout = ref<string | null>(null)
const hoverFlyout = ref<string | null>(null)
const openFlyout = computed<string | null>(() => pinnedFlyout.value ?? hoverFlyout.value)
/**
 * Set when the currently open flyout moves from one group straight to another,
 * cleared on any other change (open from closed / close to nothing). Drives
 * `.gn-switching`, which drops the panels' transitions so the swap reads as a
 * content change rather than a cross-fade. It stays set while the destination
 * panel is open, which is harmless: a transition only matters at the instant
 * the classes change, and every change re-evaluates this flag in the same DOM
 * patch.
 */
const flyoutSwitching = ref(false)
const dropdownOpen = ref(false)
const paletteOpen = ref(false)
const mobileOpen = ref(false)
const navRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const mobileRef = ref<HTMLElement | null>(null)
const mobileMenuId = 'gn-mobile-menu'

/* ---------------- Command palette source (⌘K) ---------------- */
/**
 * The palette is fed the SAME already-filtered lists the bar renders — never
 * the raw builders.
 *
 * This is a functional requirement, not a stylistic one: `featureFlag` decides
 * whether a feature is switched on for this deployment and `hideInSimpleMode`
 * decides whether this user's mode exposes it. Re-deriving the list for search
 * would make disabled or unauthorized pages findable and navigable from ⌘K —
 * a real access/UX leak, not a cosmetic bug. `groupedAdmin` / `userNavItems` /
 * `personalNavItems` have both filters already applied, so reusing them keeps
 * the palette and the bar honest by construction.
 *
 * Result grouping mirrors the bar: top-level links, then one group per flyout
 * mega-menu column set, then the user's own account pages last.
 */
const commandGroupSources = computed<CommandGroupSource[]>(() => {
  if (navKind.value === 'none') return []

  if (navKind.value === 'user') {
    // `userNavItems` is a superset of `personalNavItems` (it only adds the
    // dashboard), so one group covers everything a user can reach.
    return [{ key: 'pages', labelKey: 'nav.commandGroupPages', items: userNavItems.value }]
  }

  const sources: CommandGroupSource[] = []
  const grouped = groupedAdmin.value
  if (grouped) {
    sources.push({
      key: 'pages',
      labelKey: 'nav.commandGroupPages',
      items: [...grouped.topLevel, ...grouped.extra],
    })
    for (const group of grouped.groups) {
      sources.push({
        key: group.key,
        labelKey: group.labelKey,
        items: group.columns.flatMap((column) => column.items),
      })
    }
  } else {
    // Admin simple mode: flat list, no flyout groups.
    sources.push({ key: 'pages', labelKey: 'nav.commandGroupPages', items: adminNavItems.value })
  }

  // The admin's own account pages (keys / usage / profile …). Paths already
  // present above are deduped away by `buildCommandEntries`.
  sources.push({
    key: 'account',
    labelKey: 'nav.commandGroupAccount',
    items: personalNavItems.value,
  })
  return sources
})

const commandEntries = computed<CommandEntry[]>(() =>
  buildCommandEntries(commandGroupSources.value, t),
)

/** Platform-correct hint for the bar button tooltip (⌘K vs Ctrl K). */
const commandShortcut = commandShortcutLabel()

/* ---------------- Active state ---------------- */
function isActive(path: string): boolean {
  return isPathActive(path, route.path)
}

/** Flyout leaves use exact match, mirroring the old sidebar's child links. */
function isFlyoutLeafActive(item: { path: string }): boolean {
  return route.path === item.path
}

function isGroupActive(group: GroupedAdminFlyout): boolean {
  return group.columns.some((column) => column.items.some((item) => route.path === item.path))
}

/* ---------------- Flyout interactions ---------------- */
/**
 * Hover, focus and click must not fight over one piece of state.
 *
 * The design demo gets away with a single `open` class because its hover state
 * is pure CSS (`.gn-item:hover .gn-flyout`) and therefore invisible to its click
 * handler. A Vue port cannot do that: hover, focus and click all run through
 * JS, and the browser fires them in this order for one physical tap/click —
 *
 *   pointerenter -> pointerdown -> focusin -> pointerup -> click
 *
 * A naive toggle therefore self-cancels: `pointerenter` opens the flyout, then
 * `click` sees "already open" and closes it, so a touch tap could never open a
 * flyout at desktop widths (iPads / touch laptops — `.gn-links` only hides
 * below 768px). Tracking "was it hover-opened?" doesn't fix it either, because
 * `focusin` lands in between and rewrites that flag.
 *
 * So the click decision is made from a snapshot taken at `pointerdown` — before
 * `focusin` can interfere — and hover/pin are kept in separate refs:
 *   hover  = transient, dies on mouseleave
 *   pinned = explicit intent (click / keyboard focus), survives mouseleave
 *
 * On top of that, hover is *intent-gated* rather than immediate: see the hover
 * timing block below. An open waits out a debounce, a close waits out a grace
 * period, and moving between two groups while one is already open bypasses both
 * and swaps the panel contents with the transitions suppressed.
 */
/** Was this flyout already pinned when the current gesture started? */
const pinnedAtGestureStart = ref<string | null>(null)

/* ---------------- Flyout hover timing ---------------- */
/**
 * Hover *intent*, not raw hover.
 *
 * `FLYOUT_OPEN_DELAY_MS` (120ms): the cursor crosses every trigger on its way
 * between the wordmark and the action cluster, so opening on the bare
 * `pointerenter` made the bar strobe on the way past. 120ms rejects a
 * pass-through while still reading as instant on a deliberate stop — past
 * ~150ms a hover response starts to feel laggy, so this sits just under that.
 *
 * `FLYOUT_CLOSE_GRACE_MS` (200ms): leaving a trigger must not close the panel,
 * or the cursor cannot survive the 2px gap between sibling triggers on its way
 * to the next group. 200ms covers an ordinary sideways move without making a
 * deliberate exit feel sticky.
 *
 * Neither value is an animation, so both stay in force under
 * `prefers-reduced-motion` — they are pointer-precision affordances, and the
 * token layer already zeroes the panel's transition *durations* there.
 */
const FLYOUT_OPEN_DELAY_MS = 120
const FLYOUT_CLOSE_GRACE_MS = 200

let flyoutOpenTimer: ReturnType<typeof setTimeout> | null = null
let flyoutCloseTimer: ReturnType<typeof setTimeout> | null = null

function cancelFlyoutOpenTimer() {
  if (flyoutOpenTimer === null) return
  clearTimeout(flyoutOpenTimer)
  flyoutOpenTimer = null
}

function cancelFlyoutCloseTimer() {
  if (flyoutCloseTimer === null) return
  clearTimeout(flyoutCloseTimer)
  flyoutCloseTimer = null
}

/** Every path that settles flyout state clears both timers through here. */
function cancelFlyoutTimers() {
  cancelFlyoutOpenTimer()
  cancelFlyoutCloseTimer()
}

/** Is keyboard focus parked inside this group's item? */
function flyoutHoldsFocus(key: string): boolean {
  const item = navRef.value?.querySelector(`[data-flyout-key="${key}"]`)
  return !!item && item.contains(document.activeElement)
}

function closeFlyout() {
  cancelFlyoutTimers()
  pinnedFlyout.value = null
  hoverFlyout.value = null
}

/**
 * Mouse hover reveals a flyout transiently. Touch/pen never uses this path.
 *
 * Three cases, in order: this group is already showing (nothing to do), another
 * group is showing (swap now, no delay — this is what the user sees as "the
 * window stays put and only its contents change"), or nothing is showing (wait
 * out the open delay, so brushing past opens nothing).
 */
function handleFlyoutPointerEnter(key: string, event: PointerEvent) {
  if (event.pointerType && event.pointerType !== 'mouse') return
  // Arriving anywhere cancels a pending close for the group we came from and a
  // pending open for a group we only brushed.
  cancelFlyoutTimers()
  if (openFlyout.value === key) return
  if (openFlyout.value !== null) {
    // A *pinned* flyout (explicit click — or keyboard focus) survives the
    // cursor crossing other triggers. "Pin" means "stays until click/Esc":
    // releasing it on a stray sweep would contradict the tested contract that
    // a pinned flyout survives `mouseleave`, and would silently discard an
    // explicit choice the moment the pointer passes over a neighbour.
    if (pinnedFlyout.value !== null) return
    // A group holding keyboard focus keeps its panel: `:focus-within` would
    // otherwise keep the old panel rendered alongside the new one.
    if (flyoutHoldsFocus(openFlyout.value)) return
    // Hand the open panel to the new group in a single mutation. Both sides
    // here are hover-driven (nothing pinned), so the swap is pure preview.
    hoverFlyout.value = key
    return
  }
  flyoutOpenTimer = setTimeout(() => {
    flyoutOpenTimer = null
    hoverFlyout.value = key
  }, FLYOUT_OPEN_DELAY_MS)
}

/** Snapshot pinned state before `focusin`/`click` can mutate it. */
function handleFlyoutPointerDown(key: string) {
  // This click is about to settle the flyout, so no pending hover timer may
  // land afterwards and re-open or re-close it behind the click's back.
  cancelFlyoutTimers()
  pinnedAtGestureStart.value = pinnedFlyout.value === key ? key : null
}

/**
 * Keyboard focus pins the flyout open. Clicking also focuses, but `click`
 * runs afterwards and is authoritative, so a mouse gesture is not affected.
 */
/** One-shot: set while Esc's focus restore is focusing the trigger, so that
 *  the focusin that restore fires cannot re-pin the flyout we just closed. */
let suppressFlyoutFocusOpen = false
function openFlyoutByFocus(key: string) {
  cancelFlyoutTimers()
  if (suppressFlyoutFocusOpen) return
  pinnedFlyout.value = key
  hoverFlyout.value = null
}

function toggleFlyout(key: string) {
  cancelFlyoutTimers()
  // Decide from the pre-gesture snapshot, not from live state that `focusin`
  // may have already changed: a second click on a pinned flyout closes it,
  // anything else pins it open.
  const wasPinned = pinnedAtGestureStart.value === key
  pinnedAtGestureStart.value = null
  if (wasPinned) {
    closeFlyout()
    return
  }
  pinnedFlyout.value = key
  hoverFlyout.value = null
}

function handleFlyoutMouseLeave(key: string) {
  // A group the cursor has already left must never open behind it.
  cancelFlyoutOpenTimer()
  // A pinned flyout survives the cursor leaving; keyboard focus keeps it too —
  // both live in `pinnedFlyout`, which this path deliberately never clears.
  if (hoverFlyout.value !== key) return
  // Grace period: the cursor needs room to cross the gap to the next trigger,
  // or to travel down into this panel, before the panel may collapse.
  cancelFlyoutCloseTimer()
  flyoutCloseTimer = setTimeout(() => {
    flyoutCloseTimer = null
    if (hoverFlyout.value === key) hoverFlyout.value = null
  }, FLYOUT_CLOSE_GRACE_MS)
}

/**
 * Suppress the cross-dissolve when an open flyout moves between groups.
 *
 * Every group owns its own panel, so a group→group move fades A out over 300ms
 * while B fades in from `translateY(-8px)` — two panels dissolving past each
 * other, which is the flash. This watcher is pre-flush, so it runs in the same
 * scheduler flush as the render it precedes: `.gn-switching` therefore lands in
 * the *same* DOM patch that moves the `open` class, so A vanishes and B appears
 * in one frame with no fade and no entry transform. Opening from closed and
 * closing to nothing still animate, because there one side of the change is
 * `null`.
 */
watch(openFlyout, (next, previous) => {
  flyoutSwitching.value = next !== null && previous !== null && next !== previous
})

function handleFlyoutFocusOut(key: string, event: FocusEvent) {
  const item = navRef.value?.querySelector(`[data-flyout-key="${key}"]`)
  if (!item) return
  const next = event.relatedTarget as Node | null
  if (next && item.contains(next)) return
  if (pinnedFlyout.value === key) pinnedFlyout.value = null
}

/* ---------------- Command palette ---------------- */
function closePalette() {
  paletteOpen.value = false
}

/**
 * The palette is modal, so it takes over from the other transient surfaces
 * rather than stacking on top of them. Query reset, focus capture/restore and
 * body-scroll locking are handled inside `useCommandPalette`, keyed off this
 * flag — so the button path and the ⌘K path behave identically.
 */
function togglePalette() {
  if (paletteOpen.value) {
    closePalette()
    return
  }
  closeFlyout()
  closeDropdown()
  closeMobileMenu()
  paletteOpen.value = true
}

function handleCommandSelect(entry: CommandEntry) {
  // Reuses the nav-link path so the onboarding tour advances exactly as it does
  // for a click in the bar.
  handleLinkClick(entry)
  void router.push(entry.path)
}

/* ---------------- Mobile menu ---------------- */
function toggleMobileMenu() {
  mobileOpen.value = !mobileOpen.value
  if (mobileOpen.value) {
    closeFlyout()
    closeDropdown()
    closePalette()
    void nextTick(() => {
      const first = mobileRef.value?.querySelector<HTMLElement>('a, button, summary')
      first?.focus()
    })
  }
}

function closeMobileMenu() {
  mobileOpen.value = false
}

/** Minimal focus trap: Tab wraps between first and last focusable element. */
function handleMobileKeydown(event: KeyboardEvent) {
  if (!mobileOpen.value || event.key !== 'Tab') return
  const focusables = Array.from(
    mobileRef.value?.querySelectorAll<HTMLElement>('a[href], button, summary') ?? [],
  )
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/* ---------------- User dropdown (verbatim port from AppHeader) ---------------- */
function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

async function handleLogout() {
  closeDropdown()
  try {
    await authStore.logout()
  } catch (error) {
    console.error('Logout error:', error)
  }
  await router.push('/login')
}

function handleReplayGuide() {
  closeDropdown()
  onboardingStore.replay()
}

function formatHeaderMoney(value: number) {
  if (!Number.isFinite(value)) return '$0.00'
  return `$${value.toFixed(2)}`
}

/* ---------------- Global close + outside click ---------------- */
function closeAll() {
  closeFlyout()
  dropdownOpen.value = false
  paletteOpen.value = false
  if (mobileOpen.value) closeMobileMenu()
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node
  if (navRef.value && !navRef.value.contains(target)) {
    if (dropdownOpen.value) closeDropdown()
    if (paletteOpen.value) closePalette()
    // Unconditional: a click outside must also kill a hover-open timer that is
    // still in flight, or the flyout would appear after the click that
    // dismissed the bar.
    closeFlyout()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Unconditional for the same reason as the outside click: Escape also has
  // to cancel a pending hover-open timer, not just a visible panel.
  const flyoutBefore = openFlyout.value
  closeFlyout()
  if (dropdownOpen.value) closeDropdown()
  // Esc from inside a flyout panel (keyboard users Tab past the trigger into
  // the links) must hand focus back to the trigger: the panel is about to be
  // `visibility: hidden`, and leaving focus on an invisible element strands
  // the user (a11y audit A7). If focus was never inside the panel — e.g. a
  // mouse user who opened it by hover — Esc just closes and leaves focus be.
  if (flyoutBefore !== null && flyoutHoldsFocus(flyoutBefore)) {
    const trigger = navRef.value
      ?.querySelector<HTMLElement>(`[data-flyout-key="${flyoutBefore}"] > .gn-link`)
    if (trigger) {
      // Focusing the trigger fires `@focusin`, which would re-pin the panel
      // we just closed. `focus()` dispatches focusin synchronously, so the
      // suppression can be scoped to this one call.
      suppressFlyoutFocusOpen = true
      trigger.focus()
      suppressFlyoutFocusOpen = false
    }
  }
  // The palette closes itself (it also has to restore focus), see
  // useCommandPalette's global listener.
  if (mobileOpen.value) {
    closeMobileMenu()
    // Esc must return focus to the burger that opened the menu (a11y audit
    // A7: focus fell to <body>). Deterministic restore to the trigger rather
    // than "whatever had focus on open": browsers disagree about whether a
    // click moves focus onto a button, and the audit's contract is explicit
    // ("还给触发它的汉堡按钮").
    if (mobileRef.value?.contains(document.activeElement)) {
      navRef.value?.querySelector<HTMLElement>('.gn-burger')?.focus()
    }
  }
}

/* ---------------- Nav link click: close panels + advance tour ---------------- */
function handleLinkClick(item: { path: string }) {
  closePalette()
  if (mobileOpen.value) {
    window.setTimeout(() => closeMobileMenu(), 150)
  }
  closeFlyout()

  const selector = TOUR_SELECTOR_MAP[item.path]
  if (selector && onboardingStore.isCurrentStep(selector)) {
    onboardingStore.nextStep(500)
  }
}

function handleWordmarkClick() {
  handleLinkClick({ path: homePath.value })
}

/* ---------------- Helpers ---------------- */
function tourIdFor(path: string): string | undefined {
  return TOUR_IDS[path]
}

function hasFlyoutIcon(path: string): boolean {
  return path in FLYOUT_ICONS
}

function flyoutIcon(path: string): NavIconName {
  return FLYOUT_ICONS[path] ?? 'link'
}

/* ---------------- Body scroll lock while mobile menu is open ---------------- */
/**
 * Goes through the reference-counted helper rather than writing
 * `body.style.overflow` directly, because the command palette locks the same
 * page. With direct writes, whichever overlay closed last unlocked the page —
 * including while the other one was still open (the watchers fire in component
 * creation order, not in "who is still open" order).
 */
let mobileHoldsScrollLock = false
watch(mobileOpen, (open) => {
  if (open && !mobileHoldsScrollLock) {
    lockBodyScroll()
    mobileHoldsScrollLock = true
  } else if (!open && mobileHoldsScrollLock) {
    unlockBodyScroll()
    mobileHoldsScrollLock = false
  }
})

/* ---------------- Lifecycle (from AppSidebar / AppHeader) ---------------- */
watch(
  isAdmin,
  (value) => {
    if (value) adminSettingsStore.fetch()
  },
  { immediate: true },
)

onMounted(() => {
  void refreshBatchImageAccess()
  if (isAdmin.value) {
    adminSettingsStore.fetch()
  }
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
  // No pending hover timer may survive teardown and write to a dead component.
  cancelFlyoutTimers()
  if (mobileHoldsScrollLock) {
    unlockBodyScroll()
    mobileHoldsScrollLock = false
  }
})

// Close everything on route change
watch(
  () => route.fullPath,
  () => closeAll(),
)

/**
 * On user nav the links strip scrolls internally when the full row cannot fit
 * next to the action cluster (see `.gn-links` in global-nav.css). Keep the
 * active link in view: without this, a user on a trailing route (e.g.
 * /profile) would see the strip parked on the leading links with the current
 * page hidden behind the strip edge — the highlight would be invisible.
 * `inline: 'nearest'` means a fully-visible active link (admin nav, wide
 * viewports) never scrolls at all.
 */
watch(
  () => route.fullPath,
  () => {
    void nextTick(() => {
      navRef.value?.querySelector<HTMLElement>('.gn-links a.active')?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
    })
  },
  { immediate: true },
)
</script>

<style scoped>
/* Custom SVG icons (custom menu items): size only, never override colors */
.gn-svg-icon {
  color: currentColor;
}
.gn-svg-icon :deep(svg) {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
}
/* Right-cluster links (docs / model plaza) reuse the bar link style */
.gn-header-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: background 0.18s var(--ease), color 0.18s var(--ease);
}
.gn-header-link:hover {
  background: var(--fill);
  color: var(--text-primary);
  text-decoration: none;
}
.gn-header-link svg { width: 15px; height: 15px; flex-shrink: 0; }
/*
 * Action-cluster width budget (measured at /admin/accounts, site_name "Sub2API QA"):
 *   wordmark 92 + links 467 + actions 662 + gaps/padding ~56 = ~1277px
 * so the full cluster only fits from ~1280px up. Below that the bar sheds items
 * in order of redundancy, because the alternative is flex stealing the space
 * from the wordmark — and the wordmark IS the brand (no logo image anywhere).
 *
 *   >= 1280px : everything
 *   769-1279  : balance -> avatar dropdown; docs/plaza go icon-only  (saves ~346px)
 *   <= 768px  : links + docs/plaza -> hamburger menu
 *
 * These live in the scoped block on purpose: a global `.gn-actions .gn-header-link`
 * rule ties on specificity with the scoped `[data-v-*]` selector and loses on
 * injection order.
 */
.gn-header-link .gn-header-label { display: inline; }
@media (max-width: 1279px) {
  .gn-header-link .gn-header-label { display: none; }
}
/*
 * User nav runs a permanently compact action cluster. The 11-12 self-service
 * links (measured ~1128px of min-content at /keys) cannot share the 1360px
 * measure with the full cluster (measured 734px at 1440), so for users the
 * secondary actions stay icon-only at *every* width. The admin nav keeps the
 * width ladder above (its 5 links + flyouts fit).
 */
.gn-user .gn-header-link .gn-header-label { display: none; }
@media (max-width: 768px) {
  /* Re-homed into the hamburger menu (see the mobile menu template). */
  .gn-header-link { display: none; }
}

.gn-balance-wrap { position: relative; }
.gn-balance .gn-balance-ico { width: 15px; height: 15px; flex-shrink: 0; }
.gn-balance-wrap:not(:hover) .gn-balance-pop { pointer-events: none; }

.gn-pop .gn-pop-mobile-balance {
  display: none;
  border-bottom: 0.5px solid var(--separator);
  padding: 10px 12px;
}
.gn-pop .gn-pop-mobile-balance .label {
  font-size: 12px;
  color: var(--text-secondary);
}
.gn-pop .gn-pop-mobile-balance .amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--blue);
  margin-top: 2px;
}
.gn-pop .gn-pop-mobile-balance .frozen {
  font-size: 12px;
  color: var(--orange);
  margin-top: 2px;
}
/* The balance chip is 230px — the single widest action. Keeping it in the bar
   below 1280px overflowed the viewport (measured scrollWidth 1257 @1024px and
   801 @768px), so it moves into the avatar dropdown from here down. */
@media (max-width: 1279px) {
  .gn-balance-wrap { display: none; }
  .gn-pop .gn-pop-mobile-balance { display: block; }
}
/*
 * User nav: the chip stays in the dropdown at every width — the 230px chip
 * never fits next to 1128px of links inside the 1360px measure, and the link
 * row is the primary surface (see the `.gn-user` cluster comment above).
 */
.gn-user .gn-balance-wrap { display: none; }
.gn-user .gn-pop .gn-pop-mobile-balance { display: block; }

.gn-pop .gn-pop-contact {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-top: 0.5px solid var(--separator);
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.gn-pop .gn-pop-contact svg { width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; }
.gn-pop .gn-pop-contact-value { font-weight: 500; color: var(--text-primary); }

.gn-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: var(--r-pill);
  object-fit: cover;
}

/* VersionBadge inside the user dropdown footer */
.gn-pop-foot :deep(button) { justify-content: center; }
</style>
