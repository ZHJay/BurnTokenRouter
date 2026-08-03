<template>
  <AppLayout>
    <div class="space-y-4">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="spinner h-8 w-8 text-primary-500"></div>
      </div>

      <template v-else-if="detail">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- 四张卡共用同一套内部结构：左列 label/value/meta + 右列 8×8 磁贴。
               色调走磁贴；数值只有"可动用返佣"保留绿色 —— 那是唯一一处颜色
               承载语义（这笔钱现在就能转走）的位置，其余回到 --label。 -->
          <div class="card card-hover p-4" data-testid="affiliate-stat-rebate-rate">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">{{ t('affiliate.stats.rebateRate') }}</p>
                <p class="stat-value">
                  {{ formattedRebateRate }}<span class="ml-0.5 text-sm font-medium text-gray-500 dark:text-gray-400">%</span>
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('affiliate.stats.rebateRateHint') }}
                </p>
              </div>
              <div class="stat-icon stat-icon-primary h-8 w-8 shrink-0 text-base">
                <Icon name="dollar" size="sm" class="h-4 w-4" />
              </div>
            </div>
          </div>
          <div class="card card-hover p-4" data-testid="affiliate-stat-invited-users">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">{{ t('affiliate.stats.invitedUsers') }}</p>
                <p class="stat-value">{{ formatCount(detail.aff_count) }}</p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-teal-100 text-base text-teal-500 dark:bg-teal-900/30 dark:text-teal-300">
                <Icon name="users" size="sm" class="h-4 w-4" />
              </div>
            </div>
          </div>
          <div class="card card-hover p-4" data-testid="affiliate-stat-available-quota">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">{{ t('affiliate.stats.availableQuota') }}</p>
                <p class="stat-value text-green-600 dark:text-green-400">
                  {{ formatCurrency(detail.aff_quota) }}
                </p>
              </div>
              <div class="stat-icon stat-icon-success h-8 w-8 shrink-0 text-base">
                <Icon name="dollar" size="sm" class="h-4 w-4" />
              </div>
            </div>
          </div>
          <div class="card card-hover p-4" data-testid="affiliate-stat-total-quota">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <p class="stat-label">{{ t('affiliate.stats.totalQuota') }}</p>
                <p class="stat-value">{{ formatCurrency(detail.aff_history_quota) }}</p>
                <p v-if="detail.aff_frozen_quota > 0" class="text-xs tabular text-amber-600 dark:text-amber-400">
                  {{ t('affiliate.stats.frozenQuota') }}: {{ formatCurrency(detail.aff_frozen_quota) }}
                </p>
              </div>
              <div class="stat-icon h-8 w-8 shrink-0 bg-purple-100 text-base text-purple-500 dark:bg-purple-900/30 dark:text-purple-400">
                <Icon name="clock" size="sm" class="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('affiliate.title') }}</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">{{ t('affiliate.description') }}</p>

            <div class="mt-5 grid gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <p class="input-label mb-0">{{ t('affiliate.yourCode') }}</p>
                <div class="card-inset flex flex-col items-stretch gap-2 px-3 py-2 sm:flex-row sm:items-center">
                  <code class="min-w-0 break-all text-sm font-semibold text-gray-900 dark:text-white sm:flex-1 sm:truncate">{{ detail.aff_code }}</code>
                  <button class="btn btn-secondary btn-sm w-full sm:w-auto sm:shrink-0" @click="copyCode">
                    <Icon name="copy" size="sm" />
                    <span>{{ t('affiliate.copyCode') }}</span>
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <p class="input-label mb-0">{{ t('affiliate.inviteLink') }}</p>
                <div class="card-inset flex flex-col items-stretch gap-2 px-3 py-2 sm:flex-row sm:items-center">
                  <code class="min-w-0 break-all text-sm text-gray-700 dark:text-gray-300 sm:flex-1 sm:truncate">{{ inviteLink }}</code>
                  <button class="btn btn-secondary btn-sm w-full sm:w-auto sm:shrink-0" @click="copyInviteLink">
                    <Icon name="copy" size="sm" />
                    <span>{{ t('affiliate.copyLink') }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 说明面板不是语义状态：primary-700 on primary-50 只有 4.23:1，
                 深色下 primary-900/20 还是半透明蓝叠在环境光层上。
                 .card-inset 换成不透明的 --surface-secondary。 -->
            <div class="card-inset mt-5 p-4" data-testid="affiliate-how-it-works">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('affiliate.tips.title') }}</p>
              <ul class="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>1. {{ t('affiliate.tips.line1') }}</li>
                <li>2. {{ t('affiliate.tips.line2', { rate: `${formattedRebateRate}%` }) }}</li>
                <li>3. {{ t('affiliate.tips.line3') }}</li>
                <li v-if="detail.aff_frozen_quota > 0">4. {{ t('affiliate.tips.line4') }}</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('affiliate.transfer.title') }}</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">{{ t('affiliate.transfer.description') }}</p>
              </div>
              <button
                class="btn btn-primary"
                :disabled="transferring || detail.aff_quota <= 0"
                @click="transferQuota"
              >
                <Icon v-if="transferring" name="refresh" size="sm" class="animate-spin" />
                <Icon v-else name="dollar" size="sm" />
                <span>{{ transferring ? t('affiliate.transfer.transferring') : t('affiliate.transfer.button') }}</span>
              </button>
            </div>
            <p v-if="detail.aff_quota <= 0" class="mt-3 text-sm text-amber-600 dark:text-amber-400">
              {{ t('affiliate.transfer.empty') }}
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('affiliate.invitees.title') }}</h3>
            <div v-if="detail.invitees.length === 0" class="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-dark-700 dark:text-dark-400">
              {{ t('affiliate.invitees.empty') }}
            </div>
            <template v-else>
              <!-- 桌面表 / 移动卡片列表二选一，沿用 AvailableChannelsTable 的既有模式。
                   此前是 min-w-[560px] + overflow-x-auto：390px 机上只能横向拖动，
                   邮箱和返佣金额永远不同屏。 -->
              <div class="mt-4 hidden lg:block">
                <table data-testid="desktop-invitees" class="table w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th class="px-3 py-2">{{ t('affiliate.invitees.columns.email') }}</th>
                      <th class="px-3 py-2">{{ t('affiliate.invitees.columns.username') }}</th>
                      <th class="px-3 py-2 text-right">{{ t('affiliate.invitees.columns.rebate') }}</th>
                      <th class="px-3 py-2">{{ t('affiliate.invitees.columns.joinedAt') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in detail.invitees"
                      :key="item.user_id"
                    >
                      <td class="px-3 py-3 text-gray-900 dark:text-white">{{ item.email || '-' }}</td>
                      <td class="px-3 py-3 text-gray-700 dark:text-gray-300">{{ item.username || '-' }}</td>
                      <td class="px-3 py-3 text-right font-medium tabular text-emerald-600 dark:text-emerald-400">{{ formatCurrency(item.total_rebate) }}</td>
                      <td class="px-3 py-3 tabular text-gray-700 dark:text-gray-300">{{ formatDateTime(item.created_at) || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div data-testid="mobile-invitees" class="mt-4 min-w-0 space-y-2 lg:hidden">
                <div
                  v-for="item in detail.invitees"
                  :key="`mobile-${item.user_id}`"
                  class="card-inset p-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <p class="min-w-0 break-all text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.email || '-' }}
                    </p>
                    <p class="shrink-0 text-sm font-medium tabular text-emerald-600 dark:text-emerald-400">
                      {{ formatCurrency(item.total_rebate) }}
                    </p>
                  </div>
                  <dl class="mt-2 space-y-1 text-xs">
                    <div class="flex items-baseline justify-between gap-3">
                      <dt class="shrink-0 text-gray-500 dark:text-gray-400">{{ t('affiliate.invitees.columns.username') }}</dt>
                      <dd class="min-w-0 break-all text-right text-gray-700 dark:text-gray-300">{{ item.username || '-' }}</dd>
                    </div>
                    <div class="flex items-baseline justify-between gap-3">
                      <dt class="shrink-0 text-gray-500 dark:text-gray-400">{{ t('affiliate.invitees.columns.joinedAt') }}</dt>
                      <dd class="min-w-0 text-right tabular text-gray-700 dark:text-gray-300">{{ formatDateTime(item.created_at) || '-' }}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import userAPI from '@/api/user'
import type { UserAffiliateDetail } from '@/types'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useClipboard } from '@/composables/useClipboard'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { extractApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const { copyToClipboard } = useClipboard()

const loading = ref(true)
const transferring = ref(false)
const detail = ref<UserAffiliateDetail | null>(null)

const inviteLink = computed(() => {
  if (!detail.value) return ''
  if (typeof window === 'undefined') return `/register?aff=${encodeURIComponent(detail.value.aff_code)}`
  return `${window.location.origin}/register?aff=${encodeURIComponent(detail.value.aff_code)}`
})

// Rebate rate is a percentage in the range [0, 100]; backend already clamps it.
// We trim trailing zeros (e.g. 20.00 → "20", 12.50 → "12.5") for a cleaner UI.
const formattedRebateRate = computed(() => {
  const v = detail.value?.effective_rebate_rate_percent ?? 0
  const rounded = Math.round(v * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString()
})

function formatCount(value: number): string {
  return value.toLocaleString()
}

async function loadAffiliateDetail(silent = false): Promise<void> {
  if (!silent) {
    loading.value = true
  }
  try {
    detail.value = await userAPI.getAffiliateDetail()
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('affiliate.loadFailed')))
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

async function copyCode(): Promise<void> {
  if (!detail.value?.aff_code) return
  await copyToClipboard(detail.value.aff_code, t('affiliate.codeCopied'))
}

async function copyInviteLink(): Promise<void> {
  if (!inviteLink.value) return
  await copyToClipboard(inviteLink.value, t('affiliate.linkCopied'))
}

async function transferQuota(): Promise<void> {
  if (!detail.value || detail.value.aff_quota <= 0 || transferring.value) return
  transferring.value = true
  try {
    const resp = await userAPI.transferAffiliateQuota()
    appStore.showSuccess(t('affiliate.transfer.success', { amount: formatCurrency(resp.transferred_quota) }))
    await Promise.all([
      loadAffiliateDetail(true),
      authStore.refreshUser().catch(() => undefined),
    ])
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('affiliate.transferFailed')))
  } finally {
    transferring.value = false
  }
}

onMounted(() => {
  void loadAffiliateDetail()
})
</script>
