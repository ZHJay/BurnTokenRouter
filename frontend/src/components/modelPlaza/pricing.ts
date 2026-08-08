/**
 * Model Plaza 定价计算与展示排序的单一事实来源。
 *
 * 卡片视图与表格视图必须显示同一个价格。这些函数原先内联在
 * PlazaModelPricingTable.vue 里，卡片化时提取为纯函数，避免两处各写一遍
 * 金额运算导致价格漂移（同一模型在两个视图显示不同实付价是最坏的缺陷）。
 * 行为与提取前逐字等价，由 PlazaModelPricingTable.spec.ts 的 13 个用例锁定。
 */

import { formatScaled } from '@/utils/pricing'
import { BILLING_MODE_TOKEN, BILLING_MODE_IMAGE, type BillingMode } from '@/constants/channel'
import type { PlazaModel } from '@/api/modelPlaza'
import type { UserPricingInterval } from '@/api/channels'

export const PER_MILLION = 1_000_000

/** 价格统一保底 2 位小数，更长的有效小数原样保留。 */
export const MIN_DECIMALS = 2

/** 分组倍率上下文：按次/按图行的生效倍率可能取生图独立倍率。 */
export interface PlazaRateContext {
  /** 分组默认倍率。 */
  rateMultiplier: number
  /** 用户专属倍率；与默认不同时实付价按此计算。 */
  userRateMultiplier?: number | null
  /** 生图独立倍率开关：true 时图片计费模型不吃分组/专属倍率。 */
  imageRateIndependent?: boolean
  imageRateMultiplier?: number | null
}

export function billingModeOf(m: PlazaModel): BillingMode {
  return (m.pricing?.billing_mode || BILLING_MODE_TOKEN) as BillingMode
}

export function isTokenBilling(m: PlazaModel): boolean {
  return billingModeOf(m) === BILLING_MODE_TOKEN
}

/** 生效倍率 = 用户专属倍率 ?? 分组默认倍率。 */
export function effectiveRateOf(ctx: PlazaRateContext): number {
  return ctx.userRateMultiplier ?? ctx.rateMultiplier
}

/** 是否存在与分组默认值不同的专属倍率（决定要不要划线展示原倍率）。 */
export function hasCustomRate(ctx: PlazaRateContext): boolean {
  return ctx.userRateMultiplier != null && ctx.userRateMultiplier !== ctx.rateMultiplier
}

/** 图片计费模型且分组开启生图独立倍率：实付倍率取独立倍率，与计费口径一致。 */
export function usesIndependentImageRate(m: PlazaModel, ctx: PlazaRateContext): boolean {
  return billingModeOf(m) === BILLING_MODE_IMAGE && ctx.imageRateIndependent === true
}

/** 该行的生效倍率（按次/按图片行可能走独立倍率）。 */
export function rowRate(m: PlazaModel, ctx: PlazaRateContext): number {
  return usesIndependentImageRate(m, ctx)
    ? (ctx.imageRateMultiplier ?? 1)
    : effectiveRateOf(ctx)
}

/** 实付价 = 渠道单价 × 生效倍率，按 $/1M token 展示。 */
export function paidPerMillion(value: number | null | undefined, rate: number): string {
  if (value == null) return '-'
  return formatScaled(value * rate, PER_MILLION, MIN_DECIMALS)
}

/** 按次 / 按图片单价（乘该行生效倍率，不换算 1M）。 */
export function paidRequestPrice(
  m: PlazaModel,
  value: number | null | undefined,
  ctx: PlazaRateContext
): string {
  if (value == null) return '-'
  return formatScaled(value * rowRate(m, ctx), 1, MIN_DECIMALS)
}

/** 官方参考价不乘倍率。 */
export function officialPerMillion(value: number | null | undefined): string {
  if (value == null) return '-'
  return formatScaled(value, PER_MILLION, MIN_DECIMALS)
}

export function hasCachePricing(m: PlazaModel): boolean {
  return m.pricing?.cache_write_price != null || m.pricing?.cache_read_price != null
}

export function hasOfficialCache(o: NonNullable<PlazaModel['official_pricing']>): boolean {
  return o.cache_write_price != null || o.cache_read_price != null || o.cache_write_1h_price != null
}

/** token 模式的阶梯定价（表格内联进输入/输出列）。 */
export function tokenIntervals(m: PlazaModel): UserPricingInterval[] {
  return m.pricing?.intervals ?? []
}

/** 按次/按图模式的阶梯定价（仅保留配了按次价的档位）。 */
export function requestIntervals(m: PlazaModel): UserPricingInterval[] {
  return (m.pricing?.intervals ?? []).filter((iv) => iv.per_request_price != null)
}

/** 档位标签：优先管理员配置的 tier_label，否则按 token 区间生成（≤200K / >200K / 200K–1M）。 */
export function tierLabel(iv: UserPricingInterval): string {
  if (iv.tier_label) return iv.tier_label
  const { min_tokens: min, max_tokens: max } = iv
  if (max == null) return `>${formatTokenCount(min)}`
  if (min === 0) return `≤${formatTokenCount(max)}`
  return `${formatTokenCount(min)}–${formatTokenCount(max)}`
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${trimZero(n / 1_000_000)}M`
  if (n >= 1_000) return `${trimZero(n / 1_000)}K`
  return String(n)
}

function trimZero(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/**
 * 展示顺序（卡片网格与表格共用，两个视图顺序必须一致）：
 * 1. token 计费的排在前，按图/按次计费的沉到末尾——它们的官方 token 价与实付的按张/按次价不同量纲，混排无意义；
 * 2. 组内按官方输出价从高到低，无官方价的排最后；
 * 3. 同价按名称降序（新版本号在前，如 gpt-5.6 先于 gpt-5.5）。
 */
export function sortPlazaModels(models: PlazaModel[]): PlazaModel[] {
  return [...models].sort((a, b) => {
    const ta = isTokenBilling(a)
    const tb = isTokenBilling(b)
    if (ta !== tb) return ta ? -1 : 1
    const pa = a.official_pricing?.output_price ?? null
    const pb = b.official_pricing?.output_price ?? null
    if (pa != null && pb != null && pa !== pb) return pb - pa
    if (pa != null && pb == null) return -1
    if (pa == null && pb != null) return 1
    return b.name.localeCompare(a.name)
  })
}
