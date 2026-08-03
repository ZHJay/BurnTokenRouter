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

.table-scroll-container :deep(thead) {
  background: var(--mat-regular);
  backdrop-filter: blur(var(--mat-blur-regular)) var(--mat-diffuse);
  -webkit-backdrop-filter: blur(var(--mat-blur-regular)) var(--mat-diffuse);
}

.table-scroll-container :deep(tbody) {
  /* 保持默认 table-row-group 显示，不使用 block */
}

.table-scroll-container :deep(th) {
  @apply px-5 py-3 text-left text-xs uppercase;
  font-weight: 590;
  letter-spacing: 0.03em;
  color: var(--label-secondary);
  border: 0;
  box-shadow:
    inset 0 -0.5px 0 var(--glass-edge),
    inset 0 1px 0 var(--glass-specular);
}

.table-scroll-container :deep(td) {
  @apply px-5 py-3.5 text-sm;
  color: var(--label);
  border: 0;
  box-shadow: inset 0 -0.5px 0 var(--separator);
}

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
