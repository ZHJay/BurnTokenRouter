<template>
  <div class="stat-card">
    <div class="stat-top">
      <div :class="['stat-icon', iconClass]">
        <component v-if="icon" :is="icon" class="h-6 w-6" aria-hidden="true" />
      </div>
    </div>
    <p class="stat-label truncate">{{ title }}</p>
    <p class="stat-value" :title="String(formattedValue)">{{ formattedValue }}</p>
    <span v-if="change !== undefined" :class="['stat-trend', trendClass]">
      <Icon
        v-if="changeType !== 'neutral'"
        name="arrowUp"
        size="xs"
        :class="changeType === 'down' && 'rotate-180'"
      />
      {{ formattedChange }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import Icon from '@/components/icons/Icon.vue'

type ChangeType = 'up' | 'down' | 'neutral'
type IconVariant = 'primary' | 'success' | 'warning' | 'danger'

interface Props {
  title: string
  value: number | string
  icon?: Component
  iconVariant?: IconVariant
  change?: number
  changeType?: ChangeType
  formatValue?: (value: number | string) => string
}

const props = withDefaults(defineProps<Props>(), {
  changeType: 'neutral',
  iconVariant: 'primary'
})

const formattedValue = computed(() => {
  if (props.formatValue) {
    return props.formatValue(props.value)
  }
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})

const formattedChange = computed(() => {
  if (props.change === undefined) return ''
  const absChange = Math.abs(props.change)
  return `${absChange}%`
})

const iconClass = computed(() => {
  const classes: Record<IconVariant, string> = {
    primary: 'tint-blue',
    success: 'tint-green',
    warning: 'tint-orange',
    danger: 'tint-red'
  }
  return classes[props.iconVariant]
})

const trendClass = computed(() => {
  const classes: Record<ChangeType, string> = {
    up: 'stat-trend-up',
    down: 'stat-trend-down',
    neutral: 'stat-trend-neutral'
  }
  return classes[props.changeType]
})
</script>

<style scoped>
/* 契约镜像：apple-theme.css 的 .stat-card 家族（数值与契约一致） */
.stat-card {
  background: var(--bg-elevated);
  border-radius: var(--r-lg);
  padding: 18px 20px;
  box-shadow: var(--shadow-card), var(--glass-highlight);
  border: 0.5px solid var(--separator);
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-pop), var(--glass-highlight);
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
}

.stat-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 14px;
}

.stat-value {
  font-size: 27px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-top: 3px;
  color: var(--text-primary);
}

.stat-trend {
  font-size: 12px;
  font-weight: 600;
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.stat-trend-up {
  color: var(--green);
}

.stat-trend-down {
  color: var(--red);
}

.stat-trend-neutral {
  color: var(--text-tertiary);
}

.tint-blue {
  background: var(--blue-soft);
  color: var(--blue);
}

.tint-green {
  background: rgba(52, 199, 89, 0.14);
  color: var(--green);
}

.tint-orange {
  background: rgba(255, 159, 10, 0.14);
  color: var(--orange);
}

.tint-red {
  background: rgba(255, 59, 48, 0.12);
  color: var(--red);
}
</style>
