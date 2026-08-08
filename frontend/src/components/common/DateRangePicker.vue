<template>
  <div class="relative" ref="containerRef">
    <button
      type="button"
      @click="toggle"
      :class="['date-picker-trigger', isOpen && 'date-picker-trigger-open']"
    >
      <span class="date-picker-icon">
        <Icon name="calendar" size="sm" />
      </span>
      <span class="date-picker-value">
        {{ displayValue }}
      </span>
      <span class="date-picker-chevron">
        <Icon
          name="chevronDown"
          size="sm"
          :class="['date-picker-chevron-icon', isOpen && 'is-open']"
        />
      </span>
    </button>

    <Transition name="date-picker-dropdown">
      <div v-if="isOpen" class="date-picker-dropdown">
        <!-- Quick presets -->
        <div class="date-picker-presets">
          <button
            v-for="preset in presets"
            :key="preset.value"
            @click="selectPreset(preset)"
            :class="['date-picker-preset', isPresetActive(preset) && 'date-picker-preset-active']"
          >
            {{ t(preset.labelKey) }}
          </button>
        </div>

        <div class="date-picker-divider"></div>

        <!-- Custom date range inputs -->
        <div class="date-picker-custom">
          <div class="date-picker-field">
            <label class="date-picker-label">{{ t('dates.startDate') }}</label>
            <input
              type="date"
              v-model="localStartDate"
              :max="localEndDate || tomorrow"
              class="date-picker-input"
              @change="onDateChange"
            />
          </div>
          <div class="date-picker-separator">
            <Icon name="arrowRight" size="sm" />
          </div>
          <div class="date-picker-field">
            <label class="date-picker-label">{{ t('dates.endDate') }}</label>
            <input
              type="date"
              v-model="localEndDate"
              :min="localStartDate"
              :max="tomorrow"
              class="date-picker-input"
              @change="onDateChange"
            />
          </div>
        </div>

        <!-- Apply button -->
        <div class="date-picker-actions">
          <button @click="apply" class="date-picker-apply">
            {{ t('dates.apply') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

interface DatePreset {
  labelKey: string
  value: string
  getRange: () => { start: string; end: string }
}

interface Props {
  startDate: string
  endDate: string
}

interface Emits {
  (e: 'update:startDate', value: string): void
  (e: 'update:endDate', value: string): void
  (e: 'change', range: { startDate: string; endDate: string; preset: string | null }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t, locale } = useI18n()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const localStartDate = ref(props.startDate)
const localEndDate = ref(props.endDate)
const activePreset = ref<string | null>('last24Hours')

const today = computed(() => {
  // Use local timezone to avoid UTC timezone issues
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

// Tomorrow's date - used for max date to handle timezone differences
// When user is in a timezone behind the server, "today" on server might be "tomorrow" locally
const tomorrow = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatDateToString(d)
})

// Helper function to format date to YYYY-MM-DD using local timezone
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const presets: DatePreset[] = [
  {
    labelKey: 'dates.today',
    value: 'today',
    getRange: () => {
      const t = today.value
      return { start: t, end: t }
    }
  },
  {
    labelKey: 'dates.yesterday',
    value: 'yesterday',
    getRange: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const yesterday = formatDateToString(d)
      return { start: yesterday, end: yesterday }
    }
  },
  {
    labelKey: 'dates.last24Hours',
    value: 'last24Hours',
    getRange: () => {
      const end = new Date()
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
      return {
        start: formatDateToString(start),
        end: formatDateToString(end)
      }
    }
  },
  {
    labelKey: 'dates.last7Days',
    value: '7days',
    getRange: () => {
      const end = today.value
      const d = new Date()
      d.setDate(d.getDate() - 6)
      const start = formatDateToString(d)
      return { start, end }
    }
  },
  {
    labelKey: 'dates.last14Days',
    value: '14days',
    getRange: () => {
      const end = today.value
      const d = new Date()
      d.setDate(d.getDate() - 13)
      const start = formatDateToString(d)
      return { start, end }
    }
  },
  {
    labelKey: 'dates.last30Days',
    value: '30days',
    getRange: () => {
      const end = today.value
      const d = new Date()
      d.setDate(d.getDate() - 29)
      const start = formatDateToString(d)
      return { start, end }
    }
  },
  {
    labelKey: 'dates.thisMonth',
    value: 'thisMonth',
    getRange: () => {
      const now = new Date()
      const start = formatDateToString(new Date(now.getFullYear(), now.getMonth(), 1))
      return { start, end: today.value }
    }
  },
  {
    labelKey: 'dates.lastMonth',
    value: 'lastMonth',
    getRange: () => {
      const now = new Date()
      const start = formatDateToString(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const end = formatDateToString(new Date(now.getFullYear(), now.getMonth(), 0))
      return { start, end }
    }
  }
]

const displayValue = computed(() => {
  if (activePreset.value) {
    const preset = presets.find((p) => p.value === activePreset.value)
    if (preset) return t(preset.labelKey)
  }

  if (localStartDate.value && localEndDate.value) {
    if (localStartDate.value === localEndDate.value) {
      return formatDate(localStartDate.value)
    }
    return `${formatDate(localStartDate.value)} - ${formatDate(localEndDate.value)}`
  }

  return t('dates.selectDateRange')
})

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  const dateLocale = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
}

const isPresetActive = (preset: DatePreset): boolean => {
  return activePreset.value === preset.value
}

const selectPreset = (preset: DatePreset) => {
  const range = preset.getRange()
  localStartDate.value = range.start
  localEndDate.value = range.end
  activePreset.value = preset.value
}

const onDateChange = () => {
  // Check if current dates match any preset
  activePreset.value = null
  for (const preset of presets) {
    const range = preset.getRange()
    if (range.start === localStartDate.value && range.end === localEndDate.value) {
      activePreset.value = preset.value
      break
    }
  }
}

const toggle = () => {
  isOpen.value = !isOpen.value
}

const apply = () => {
  emit('update:startDate', localStartDate.value)
  emit('update:endDate', localEndDate.value)
  emit('change', {
    startDate: localStartDate.value,
    endDate: localEndDate.value,
    preset: activePreset.value
  })
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

// Sync local state with props
watch(
  () => props.startDate,
  (val) => {
    localStartDate.value = val
    onDateChange()
  }
)

watch(
  () => props.endDate,
  (val) => {
    localEndDate.value = val
    onDateChange()
  }
)

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
  // Initialize active preset detection
  onDateChange()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.date-picker-trigger {
  /* 与 .input 一致的 44px 触发控件 */
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--r-md);
  border: 0.5px solid var(--separator-strong);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: box-shadow 0.18s var(--ease), border-color 0.18s var(--ease);
}

.date-picker-trigger:hover {
  border-color: var(--text-tertiary);
}

.date-picker-trigger:focus-visible {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.date-picker-trigger-open {
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.date-picker-icon {
  display: inline-flex;
  color: var(--text-tertiary);
}

.date-picker-value {
  font-weight: 500;
  white-space: nowrap;
}

.date-picker-chevron {
  display: inline-flex;
  color: var(--text-tertiary);
}

.date-picker-chevron-icon {
  transition: transform 0.2s var(--ease);
}

.date-picker-chevron-icon.is-open {
  transform: rotate(180deg);
}

.date-picker-dropdown {
  /* 契约镜像：不透明浮出面板（浮出层不透明 + 纱幕规范） */
  position: absolute;
  left: 0;
  z-index: 100;
  margin-top: 8px;
  background: var(--glass-bg-strong);
  border-radius: var(--r-lg);
  border: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight), var(--shadow-pop);
  overflow: hidden;
  min-width: 320px;
}

.date-picker-presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  padding: 8px;
}

.date-picker-preset {
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  border-radius: var(--r-sm);
  padding: 8px 12px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
  text-align: left;
}

.date-picker-preset:hover {
  background: var(--fill);
  color: var(--text-primary);
}

.date-picker-preset:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.date-picker-preset-active {
  background: var(--blue-soft);
  color: var(--blue);
}

.date-picker-divider {
  border-top: 0.5px solid var(--separator);
}

.date-picker-custom {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px;
}

.date-picker-field {
  flex: 1;
}

.date-picker-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
}

.date-picker-input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--r-sm);
  border: 0.5px solid var(--separator-strong);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: box-shadow 0.18s var(--ease), border-color 0.18s var(--ease);
}

.date-picker-input:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.date-picker-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.6;
  filter: invert(0.5);
}

.date-picker-input::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}

.dark .date-picker-input::-webkit-calendar-picker-indicator {
  filter: none;
}

.date-picker-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 9px;
  color: var(--text-tertiary);
}

.date-picker-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 12px 12px;
}

.date-picker-apply {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--r-pill);
  border: none;
  background: var(--blue);
  color: #fff;
  font-size: 13.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  box-shadow: var(--shadow-blue);
  transition: background 0.18s var(--ease), transform 0.12s var(--ease);
}

.date-picker-apply:hover {
  background: var(--blue-hover);
}

.date-picker-apply:active {
  transform: scale(0.97);
}

.date-picker-apply:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

/* Dropdown animation */
.date-picker-dropdown-enter-active,
.date-picker-dropdown-leave-active {
  transition: opacity 0.2s var(--ease), transform 0.2s var(--ease);
}

.date-picker-dropdown-enter-from,
.date-picker-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
