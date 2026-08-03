<template>
  <div class="relative" ref="containerRef">
    <button
      ref="triggerRef"
      type="button"
      @click="toggle"
      :disabled="disabled"
      role="combobox"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-controls="isOpen ? listboxId : undefined"
      :aria-activedescendant="activeDescendantId"
      :id="id"
      :aria-label="ariaLabel ?? 'Select option'"
      :aria-describedby="ariaDescribedby"
      :class="[
        'select-trigger',
        isOpen && 'select-trigger-open',
        error && 'select-trigger-error',
        disabled && 'select-trigger-disabled'
      ]"
      @keydown="onTriggerKeyDown"
    >
      <span class="select-value">
        <slot name="selected" :option="selectedOption">
          {{ selectedLabel }}
        </slot>
      </span>
      <span
        v-if="clearable && hasValue && !disabled"
        class="select-clear"
        role="button"
        tabindex="-1"
        aria-label="Clear selection"
        @click.stop="clearSelection"
        @mousedown.stop
        @keydown.enter.stop.prevent="clearSelection"
      >
        <Icon name="x" size="sm" />
      </span>
      <span class="select-icon">
        <Icon
          name="chevronDown"
          size="md"
          :class="['transition-transform duration-fast ease-apple-out', isOpen && 'rotate-180']"
        />
      </span>
    </button>

    <!-- Teleport dropdown to body to escape stacking context -->
    <Teleport to="body">
      <Transition name="select-dropdown">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="select-dropdown-portal"
          :class="[instanceId]"
          :style="dropdownStyle"
          @click.stop
          @mousedown.stop
          @keydown="onDropdownKeyDown"
        >
          <!-- Search input -->
          <div v-if="isSearchable" class="select-search">
            <Icon name="search" size="sm" class="text-gray-400" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              :placeholder="searchPlaceholderText"
              :aria-label="searchPlaceholderText"
              role="combobox"
              :aria-expanded="isOpen"
              aria-haspopup="listbox"
              :aria-controls="listboxId"
              :aria-activedescendant="activeDescendantId"
              aria-autocomplete="list"
              class="select-search-input"
              @click.stop
            />
          </div>

          <!-- Options list -->
          <div
            class="select-options"
            ref="optionsListRef"
            role="listbox"
            :id="listboxId"
            :aria-label="ariaLabel ?? 'Select option'"
          >
            <div
              v-for="(option, index) in filteredOptions"
              :key="`${typeof getOptionValue(option)}:${String(getOptionValue(option) ?? '')}`"
              :id="getOptionId(index)"
              role="option"
              :aria-selected="isSelected(option)"
              :aria-disabled="isOptionDisabled(option)"
              @click.stop="!isOptionDisabled(option) && selectOption(option)"
              @mouseenter="handleOptionMouseEnter(option, index)"
              :class="[
                'select-option',
                isGroupHeaderOption(option) && 'select-option-group',
                isSelected(option) && 'select-option-selected',
                isOptionDisabled(option) && !isGroupHeaderOption(option) && 'select-option-disabled',
                focusedIndex === index && !isGroupHeaderOption(option) && 'select-option-focused'
              ]"
            >
              <slot name="option" :option="option" :selected="isSelected(option)">
                <Icon
                  v-if="option._creatable"
                  name="search"
                  size="sm"
                  class="flex-shrink-0 text-gray-400"
                />
                <span class="select-option-label" :class="option._creatable && 'italic text-gray-500 dark:text-dark-300'">{{ getOptionLabel(option) }}</span>
                <Icon
                  v-if="isSelected(option)"
                  name="check"
                  size="sm"
                  class="text-primary-500"
                  :stroke-width="2"
                />
              </slot>
            </div>

            <!-- Empty state -->
            <div v-if="filteredOptions.length === 0" class="select-empty" role="presentation">
              {{ emptyTextDisplay }}
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()

// Instance ID for unique click-outside detection
const instanceId = `select-${Math.random().toString(36).substring(2, 9)}`

export interface SelectOption {
  value: string | number | boolean | null
  label: string
  disabled?: boolean
  [key: string]: unknown
}

interface Props {
  modelValue: string | number | boolean | null | undefined
  options: SelectOption[] | Array<Record<string, unknown>>
  placeholder?: string
  disabled?: boolean
  error?: boolean
  searchable?: boolean | 'auto'
  searchPlaceholder?: string
  emptyText?: string
  valueKey?: string
  labelKey?: string
  creatable?: boolean
  creatablePrefix?: string
  clearable?: boolean
  id?: string
  ariaLabel?: string
  ariaDescribedby?: string
}

interface Emits {
  (e: 'update:modelValue', value: string | number | boolean | null): void
  (e: 'change', value: string | number | boolean | null, option: SelectOption | null): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  error: false,
  searchable: 'auto',
  creatable: false,
  creatablePrefix: '',
  clearable: false,
  valueKey: 'value',
  labelKey: 'label'
})

const emit = defineEmits<Emits>()

const isOpen = ref(false)
const searchQuery = ref('')
const focusedIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const optionsListRef = ref<HTMLElement | null>(null)
const dropdownPosition = ref<'bottom' | 'top'>('bottom')
const triggerRect = ref<DOMRect | null>(null)
const dropdownViewportPadding = 8
const dropdownMinimumWidth = 200

// i18n placeholders
const placeholderText = computed(() => props.placeholder ?? t('common.selectOption'))
const searchPlaceholderText = computed(() => props.searchPlaceholder ?? t('common.searchPlaceholder'))
const emptyTextDisplay = computed(() => props.emptyText ?? t('common.noOptionsFound'))

const isSearchable = computed(() => {
  if (props.searchable === 'auto') return props.options.length > 5
  return props.searchable
})

/* combobox 的三段引用：listbox 容器 id、每个 option 的 id、当前高亮的 option id。
   instanceId 已经是每个实例唯一（见上方 select-${random}），所以直接派生即可。
   id 按 index 派生而不是按 value：value 可能是 boolean / null / 带空格的字符串，
   不能直接进 HTML id；index 在同一次渲染内天然唯一，而 aria-activedescendant
   本来就只需要在当次渲染里成立。 */
const listboxId = `${instanceId}-listbox`
const getOptionId = (index: number) => `${instanceId}-option-${index}`

const activeDescendantId = computed(() => {
  if (!isOpen.value) return undefined
  if (focusedIndex.value < 0 || focusedIndex.value >= filteredOptions.value.length) return undefined
  return getOptionId(focusedIndex.value)
})

// Computed style for teleported dropdown
const dropdownStyle = computed(() => {
  if (!triggerRect.value) return {}

  const rect = triggerRect.value
  const viewportRight = Math.max(dropdownViewportPadding, window.innerWidth - dropdownViewportPadding)
  const left = Math.min(
    Math.max(dropdownViewportPadding, rect.left),
    viewportRight
  )
  const availableWidth = Math.max(0, viewportRight - left)
  const preferredMinWidth = Math.max(dropdownMinimumWidth, rect.width)
  const minWidth = Math.min(preferredMinWidth, availableWidth)
  const style: Record<string, string> = {
    position: 'fixed',
    left: `${left}px`,
    minWidth: `${minWidth}px`,
    maxWidth: `${availableWidth}px`,
    zIndex: '100000020'
  }

  if (dropdownPosition.value === 'top') {
    style.bottom = `${window.innerHeight - rect.top + 4}px`
  } else {
    style.top = `${rect.bottom + 4}px`
  }

  return style
})

const getOptionValue = (option: any): any => {
  if (typeof option === 'object' && option !== null) {
    return option[props.valueKey]
  }
  return option
}

const getOptionLabel = (option: any): string => {
  if (typeof option === 'object' && option !== null) {
    return String(option[props.labelKey] ?? '')
  }
  return String(option ?? '')
}

const isOptionDisabled = (option: any): boolean => {
  if (typeof option === 'object' && option !== null) {
    return !!option.disabled
  }
  return false
}

const isGroupHeaderOption = (option: any): boolean => {
  if (typeof option === 'object' && option !== null) {
    return option.kind === 'group'
  }
  return false
}

const selectedOption = computed(() => {
  return props.options.find((opt) => getOptionValue(opt) === props.modelValue) || null
})

const selectedLabel = computed(() => {
  if (selectedOption.value) {
    return getOptionLabel(selectedOption.value)
  }
  // In creatable mode, show the raw value if no matching option
  if (props.creatable && props.modelValue) {
    return String(props.modelValue)
  }
  return placeholderText.value
})

const hasValue = computed(
  () => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== ''
)

const filteredOptions = computed(() => {
  let opts = props.options as any[]
  if (isSearchable.value && searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    opts = opts.filter((opt) => {
      // Match label
      if (getOptionLabel(opt).toLowerCase().includes(query)) return true
      // Also match description if present
      if (opt.description && String(opt.description).toLowerCase().includes(query)) return true
      return false
    })
    // In creatable mode, always prepend a fuzzy search option
    if (props.creatable && searchQuery.value.trim()) {
      const trimmed = searchQuery.value.trim()
      const prefix = props.creatablePrefix || t('common.search')
      opts = [{ [props.valueKey]: trimmed, [props.labelKey]: `${prefix} "${trimmed}"`, _creatable: true }, ...opts]
    }
  }
  return opts
})

const isSelected = (option: any): boolean => {
  return getOptionValue(option) === props.modelValue
}

const findNextEnabledIndex = (startIndex: number): number => {
  const opts = filteredOptions.value
  if (opts.length === 0) return -1
  for (let offset = 0; offset < opts.length; offset++) {
    const idx = (startIndex + offset) % opts.length
    if (!isOptionDisabled(opts[idx])) return idx
  }
  return -1
}

const findPrevEnabledIndex = (startIndex: number): number => {
  const opts = filteredOptions.value
  if (opts.length === 0) return -1
  for (let offset = 0; offset < opts.length; offset++) {
    const idx = (startIndex - offset + opts.length) % opts.length
    if (!isOptionDisabled(opts[idx])) return idx
  }
  return -1
}

const handleOptionMouseEnter = (option: any, index: number) => {
  if (isOptionDisabled(option) || isGroupHeaderOption(option)) return
  focusedIndex.value = index
}

// Update trigger rect periodically while open to follow scroll/resize
const updateTriggerRect = () => {
  if (containerRef.value) {
    triggerRect.value = containerRef.value.getBoundingClientRect()
  }
}

const calculateDropdownPosition = () => {
  if (!containerRef.value) return
  updateTriggerRect()

  nextTick(() => {
    if (!dropdownRef.value || !triggerRect.value) return
    const dropdownHeight = dropdownRef.value.offsetHeight || 240
    const spaceBelow = window.innerHeight - triggerRect.value.bottom
    const spaceAbove = triggerRect.value.top

    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      dropdownPosition.value = 'top'
    } else {
      dropdownPosition.value = 'bottom'
    }
  })
}

const toggle = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

watch(isOpen, (open) => {
  if (open) {
    calculateDropdownPosition()
    // Reset focused index to current selection or first item
    if (filteredOptions.value.length === 0) {
      focusedIndex.value = -1
    } else {
      const selectedIdx = filteredOptions.value.findIndex(isSelected)
      const initialIdx = selectedIdx >= 0 ? selectedIdx : 0
      focusedIndex.value = isOptionDisabled(filteredOptions.value[initialIdx])
        ? findNextEnabledIndex(initialIdx + 1)
        : initialIdx
    }

    if (isSearchable.value) {
      nextTick(() => searchInputRef.value?.focus())
    }
    // Add scroll listener to update position
    window.addEventListener('scroll', updateTriggerRect, { capture: true, passive: true })
    window.addEventListener('resize', calculateDropdownPosition)
  } else {
    searchQuery.value = ''
    focusedIndex.value = -1
    window.removeEventListener('scroll', updateTriggerRect, { capture: true })
    window.removeEventListener('resize', calculateDropdownPosition)
  }
})

const selectOption = (option: any) => {
  const value = getOptionValue(option) ?? null
  emit('update:modelValue', value)
  emit('change', value, option)
  isOpen.value = false
  triggerRef.value?.focus()
}

const clearSelection = () => {
  if (props.disabled) return
  emit('update:modelValue', null)
  emit('change', null, null)
}

// Keyboards
/* 焦点始终留在 trigger 上，不进弹层。

   弹层是 v-if 挂载的，四条关闭路径里只有两条会把焦点还给 trigger
   （selectOption 与 Escape）；Tab 与 click-outside 不会。若焦点在弹层内部，
   那两条路径会把焦点掉给 <body>，把「弹层收不到键盘」换成「焦点丢失」，
   是另一个 2.4.3 失败。焦点留在 trigger 则这两条路径无需任何新逻辑，
   同时也正是本组件已经在靠近的 ARIA combobox 模式。

   代价是 keydown 必须同时绑在 trigger 和弹层上：弹层 teleport 到 body，
   不是 trigger 的 DOM 祖先，冒泡不会到它那儿 —— 这正是原先不可搜索变体
   键盘全哑的原因（可搜索时是弹层内的搜索框拿到焦点，才「碰巧」能用）。

   两处绑定不会双触发：teleport 后的弹层与 trigger 是 body 下的兄弟子树，
   trigger 上的 keydown 冒泡路径里没有弹层。 */
const onTriggerKeyDown = (e: KeyboardEvent) => {
  if (!isOpen.value) {
    /* 关闭态只认方向键开合，其余键（Enter / Space）继续走 button 原生
       activation → click → toggle，与改动前一致。 */
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      isOpen.value = true
    }
    return
  }

  /* 已展开：交给同一套弹层键盘逻辑。这里不能重复「打开」动作，否则一次
     ArrowDown 会既开弹层又移高亮 —— 开合与移动必须互斥。 */
  onDropdownKeyDown(e)
}

const onDropdownKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      focusedIndex.value = findNextEnabledIndex(focusedIndex.value + 1)
      if (focusedIndex.value >= 0) scrollToFocused()
      break
    case 'ArrowUp':
      e.preventDefault()
      focusedIndex.value = findPrevEnabledIndex(focusedIndex.value - 1)
      if (focusedIndex.value >= 0) scrollToFocused()
      break
    case 'Enter':
      e.preventDefault()
      if (focusedIndex.value >= 0 && focusedIndex.value < filteredOptions.value.length) {
        const opt = filteredOptions.value[focusedIndex.value]
        if (!isOptionDisabled(opt)) selectOption(opt)
      }
      break
    case 'Escape':
      e.preventDefault()
      isOpen.value = false
      triggerRef.value?.focus()
      break
    case 'Tab':
      isOpen.value = false
      break
  }
}

const scrollToFocused = () => {
  nextTick(() => {
    const list = optionsListRef.value
    if (!list) return
    const focusedEl = list.children[focusedIndex.value] as HTMLElement
    if (!focusedEl) return

    if (focusedEl.offsetTop < list.scrollTop) {
      list.scrollTop = focusedEl.offsetTop
    } else if (focusedEl.offsetTop + focusedEl.offsetHeight > list.scrollTop + list.offsetHeight) {
      list.scrollTop = focusedEl.offsetTop + focusedEl.offsetHeight - list.offsetHeight
    }
  })
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  // Check if click is inside THIS specific instance's dropdown or trigger
  const isInDropdown = !!target.closest(`.${instanceId}`)
  const isInTrigger = containerRef.value?.contains(target)

  if (!isInDropdown && !isInTrigger && isOpen.value) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', updateTriggerRect, { capture: true })
  window.removeEventListener('resize', calculateDropdownPosition)
})
</script>

<style scoped>
/* 触发器读作 input：不透明表面 + 内嵌发丝线，聚焦时 accent 环 */
.select-trigger {
  @apply flex w-full items-center justify-between gap-2;
  /* py-2 → 36px，与 .input 对齐。py-2.5 是 40px，在共享筛选行里
     （如 /admin/risk-control）与相邻 .input 差 4px，肉眼可见。 */
  @apply cursor-pointer rounded-lg px-4 py-2 text-sm;
  background-color: var(--surface-secondary);
  color: var(--label);
  border: 0;
  box-shadow: inset 0 0 0 1px var(--separator);
  letter-spacing: -0.006em;
  transition:
    box-shadow 240ms var(--ease-out),
    background-color 240ms var(--ease-out),
    transform 100ms var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}

.select-trigger:hover:not(:disabled) {
  box-shadow: inset 0 0 0 1px var(--label-quaternary);
}

/* 反馈落在 pointer-down 而非 click，与 .btn 同约定 */
.select-trigger:active:not(:disabled) {
  transform: scale(0.96);
}

.select-trigger:focus-visible {
  outline: none;
  background-color: var(--surface);
  box-shadow:
    inset 0 0 0 1.5px var(--accent),
    0 0 0 3.5px var(--accent-tint);
}

.select-trigger-open {
  background-color: var(--surface);
  box-shadow:
    inset 0 0 0 1.5px var(--accent),
    0 0 0 3.5px var(--accent-tint);
}

.select-trigger-error {
  box-shadow: inset 0 0 0 1.5px var(--sys-red);
}

.select-trigger-error:focus-visible,
.select-trigger-error.select-trigger-open {
  box-shadow:
    inset 0 0 0 1.5px var(--sys-red),
    0 0 0 3.5px rgb(255 59 48 / 0.18);
}

.select-trigger-disabled {
  @apply cursor-not-allowed opacity-60;
}

.select-value {
  @apply flex-1 truncate text-left;
}

.select-icon {
  @apply flex-shrink-0 text-gray-400 dark:text-dark-400;
}

.select-clear {
  @apply flex flex-shrink-0 cursor-pointer items-center justify-center;
  @apply rounded-full text-gray-400 transition-colors duration-fast ease-apple-out;
  @apply hover:text-gray-600 dark:hover:text-gray-200;
}

/* 与 style.css 的减弱动效分支同约定：那份分支是一份固定选择器清单
   (.btn/.card/.card-hover/.sidebar-link/.progress-bar/.tab)，这里的按下缩放是
   scoped 里的裸规则，不在清单内，因此本地中和位移、保留颜色反馈。
   .select-clear 刻意不给按下缩放：它嵌在 .select-trigger 内，
   :active 会同时命中祖先，两层缩放相乘会变成 0.92。 */
@media (prefers-reduced-motion: reduce) {
  .select-trigger {
    transition-property: background-color, box-shadow, color;
  }

  .select-trigger:active:not(:disabled) {
    transform: none;
  }
}
</style>

<style>
/* 弹层：不透明表面 + 四层玻璃边缘。

   这里刻意不用 thin 材质：弹层 teleport 到 body，逃出了 modal 的 backdrop
   root，所以它会真的把下面那层 modal 材质再模糊一次。实测单层 thin 均值
   218.5，thin 叠 thin 是 248.6 —— 比 0.91 的纯白填充还亮，因为 --mat-diffuse
   里的 brightness(1.06) 生效了两次，表面不再读作材质。全仓 29 个文件、84 处
   可达嵌套，其中 75 处是本组件。

   每个调用点都叠在别的 chrome 上，答案永远相同，所以判断放在这一处，
   与 6bc93a653 对 .btn-secondary 采用的同一论证。
   保留四层玻璃边缘与 --shadow-3，只换填充与模糊。 */
.select-dropdown-portal {
  @apply w-max min-w-[200px];
  @apply overflow-hidden rounded-xl;
  background: var(--surface);
  border: 0;
  box-shadow:
    0 0 0 0.5px var(--glass-edge-outer),
    inset 0 0 0 0.5px var(--glass-edge),
    inset 0 -0.5px 0 0 var(--glass-counter),
    inset 0 1px 0 0 var(--glass-specular),
    var(--shadow-3);
  pointer-events: auto !important;
}

.select-dropdown-portal .select-search {
  @apply flex items-center gap-2 px-3 py-2;
  border: 0;
  box-shadow: inset 0 -0.5px 0 var(--separator);
}

.select-dropdown-portal .select-search-input {
  @apply flex-1 bg-transparent text-sm;
  @apply focus:outline-none;
  color: var(--label);
}

.select-dropdown-portal .select-search-input::placeholder {
  color: var(--label-tertiary);
}

.select-dropdown-portal .select-options {
  @apply max-h-80 overflow-y-auto py-1 outline-none;
}

.select-dropdown-portal .select-option {
  @apply flex items-center justify-between gap-2;
  @apply px-4 py-2.5 text-sm;
  @apply cursor-pointer;
  color: var(--label);
  transition:
    background-color 100ms var(--ease-out),
    transform 100ms var(--ease-out);
  pointer-events: auto !important;
  -webkit-tap-highlight-color: transparent;
}

.select-dropdown-portal .select-option:hover {
  background-color: var(--surface-hover);
}

/* 列表项按下用 0.98：--surface-pressed 已被键盘焦点态占用，缩放是这里唯一没被占的信号 */
.select-dropdown-portal .select-option:active:not(.select-option-disabled):not(.select-option-group) {
  transform: scale(0.98);
}

.select-dropdown-portal .select-option-selected {
  background-color: var(--surface-selected);
  color: var(--accent);
  font-weight: 590;
}

.select-dropdown-portal .select-option-focused {
  background-color: var(--surface-pressed);
}

.select-dropdown-portal .select-option-disabled {
  @apply cursor-not-allowed opacity-40;
}

.select-dropdown-portal .select-option-group {
  @apply cursor-default select-none;
  @apply text-[11px] uppercase;
  background-color: var(--surface-secondary);
  font-weight: 590;
  letter-spacing: 0.04em;
  color: var(--label-tertiary);
}

.select-dropdown-portal .select-option-group:hover {
  background-color: var(--surface-secondary);
}

.select-dropdown-portal .select-option-label {
  @apply flex-1 min-w-0 truncate text-left;
}

.select-dropdown-portal .select-empty {
  @apply px-4 py-8 text-center text-sm;
  color: var(--label-secondary);
}

/* 从锚点生长，而不是单纯位移淡入 */
.select-dropdown-enter-active,
.select-dropdown-leave-active {
  transition:
    opacity 240ms var(--ease-out),
    transform 240ms var(--spring);
  transform-origin: top center;
}

.select-dropdown-enter-from,
.select-dropdown-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-6px);
}

/* 与 style.css 的减弱动效分支同约定：那份分支是一份固定选择器清单
   (.btn/.card/.card-hover/.sidebar-link/.progress-bar/.tab)，这里的按下缩放是
   scoped 里的裸规则，不在清单内，因此本地中和位移、保留颜色反馈。 */
@media (prefers-reduced-motion: reduce) {
  .select-dropdown-portal .select-option {
    transition-property: background-color, color;
  }

  .select-dropdown-portal .select-option:active {
    transform: none;
  }
}
</style>
