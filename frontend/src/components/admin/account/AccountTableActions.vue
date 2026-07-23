<template>
  <div class="account-table-actions">
    <slot name="before"></slot>
    <button
      @click="$emit('refresh')"
      :disabled="loading"
      class="btn btn-secondary account-refresh-button"
      :title="t('common.refresh')"
      :aria-label="t('common.refresh')"
    >
      <Icon name="refresh" size="md" :class="[loading ? 'animate-spin' : '']" />
    </button>
    <slot name="after"></slot>
    <slot name="beforeCreate"></slot>
    <button @click="$emit('create')" class="btn btn-primary account-create-button">
      <Icon name="plus" size="sm" :stroke-width="2" />
      {{ t('admin.accounts.createAccount') }}
    </button>
    <slot name="afterCreate"></slot>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

defineProps(['loading'])
defineEmits(['refresh', 'create'])

const { t } = useI18n()
</script>

<style scoped>
.account-table-actions {
  @apply flex flex-wrap items-center justify-end gap-2;
}

.account-refresh-button {
  @apply h-9 w-9 p-0;
}

.account-create-button {
  min-height: 2.25rem;
  padding-top: 0.4375rem;
  padding-bottom: 0.4375rem;
}
</style>
