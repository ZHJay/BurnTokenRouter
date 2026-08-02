<template>
  <div
    v-if="uniqueIps.length > 0"
    class="hairline-bottom flex flex-shrink-0 items-center justify-end gap-2 px-4 py-2"
  >
    <span v-if="pendingCount > 0" class="tabular text-xs text-gray-500 dark:text-gray-400">
      {{ t('usage.ipGeo.pending', { count: pendingCount }) }}
    </span>
    <button
      type="button"
      class="batch-fetch-btn inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
      :disabled="loading || pendingCount === 0"
      @click="run"
    >
      {{ loading ? t('usage.ipGeo.batchFetching') : t('usage.ipGeo.batchFetch') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchBatch, getEntry } from '@/utils/ipGeoLookup'

// 当前页 IP 批量地理查询工具条:传入原始 IP 列表(可含空值),内部去重;
// 无 IP 时自身不渲染。批量失败 emit failed,由使用方弹提示。
const props = defineProps<{
  ips: Array<string | null | undefined>
}>()

const emit = defineEmits<{
  (e: 'failed'): void
}>()

const { t } = useI18n()

const uniqueIps = computed(() =>
  Array.from(new Set(props.ips.filter((ip): ip is string => Boolean(ip))))
)

const pendingCount = computed(() =>
  uniqueIps.value.filter((ip) => {
    const status = getEntry(ip).status
    return status === 'idle' || status === 'error'
  }).length
)

const loading = ref(false)

const run = async () => {
  loading.value = true
  try {
    const ok = await fetchBatch(uniqueIps.value)
    if (!ok) emit('failed')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.hairline-bottom {
  box-shadow: inset 0 -0.5px 0 var(--separator);
}

/* accent 文字按钮：染色底 + pointer-down 反馈，保持工具条轻量 */
.batch-fetch-btn {
  color: var(--accent);
  font-weight: 590;
  transition:
    background-color 240ms var(--ease-out),
    transform 100ms var(--ease-out);
}

.batch-fetch-btn:hover:not(:disabled) {
  background-color: var(--accent-tint);
}

.batch-fetch-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.batch-fetch-btn:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3.5px var(--accent-tint-strong),
    0 0 0 1px var(--accent);
}

.batch-fetch-btn:disabled {
  @apply cursor-not-allowed opacity-40;
}
</style>
