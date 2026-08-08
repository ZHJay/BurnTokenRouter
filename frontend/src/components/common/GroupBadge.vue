<template>
  <span
    :class="[
      'badge',
      badgeClass
    ]"
  >
    <!-- Platform logo -->
    <PlatformIcon v-if="platform" :platform="platform" size="sm" />
    <!-- Group name -->
    <span class="truncate">{{ name }}</span>
    <!-- Right side label -->
    <span v-if="showLabel" :class="labelClass">
      <template v-if="hasCustomRate">
        <!-- 原倍率删除线 + 专属倍率高亮 -->
        <span class="line-through opacity-50 mr-0.5">{{ rateMultiplier }}x</span>
        <span class="font-bold">{{ userRateMultiplier }}x</span>
      </template>
      <template v-else>
        {{ labelText }}
      </template>
    </span>
    <span v-if="hasPeakRate" :class="peakRateClass" :title="peakRateTitle">
      {{ peakRateText }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubscriptionType, GroupPlatform } from '@/types'
import { useAppStore } from '@/stores/app'
import { formatPeakRateWindow, serverTimezoneLabel } from '@/utils/peak-rate'
import PlatformIcon from './PlatformIcon.vue'

interface Props {
  name: string
  platform?: GroupPlatform
  subscriptionType?: SubscriptionType
  rateMultiplier?: number
  userRateMultiplier?: number | null // 用户专属倍率
  peakRateEnabled?: boolean
  peakStart?: string
  peakEnd?: string
  peakRateMultiplier?: number
  showRate?: boolean
  daysRemaining?: number | null // 剩余天数（订阅类型时使用）
  /**
   * 订阅分组默认在右侧 label 展示"订阅"或剩余天数；
   * 开启后订阅分组也改为显示倍率（保留订阅主题色 label，配合可用渠道这类
   * 只关心费率、不关心有效期的场景）。
   */
  alwaysShowRate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subscriptionType: 'standard',
  showRate: true,
  daysRemaining: null,
  userRateMultiplier: null,
  peakRateEnabled: false,
  alwaysShowRate: false
})

const { t } = useI18n()

const isSubscription = computed(() => props.subscriptionType === 'subscription')

// 是否有专属倍率（且与默认倍率不同）
const hasCustomRate = computed(() => {
  return (
    props.userRateMultiplier !== null &&
    props.userRateMultiplier !== undefined &&
    props.rateMultiplier !== undefined &&
    props.userRateMultiplier !== props.rateMultiplier
  )
})

const appStore = useAppStore()

const hasPeakRate = computed(() => {
  return Boolean(props.showRate && props.peakRateEnabled && props.peakStart && props.peakEnd)
})

const peakRateText = computed(() => {
  return formatPeakRateWindow(
    {
      peak_rate_enabled: props.peakRateEnabled,
      peak_start: props.peakStart,
      peak_end: props.peakEnd,
      peak_rate_multiplier: props.peakRateMultiplier
    },
    serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset)
  )
})

const peakRateTitle = computed(() => {
  return t('common.peakRateTooltip', { window: peakRateText.value })
})

// 是否显示右侧标签
const showLabel = computed(() => {
  if (!props.showRate) return false
  // 订阅类型：显示天数或"订阅"
  if (isSubscription.value) return true
  // 标准类型：显示倍率（包括专属倍率）
  return props.rateMultiplier !== undefined || hasCustomRate.value
})

// Label text
const labelText = computed(() => {
  const rateLabel = props.rateMultiplier !== undefined ? `${props.rateMultiplier}x` : ''
  if (isSubscription.value && !props.alwaysShowRate) {
    // 如果有剩余天数，显示天数
    if (props.daysRemaining !== null && props.daysRemaining !== undefined) {
      if (props.daysRemaining <= 0) {
        return t('admin.users.expired')
      }
      return t('admin.users.daysRemaining', { days: props.daysRemaining })
    }
    // 否则显示"订阅"
    return t('groups.subscription')
  }
  return rateLabel
})

// Label style based on type and days remaining
const labelClass = computed(() => {
  if (!isSubscription.value) {
    // 标准类型：中性 gpill
    return 'gpill'
  }

  // 订阅类型：根据剩余天数显示不同颜色
  if (props.daysRemaining !== null && props.daysRemaining !== undefined) {
    if (props.daysRemaining <= 0 || props.daysRemaining <= 3) {
      // 已过期或紧急（<=3天）：b-red
      return 'b-red'
    }
    if (props.daysRemaining <= 7) {
      // 警告（<=7天）：b-orange
      return 'b-orange'
    }
  }

  // 正常状态或无天数：与主徽章同平台色
  return badgeClass.value
})

const peakRateClass = computed(() => {
  return 'b-orange'
})

// Badge color based on platform and subscription type
const badgeClass = computed(() => {
  if (props.platform === 'anthropic') {
    return 'b-claude'
  } else if (props.platform === 'openai') {
    return 'b-openai'
  }
  if (props.platform === 'gemini') {
    return 'b-gemini'
  }
  if (props.platform === 'antigravity') {
    return 'b-purple'
  }
  if (props.platform === 'grok') {
    return 'b-grok'
  }
  if (props.platform === 'kimi') {
    return isSubscription.value
      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
      : 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400'
  }
  if (props.platform === 'zhipu') {
    return isSubscription.value
      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
  }
  if (props.platform === 'deepseek') {
    return isSubscription.value
      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
      : 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400'
  }
  if (props.platform === 'composite') {
    return 'b-teal'
  }
  // Fallback
  return 'b-blue'
})
</script>

<style scoped>
/* 契约镜像：apple-theme.css 的 .badge / .b-* / .gpill 体系（B1 全局类落地前的本地回退） */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.b-openai {
  background: rgba(16, 163, 127, 0.12);
  color: #0f9d78;
}

.b-claude {
  background: rgba(217, 119, 87, 0.14);
  color: #c2612f;
}

.b-gemini {
  background: rgba(66, 133, 244, 0.14);
  color: #3b76e0;
}

.b-grok {
  background: rgba(120, 120, 128, 0.16);
  color: var(--text-secondary);
}

.b-blue {
  background: var(--blue-soft);
  color: var(--blue);
}

.b-green {
  background: rgba(52, 199, 89, 0.14);
  color: #28a745;
}

.b-orange {
  background: rgba(255, 159, 10, 0.14);
  color: #d9820a;
}

.b-red {
  background: rgba(255, 59, 48, 0.12);
  color: var(--red);
}

.b-purple {
  background: rgba(175, 82, 222, 0.14);
  color: var(--purple);
}

.b-teal {
  background: rgba(48, 176, 199, 0.14);
  color: var(--teal);
}

/* 暗色模式调整（与 apple-theme.css 一致） */
:global(html.dark) .b-claude {
  color: #e0955f;
}

:global(html.dark) .b-green {
  color: var(--green);
}

:global(html.dark) .b-orange {
  color: var(--orange);
}

.gpill {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--fill);
  color: var(--text-secondary);
}
</style>
