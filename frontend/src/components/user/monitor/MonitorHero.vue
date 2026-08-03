<template>
  <!--
    Opaque `.card`, not glass — even though this is a control row.
    It scrolls with the content, and glass (`--mat-regular`) is reserved for the
    chrome that content passes UNDER: the fixed top bar and the sticky thead.
    A glass card mid-page would stack translucency over the ambient wash and
    read as a second top bar. Same shape as /dashboard and /admin/usage:
    subject on the left, controls on the right, inside one opaque surface.
  -->
  <section class="card p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- Left: the subject of the row. Without it the controls float against
           a bare background with nothing to be attached to. -->
      <div class="flex items-center gap-3">
        <div
          class="stat-icon h-8 w-8"
          :class="statusTileClass"
          aria-hidden="true"
        >
          <Icon :name="statusIconName" size="sm" />
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="stat-label">{{ t('channelStatus.title') }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ metaLine }}</span>
        </div>
      </div>

      <!-- Right: window / status / refresh / auto-refresh -->
      <div class="flex items-center gap-2 flex-wrap">
      <Segmented
        :model-value="window"
        :options="windowOptions"
        mode="radiogroup"
        :aria-label="t('dashboard.timeRange')"
        item-class="text-xs"
        @update:model-value="emit('update:window', $event)"
      />

      <span
        class="badge uppercase tracking-[0.04em]"
        :class="overallChipClass"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="overallDotClass"
        ></span>
        {{ overallLabel }}
      </span>

      <!-- btn-secondary, not btn-ghost: a ghost icon button on an opaque card
           has no affordance. btn-secondary carries the four-layer edge and
           btn-icon lands at 36px, matching the tabs and the auto-refresh pill. -->
      <button
        type="button"
        class="btn btn-secondary btn-icon"
        :disabled="loading"
        :title="t('common.refresh')"
        @click="emit('refresh')"
      >
        <Icon name="refresh" size="md" :class="loading ? 'animate-spin' : ''" />
      </button>

      <AutoRefreshButton
        v-if="autoRefresh"
        :enabled="autoRefresh.enabled.value"
        :interval-seconds="autoRefresh.intervalSeconds.value"
        :countdown="autoRefresh.countdown.value"
        :intervals="autoRefresh.intervals"
        @update:enabled="autoRefresh.setEnabled"
        @update:interval="autoRefresh.setInterval"
      />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import AutoRefreshButton from '@/components/common/AutoRefreshButton.vue'
import Segmented from '@/components/common/Segmented.vue'
import { formatTime } from '@/utils/format'
export type MonitorWindow = '7d' | '15d' | '30d'
export type OverallStatus = 'operational' | 'degraded'

const props = defineProps<{
  overallStatus: OverallStatus
  intervalSeconds: number
  window: MonitorWindow
  loading: boolean
  /** Timestamp of the last completed load, for the meta line. */
  lastUpdatedAt?: number | null
  autoRefresh?: {
    enabled: { value: boolean }
    intervalSeconds: { value: number }
    countdown: { value: number }
    intervals: readonly number[]
    setEnabled: (v: boolean) => void
    setInterval: (v: number) => void
  }
}>()

const emit = defineEmits<{
  (e: 'update:window', value: MonitorWindow): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()

const windowOptions = computed<{ value: MonitorWindow; label: string }[]>(() => [
  { value: '7d', label: t('channelStatus.windowTab.7d') },
  { value: '15d', label: t('channelStatus.windowTab.15d') },
  { value: '30d', label: t('channelStatus.windowTab.30d') },
])

const overallLabel = computed(() => t(`channelStatus.overall.${props.overallStatus}`))

/* The status tile tints by state, so the row carries its state visually as well
   as in the badge text. Both tints have a per-theme value in style.css. */
const statusTileClass = computed(() =>
  props.overallStatus === 'operational' ? 'stat-icon-success' : 'stat-icon-warning',
)

const statusIconName = computed(() =>
  props.overallStatus === 'operational' ? 'checkCircle' : 'exclamationTriangle',
)

/* Last-updated + the backend probe interval. `intervalSeconds` is the monitor's
   own probe cadence, which is a different number from the auto-refresh pill's
   client poll — the pill says how often this page refetches, this says how often
   the data behind it is actually recollected. */
const metaLine = computed(() => {
  const poll = t('monitorCommon.pollEvery', { n: props.intervalSeconds })
  if (!props.lastUpdatedAt) return poll
  return `${t('monitorCommon.updatedAt', { time: formatTime(new Date(props.lastUpdatedAt)) })} · ${poll}`
})

const overallChipClass = computed(() => {
  switch (props.overallStatus) {
    case 'operational':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    case 'degraded':
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  }
})

const overallDotClass = computed(() => {
  switch (props.overallStatus) {
    case 'operational':
      return 'bg-emerald-500 animate-pulse'
    case 'degraded':
    default:
      return 'bg-amber-500 animate-pulse'
  }
})

</script>
