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
        <div v-if="$slots.pagination" class="table-pagination-container">
          <slot name="pagination" />
        </div>
      </div>
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
  @apply flex flex-col gap-4;
  height: calc(100vh - 77px - 4.5rem); /* 减去桌面 header + lg:pt-6/lg:pb-12 */
}

.layout-section-fixed {
  @apply flex-shrink-0;
}

.layout-section-scrollable {
  @apply flex-1 min-h-0 flex flex-col;
}

/* 表格滚动容器 - 增强版表体滚动方案 */
.table-scroll-container {
  @apply flex flex-col overflow-hidden h-full bg-white dark:bg-dark-900 rounded-3xl border border-black/[0.06] dark:border-white/10 shadow-card;
  transition:
    border-color 240ms cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 240ms cubic-bezier(0.32, 0.72, 0, 1);
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
  @apply bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl;
}

.table-scroll-container :deep(tbody) {
  /* 保持默认 table-row-group 显示，不使用 block */
}

.table-scroll-container :deep(th) {
  @apply px-5 py-3.5 text-left text-xs font-semibold tracking-wide text-gray-500 dark:text-dark-300 border-b border-black/[0.07] dark:border-white/10;
}

.table-scroll-container :deep(td) {
  @apply px-5 py-3.5 text-sm text-gray-700 dark:text-gray-300 border-b border-black/[0.05] dark:border-white/[0.07];
}

.table-pagination-container {
  @apply flex-shrink-0 border-t border-black/[0.06] dark:border-white/10;
}

.table-pagination-container :deep(> div) {
  @apply border-t-0 bg-transparent dark:bg-transparent;
}

/* 移动端：恢复正常滚动 */
.table-page-layout.mobile-mode .table-scroll-container {
  @apply h-auto overflow-visible border-none shadow-none bg-transparent;
}

.table-page-layout.mobile-mode .layout-section-scrollable {
  @apply flex-none min-h-fit;
}

.table-page-layout.mobile-mode .table-scroll-container :deep(table) {
  @apply flex-none;
  display: table;
  min-width: 100%;
}

.table-page-layout.mobile-mode .table-pagination-container {
  @apply mt-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card dark:border-white/10 dark:bg-dark-900;
}
</style>
