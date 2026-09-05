<template>
  <article class="plaza-card">
    <!-- 头部：平台徽标 + 生效倍率（专属倍率划线展示原倍率） -->
    <header class="plaza-card-head">
      <span class="badge" :class="badgeVariant">
        <PlatformIcon :platform="(platform || undefined) as GroupPlatform" size="xs" />
        {{ platformLabel(platform || '') }}
      </span>
      <span class="plaza-rate">
        <span v-if="customRate" class="plaza-rate-orig">{{ formatMultiplier(rateMultiplier) }}x</span>
        <span class="plaza-rate-value" :class="{ 'is-custom': customRate }">
          {{ formatMultiplier(displayRate) }}x
        </span>
      </span>
    </header>

    <h3 class="plaza-card-title">{{ model.name }}</h3>

    <!-- 能力标签：计费模式 / 阶梯定价 / 缓存 -->
    <div v-if="tags.length" class="plaza-card-tags">
      <span v-for="tag in tags" :key="tag" class="plaza-tag">{{ tag }}</span>
    </div>

    <!-- 关键定价：实付价为主，官方参考价次级 -->
    <dl class="plaza-price-list">
      <div v-for="row in priceRows" :key="row.key" class="plaza-price-row">
        <dt class="plaza-price-label">{{ row.label }}</dt>
        <dd class="plaza-price-value">
          <span class="plaza-price-paid mono">{{ row.paid }}</span>
          <span v-if="row.suffix" class="plaza-price-suffix">{{ row.suffix }}</span>
          <span v-if="row.official" class="plaza-price-official mono">{{ row.official }}</span>
        </dd>
      </div>
    </dl>

    <p v-if="unitNote" class="plaza-card-unit">{{ unitNote }}</p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { platformLabel } from '@/utils/platformColors'
import { formatMultiplier } from '@/utils/formatters'
import { platformBadgeVariant } from './platformBadge'
import {
  billingModeOf,
  effectiveRateOf,
  hasCachePricing,
  hasCustomRate,
  isTokenBilling,
  officialPerMillion,
  paidPerMillion,
  paidRequestPrice,
  requestIntervals,
  rowRate,
  tierLabel,
  tokenIntervals,
  type PlazaRateContext
} from './pricing'
import { BILLING_MODE_IMAGE } from '@/constants/channel'
import type { PlazaModel } from '@/api/modelPlaza'
import type { GroupPlatform } from '@/types'

const props = defineProps<{
  model: PlazaModel
  /** 分组平台：决定徽标配色与文案。 */
  platform?: string
  rateMultiplier: number
  userRateMultiplier?: number | null
  imageRateIndependent?: boolean
  imageRateMultiplier?: number | null
}>()

const { t } = useI18n()

/** 倍率上下文集中构造，卡片与表格共用同一套定价函数。 */
const ctx = computed<PlazaRateContext>(() => ({
  rateMultiplier: props.rateMultiplier,
  userRateMultiplier: props.userRateMultiplier ?? null,
  imageRateIndependent: props.imageRateIndependent,
  imageRateMultiplier: props.imageRateMultiplier
}))

const badgeVariant = computed(() => platformBadgeVariant(props.platform || ''))
const tokenBilling = computed(() => isTokenBilling(props.model))
const customRate = computed(() => hasCustomRate(ctx.value))

/** 卡片右上角展示该模型实际生效的倍率（按图独立倍率优先）。 */
const displayRate = computed(() => rowRate(props.model, ctx.value))

const tags = computed(() => {
  const list: string[] = []
  if (!tokenBilling.value) {
    list.push(
      billingModeOf(props.model) === BILLING_MODE_IMAGE
        ? t('modelPlaza.table.perImage')
        : t('modelPlaza.table.perRequest')
    )
  }
  if (tieredIntervals.value.length > 1) list.push(t('modelPlaza.cards.tiered'))
  if (hasCachePricing(props.model)) list.push(t('modelPlaza.cards.cache'))
  if (props.model.time_pricing?.periods.length) {
    list.push(t('modelPlaza.cards.timePricing'))
    if (props.model.time_pricing.weekdays_only) list.push(t('modelPlaza.cards.weekdaysOnly'))
  }
  return list
})

/** 阶梯档位：token 模式取全部区间，按次/按图取配了按次价的区间。 */
const tieredIntervals = computed(() =>
  tokenBilling.value ? tokenIntervals(props.model) : requestIntervals(props.model)
)

interface PriceRow {
  key: string
  label: string
  paid: string
  suffix?: string
  official?: string | null
}

/**
 * 卡片只展示「首档」价格：阶梯定价的完整档位属于比价场景，留给表格视图。
 * 有多档时挂 `阶梯定价` 标签提示用户切到表格看全量。
 */
const priceRows = computed<PriceRow[]>(() => {
  const m = props.model
  const rate = effectiveRateOf(ctx.value)

  if (!tokenBilling.value) {
    const intervals = requestIntervals(m)
    const first = intervals[0]
    const raw = first ? first.per_request_price : m.pricing?.per_request_price
    const suffix =
      billingModeOf(m) === BILLING_MODE_IMAGE
        ? t('modelPlaza.table.perUnitImage')
        : t('modelPlaza.table.perUnitRequest')
    return [
      {
        key: 'unit',
        label: first ? tierLabel(first) : t('modelPlaza.cards.unitPrice'),
        paid: paidRequestPrice(m, raw, ctx.value),
        suffix
      }
    ]
  }

  const first = tokenIntervals(m)[0]
  const inputRaw = first ? first.input_price : m.pricing?.input_price
  const outputRaw = first ? first.output_price : m.pricing?.output_price

  return [
    {
      key: 'input',
      label: t('modelPlaza.table.input'),
      paid: paidPerMillion(inputRaw, rate),
      official: officialIfDifferent(
        paidPerMillion(inputRaw, rate),
        m.official_pricing?.input_price
      )
    },
    {
      key: 'output',
      label: t('modelPlaza.table.output'),
      paid: paidPerMillion(outputRaw, rate),
      official: officialIfDifferent(
        paidPerMillion(outputRaw, rate),
        m.official_pricing?.output_price
      )
    }
  ]
})

/**
 * 官方参考价只在与实付价不同时展示：倍率为 1 时两者相同，
 * 再划一道线纯属噪音（用户会以为有折扣却看到同一个数）。
 */
function officialIfDifferent(paid: string, officialRaw: number | null | undefined): string | null {
  const official = officialPerMillion(officialRaw)
  if (official === '-' || official === paid) return null
  return official
}

/** 单位脚注：token 行是 $/1M token；按次/按图的单位已内联在价格后，不再重复。 */
const unitNote = computed(() => (tokenBilling.value ? t('modelPlaza.table.unitPerMillion') : ''))
</script>

<style scoped>
/* 卡片：发丝线 + hover 上浮 2px（与全站 .card-hover 同语言，iOS 弹簧曲线） */
.plaza-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* 网格轨道内不能因内容撑破：min-width:0 是 grid item 不溢出的前提 */
  min-width: 0;
  padding: 16px;
  background: var(--bg-elevated);
  border-radius: var(--r-md);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card), var(--glass-highlight);
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}

.plaza-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-pop), var(--glass-highlight);
}

.plaza-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.plaza-card-head .badge {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plaza-rate {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
  font-family: "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 12px;
}

.plaza-rate-orig {
  color: var(--text-tertiary);
  text-decoration: line-through;
}

.plaza-rate-value {
  font-weight: 700;
  color: var(--text-secondary);
}

.plaza-rate-value.is-custom {
  color: var(--blue);
}

/* 模型名可能很长（如 claude-3-5-sonnet-20241022），必须能在窄轨道内断行 */
.plaza-card-title {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.plaza-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.plaza-tag {
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--fill);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.plaza-price-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 0.5px solid var(--separator);
}

.plaza-price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.plaza-price-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.plaza-price-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.plaza-price-paid {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
}

.plaza-price-suffix,
.plaza-price-official {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* 官方参考价：划线表示「原价」，与实付价形成对比 */
.plaza-price-official {
  text-decoration: line-through;
}

.plaza-card-unit {
  font-size: 11px;
  color: var(--text-tertiary);
}
</style>
