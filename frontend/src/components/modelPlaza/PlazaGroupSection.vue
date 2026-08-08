<template>
  <section
    class="plaza-group"
    :class="[platformBorderStrongClass(group.platform)]"
  >
    <!-- 分组头部:名称/平台/倍率徽章/专属/订阅徽章 + 描述 -->
    <header class="plaza-group-head">
      <div class="flex flex-wrap items-center gap-2">
        <GroupBadge
          :name="group.name"
          :platform="group.platform as GroupPlatform"
          :subscription-type="(group.subscription_type || 'standard') as SubscriptionType"
          :rate-multiplier="group.rate_multiplier"
          :user-rate-multiplier="group.user_rate_multiplier ?? null"
          :peak-rate-enabled="group.peak_rate_enabled"
          :peak-start="group.peak_start"
          :peak-end="group.peak_end"
          :peak-rate-multiplier="group.peak_rate_multiplier"
          always-show-rate
        />
        <span
          v-if="group.is_exclusive"
          class="badge b-purple"
        >
          <Icon name="shield" size="xs" class="h-3 w-3" />
          {{ t('modelPlaza.badges.exclusive') }}
        </span>
        <span
          v-if="group.subscription_type === 'subscription'"
          class="badge b-blue"
        >
          {{ t('modelPlaza.badges.subscription') }}
        </span>
      </div>
      <p v-if="group.description" class="mt-2 text-sm text-gray-500 dark:text-dark-400">
        {{ group.description }}
      </p>
      <p
        v-if="peakNote"
        class="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
      >
        <Icon name="clock" size="xs" class="h-3 w-3" />
        {{ peakNote }}
      </p>
    </header>

    <!--
      两种呈现共用同一份 group.models 与同一套定价函数(./pricing):
      - cards:Apple 产品网格式模型卡(默认)
      - table:密集定价表,跨模型比价时信息密度更高
      表格整行(含 hover 底色/分区底色)顶到卡片边缘,左右留白由表格首列/末列的 padding 提供。
    -->
    <div>
      <template v-if="group.models.length > 0">
        <PlazaModelCardGrid
          v-if="view === 'cards'"
          :models="group.models"
          :platform="group.platform"
          :rate-multiplier="group.rate_multiplier"
          :user-rate-multiplier="group.user_rate_multiplier ?? null"
          :image-rate-independent="group.image_rate_independent"
          :image-rate-multiplier="group.image_rate_multiplier"
        />
        <PlazaModelPricingTable
          v-else
          :models="group.models"
          :platform="group.platform"
          :rate-multiplier="group.rate_multiplier"
          :user-rate-multiplier="group.user_rate_multiplier ?? null"
          :image-rate-independent="group.image_rate_independent"
          :image-rate-multiplier="group.image_rate_multiplier"
        />
      </template>
      <p v-else class="plaza-group-empty">
        {{ t('modelPlaza.detail.noModels') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import GroupBadge from '@/components/common/GroupBadge.vue'
import PlazaModelPricingTable from './PlazaModelPricingTable.vue'
import PlazaModelCardGrid from './PlazaModelCardGrid.vue'
import type { PlazaViewMode } from './viewMode'
import type { ModelPlazaGroup } from '@/api/modelPlaza'
import type { GroupPlatform, SubscriptionType } from '@/types'
import { platformBorderStrongClass } from '@/utils/platformColors'
import { hasPeakRate, formatPeakRateWindow, serverTimezoneLabel } from '@/utils/peak-rate'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  group: ModelPlazaGroup
  /** 呈现形态:卡片网格 / 密集表格。 */
  view: PlazaViewMode
}>()

const { t } = useI18n()
const appStore = useAppStore()

const peakNote = computed(() => {
  if (!hasPeakRate(props.group)) return ''
  const window = formatPeakRateWindow(
    props.group,
    serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset)
  )
  return t('modelPlaza.detail.peakNote', {
    window,
    multiplier: props.group.peak_rate_multiplier
  })
})
</script>

<style scoped>
/*
 * 分组卡:发丝线容器。
 * 刻意不做容器级 hover 上浮——卡片视图里每张模型卡自己会上浮 2px,
 * 容器同时上浮会变成双重位移(悬停一张卡,整组跟着动)。
 */
.plaza-group {
  background: var(--bg-elevated);
  border-radius: var(--r-lg);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card), var(--glass-highlight);
  overflow: hidden;
}

.plaza-group-head {
  padding: 16px 20px;
  border-bottom: 0.5px solid var(--separator);
}

.plaza-group-empty {
  padding: 16px 20px;
  text-align: center;
  font-size: 14px;
  color: var(--text-tertiary);
}
</style>
