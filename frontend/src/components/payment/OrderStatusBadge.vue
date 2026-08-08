<template>
  <span class="badge" :class="statusClass">
    {{ statusLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OrderStatus } from '@/types/payment'

const props = defineProps<{
  status: OrderStatus
}>()

const { t } = useI18n()

const statusMap: Record<OrderStatus, { key: string; class: string }> = {
  PENDING: { key: 'payment.status.pending', class: 'b-orange' },
  PAID: { key: 'payment.status.paid', class: 'b-blue' },
  RECHARGING: { key: 'payment.status.recharging', class: 'b-blue' },
  COMPLETED: { key: 'payment.status.completed', class: 'b-green' },
  EXPIRED: { key: 'payment.status.expired', class: 'b-grok' },
  CANCELLED: { key: 'payment.status.cancelled', class: 'b-grok' },
  FAILED: { key: 'payment.status.failed', class: 'b-red' },
  REFUND_REQUESTED: { key: 'payment.status.refund_requested', class: 'b-orange' },
  REFUNDING: { key: 'payment.status.refunding', class: 'b-orange' },
  REFUND_PENDING: { key: 'payment.status.refund_pending', class: 'b-orange' },
  REFUNDED: { key: 'payment.status.refunded', class: 'b-purple' },
  PARTIALLY_REFUNDED: { key: 'payment.status.partially_refunded', class: 'b-purple' },
  REFUND_FAILED: { key: 'payment.status.refund_failed', class: 'b-red' },
}

const statusLabel = computed(() => {
  const entry = statusMap[props.status]
  return entry ? t(entry.key) : props.status
})

const statusClass = computed(() => {
  const entry = statusMap[props.status]
  return entry?.class ?? 'b-grok'
})
</script>
