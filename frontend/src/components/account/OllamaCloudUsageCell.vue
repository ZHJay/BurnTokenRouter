<template>
  <div
    v-if="state?.eligible"
    class="min-w-0 max-w-full space-y-1"
    data-testid="ollama-cloud-usage-cell"
  >
    <UsageProgressBar
      v-if="snapshot?.data?.five_hour"
      label="5h"
      :utilization="snapshot.data.five_hour.used_percent"
      :resets-at="snapshot.data.five_hour.reset_at"
      color="indigo"
      data-testid="ollama-cloud-five-hour"
    />
    <UsageProgressBar
      v-if="snapshot?.data?.seven_day"
      label="7d"
      :utilization="snapshot.data.seven_day.used_percent"
      :resets-at="snapshot.data.seven_day.reset_at"
      color="emerald"
      data-testid="ollama-cloud-seven-day"
    />
  </div>
  <!-- 空值占位符与同列的 AccountUsageCell 对齐：那里 5 处「-」占位都是裸
       text-gray-400。gray 阶已走 --c-gray-* 主题翻转变量，裸类在两个主题下
       各自取到正确的值，所以这里的 dark: 分支可以直接删掉而不是改写。 -->
  <span v-else class="text-sm text-gray-400">-</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '@/types'
import UsageProgressBar from './UsageProgressBar.vue'

const props = defineProps<{ account: Account }>()
const state = computed(() => props.account.ollama_cloud_usage)
const snapshot = computed(() => state.value?.snapshot)
</script>
