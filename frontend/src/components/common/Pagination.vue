<template>
  <div
    class="pagination"
  >
    <div class="pagination-mobile sm:hidden">
      <!-- Mobile pagination -->
      <button
        @click="goToPage(page - 1)"
        :disabled="page === 1"
        class="mobile-btn"
      >
        {{ t('pagination.previous') }}
      </button>
      <span class="pagination-info">
        {{ t('pagination.pageOf', { page, total: totalPages }) }}
      </span>
      <button
        @click="goToPage(page + 1)"
        :disabled="page === totalPages"
        class="mobile-btn"
      >
        {{ t('pagination.next') }}
      </button>
    </div>

    <div class="pagination-desktop hidden sm:flex">
      <!-- Desktop pagination info -->
      <div class="pagination-left">
        <p class="pagination-info">
          {{ t('pagination.showing') }}
          <span class="font-medium">{{ fromItem }}</span>
          {{ t('pagination.to') }}
          <span class="font-medium">{{ toItem }}</span>
          {{ t('pagination.of') }}
          <span class="font-medium">{{ total }}</span>
          {{ t('pagination.results') }}
        </p>

        <!-- Page size selector -->
        <div v-if="showPageSizeSelector" class="page-size-group">
          <span class="pagination-info">{{ t('pagination.perPage') }}:</span>
          <div class="page-size-select w-20">
            <Select
              :model-value="pageSize"
              :options="pageSizeSelectOptions"
              @update:model-value="handlePageSizeChange"
            />
          </div>
        </div>

        <div v-if="showJump" class="jump-group">
          <span class="pagination-info">{{ t('pagination.jumpTo') }}</span>
          <input
            v-model="jumpPage"
            type="number"
            min="1"
            :max="totalPages"
            class="jump-input w-20"
            :placeholder="t('pagination.jumpPlaceholder')"
            @keyup.enter="submitJump"
          />
          <button type="button" class="pager-btn jump-go" @click="submitJump">
            {{ t('pagination.jumpAction') }}
          </button>
        </div>
      </div>

      <!-- Desktop pagination buttons -->
      <nav class="pager" aria-label="Pagination">
        <!-- Previous button -->
        <button
          @click="goToPage(page - 1)"
          :disabled="page === 1"
          class="pager-btn"
          :aria-label="t('pagination.previous')"
        >
          <Icon name="chevronLeft" size="md" />
        </button>

        <!-- Page numbers -->
        <button
          v-for="(pageNum, index) in visiblePages"
          :key="`${pageNum}-${index}`"
          @click="typeof pageNum === 'number' && goToPage(pageNum)"
          :disabled="typeof pageNum !== 'number'"
          :class="[
            'pager-btn',
            pageNum === page && 'active',
            typeof pageNum !== 'number' && 'is-ellipsis'
          ]"
          :aria-label="
            typeof pageNum === 'number' ? t('pagination.goToPage', { page: pageNum }) : undefined
          "
          :aria-current="pageNum === page ? 'page' : undefined"
        >
          {{ pageNum }}
        </button>

        <!-- Next button -->
        <button
          @click="goToPage(page + 1)"
          :disabled="page === totalPages"
          class="pager-btn"
          :aria-label="t('pagination.next')"
        >
          <Icon name="chevronRight" size="md" />
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import Select from './Select.vue'
import { getConfiguredTablePageSizeOptions, normalizeTablePageSize } from '@/utils/tablePreferences'
import { setPersistedPageSize } from '@/composables/usePersistedPageSize'

const { t } = useI18n()

interface Props {
  total: number
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  showPageSizeSelector?: boolean
  showJump?: boolean
}

interface Emits {
  (e: 'update:page', page: number): void
  (e: 'update:pageSize', pageSize: number): void
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => getConfiguredTablePageSizeOptions(),
  showPageSizeSelector: true,
  showJump: false
})

const emit = defineEmits<Emits>()

const totalPages = computed(() => Math.ceil(props.total / props.pageSize))

const fromItem = computed(() => {
  if (props.total === 0) return 0
  return (props.page - 1) * props.pageSize + 1
})

const toItem = computed(() => {
  const to = props.page * props.pageSize
  return to > props.total ? props.total : to
})

const pageSizeSelectOptions = computed(() => {
  const options = Array.from(
    new Set([
      ...getConfiguredTablePageSizeOptions(),
      normalizeTablePageSize(props.pageSize)
    ])
  ).sort((a, b) => a - b)

  return options.map((size) => ({
    value: size,
    label: String(size)
  }))
})

const jumpPage = ref('')

const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const maxVisible = 7
  const total = totalPages.value

  if (total <= maxVisible) {
    // Show all pages if total is small
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // Always show first page
    pages.push(1)

    const start = Math.max(2, props.page - 2)
    const end = Math.min(total - 1, props.page + 2)

    // Add ellipsis before if needed
    if (start > 2) {
      pages.push('...')
    }

    // Add middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    // Add ellipsis after if needed
    if (end < total - 1) {
      pages.push('...')
    }

    // Always show last page
    pages.push(total)
  }

  return pages
})

const goToPage = (newPage: number) => {
  if (newPage >= 1 && newPage <= totalPages.value && newPage !== props.page) {
    emit('update:page', newPage)
  }
}

const handlePageSizeChange = (value: string | number | boolean | null) => {
  if (value === null || typeof value === 'boolean') return
  const newPageSize = normalizeTablePageSize(typeof value === 'string' ? parseInt(value, 10) : value)
  setPersistedPageSize(newPageSize)
  emit('update:pageSize', newPageSize)
}

const submitJump = () => {
  const value = jumpPage.value.trim()
  if (!value) return
  const pageNum = Number.parseInt(value, 10)
  if (Number.isNaN(pageNum)) return
  const nextPage = Math.min(Math.max(pageNum, 1), totalPages.value)
  jumpPage.value = ''
  goToPage(nextPage)
}
</script>

<style scoped>
.pagination {
  /* 契约镜像：apple-theme.css 的 .pagination */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px 22px;
  border-top: 0.5px solid var(--separator);
  background: var(--bg-elevated);
  border-radius: 0 0 var(--r-xl) var(--r-xl);
  font-size: 13px;
  color: var(--text-secondary);
}

.pagination-mobile {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pagination-desktop {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.pagination-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.pagination-info {
  font-size: 13px;
  color: var(--text-secondary);
}

.pagination b {
  color: var(--text-primary);
  font-weight: 600;
}

.page-size-group,
.jump-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pager {
  /* 契约镜像：apple-theme.css 的 .pager */
  display: flex;
  gap: 4px;
  align-items: center;
}

.pager-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s var(--ease), color 0.15s var(--ease), transform 0.12s var(--ease);
}

.pager-btn:hover:not(:disabled):not(.active) {
  background: var(--fill);
}

.pager-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.pager-btn.active {
  background: var(--blue);
  color: #fff;
}

.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pager-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.pager-btn.is-ellipsis {
  cursor: default;
}

.jump-go {
  min-width: auto;
  padding: 0 12px;
  background: var(--fill);
  border-radius: var(--r-pill);
  color: var(--text-primary);
}

.jump-go:hover:not(:disabled) {
  background: var(--fill-hover);
}

.mobile-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 14px;
  border-radius: var(--r-pill);
  border: 0.5px solid var(--separator-strong);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: background 0.15s var(--ease), transform 0.12s var(--ease);
}

.mobile-btn:hover:not(:disabled) {
  background: var(--fill);
}

.mobile-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.mobile-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mobile-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.page-size-select :deep(.select-trigger) {
  height: 32px;
  padding: 0 10px;
  border-radius: var(--r-sm);
  font-size: 13px;
  border-color: var(--separator-strong);
}

.jump-input {
  height: 32px;
  padding: 0 10px;
  border-radius: var(--r-sm);
  border: 0.5px solid var(--separator-strong);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: box-shadow 0.18s var(--ease), border-color 0.18s var(--ease);
}

.jump-input:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}
</style>
