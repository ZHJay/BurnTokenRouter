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
          :class="['transition-transform duration-fast ease-apple-out', isOpen && 'rotate-180']"
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
            <Icon name="arrowRight" size="sm" class="text-gray-400" />
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
/* 触发器读作控件：不透明表面 + 内嵌发丝线，聚焦/展开时 accent 环 */
.date-picker-trigger {
  @apply flex items-center gap-2;
  @apply cursor-pointer rounded-lg px-3 py-2 text-sm;
  background-color: var(--surface-secondary);
  color: var(--label);
  border: 0;
  box-shadow: inset 0 0 0 1px var(--separator);
  letter-spacing: -0.006em;
  transition:
    box-shadow 240ms var(--ease-out),
    background-color 240ms var(--ease-out);
}

.date-picker-trigger:hover {
  box-shadow: inset 0 0 0 1px var(--label-quaternary);
}

.date-picker-trigger:focus-visible {
  outline: none;
  background-color: var(--surface);
  box-shadow:
    inset 0 0 0 1.5px var(--accent),
    0 0 0 3.5px var(--accent-tint);
}

.date-picker-trigger-open {
  background-color: var(--surface);
  box-shadow:
    inset 0 0 0 1.5px var(--accent),
    0 0 0 3.5px var(--accent-tint);
}

.date-picker-icon {
  @apply text-gray-400 dark:text-dark-400;
}

.date-picker-value {
  @apply font-medium;
  /* 等宽数位写成普通声明：SFC 的 <style> 是独立的 PostCSS 入口，
     @apply 取不到 style.css 里 @layer 定义的 .tabular。 */
  font-variant-numeric: tabular-nums;
}

.date-picker-chevron {
  @apply text-gray-400 dark:text-dark-400;
}

/* 弹层：短暂出现的浮层走 thin 材质 + 四层玻璃边缘 */
.date-picker-dropdown {
  @apply absolute left-0 z-[100] mt-2;
  @apply min-w-[320px] overflow-hidden rounded-xl;
  background: var(--mat-thin);
  backdrop-filter: blur(var(--mat-blur-thin)) var(--mat-diffuse);
  -webkit-backdrop-filter: blur(var(--mat-blur-thin)) var(--mat-diffuse);
  border: 0;
  box-shadow:
    0 0 0 0.5px var(--glass-edge-outer),
    inset 0 0 0 0.5px var(--glass-edge),
    inset 0 -0.5px 0 0 var(--glass-counter),
    inset 0 1px 0 0 var(--glass-specular),
    var(--shadow-3);
}

.date-picker-presets {
  @apply grid grid-cols-2 gap-1 p-2;
}

.date-picker-preset {
  @apply rounded-full px-3 py-1.5 text-xs;
  color: var(--label-secondary);
  font-weight: 590;
  transition:
    background-color 100ms var(--ease-out),
    color 100ms var(--ease-out),
    transform 100ms var(--ease-out);
}

.date-picker-preset:hover {
  background-color: var(--surface-hover);
  color: var(--label);
}

.date-picker-preset:active {
  transform: scale(0.96);
}

.date-picker-preset-active {
  background-color: var(--accent-tint);
  color: var(--accent);
}

.date-picker-preset-active:hover {
  background-color: var(--accent-tint-strong);
  color: var(--accent);
}

.date-picker-divider {
  border: 0;
  box-shadow: inset 0 0.5px 0 var(--separator);
}

.date-picker-custom {
  @apply flex items-end gap-2 p-3;
}

.date-picker-field {
  @apply flex-1;
}

.date-picker-label {
  @apply mb-1 block text-xs font-medium;
  letter-spacing: 0.002em;
  color: var(--label-secondary);
}

.date-picker-input {
  @apply w-full rounded-lg px-2 py-1.5 text-sm;
  font-variant-numeric: tabular-nums;
  background-color: var(--surface-secondary);
  color: var(--label);
  border: 0;
  box-shadow: inset 0 0 0 1px var(--separator);
  transition:
    box-shadow 240ms var(--ease-out),
    background-color 240ms var(--ease-out);
}

.date-picker-input:focus {
  outline: none;
  background-color: var(--surface);
  box-shadow:
    inset 0 0 0 1.5px var(--accent),
    0 0 0 3.5px var(--accent-tint);
}

.date-picker-input::-webkit-calendar-picker-indicator {
  @apply cursor-pointer opacity-60 hover:opacity-100;
  filter: invert(0.5);
}

.dark .date-picker-input::-webkit-calendar-picker-indicator {
  filter: invert(0.7);
}

.date-picker-separator {
  @apply flex items-center justify-center pb-1;
}

.date-picker-actions {
  @apply flex justify-end p-2 pt-0;
}

.date-picker-apply {
  @apply rounded-full px-4 py-1.5 text-sm;
  background-color: var(--accent);
  color: var(--on-accent);
  font-weight: 590;
  letter-spacing: -0.006em;
  box-shadow: var(--shadow-accent);
  transition:
    background-color 240ms var(--ease-out),
    transform 100ms var(--ease-out);
}

.date-picker-apply:hover {
  background-color: var(--accent-hover);
}

.date-picker-apply:active {
  background-color: var(--accent-pressed);
  transform: scale(0.96);
}

/* 从锚点生长，而不是单纯位移淡入 */
.date-picker-dropdown-enter-active,
.date-picker-dropdown-leave-active {
  transition:
    opacity 240ms var(--ease-out),
    transform 240ms var(--spring);
  transform-origin: top left;
}

.date-picker-dropdown-enter-from,
.date-picker-dropdown-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-6px);
}
</style>
