<template>
  <div class="row-actions justify-end">
    <button
      type="button"
      @click="$emit('run', row)"
      :disabled="running"
      class="icon-btn disabled:cursor-not-allowed disabled:opacity-50"
      :title="t('admin.channelMonitor.runNow')"
      :aria-label="t('admin.channelMonitor.runNow')"
    >
      <Icon name="refresh" size="sm" :class="running ? 'animate-spin' : ''" />
    </button>
    <button
      type="button"
      data-testid="monitor-duplicate"
      :title="duplicateTitle"
      :aria-label="duplicateTitle"
      :disabled="duplicating || Boolean(row.api_key_decrypt_failed)"
      @click="$emit('duplicate', row)"
      class="icon-btn disabled:cursor-not-allowed disabled:opacity-50"
    >
      <!--
        Row actions are icon-only (approved demo). Progress feedback therefore
        rides on the icon itself — same pattern as the Run button above — so the
        duplicating state stays visible to sighted users, not just to the
        accessible name in title/aria-label.
      -->
      <Icon :name="duplicating ? 'refresh' : 'copy'" size="sm" :class="duplicating ? 'animate-spin' : ''" />
    </button>
    <button
      type="button"
      @click="$emit('edit', row)"
      class="icon-btn"
      :title="t('common.edit')"
      :aria-label="t('common.edit')"
    >
      <Icon name="edit" size="sm" />
    </button>
    <button
      type="button"
      @click="$emit('delete', row)"
      class="icon-btn danger"
      :title="t('common.delete')"
      :aria-label="t('common.delete')"
    >
      <Icon name="trash" size="sm" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChannelMonitor } from '@/api/admin/channelMonitor'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{
  row: ChannelMonitor
  running: boolean
  duplicating: boolean
}>()

defineEmits<{
  (e: 'run', row: ChannelMonitor): void
  (e: 'duplicate', row: ChannelMonitor): void
  (e: 'edit', row: ChannelMonitor): void
  (e: 'delete', row: ChannelMonitor): void
}>()

const { t } = useI18n()
const duplicateTitle = computed(() => {
  if (props.row.api_key_decrypt_failed) return t('admin.channelMonitor.duplicateKeyUnavailable')
  if (props.duplicating) return t('admin.channelMonitor.duplicating')
  return t('admin.channelMonitor.duplicate')
})
</script>
