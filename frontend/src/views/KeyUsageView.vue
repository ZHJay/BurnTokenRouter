<template>
  <div class="kv-page">
    <!-- ambient 光斑 -->
    <div class="kv-spot kv-spot-1" aria-hidden="true"></div>
    <div class="kv-spot kv-spot-2" aria-hidden="true"></div>

    <!-- Header (同 HomeView 的 48px 磨砂条) -->
    <header class="kv-nav glass">
      <nav class="kv-nav-inner">
        <router-link to="/home" class="kv-wordmark-link">
          <span class="wordmark truncate">{{ siteName }}</span>
        </router-link>
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
        </div>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="kv-main">
      <!-- Hero -->
      <div class="kv-hero">
        <h1 class="kv-title">{{ t('keyUsage.title') }}</h1>
        <p class="kv-sub">{{ t('keyUsage.subtitle') }}</p>
      </div>

      <!-- Input Section -->
      <div class="kv-input-section">
        <div class="kv-search-row">
          <div class="kv-search">
            <Icon name="lock" size="md" class="kv-search-icon" />
            <input
              v-model="apiKey"
              :type="keyVisible ? 'text' : 'password'"
              :placeholder="t('keyUsage.placeholder')"
              class="input kv-search-input"
              @keydown.enter="queryKey"
            />
            <button
              type="button"
              class="kv-eye"
              :aria-label="keyVisible ? t('keyUsage.hideKey') : t('keyUsage.showKey')"
              :title="keyVisible ? t('keyUsage.hideKey') : t('keyUsage.showKey')"
              @click="keyVisible = !keyVisible"
            >
              <Icon v-if="!keyVisible" name="eye" size="md" />
              <Icon v-else name="eyeOff" size="md" />
            </button>
          </div>
          <button
            @click="queryKey"
            :disabled="isQuerying"
            class="btn btn-primary kv-query-btn"
          >
            <svg v-if="isQuerying" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
            </svg>
            <Icon v-else name="search" size="md" />
            {{ isQuerying ? t('keyUsage.querying') : t('keyUsage.query') }}
          </button>
        </div>
        <p class="kv-note">{{ t('keyUsage.privacyNote') }}</p>

        <!-- Date Range Picker -->
        <div v-if="showDatePicker" class="kv-daterange">
          <div class="kv-daterange-row">
            <span class="kv-daterange-label">{{ t('keyUsage.dateRange') }}</span>
            <button
              v-for="range in dateRanges"
              :key="range.key"
              @click="setDateRange(range.key)"
              class="filter-chip"
              :class="currentRange === range.key ? 'on' : ''"
            >{{ range.label }}</button>
            <div v-if="currentRange === 'custom'" class="kv-daterange-custom">
              <input
                v-model="customStartDate"
                type="date"
                class="input kv-date-input"
              />
              <span class="kv-dash">-</span>
              <input
                v-model="customEndDate"
                type="date"
                class="input kv-date-input"
              />
              <button
                @click="queryKey"
                class="btn btn-primary btn-sm"
              >{{ t('keyUsage.apply') }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Container -->
      <div v-if="showResults">
        <!-- Loading Skeleton -->
        <div v-if="showLoading" class="kv-skeletons">
          <div class="card kv-skeleton-card">
            <div class="skeleton h-5 w-24 mb-6"></div>
            <div class="flex justify-center"><div class="skeleton w-44 h-44 rounded-full"></div></div>
          </div>
          <div class="card kv-skeleton-card">
            <div class="skeleton h-5 w-24 mb-6"></div>
            <div class="flex justify-center"><div class="skeleton w-44 h-44 rounded-full"></div></div>
          </div>
          <div class="card kv-skeleton-card kv-skeleton-wide">
            <div class="skeleton h-5 w-32 mb-6"></div>
            <div class="space-y-4">
              <div class="skeleton h-4 w-full"></div>
              <div class="skeleton h-4 w-3/4"></div>
              <div class="skeleton h-4 w-5/6"></div>
              <div class="skeleton h-4 w-2/3"></div>
            </div>
          </div>
        </div>

        <!-- Result Content -->
        <div v-else-if="resultData" class="kv-results">
          <!-- Status Badge -->
          <div v-if="statusInfo" class="fade-up kv-status-row">
            <div class="kv-status-pill">
              <span
                class="dot"
                :class="statusInfo.isActive ? 'dot-active' : 'dot-error'"
              ></span>
              <span class="kv-status-label">{{ statusInfo.label }}</span>
              <span class="kv-status-sep">|</span>
              <span class="kv-status-text">{{ statusInfo.statusText }}</span>
            </div>
          </div>

          <!-- Ring Cards Grid -->
          <div v-if="ringItems.length > 0" :class="ringGridClass">
            <div
              v-for="(ring, i) in ringItems"
              :key="i"
              class="fade-up card card-hover kv-ring"
              :class="`fade-up-delay-${Math.min(i + 1, 4)}`"
            >
              <div class="kv-ring-head">
                <h3 class="kv-ring-title">{{ ring.title }}</h3>
                <!-- Clock icon -->
                <svg v-if="ring.iconType === 'clock'" class="kv-ring-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <!-- Calendar icon -->
                <svg v-else-if="ring.iconType === 'calendar'" class="kv-ring-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <!-- Dollar icon -->
                <svg v-else class="kv-ring-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div class="flex justify-center">
                <div class="relative">
                  <svg class="w-44 h-44" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="68" fill="none" :style="{ stroke: ringTrackColor }" stroke-width="10"/>
                    <circle
                      class="progress-ring"
                      cx="80" cy="80" r="68" fill="none"
                      :style="{ stroke: `url(#ring-grad-${i})` }"
                      stroke-width="10" stroke-linecap="round"
                      :stroke-dasharray="CIRCUMFERENCE.toFixed(2)"
                      :stroke-dashoffset="getRingOffset(ring)"
                    />
                    <defs>
                      <linearGradient :id="`ring-grad-${i}`" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" :style="{ stopColor: RING_GRADIENTS[i % 4].from }"/>
                        <stop offset="100%" :style="{ stopColor: RING_GRADIENTS[i % 4].to }"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <template v-if="ring.isBalance">
                      <span class="kv-ring-amount" :style="{ color: RING_GRADIENTS[i % 4].from }">
                        {{ ring.amount }}
                      </span>
                    </template>
                    <template v-else>
                      <span class="kv-ring-pct">
                        {{ displayPcts[i] ?? 0 }}%
                      </span>
                      <span class="kv-ring-used">{{ t('keyUsage.used') }}</span>
                      <span
                        class="kv-ring-sub"
                        :style="{ color: RING_GRADIENTS[i % 4].from }"
                      >{{ ring.amount }}</span>
                      <p v-if="ring.resetAt && formatResetTime(ring.resetAt)" class="kv-ring-reset">
                        ⟳ {{ formatResetTime(ring.resetAt) }}
                      </p>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Detail Card -->
          <div
            v-if="detailRows.length > 0"
            class="fade-up fade-up-delay-3 card kv-panel"
          >
            <div class="kv-panel-head">
              <h3 class="kv-panel-title">{{ t('keyUsage.detailInfo') }}</h3>
            </div>
            <div class="kv-rows">
              <div
                v-for="(row, i) in detailRows"
                :key="i"
                class="kv-row"
              >
                <div class="flex items-center gap-3">
                  <div class="kv-row-icon" :class="row.iconBg">
                    <svg
                      class="w-4 h-4"
                      :class="row.iconColor"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                      v-html="row.iconSvg"
                    ></svg>
                  </div>
                  <span class="kv-row-label">{{ row.label }}</span>
                </div>
                <span class="kv-row-value" :class="row.valueClass || 'text-gray-900 dark:text-white'">
                  {{ row.value }}
                </span>
              </div>
            </div>
          </div>

          <!-- Usage Stats Card -->
          <div
            v-if="usageStatCells.length > 0"
            class="fade-up fade-up-delay-3 card kv-panel"
          >
            <div class="kv-panel-head">
              <h3 class="kv-panel-title">{{ t('keyUsage.tokenStats') }}</h3>
            </div>
            <div class="kv-stat-grid">
              <div
                v-for="(cell, i) in usageStatCells"
                :key="i"
                class="kv-stat-cell"
              >
                <div class="kv-stat-label">{{ cell.label }}</div>
                <div class="kv-stat-value">{{ cell.value }}</div>
              </div>
            </div>
          </div>

          <!-- Daily Usage Table -->
          <div
            v-if="showDailyUsage"
            class="fade-up fade-up-delay-4 table-card kv-table-card"
          >
            <div class="kv-panel-head kv-panel-head-row">
              <h3 class="kv-panel-title">{{ t('keyUsage.dailyDetail') }}</h3>
              <div class="segmented">
                <button
                  v-for="option in dailyUsageOptions"
                  :key="option.value"
                  @click="setDailyUsageDays(option.value)"
                  :class="dailyUsageDays === option.value ? 'active' : ''"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div v-if="dailyUsageRows.length > 0" class="table-scroll">
              <table class="kv-table">
                <thead>
                  <tr>
                    <th>{{ t('keyUsage.date') }}</th>
                    <th class="num">{{ t('keyUsage.requests') }}</th>
                    <th class="num">{{ t('keyUsage.inputTokens') }}</th>
                    <th class="num">{{ t('keyUsage.outputTokens') }}</th>
                    <th class="num">{{ t('keyUsage.cacheReadTokens') }}</th>
                    <th class="num">{{ t('keyUsage.cacheWriteTokens') }}</th>
                    <th class="num">{{ t('keyUsage.cost') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in dailyUsageRows"
                    :key="row.date"
                  >
                    <td class="kv-date-cell">{{ row.date }}</td>
                    <td class="num">{{ fmtNum(row.requests) }}</td>
                    <td class="num">{{ fmtNum(row.input_tokens) }}</td>
                    <td class="num">{{ fmtNum(row.output_tokens) }}</td>
                    <td class="num">{{ fmtNum(row.cache_read_tokens) }}</td>
                    <td class="num">{{ fmtNum(row.cache_write_tokens) }}</td>
                    <td class="num kv-cost">{{ usd(row.actual_cost != null ? row.actual_cost : row.cost) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="kv-empty-rows">
              {{ t('keyUsage.noDailyUsage') }}
            </div>
          </div>

          <!-- Model Stats Table -->
          <div
            v-if="modelStats.length > 0"
            class="fade-up fade-up-delay-4 table-card kv-table-card"
          >
            <div class="kv-panel-head">
              <h3 class="kv-panel-title">{{ t('keyUsage.modelStats') }}</h3>
            </div>
            <div class="table-scroll">
              <table class="kv-table">
                <thead>
                  <tr>
                    <th>{{ t('keyUsage.model') }}</th>
                    <th class="num">{{ t('keyUsage.requests') }}</th>
                    <th class="num">{{ t('keyUsage.inputTokens') }}</th>
                    <th class="num">{{ t('keyUsage.outputTokens') }}</th>
                    <th class="num">{{ t('keyUsage.cacheCreationTokens') }}</th>
                    <th class="num">{{ t('keyUsage.cacheReadTokens') }}</th>
                    <th class="num">{{ t('keyUsage.totalTokens') }}</th>
                    <th class="num">{{ t('keyUsage.cost') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(m, i) in modelStats"
                    :key="i"
                  >
                    <td class="kv-model-cell">{{ m.model || '-' }}</td>
                    <td class="num">{{ fmtNum(m.requests) }}</td>
                    <td class="num">{{ fmtNum(m.input_tokens) }}</td>
                    <td class="num">{{ fmtNum(m.output_tokens) }}</td>
                    <td class="num">{{ fmtNum(m.cache_creation_tokens) }}</td>
                    <td class="num">{{ fmtNum(m.cache_read_tokens) }}</td>
                    <td class="num">{{ fmtNum(m.total_tokens) }}</td>
                    <td class="num kv-cost">{{ usd(m.actual_cost != null ? m.actual_cost : m.cost) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer (same pattern as HomeView) -->
    <footer class="kv-footer">
      <div class="kv-footer-inner">
        <p class="kv-footer-copy">
          &copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}
        </p>
        <div class="flex items-center gap-4">
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="kv-footer-link"
          >{{ t('home.docs') }}</a>
          <a
            :href="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="kv-footer-link"
          >GitHub</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { buildGatewayUrl } from '@/api/client'
import { formatDateLocalInput } from '@/utils/format'
import { sanitizeUrl } from '@/utils/url'
import { useTheme } from '@/composables/useTheme'

const { t, locale } = useI18n()
const appStore = useAppStore()
const { isDark, toggleTheme } = useTheme()

// ==================== Site Settings (same as HomeView) ====================

const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API')
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const githubUrl = 'https://github.com/Wei-Shaw/sub2api'

const currentYear = computed(() => new Date().getFullYear())

// ==================== Key Query State ====================

const apiKey = ref('')
const keyVisible = ref(false)
const isQuerying = ref(false)
const showResults = ref(false)
const showLoading = ref(false)
const showDatePicker = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resultData = ref<any>(null)
const now = ref(new Date())
let resetTimer: ReturnType<typeof setInterval> | null = null

// ==================== Date Range State ====================

type DateRangeKey = 'today' | '7d' | '30d' | 'custom'
const currentRange = ref<DateRangeKey>('today')
const customStartDate = ref('')
const customEndDate = ref('')
const dailyUsageDays = ref<7 | 30 | 90>(30)

const dateRanges = computed(() => [
  { key: 'today' as const, label: t('keyUsage.dateRangeToday') },
  { key: '7d' as const, label: t('keyUsage.dateRange7d') },
  { key: '30d' as const, label: t('keyUsage.dateRange30d') },
  { key: 'custom' as const, label: t('keyUsage.dateRangeCustom') },
])

const dailyUsageOptions = computed(() => [
  { value: 7 as const, label: t('keyUsage.dateRange7d') },
  { value: 30 as const, label: t('keyUsage.dateRange30d') },
  { value: 90 as const, label: t('keyUsage.dateRange90d') },
])

function setDateRange(key: DateRangeKey) {
  currentRange.value = key
  if (key !== 'custom') {
    queryKey()
  }
}

function getDateParams(): string {
  const now = new Date()
  const params = new URLSearchParams()

  if (currentRange.value === 'custom') {
    if (customStartDate.value && customEndDate.value) {
      params.set('start_date', customStartDate.value)
      params.set('end_date', customEndDate.value)
    }
  } else {
    const end = formatDateLocalInput(now)
    let start: string
    switch (currentRange.value) {
      case 'today': start = end; break
      case '7d': start = formatDateLocalInput(new Date(now.getTime() - 7 * 86400000)); break
      case '30d': start = formatDateLocalInput(new Date(now.getTime() - 30 * 86400000)); break
      default: start = formatDateLocalInput(new Date(now.getTime() - 30 * 86400000))
    }
    params.set('start_date', start)
    params.set('end_date', end)
  }
  params.set('days', String(dailyUsageDays.value))
  params.set('timezone', getBrowserTimezone())
  return params.toString()
}

function setDailyUsageDays(days: 7 | 30 | 90) {
  if (dailyUsageDays.value === days) return
  dailyUsageDays.value = days
  if (resultData.value && apiKey.value.trim()) {
    queryKey()
  }
}

// ==================== Ring Animation ====================

const CIRCUMFERENCE = 2 * Math.PI * 68
// 环形渐变:teal/green/orange 走 iOS 语义 token;indigo 为数据可视化强调色,无对应 token,保留字面量
const RING_GRADIENTS = [
  { from: 'var(--teal)', to: 'color-mix(in srgb, var(--teal) 62%, white)' },
  { from: '#6366F1', to: '#A5B4FC' },
  { from: 'var(--green)', to: 'color-mix(in srgb, var(--green) 62%, white)' },
  { from: 'var(--orange)', to: 'color-mix(in srgb, var(--orange) 62%, white)' },
]

const ringAnimated = ref(false)
const displayPcts = ref<number[]>([])

const ringTrackColor = computed(() => isDark.value ? 'var(--fill)' : 'var(--fill-hover)')

interface RingItem {
  title: string
  pct: number
  amount: string
  isBalance?: boolean
  iconType: 'clock' | 'calendar' | 'dollar'
  resetAt?: string | null
}

function getRingOffset(ring: RingItem): number {
  if (!ringAnimated.value) return CIRCUMFERENCE
  if (ring.isBalance) return 0
  return CIRCUMFERENCE - (Math.min(ring.pct, 100) / 100) * CIRCUMFERENCE
}

function triggerRingAnimation(items: RingItem[]) {
  ringAnimated.value = false
  displayPcts.value = items.map(() => 0)

  nextTick(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        ringAnimated.value = true

        // Animate percentage numbers
        const duration = 1000
        const startTime = performance.now()
        const targets = items.map(item => item.isBalance ? 0 : item.pct)

        function tick() {
          const elapsed = performance.now() - startTime
          const p = Math.min(elapsed / duration, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          displayPcts.value = targets.map(target => Math.round(ease * target))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }, 50)
    })
  })
}

// ==================== Computed Data ====================

const statusInfo = computed(() => {
  const data = resultData.value
  if (!data) return null

  if (data.mode === 'quota_limited') {
    const isValid = data.isValid !== false
    const statusMap: Record<string, string> = {
      active: 'Active',
      quota_exhausted: 'Quota Exhausted',
      expired: 'Expired',
    }
    return {
      label: t('keyUsage.quotaMode'),
      statusText: statusMap[data.status] || data.status || 'Unknown',
      isActive: isValid && data.status === 'active',
    }
  }

  return {
    label: data.planName || t('keyUsage.walletBalance'),
    statusText: 'Active',
    isActive: true,
  }
})

const ringItems = computed<RingItem[]>(() => {
  const data = resultData.value
  if (!data) return []

  const items: RingItem[] = []

  if (data.mode === 'quota_limited') {
    if (data.quota) {
      const pct = data.quota.limit > 0 ? Math.min(Math.round((data.quota.used / data.quota.limit) * 100), 100) : 0
      items.push({ title: t('keyUsage.totalQuota'), pct, amount: `${usd(data.quota.used)} / ${usd(data.quota.limit)}`, iconType: 'dollar' })
    }
    if (data.rate_limits) {
      const windowLabels: Record<string, string> = { '5h': t('keyUsage.limit5h'), '1d': t('keyUsage.limitDaily'), '7d': t('keyUsage.limit7d') }
      const windowIcons: Record<string, 'clock' | 'calendar'> = { '5h': 'clock', '1d': 'calendar', '7d': 'calendar' }
      for (const rl of data.rate_limits) {
        const pct = rl.limit > 0 ? Math.min(Math.round((rl.used / rl.limit) * 100), 100) : 0
        items.push({
          title: windowLabels[rl.window] || rl.window,
          pct,
          amount: `${usd(rl.used)} / ${usd(rl.limit)}`,
          iconType: windowIcons[rl.window] || 'clock',
          resetAt: rl.reset_at,
        })
      }
    }
  } else {
    if (data.subscription) {
      const sub = data.subscription
      const limits = [
        { label: t('keyUsage.limitDaily'), usage: sub.daily_usage_usd, limit: sub.daily_limit_usd },
        { label: t('keyUsage.limitWeekly'), usage: sub.weekly_usage_usd, limit: sub.weekly_limit_usd },
        { label: t('keyUsage.limitMonthly'), usage: sub.monthly_usage_usd, limit: sub.monthly_limit_usd },
      ]
      for (const l of limits) {
        if (l.limit != null && l.limit > 0) {
          const pct = Math.min(Math.round((l.usage / l.limit) * 100), 100)
          items.push({ title: l.label, pct, amount: `${usd(l.usage)} / ${usd(l.limit)}`, iconType: 'calendar' })
        }
      }
    }
    if (!data.subscription && data.balance != null) {
      items.push({ title: t('keyUsage.walletBalance'), pct: 0, amount: usd(data.balance), isBalance: true, iconType: 'dollar' })
    }
  }

  return items
})

const ringGridClass = computed(() => {
  const len = ringItems.value.length
  if (len === 1) return 'kv-ring-grid kv-ring-grid-1'
  if (len === 2) return 'kv-ring-grid kv-ring-grid-2'
  return 'kv-ring-grid'
})

interface DetailRow {
  iconBg: string
  iconColor: string
  iconSvg: string
  label: string
  value: string
  valueClass: string
}

function getUsageColor(pct: number): string {
  if (pct > 90) return 'text-rose-500'
  if (pct > 70) return 'text-amber-500'
  return 'text-emerald-500'
}

const detailRows = computed<DetailRow[]>(() => {
  const data = resultData.value
  if (!data) return []

  const rows: DetailRow[] = []
  const ICON_SHIELD = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
  const ICON_CALENDAR = '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
  const ICON_DOLLAR = '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
  const ICON_CHECK = '<polyline points="20 6 9 17 4 12"/>'

  if (data.mode === 'quota_limited') {
    if (data.quota) {
      const remainColor = data.quota.remaining <= 0 ? 'text-rose-500'
        : data.quota.remaining < data.quota.limit * 0.1 ? 'text-amber-500'
        : 'text-emerald-500'
      rows.push({
        iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', iconSvg: ICON_SHIELD,
        label: t('keyUsage.remainingQuota'), value: usd(data.quota.remaining), valueClass: remainColor,
      })
    }
    if (data.expires_at) {
      const daysLeft = data.days_until_expiry
      let expiryStr = formatDate(data.expires_at)
      if (daysLeft != null) {
        expiryStr += daysLeft > 0 ? ` ${t('keyUsage.daysLeft', { days: daysLeft })}` : daysLeft === 0 ? ` ${t('keyUsage.todayExpires')}` : ''
      }
      rows.push({
        iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500', iconSvg: ICON_CALENDAR,
        label: t('keyUsage.expiresAt'), value: expiryStr, valueClass: '',
      })
    }
    if (data.rate_limits) {
      const windowMap: Record<string, string> = { '5h': '5H', '1d': locale.value === 'zh' ? '日' : 'D', '7d': '7D' }
      for (const rl of data.rate_limits) {
        const pct = rl.limit > 0 ? (rl.used / rl.limit) * 100 : 0
        let valueStr = `${usd(rl.used)} / ${usd(rl.limit)}`
        const resetStr = formatResetTime(rl.reset_at)
        if (resetStr) {
          valueStr += ` (⟳ ${resetStr})`
        }
        rows.push({
          iconBg: 'bg-primary-500/10', iconColor: 'text-primary-500', iconSvg: ICON_DOLLAR,
          label: `${t('keyUsage.usedQuota')} (${windowMap[rl.window] || rl.window})`,
          value: valueStr,
          valueClass: getUsageColor(pct),
        })
      }
    }
  } else {
    rows.push({
      iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', iconSvg: ICON_CHECK,
      label: t('keyUsage.subscriptionType'), value: data.planName || t('keyUsage.walletBalance'), valueClass: '',
    })

    if (data.subscription) {
      const sub = data.subscription
      if (sub.daily_limit_usd > 0) {
        const pct = (sub.daily_usage_usd / sub.daily_limit_usd) * 100
        rows.push({
          iconBg: 'bg-primary-500/10', iconColor: 'text-primary-500', iconSvg: ICON_DOLLAR,
          label: `${t('keyUsage.usedQuota')} (${locale.value === 'zh' ? '日' : 'D'})`, value: `${usd(sub.daily_usage_usd)} / ${usd(sub.daily_limit_usd)}`, valueClass: getUsageColor(pct),
        })
      }
      if (sub.weekly_limit_usd > 0) {
        const pct = (sub.weekly_usage_usd / sub.weekly_limit_usd) * 100
        rows.push({
          iconBg: 'bg-indigo-500/10', iconColor: 'text-indigo-500', iconSvg: ICON_DOLLAR,
          label: `${t('keyUsage.usedQuota')} (${locale.value === 'zh' ? '周' : 'W'})`, value: `${usd(sub.weekly_usage_usd)} / ${usd(sub.weekly_limit_usd)}`, valueClass: getUsageColor(pct),
        })
      }
      if (sub.monthly_limit_usd > 0) {
        const pct = (sub.monthly_usage_usd / sub.monthly_limit_usd) * 100
        rows.push({
          iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', iconSvg: ICON_DOLLAR,
          label: `${t('keyUsage.usedQuota')} (${locale.value === 'zh' ? '月' : 'M'})`, value: `${usd(sub.monthly_usage_usd)} / ${usd(sub.monthly_limit_usd)}`, valueClass: getUsageColor(pct),
        })
      }
      if (sub.expires_at) {
        rows.push({
          iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500', iconSvg: ICON_CALENDAR,
          label: t('keyUsage.subscriptionExpires'), value: formatDate(sub.expires_at), valueClass: '',
        })
      }
    }

    const remainColor = data.remaining != null
      ? (data.remaining <= 0 ? 'text-rose-500' : data.remaining < 10 ? 'text-amber-500' : 'text-emerald-500')
      : ''
    rows.push({
      iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', iconSvg: ICON_SHIELD,
      label: t('keyUsage.remainingQuota'), value: data.remaining != null ? usd(data.remaining) : '-', valueClass: remainColor,
    })
  }

  return rows
})

interface StatCell {
  label: string
  value: string
}

const usageStatCells = computed<StatCell[]>(() => {
  const usage = resultData.value?.usage
  if (!usage) return []

  const today = usage.today || {}
  const total = usage.total || {}

  return [
    { label: t('keyUsage.todayRequests'), value: fmtNum(today.requests) },
    { label: t('keyUsage.todayInputTokens'), value: fmtNum(today.input_tokens) },
    { label: t('keyUsage.todayOutputTokens'), value: fmtNum(today.output_tokens) },
    { label: t('keyUsage.todayTokens'), value: fmtNum(today.total_tokens) },
    { label: t('keyUsage.todayCacheCreation'), value: fmtNum(today.cache_creation_tokens) },
    { label: t('keyUsage.todayCacheRead'), value: fmtNum(today.cache_read_tokens) },
    { label: t('keyUsage.todayCost'), value: usd(today.actual_cost) },
    { label: t('keyUsage.rpmTpm'), value: `${usage.rpm || 0} / ${usage.tpm || 0}` },
    { label: t('keyUsage.totalRequests'), value: fmtNum(total.requests) },
    { label: t('keyUsage.totalInputTokens'), value: fmtNum(total.input_tokens) },
    { label: t('keyUsage.totalOutputTokens'), value: fmtNum(total.output_tokens) },
    { label: t('keyUsage.totalTokensLabel'), value: fmtNum(total.total_tokens) },
    { label: t('keyUsage.totalCacheCreation'), value: fmtNum(total.cache_creation_tokens) },
    { label: t('keyUsage.totalCacheRead'), value: fmtNum(total.cache_read_tokens) },
    { label: t('keyUsage.totalCost'), value: usd(total.actual_cost) },
    { label: t('keyUsage.avgDuration'), value: usage.average_duration_ms ? `${Math.round(usage.average_duration_ms)} ms` : '-' },
  ]
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelStats = computed<any[]>(() => resultData.value?.model_stats || [])

interface DailyUsageRow {
  date: string
  requests: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost: number
  actual_cost?: number
}

const dailyUsageRows = computed<DailyUsageRow[]>(() => {
  const rows = resultData.value?.daily_usage
  return Array.isArray(rows) ? rows : []
})

const showDailyUsage = computed(() => Boolean(resultData.value && Array.isArray(resultData.value.daily_usage)))

// ==================== Utility Functions ====================

function usd(value: number | null | undefined): string {
  if (value == null || value < 0) return '-'
  return '$' + Number(value).toFixed(2)
}

function fmtNum(val: number | null | undefined): string {
  if (val == null) return '-'
  return val.toLocaleString()
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const loc = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return d.toLocaleDateString(loc, { year: 'numeric', month: 'long', day: 'numeric' })
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// ==================== API Query ====================

async function fetchUsage(key: string) {
  const dateParams = getDateParams()
  const url = buildGatewayUrl('/v1/usage') + (dateParams ? '?' + dateParams : '')
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + key },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.error?.message || body?.message || `${t('keyUsage.queryFailed')} (${res.status})`
    throw new Error(msg)
  }
  return await res.json()
}

async function queryKey() {
  if (isQuerying.value) return
  const key = apiKey.value.trim()
  if (!key) {
    appStore.showInfo(t('keyUsage.enterApiKey'))
    return
  }

  isQuerying.value = true
  showResults.value = true
  showLoading.value = true
  resultData.value = null

  try {
    const data = await fetchUsage(key)
    resultData.value = data
    showLoading.value = false
    showDatePicker.value = true

    // Trigger ring animations after DOM update
    nextTick(() => {
      triggerRingAnimation(ringItems.value)
    })

    appStore.showSuccess(t('keyUsage.querySuccess'))
  } catch (err) {
    showResults.value = false
    showLoading.value = false
    appStore.showError((err as Error).message || t('keyUsage.queryFailedRetry'))
  } finally {
    isQuerying.value = false
  }
}

// ==================== Lifecycle ====================

function formatResetTime(resetAt: string | null | undefined): string {
  if (!resetAt) return ''
  const diff = new Date(resetAt).getTime() - now.value.getTime()
  if (diff <= 0) return t('keyUsage.resetNow')
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

onMounted(() => {
  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
  resetTimer = setInterval(() => { now.value = new Date() }, 60000)
})

onUnmounted(() => {
  if (resetTimer) clearInterval(resetTimer)
})
</script>

<style scoped>
/* =========================================================================
   Key Usage · Apple 外壳(组件样式来自全局设计系统 style.css)
   ========================================================================= */

.kv-page {
  position: relative;
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  flex-direction: column;
  background: var(--bg);
  color: var(--text-primary);
  overflow-x: clip;
}

/* ambient 光斑 */
.kv-spot {
  position: fixed;
  z-index: 0;
  border-radius: 50%;
  pointer-events: none;
}
.kv-spot-1 {
  width: 440px;
  height: 440px;
  top: -160px;
  right: -140px;
  background: var(--blue);
  opacity: 0.12;
  filter: blur(100px);
}
.kv-spot-2 {
  width: 420px;
  height: 420px;
  bottom: -180px;
  left: -140px;
  background: var(--teal);
  opacity: 0.09;
  filter: blur(100px);
}
:global(html.dark) .kv-spot-1 { opacity: 0.18; }
:global(html.dark) .kv-spot-2 { opacity: 0.14; }

/* 48px 磨砂顶栏 */
.kv-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  height: var(--gn-height, 48px);
  border-bottom: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight);
}

.kv-nav-inner {
  max-width: 1024px;
  height: 100%;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.kv-wordmark-link {
  min-width: 0;
  display: flex;
  align-items: center;
}

.wordmark {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  white-space: nowrap;
}

.kv-main {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1024px;
  margin: 0 auto;
  padding: 56px 20px 48px;
  flex: 1;
}

/* Hero */
.kv-hero {
  text-align: center;
  margin-bottom: 36px;
}

.kv-title {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.kv-sub {
  margin-top: 10px;
  font-size: 15px;
  color: var(--text-secondary);
  max-width: 440px;
  margin-inline: auto;
}

/* Search */
.kv-input-section {
  max-width: 560px;
  margin: 0 auto 48px;
}

.kv-search-row {
  display: flex;
  gap: 12px;
}

.kv-search {
  position: relative;
  flex: 1;
  min-width: 0;
}

.kv-search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.kv-search-input {
  height: 46px;
  padding-left: 44px;
  padding-right: 44px;
  font-size: 14px;
}

.kv-eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease);
}
.kv-eye:hover {
  background: var(--fill);
  color: var(--text-primary);
}

.kv-query-btn {
  height: 46px;
  padding: 0 22px;
  flex-shrink: 0;
}

.kv-note {
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* Date range */
.kv-daterange {
  margin-top: 18px;
}

.kv-daterange-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.kv-daterange-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-right: 4px;
}

.kv-daterange-custom {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 4px;
}

.kv-date-input {
  width: auto;
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
}

.kv-dash {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* Skeletons */
.kv-skeletons {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (min-width: 768px) {
  .kv-skeletons {
    grid-template-columns: repeat(2, 1fr);
  }
  .kv-skeleton-wide {
    grid-column: 1 / -1;
  }
}

/* Results */
.kv-results {
  display: grid;
  gap: 24px;
}

.kv-status-row {
  display: flex;
  justify-content: center;
}

.kv-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--r-pill);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card);
}

.kv-status-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.kv-status-sep {
  font-size: 12px;
  color: var(--text-tertiary);
}

.kv-status-text {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Ring cards */
.kv-ring-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
@media (min-width: 768px) {
  .kv-ring-grid { grid-template-columns: repeat(2, 1fr); }
  .kv-ring-grid-1 { grid-template-columns: 1fr; max-width: 480px; margin-inline: auto; }
}
@media (min-width: 1024px) {
  .kv-ring-grid { grid-template-columns: repeat(3, 1fr); }
  .kv-ring-grid-2 { grid-template-columns: repeat(2, 1fr); }
}

.kv-ring {
  padding: 24px 24px 28px;
}

.kv-ring-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.kv-ring-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.kv-ring-icon {
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
}

.kv-ring-amount {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.kv-ring-pct {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.kv-ring-used {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary);
}

.kv-ring-sub {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.kv-ring-reset {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

/* Panels */
.kv-panel {
  padding: 22px;
}

.kv-panel-head {
  padding-bottom: 14px;
  margin-bottom: 6px;
  border-bottom: 0.5px solid var(--separator);
}

.kv-panel-head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.kv-panel-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.kv-rows {
  display: flex;
  flex-direction: column;
}

.kv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 2px;
}
.kv-row + .kv-row {
  border-top: 0.5px solid var(--separator);
}

.kv-row-icon {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.kv-row-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.kv-row-value {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

/* Usage stat grid (发丝线网格) */
.kv-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5px;
  background: var(--separator);
  margin-top: 12px;
  border-radius: var(--r-md);
  overflow: hidden;
}
@media (min-width: 768px) {
  .kv-stat-grid { grid-template-columns: repeat(4, 1fr); }
}

.kv-stat-cell {
  background: var(--bg-elevated);
  padding: 14px 16px;
}

.kv-stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.kv-stat-value {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

/* Tables */
.kv-table-card {
  overflow: hidden;
}

.kv-table-card .kv-panel-head {
  padding: 16px 22px;
  margin-bottom: 0;
}

.kv-table th.num,
.kv-table td.num {
  text-align: right;
}

.kv-table td {
  white-space: nowrap;
}

.kv-date-cell,
.kv-model-cell {
  font-weight: 500;
}

.kv-cost {
  font-weight: 600;
}

.kv-empty-rows {
  padding: 32px 22px;
  text-align: center;
  font-size: 14px;
  color: var(--text-tertiary);
}

/* Footer */
.kv-footer {
  position: relative;
  z-index: 1;
  border-top: 0.5px solid var(--separator);
}

.kv-footer-inner {
  max-width: 1024px;
  margin: 0 auto;
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
@media (min-width: 640px) {
  .kv-footer-inner {
    flex-direction: row;
    text-align: left;
  }
}

.kv-footer-copy {
  font-size: 13px;
  color: var(--text-tertiary);
}

.kv-footer-link {
  font-size: 13px;
  color: var(--text-tertiary);
  transition: color 0.18s var(--ease);
}
.kv-footer-link:hover {
  color: var(--text-primary);
  text-decoration: none;
}

/* Ring animation */
.progress-ring {
  transition: stroke-dashoffset 1.2s var(--ease);
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}

/* Skeleton loading */
@keyframes shimmer-kv {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--fill-hover) 25%, var(--fill) 50%, var(--fill-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer-kv 1.8s ease-in-out infinite;
  border-radius: 8px;
}
:global(.dark) .skeleton {
  background: linear-gradient(90deg, var(--fill) 25%, var(--fill-hover) 50%, var(--fill) 75%);
  background-size: 200% 100%;
}

/* Fade up animation */
@keyframes fade-up-kv {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-up {
  animation: fade-up-kv 0.5s var(--ease) forwards;
}
.fade-up-delay-1 { animation-delay: 0.1s; opacity: 0; }
.fade-up-delay-2 { animation-delay: 0.2s; opacity: 0; }
.fade-up-delay-3 { animation-delay: 0.3s; opacity: 0; }
.fade-up-delay-4 { animation-delay: 0.4s; opacity: 0; }

/* Tabular nums */
.tabular-nums {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

@media (max-width: 640px) {
  .kv-main { padding: 40px 16px 32px; }
  .kv-title { font-size: 30px; }
  .kv-search-row { flex-direction: column; }
}
</style>
