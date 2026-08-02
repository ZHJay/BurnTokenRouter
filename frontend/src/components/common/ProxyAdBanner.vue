<template>
  <a
    class="inline-flex max-w-full shrink-0 items-center gap-1 truncate rounded-md text-xs font-normal tracking-[0.01em] text-primary-600 transition-colors duration-fast ease-apple-out hover:underline focus-visible:outline-none focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)] dark:text-primary-400"
    href="https://sub2api.io/proxyip"
    target="_blank"
    rel="noopener noreferrer"
  >
    <span class="truncate">{{ t('admin.proxies.ad.inline') }}</span>
    <Icon name="externalLink" size="xs" />
  </a>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()
</script>
