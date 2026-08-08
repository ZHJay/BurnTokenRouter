<template>
  <div class="empty">
    <!-- Icon -->
    <div class="empty-icon-wrap">
      <slot name="icon">
        <component v-if="icon" :is="icon" class="empty-state-icon" aria-hidden="true" />
        <svg
          v-else
          class="empty-state-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </slot>
    </div>

    <!-- Title -->
    <h3 class="empty-state-title">
      {{ displayTitle }}
    </h3>

    <!-- Description -->
    <p class="empty-state-description">
      {{ description }}
    </p>

    <!-- Action -->
    <div v-if="actionText || $slots.action" class="empty-action">
      <slot name="action">
        <component
          :is="actionTo ? 'RouterLink' : 'button'"
          v-if="actionText"
          :to="actionTo"
          @click="!actionTo && $emit('action')"
          class="btn btn-primary"
        >
          <Icon v-if="actionIcon" name="plus" size="md" />
          {{ actionText }}
        </component>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Component } from 'vue'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()

interface Props {
  icon?: Component | string
  title?: string
  description?: string
  actionText?: string
  actionTo?: string | object
  actionIcon?: boolean
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  actionIcon: true
})

const displayTitle = computed(() => props.title || t('common.noData'))

defineEmits(['action'])
</script>

<style scoped>
/* 契约镜像：apple-theme.css 的 .empty */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 24px;
  background: var(--fill);
  margin-bottom: 20px;
}

.empty-state-icon {
  width: 40px;
  height: 40px;
  color: var(--text-tertiary);
}

.empty-state-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.empty-state-description {
  max-width: 380px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.empty-action {
  margin-top: 24px;
}

/* 契约镜像：apple-theme.css 的 .btn/.btn-primary（本地回退） */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--r-pill);
  font-size: 13.5px;
  font-weight: 500;
  font-family: inherit;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.18s var(--ease), box-shadow 0.18s var(--ease),
    transform 0.12s var(--ease);
}

.btn:active {
  transform: scale(0.97);
}

.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.btn-primary {
  background: var(--blue);
  color: #fff;
  box-shadow: var(--shadow-blue);
}

.btn-primary:hover {
  background: var(--blue-hover);
}
</style>
