<template>
  <span
    class="badge"
    :class="statusClass"
  >
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
  // Money states must stay mutually distinguishable: pending (yellow) is intentionally
  // not the same tint as the refund family (orange), so they don't collapse into one badge.
  PENDING: { key: 'payment.status.pending', class: 'badge-pending' },
  PAID: { key: 'payment.status.paid', class: 'badge-primary' },
  RECHARGING: { key: 'payment.status.recharging', class: 'badge-primary' },
  COMPLETED: { key: 'payment.status.completed', class: 'badge-success' },
  EXPIRED: { key: 'payment.status.expired', class: 'badge-gray' },
  CANCELLED: { key: 'payment.status.cancelled', class: 'badge-gray' },
  FAILED: { key: 'payment.status.failed', class: 'badge-danger' },
  REFUND_REQUESTED: { key: 'payment.status.refund_requested', class: 'badge-warning' },
  REFUNDING: { key: 'payment.status.refunding', class: 'badge-warning' },
  REFUND_PENDING: { key: 'payment.status.refund_pending', class: 'badge-warning' },
  REFUNDED: { key: 'payment.status.refunded', class: 'badge-purple' },
  PARTIALLY_REFUNDED: { key: 'payment.status.partially_refunded', class: 'badge-purple' },
  REFUND_FAILED: { key: 'payment.status.refund_failed', class: 'badge-danger' },
}

const statusLabel = computed(() => {
  const entry = statusMap[props.status]
  return entry ? t(entry.key) : props.status
})

const statusClass = computed(() => {
  const entry = statusMap[props.status]
  return entry?.class ?? 'badge-gray'
})
</script>

<style scoped>
/* PENDING has no semantic badge of its own; Apple system yellow keeps it separate
   from the orange refund states without inventing a new colour. */
.badge-pending {
  background: rgb(255 204 0 / 0.2);
  color: #8a6100;
}

:global(.dark) .badge-pending {
  background: rgb(255 214 10 / 0.2);
  color: #ffd60a;
}
</style>
