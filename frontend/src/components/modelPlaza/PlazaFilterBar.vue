<template>
  <div class="space-y-3">
    <!-- 工具条:模型名搜索 + 视图切换(对标 demo 的 .toolbar) -->
    <div class="toolbar plaza-toolbar">
      <div class="search plaza-search">
        <Icon name="search" size="sm" />
        <input
          :value="search"
          type="text"
          :placeholder="t('modelPlaza.filters.searchPlaceholder')"
          :aria-label="t('modelPlaza.filters.searchPlaceholder')"
          @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="search"
          type="button"
          class="plaza-search-clear"
          :aria-label="t('modelPlaza.filters.clearSearch')"
          @click="$emit('update:search', '')"
        >
          <Icon name="x" size="xs" class="h-3.5 w-3.5" />
        </button>
      </div>
      <PlazaViewToggle
        :model-value="view"
        @update:model-value="$emit('update:view', $event)"
      />
    </div>

    <!-- 一级:平台 -->
    <div class="plaza-filter-row">
      <span class="plaza-filter-label">
        {{ t('modelPlaza.filters.platformLabel') }}
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="p in ['all', ...platforms]"
          :key="`platform-${p}`"
          type="button"
          class="inline-flex items-center gap-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
          :class="p === 'all' ? chipClass(platform === 'all') : platform === p ? 'chip-tinted-active' : 'chip-tinted'"
          :style="p === 'all' ? undefined : { '--chip-accent': platformAccentColor(p) }"
          :disabled="p !== 'all' && !platformEnabled(p)"
          @click="$emit('update:platform', p)"
        >
          <PlatformIcon v-if="p !== 'all'" :platform="p as GroupPlatform" size="xs" />
          {{ p === 'all' ? t('modelPlaza.filters.all') : p }}
        </button>
      </div>
    </div>

    <!-- 二级:分组(按所属平台着色,当前组合下无结果的置灰) -->
    <div class="plaza-filter-row">
      <span class="plaza-filter-label">
        {{ t('modelPlaza.filters.groupLabel') }}
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="text-sm font-medium transition"
          :class="chipClass(groupId === 'all')"
          @click="$emit('update:groupId', 'all')"
        >
          {{ t('modelPlaza.filters.all') }}
        </button>
        <button
          v-for="g in groups"
          :key="`group-${g.id}`"
          type="button"
          class="text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
          :class="groupId === g.id ? 'chip-tinted-active' : 'chip-tinted'"
          :style="{ '--chip-accent': platformAccentColor(g.platform) }"
          :disabled="!groupEnabled(g)"
          @click="$emit('update:groupId', g.id)"
        >
          {{ g.name }}
        </button>
      </div>
    </div>

    <!-- 三级:倍率(当前组合下不存在的置灰) -->
    <div class="plaza-filter-row">
      <span class="plaza-filter-label">
        {{ t('modelPlaza.filters.rateLabel') }}
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="text-sm font-medium transition"
          :class="chipClass(rate === 'all')"
          @click="$emit('update:rate', 'all')"
        >
          {{ t('modelPlaza.filters.all') }}
        </button>
        <button
          v-for="r in rates"
          :key="`rate-${r}`"
          type="button"
          class="font-mono text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
          :class="chipClass(rate === r)"
          :disabled="!rateEnabled(r)"
          @click="$emit('update:rate', r)"
        >
          {{ r }}x
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import PlazaViewToggle from './PlazaViewToggle.vue'
import type { PlazaViewMode } from './viewMode'
import { platformAccentColor } from '@/utils/platformColors'
import type { GroupPlatform } from '@/types'

const props = defineProps<{
  /** 数据中出现的平台(去重排序后)。 */
  platforms: string[]
  /** 全量分组(含平台与生效倍率),三个维度的置灰联动由此推导。 */
  groups: Array<{ id: number; name: string; platform: string; rate: number }>
  /** 全量生效倍率去重升序。 */
  rates: number[]
  platform: string
  groupId: number | 'all'
  rate: number | 'all'
  /** 模型名搜索词(纯前端过滤)。 */
  search: string
  /** 当前呈现形态:卡片网格 / 密集表格。 */
  view: PlazaViewMode
}>()

defineEmits<{
  'update:platform': [value: string]
  'update:groupId': [value: number | 'all']
  'update:rate': [value: number | 'all']
  'update:search': [value: string]
  'update:view': [value: PlazaViewMode]
}>()

const { t } = useI18n()

/**
 * 三个维度互为约束(faceted):某选项可点 ⟺ 在「其他两维」当前选择下仍有分组命中。
 * 「全部」永远可点,作为解除本维约束的出口;可点项组合恒有结果,无需选择修正。
 */
function platformEnabled(p: string): boolean {
  return props.groups.some(
    (g) =>
      g.platform === p &&
      (props.groupId === 'all' || g.id === props.groupId) &&
      (props.rate === 'all' || g.rate === props.rate)
  )
}

function groupEnabled(g: { platform: string; rate: number }): boolean {
  return (
    (props.platform === 'all' || g.platform === props.platform) &&
    (props.rate === 'all' || g.rate === props.rate)
  )
}

function rateEnabled(r: number): boolean {
  return props.groups.some(
    (g) =>
      g.rate === r &&
      (props.platform === 'all' || g.platform === props.platform) &&
      (props.groupId === 'all' || g.id === props.groupId)
  )
}

function chipClass(active: boolean): string {
  return active
    ? 'filter-chip on'
    : 'filter-chip'
}
</script>

<style scoped>
/*
 * 筛选行的标签列。
 *
 * 原实现是 `w-10 shrink-0`(40px)固定列:中文「平台」放得下,英文
 * "PLATFORM" 需要约 73px —— 文字溢出 40px 盒子后,紧随其后的 chip 容器
 * (自带背景的药丸)直接盖在上面,375/768px 下实测出现「PLATFO」被截断
 * 且被蓝色 All 药丸压住。标签宽度不能由某一种语言的字长决定。
 *
 * 改法:窄视口标签独占一行(iOS 设置分组风格),sm 起才与 chip 同排,
 * 并给足 min-width 让三行标签仍然对齐。颜色改为消费 --text-tertiary,
 * 不再硬编码 gray/dark 阶。
 */
.plaza-filter-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.plaza-filter-label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  white-space: nowrap;
}

@media (min-width: 640px) {
  .plaza-filter-row {
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
  }

  .plaza-filter-label {
    min-width: 76px;
    padding-top: 9px;
  }
}

/* 工具条:.toolbar 自带 margin-bottom,这里由外层 space-y-3 统一管间距 */
.plaza-toolbar {
  margin-bottom: 0;
}

/*
 * 搜索框可增长但保底 240px(全站 .search 的 min-width)。
 * 375px 视口装不下「搜索 + 分段控件」时由 .toolbar 的 flex-wrap 换行承接,
 * 不让任何一方被压成溢出源。
 */
.plaza-search {
  flex: 1 1 240px;
}

.plaza-search-clear {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease), transform 0.18s var(--ease);
}

.plaza-search-clear:hover {
  background: var(--fill-hover);
  color: var(--text-primary);
}

.plaza-search-clear:active {
  transform: scale(0.97);
}

/* 平台/分组 chip 统一为药丸形(尺寸与全站 .filter-chip 一致) */
.chip-tinted,
.chip-tinted-active {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--r-pill);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* 平台/分组 chip 的配色统一从 --chip-accent(平台主色)派生,新增平台无需扩展样式。
   激活态与非激活态在模板上互斥挂载,避免选择器优先级互相覆盖。 */
.chip-tinted {
  color: var(--chip-accent);
  color: color-mix(in srgb, var(--chip-accent) 78%, black);
  background-color: color-mix(in srgb, var(--chip-accent) 9%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-accent) 25%, transparent);
}

.chip-tinted:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--chip-accent) 16%, transparent);
}

.dark .chip-tinted {
  color: color-mix(in srgb, var(--chip-accent) 72%, white);
  background-color: color-mix(in srgb, var(--chip-accent) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-accent) 30%, transparent);
}

.dark .chip-tinted:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--chip-accent) 18%, transparent);
}

.chip-tinted-active {
  color: #fff;
  background-color: var(--chip-accent);
  background-color: color-mix(in srgb, var(--chip-accent) 85%, black);
  box-shadow: 0 1px 2px 0 color-mix(in srgb, var(--chip-accent) 35%, transparent);
}

.chip-tinted-active:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--chip-accent) 75%, black);
}

.dark .chip-tinted-active {
  background-color: color-mix(in srgb, var(--chip-accent) 80%, transparent);
}

.dark .chip-tinted-active:not(:disabled):hover {
  background-color: var(--chip-accent);
}
</style>
