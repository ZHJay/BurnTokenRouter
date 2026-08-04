<template>
  <!--
    Regular material, fixed so page content scrolls underneath the glass.
    `left` tracks the sidebar width; on mobile the sidebar is off-canvas so the
    bar spans the full viewport.

    box-shadow 只剩底缘发丝线，没有顶部镜面高光 —— 这里曾有
    `inset 0 1px 0 var(--glass-specular)`。高光模拟浮空面板近边缘的受光，需要那
    条边背后有东西可折射；本元素 `top-0`，被点亮的上缘紧贴浏览器边框，外面是空
    的，于是它在页面顶部画出一条通宽 1px 近白线（深色下合成约 rgb(123,123,124)，
    读作边框而不是厚度）。朝向内容的是底缘，已由 --glass-edge 承担。
    同一处修复见 style.css 的 .sidebar。
  -->
  <header
    class="app-header glass fixed right-0 top-0 z-30 left-0 transition-all duration-300"
    :class="[sidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-64']"
    style="box-shadow: inset 0 -0.5px 0 var(--glass-edge)"
  >
    <div class="flex h-16 items-center justify-between gap-2 px-2 sm:px-4 md:px-6">
      <!--
        Left: Mobile Menu Toggle + Page Title.
        `min-w-0 flex-1` is load-bearing: this side must be the one that yields.
        It previously carried `shrink-0`, so a long page subtitle (e.g. on
        /admin/settings) could not truncate and pushed the action row instead,
        wrapping "Model Plaza" onto a second line and detaching its icon.
      -->
      <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <button
          @click="toggleMobileSidebar"
          class="btn btn-ghost btn-icon lg:hidden"
          :aria-label="t('common.toggleMenu')"
        >
          <Icon name="menu" size="md" />
        </button>

        <!--
          min-w-0 lets the truncate on the children actually take effect.

          `sr-only` rather than `hidden` below lg: this block holds the only h1
          on an app page, and `display: none` removed it from the accessibility
          tree entirely, leaving every page under 1024px with no h1 and content
          starting at h2/h3 (WCAG 1.3.1). `sr-only` keeps the heading in the tree
          while staying invisible, and because it also positions the block
          absolutely it stays out of the flex flow exactly like `hidden` did — the
          compact layout is unchanged.
        -->
        <div class="sr-only min-w-0 lg:not-sr-only lg:block">
          <!-- Vibrancy: text over glass gets heavier weight, never flat grey -->
          <h1
            class="on-glass truncate text-[17px] font-semibold leading-tight tracking-[-0.014em] text-gray-900 dark:text-white"
          >
            {{ pageTitle }}
          </h1>
          <p v-if="pageDescription" class="truncate text-xs text-gray-500 dark:text-dark-400">
            {{ pageDescription }}
          </p>
        </div>
      </div>

      <!-- Right: Announcements + Docs + Language + Subscriptions + Balance + User Dropdown -->
      <!--
        The action row must never WRAP, but it must be allowed to SHRINK.

        It used to be `shrink-0`, which is what stranded the user menu: below lg
        the left group collapses to 0 wide (its only visible child is the
        hamburger and the title is hidden), so the action row started at x=24 and
        ran 45-72px past the viewport with no scroller — the surplus was simply
        unreachable, and log out / account settings could not be tapped on an
        iPad. `min-w-0` lets it give ground instead of clipping; the individual
        links carry `whitespace-nowrap` so the no-wrap guarantee that `shrink-0`
        was really providing is kept where it belongs, and the username block is
        the designated pressure valve (it truncates).

        gap-2 rather than gap-1 at the base size: the bell-to-language gap
        measured 4.0px, too tight to hit reliably with a thumb.
      -->
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <!-- Announcement Bell -->
        <AnnouncementBell v-if="user" />

        <!--
          Docs + Model Plaza reveal at lg, not sm.

          They used to appear from 640px up while the sidebar stays off-canvas
          until 1024px, so the 640-1023px band rendered the drawer toggle AND the
          full desktop link set at once and overflowed the viewport. The drawer
          already carries this navigation below lg, so revealing it here was pure
          duplication that cost 196px of a 667px viewport.
        -->
        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hidden items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-dark-400 dark:hover:bg-dark-800 dark:hover:text-white lg:flex"
        >
          <Icon name="book" size="sm" />
          <span>{{ t('nav.docs') }}</span>
        </a>

        <!-- Model Plaza Entry -->
        <router-link
          v-if="user && modelPlazaEnabled"
          :to="{ path: '/model-plaza', query: { embedded: '1' } }"
          class="hidden items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-dark-400 dark:hover:bg-dark-800 dark:hover:text-white lg:flex"
        >
          <Icon name="grid" size="sm" />
          <span>{{ t('nav.modelPlaza') }}</span>
        </router-link>

        <!-- Language Switcher -->
        <LocaleSwitcher />

        <!-- Subscription Progress (for users with active subscriptions) -->
        <SubscriptionProgressMini v-if="user" />

        <!-- Balance Display -->
        <div
          v-if="user"
          class="group relative hidden items-center gap-2 rounded-full px-3 py-1.5 sm:flex"
          style="background: var(--accent-tint)"
        >
          <svg
            class="h-4 w-4 text-primary-600 dark:text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
            />
          </svg>
          <span class="text-sm font-semibold text-primary-700 dark:text-primary-300">
            {{ formatHeaderMoney(availableBalance) }}
          </span>
          <span
            v-if="frozenBalance > 0"
            class="badge badge-warning"
          >
            {{ balanceFrozenLabel }}
          </span>
          <div
            class="dropdown pointer-events-none absolute right-0 top-full mt-2 hidden w-56 p-3 text-xs group-hover:block"
          >
            <div class="flex items-center justify-between">
              <span class="text-gray-500 dark:text-dark-400">{{ balanceAvailableText }}</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ formatHeaderMoney(availableBalance) }}</span>
            </div>
            <div class="mt-2 flex items-center justify-between">
              <span class="text-gray-500 dark:text-dark-400">{{ balanceFrozenText }}</span>
              <span class="font-medium text-amber-700 dark:text-amber-200">{{ formatHeaderMoney(frozenBalance) }}</span>
            </div>
            <div class="mt-2 border-t border-gray-100 pt-2 dark:border-dark-700">
              <div class="flex items-center justify-between">
                <span class="text-gray-500 dark:text-dark-400">{{ balanceTotalText }}</span>
                <span class="font-semibold text-gray-900 dark:text-white">{{ formatHeaderMoney(totalBalance) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- User Dropdown -->
        <!--
          keydown is bound on the wrapper, not the trigger: Escape has to work
          while focus is on a menu item too, and the event bubbles here from
          either.
        -->
        <div v-if="user" class="relative min-w-0" ref="dropdownRef" @keydown="handleMenuKeydown">
          <button
            ref="triggerRef"
            @click="toggleDropdown"
            class="btn btn-ghost min-w-0 p-1.5"
            :aria-label="t('common.userMenu')"
            aria-haspopup="menu"
            :aria-expanded="dropdownOpen ? 'true' : 'false'"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-sm font-medium text-white shadow-sm"
            >
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                :alt="displayName"
                class="h-full w-full object-cover"
              >
              <span v-else>{{ userInitials }}</span>
            </div>
            <!--
              The pressure valve. Everything else in the action row is a
              fixed-size control, so this is the one thing that can absorb width
              pressure; min-w-0 + truncate is what turns "shrink" into an
              ellipsis instead of an overflow.
            -->
            <div class="hidden min-w-0 text-left md:block">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                <span class="block truncate">{{ displayName }}</span>
              </div>
              <div class="text-xs capitalize text-gray-500 dark:text-dark-400">
                <span class="block truncate">{{ user.role }}</span>
              </div>
            </div>
            <Icon name="chevronDown" size="sm" class="hidden shrink-0 text-gray-400 md:block" />
          </button>

          <!-- Dropdown Menu -->
          <!--
            animate-none is required, not decorative: `.dropdown` carries an
            intrinsic `animate-scale-in`, so inside a <transition> both the
            keyframe and the transition drive `transform` on enter with different
            scale values and fight. Same fix as AccountGroupsCell.vue.
          -->
          <transition name="dropdown">
            <div
              v-if="dropdownOpen"
              ref="menuRef"
              class="dropdown right-0 mt-2 w-56 animate-none"
              role="menu"
              :aria-label="t('common.userMenu')"
            >
              <!-- User Info -->
              <div role="none" class="border-b border-gray-100 px-4 py-3 dark:border-dark-700">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ displayName }}
                </div>
                <div class="text-xs text-gray-500 dark:text-dark-400">{{ user.email }}</div>
              </div>

              <!-- Balance (mobile only) -->
              <div role="none" class="border-b border-gray-100 px-4 py-2 dark:border-dark-700 sm:hidden">
                <div class="text-xs text-gray-500 dark:text-dark-400">
                  {{ t('common.balance') }}
                </div>
                <div class="text-sm font-semibold text-primary-600 dark:text-primary-400">
                  {{ formatHeaderMoney(availableBalance) }}
                </div>
                <div v-if="frozenBalance > 0" class="mt-1 text-xs text-amber-600 dark:text-amber-300">
                  {{ balanceFrozenText }} {{ formatHeaderMoney(frozenBalance) }}
                </div>
              </div>

              <div role="none" class="py-1">
                <router-link to="/profile" role="menuitem" @click="closeDropdown" class="dropdown-item">
                  <Icon name="user" size="sm" />
                  {{ t('nav.profile') }}
                </router-link>

                <router-link to="/keys" role="menuitem" @click="closeDropdown" class="dropdown-item">
                  <Icon name="key" size="sm" />
                  {{ t('nav.apiKeys') }}
                </router-link>

                <a
                  v-if="authStore.isAdmin"
                  href="https://github.com/Wei-Shaw/sub2api"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  @click="closeDropdown"
                  class="dropdown-item"
                >
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                    />
                  </svg>
                  {{ t('nav.github') }}
                </a>

              </div>

              <!-- Contact Support (only show if configured) -->
              <div
                v-if="contactInfo"
                role="none"
                class="border-t border-gray-100 px-4 py-2.5 dark:border-dark-700"
              >
                <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                    />
                  </svg>
                  <span>{{ t('common.contactSupport') }}:</span>
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{
                    contactInfo
                  }}</span>
                </div>
              </div>

              <div v-if="showOnboardingButton" role="none" class="border-t border-gray-100 py-1 dark:border-dark-700">
                <button role="menuitem" @click="handleReplayGuide" class="dropdown-item w-full">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 14a1 1 0 110 2 1 1 0 010-2zm1.07-7.75c0-.6-.49-1.25-1.32-1.25-.7 0-1.22.4-1.43 1.02a1 1 0 11-1.9-.62A3.41 3.41 0 0111.8 5c2.02 0 3.25 1.4 3.25 2.9 0 2-1.83 2.55-2.43 3.12-.43.4-.47.75-.47 1.23a1 1 0 01-2 0c0-1 .16-1.82 1.1-2.7.69-.64 1.82-1.05 1.82-2.06z"
                    />
                  </svg>
                  {{ $t('onboarding.restartTour') }}
                </button>
              </div>

              <div role="none" class="border-t border-gray-100 py-1 dark:border-dark-700">
                <button
                  role="menuitem"
                  @click="handleLogout"
                  class="dropdown-item w-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                  {{ t('nav.logout') }}
                </button>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore, useOnboardingStore } from '@/stores'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import SubscriptionProgressMini from '@/components/common/SubscriptionProgressMini.vue'
import AnnouncementBell from '@/components/common/AnnouncementBell.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const adminSettingsStore = useAdminSettingsStore()
const onboardingStore = useOnboardingStore()

const user = computed(() => authStore.user)
const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const contactInfo = computed(() => appStore.contactInfo)
const docUrl = computed(() => sanitizeUrl(appStore.docUrl))
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))
const avatarUrl = computed(() => user.value?.avatar_url?.trim() || '')
const availableBalance = computed(() => Number(user.value?.balance || 0))
const frozenBalance = computed(() => Number(user.value?.frozen_balance || 0))
const totalBalance = computed(() => availableBalance.value + frozenBalance.value)
const balanceAvailableText = computed(() => t('common.availableBalance') === 'common.availableBalance' ? '可用余额' : t('common.availableBalance'))
const balanceFrozenText = computed(() => t('common.frozenBalance') === 'common.frozenBalance' ? '冻结金额' : t('common.frozenBalance'))
const balanceTotalText = computed(() => t('common.totalBalance') === 'common.totalBalance' ? '总余额' : t('common.totalBalance'))
const balanceFrozenLabel = computed(() => `${balanceFrozenText.value} ${formatHeaderMoney(frozenBalance.value)}`)

// 只在标准模式的管理员下显示新手引导按钮
const showOnboardingButton = computed(() => {
  return !authStore.isSimpleMode && user.value?.role === 'admin'
})

const userInitials = computed(() => {
  if (!user.value) return ''
  // Prefer username, fallback to email
  if (user.value.username) {
    return user.value.username.substring(0, 2).toUpperCase()
  }
  if (user.value.email) {
    // Get the part before @ and take first 2 chars
    const localPart = user.value.email.split('@')[0]
    return localPart.substring(0, 2).toUpperCase()
  }
  return ''
})

const displayName = computed(() => {
  if (!user.value) return ''
  return user.value.username || user.value.email?.split('@')[0] || ''
})

const pageTitle = computed(() => {
  // For custom pages, use the menu item's label instead of generic "自定义页面"
  if (route.name === 'CustomPage') {
    const id = route.params.id as string
    const publicItems = appStore.cachedPublicSettings?.custom_menu_items ?? []
    const menuItem = publicItems.find((item) => item.id === id)
      ?? (authStore.isAdmin ? adminSettingsStore.customMenuItems.find((item) => item.id === id) : undefined)
    if (menuItem?.label) return menuItem.label
  }
  const titleKey = route.meta.titleKey as string
  if (titleKey) {
    return t(titleKey)
  }
  return (route.meta.title as string) || ''
})

const pageDescription = computed(() => {
  const descKey = route.meta.descriptionKey as string
  if (descKey) {
    return t(descKey)
  }
  return (route.meta.description as string) || ''
})

function toggleMobileSidebar() {
  appStore.toggleMobileSidebar()
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

/**
 * Close and hand focus back to the trigger.
 *
 * Separate from closeDropdown() on purpose: closeDropdown is bound as
 * `@click="closeDropdown"` on the menu items, so a `returnFocus` parameter would
 * receive the MouseEvent and always read as truthy. Keyboard dismissal has to
 * restore focus explicitly — the panel is `v-if`, so the focused item is removed
 * from the DOM and focus would otherwise fall back to <body>, stranding the user
 * at the top of the tab order.
 */
function closeDropdownAndRestoreFocus() {
  if (!dropdownOpen.value) return
  dropdownOpen.value = false
  triggerRef.value?.focus()
}

/** The menu items, in DOM order. Read live: several are conditional. */
function menuItems(): HTMLElement[] {
  if (!menuRef.value) return []
  return Array.from(menuRef.value.querySelectorAll<HTMLElement>('[role="menuitem"]'))
}

function focusItemAt(index: number) {
  const items = menuItems()
  if (items.length === 0) return
  // Wrap at both ends: ArrowDown past the last item returns to the first.
  const target = ((index % items.length) + items.length) % items.length
  items[target].focus()
}

async function openDropdownAndFocusFirst() {
  dropdownOpen.value = true
  await nextTick()
  focusItemAt(0)
}

function handleMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (!dropdownOpen.value) return
    event.stopPropagation()
    closeDropdownAndRestoreFocus()
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault() // otherwise the page scrolls behind the open menu
    if (!dropdownOpen.value) {
      void openDropdownAndFocusFirst()
      return
    }
    const items = menuItems()
    const current = items.indexOf(document.activeElement as HTMLElement)
    if (current === -1) {
      focusItemAt(event.key === 'ArrowDown' ? 0 : items.length - 1)
    } else {
      focusItemAt(current + (event.key === 'ArrowDown' ? 1 : -1))
    }
    return
  }

  if (!dropdownOpen.value) return

  if (event.key === 'Home') {
    event.preventDefault()
    focusItemAt(0)
  } else if (event.key === 'End') {
    event.preventDefault()
    focusItemAt(menuItems().length - 1)
  }
}

async function handleLogout() {
  closeDropdown()
  try {
    await authStore.logout()
  } catch (error) {
    // Ignore logout errors - still redirect to login
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

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/*
 * Notch / status-bar inset.
 *
 * The bar is `position: fixed; top: 0`, so on a device with a safe area it sits
 * under the status bar. Padding the top by the inset pushes the 4rem content row
 * clear of it while the glass itself still runs edge to edge — the status bar
 * gets the material behind it instead of raw page background. The height grows by
 * the same term so the padding adds to the bar rather than eating the row.
 *
 * Requires `viewport-fit=cover` in index.html; without it env() resolves to 0px
 * and both values collapse to today's behaviour, which is also the correct
 * no-safe-area result.
 *
 * Deliberately declared here rather than reusing the safe-area helper classes in
 * style.css: those have no call sites, so Tailwind purges them and they never
 * reach the served stylesheet. Note that naming one in a comment is enough to
 * un-purge it — the content globs scan .vue files as plain text — so this comment
 * avoids spelling them out.
 */
.app-header {
  padding-top: env(safe-area-inset-top);
  height: calc(4rem + env(safe-area-inset-top));
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
</style>
