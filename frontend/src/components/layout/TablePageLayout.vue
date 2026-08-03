<template>
  <div class="table-page-layout" :class="{ 'mobile-mode': isMobile }">
    <!-- 固定区域：操作按钮 -->
    <div v-if="$slots.actions" class="layout-section-fixed">
      <slot name="actions" />
    </div>

    <!-- 固定区域：搜索和过滤器 -->
    <div v-if="$slots.filters" class="layout-section-fixed">
      <slot name="filters" />
    </div>

    <!-- 滚动区域：表格 -->
    <div class="layout-section-scrollable">
      <div class="card table-scroll-container">
        <slot name="table" />
      </div>
    </div>

    <!-- 固定区域：分页器 -->
    <div v-if="$slots.pagination" class="layout-section-fixed">
      <slot name="pagination" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
/* 桌面端：Flexbox 布局 */
.table-page-layout {
  @apply flex flex-col gap-6;
  /* Matches what AppLayout reserves at the lg breakpoint: pt-[5rem] + pb-8.
     Below lg the .mobile-mode branch releases the fixed height entirely, since
     AppLayout's padding differs there (88px base / 104px at md) and a fixed
     height with no overflow rule would clip long tables. */
  height: calc(100vh - 5rem - 2rem);
}

.layout-section-fixed {
  @apply flex-shrink-0;
}

.layout-section-scrollable {
  @apply flex-1 min-h-0 flex flex-col;
}

/* 表格滚动容器 - 增强版表体滚动方案 */
.table-scroll-container {
  /* Cannot `@apply card` here: Vite hands each SFC <style> block to PostCSS as
     its own entry, so Tailwind never sees style.css's @layer components and the
     build fails. Inline the .card properties instead — and they must stay in
     lockstep with `.card`, since this shell IS a card. The radius was 12px while
     `.card` uses rounded-xl (16px), which made every table page read differently
     from the dashboards. */
  @apply flex h-full flex-col overflow-hidden;
  background-color: var(--surface);
  border-radius: 16px;
  box-shadow:
    inset 0 0 0 0.5px var(--hairline),
    var(--shadow-2);
}

.table-scroll-container :deep(.table-wrapper) {
  @apply flex-1 overflow-x-auto overflow-y-auto;
  /* 确保横向滚动条显示在最底部 */
  scrollbar-gutter: stable;
}

.table-scroll-container :deep(table) {
  @apply w-full;
  min-width: max-content; /* 关键：确保表格宽度根据内容撑开，从而触发横向滚动 */
  display: table; /* 使用标准 table 布局以支持 sticky 列 */
}

/* thead 的材质已删除。实测：这个 thead 跑着 blur(34px) 而 background 是
   rgba(0,0,0,0)，其上每一个 th 都是不透明 --surface —— 21 个 th 里 0 个透明。
   也就是一个完全透明元素上的 34px 模糊，被自己的子元素整块遮住，永远不可见。
   它同时不在两个无障碍选择器清单里，只靠 --mat-blur-* 的变量钉死才没出事。
   表头材质归 DataTable 的 .sticky-header-cell 所有（不透明 + iOS 27 边缘处理）。 */

.table-scroll-container :deep(tbody) {
  /* 保持默认 table-row-group 显示，不使用 block */
}

/* :deep(th) / :deep(td) 已删除 —— 单元格度量此前有三个所有者：这里
   （20px/14px）、style.css 的 .table td（16px/12px）、以及 DataTable 自己的
   py-4。本文件被 17 个视图引入，所以这里的值实际上赢下几乎所有表格，
   .table td 形同虚设。现在单元格度量只归 DataTable / .table 所有。
   为保持现有观感不变，DataTable 的 .sticky-header-cell 与 .table-body td
   已承载等效的 padding 与发丝线阴影。 */

/* 移动端：恢复正常滚动 */
.table-page-layout.mobile-mode .table-scroll-container {
  @apply h-auto overflow-visible border-none bg-transparent shadow-none;
  box-shadow: none;
}

.table-page-layout.mobile-mode .layout-section-scrollable {
  @apply flex-none min-h-fit;
}

/* Below lg the children go flex-none, so a fixed parent height with no overflow
   rule would clip long tables. Release it and let the page scroll. */
.table-page-layout.mobile-mode {
  height: auto;
}

.table-page-layout.mobile-mode .table-scroll-container :deep(table) {
  @apply flex-none;
  display: table;
  min-width: 100%;
}
</style>
