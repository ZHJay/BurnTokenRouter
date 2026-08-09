<template>
  <div class="relative" ref="containerRef">
    <button
      ref="triggerRef"
      type="button"
      @click="toggle"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-haspopup="true"
      :aria-controls="listboxId"
      :class="[
        'select-trigger',
        isOpen && 'select-trigger-open',
        disabled && 'select-trigger-disabled'
      ]"
      @keydown="onKeydown"
    >
      <span class="select-value">
        {{ selectedLabel }}
      </span>
      <span class="select-icon">
        <Icon
          name="chevronDown"
          size="md"
          :class="['transition-transform duration-200', isOpen && 'rotate-180']"
        />
      </span>
    </button>

    <Transition name="select-dropdown">
      <div
        v-if="isOpen"
        :id="listboxId"
        class="select-dropdown"
        role="listbox"
        :aria-label="t('admin.proxies.searchProxies')"
      >
        <!-- Search and Batch Test Header -->
        <div class="select-header">
          <div class="select-search">
            <Icon name="search" size="sm" class="text-gray-400" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              role="combobox"
              :aria-expanded="isOpen"
              :aria-controls="listboxId"
              :aria-activedescendant="activeOptionId"
              aria-autocomplete="list"
              :placeholder="t('admin.proxies.searchProxies')"
              class="select-search-input"
              @click.stop
              @keydown="onSearchKeydown"
            />
          </div>
          <button
            v-if="proxies.length > 0"
            type="button"
            @click.stop="handleBatchTest"
            :disabled="batchTesting"
            class="batch-test-btn"
            :title="t('admin.proxies.batchTest')"
          >
            <svg v-if="batchTesting" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <Icon v-else name="play" size="sm" />
          </button>
        </div>

        <!-- Options list -->
        <div class="select-options">
          <!-- No Proxy option -->
          <div
            :id="optionId(null)"
            role="option"
            :aria-selected="modelValue === null"
            @click="selectOption(null)"
            @mouseenter="focusedIndex = 0"
            :class="[
              'select-option',
              modelValue === null && 'select-option-selected',
              focusedIndex === 0 && 'select-option-focused'
            ]"
          >
            <span class="select-option-label">{{ t('admin.accounts.noProxy') }}</span>
            <Icon v-if="modelValue === null" name="check" size="sm" class="text-primary-500" />
          </div>

          <!-- Proxy options -->
          <div
            v-for="(proxy, index) in filteredProxies"
            :key="proxy.id"
            :id="optionId(proxy.id)"
            role="option"
            :aria-selected="modelValue === proxy.id"
            @click="selectOption(proxy.id)"
            @mouseenter="focusedIndex = index + 1"
            :class="[
              'select-option',
              modelValue === proxy.id && 'select-option-selected',
              focusedIndex === index + 1 && 'select-option-focused'
            ]"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">{{ proxy.name }}</span>
                <!-- Account count badge -->
                <span
                  v-if="proxy.account_count !== undefined"
                  class="inline-flex flex-shrink-0 items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-dark-600 dark:text-gray-400"
                >
                  {{ proxy.account_count }}
                </span>
                <!-- Test result badges -->
                <template v-if="testResults[proxy.id]">
                  <span
                    v-if="testResults[proxy.id].success"
                    class="inline-flex flex-shrink-0 items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  >
                    <span v-if="testResults[proxy.id].country">{{
                      testResults[proxy.id].country
                    }}</span>
                    <span v-if="testResults[proxy.id].latency_ms"
                      >{{ testResults[proxy.id].latency_ms }}ms</span
                    >
                  </span>
                  <span
                    v-else
                    class="inline-flex flex-shrink-0 items-center rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  >
                    {{ t('admin.proxies.testFailed') }}
                  </span>
                </template>
              </div>
              <div class="truncate text-xs text-gray-500 dark:text-gray-400">
                {{ proxy.protocol }}://{{ proxy.host }}:{{ proxy.port }}
              </div>
            </div>

            <!-- Individual test button -->
            <button
              type="button"
              @click.stop="handleTestProxy(proxy)"
              :disabled="testingProxyIds.has(proxy.id)"
              class="test-btn"
              :title="t('admin.proxies.testConnection')"
            >
              <svg
                v-if="testingProxyIds.has(proxy.id)"
                class="h-3.5 w-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <Icon v-else name="play" size="xs" />
            </button>

            <Icon
              v-if="modelValue === proxy.id"
              name="check"
              size="sm"
              class="flex-shrink-0 text-primary-500"
            />
          </div>

          <!-- Empty state -->
          <div v-if="filteredProxies.length === 0 && searchQuery" class="select-empty">
            {{ t('common.noOptionsFound') }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import Icon from '@/components/icons/Icon.vue'
import type { Proxy } from '@/types'
import { useListboxKeyboard } from '@/composables/useListboxKeyboard'

const { t } = useI18n()

interface ProxyTestResult {
  success: boolean
  message: string
  latency_ms?: number
  ip_address?: string
  city?: string
  region?: string
  country?: string
}

interface Props {
  modelValue: number | null
  proxies: Proxy[]
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const focusedIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Unique ids for the WAI-ARIA combobox wiring.
const instanceId = `proxy-select-${Math.random().toString(36).substring(2, 9)}`
const listboxId = `${instanceId}-listbox`

const optionId = (value: number | null): string => {
  return `${instanceId}-option-${String(value)}`
}

const activeOptionId = computed(() => {
  if (!isOpen.value) return undefined
  if (focusedIndex.value < 0 || focusedIndex.value > filteredProxies.value.length) return undefined
  if (focusedIndex.value === 0) return optionId(null)
  const proxy = filteredProxies.value[focusedIndex.value - 1]
  return proxy ? optionId(proxy.id) : undefined
})

// Test state
const testResults = reactive<Record<number, ProxyTestResult>>({})
const testingProxyIds = reactive(new Set<number>())
const batchTesting = ref(false)

const selectedProxy = computed(() => {
  if (props.modelValue === null) return null
  return props.proxies.find((p) => p.id === props.modelValue) || null
})

const selectedLabel = computed(() => {
  if (!selectedProxy.value) {
    return t('admin.accounts.noProxy')
  }
  const proxy = selectedProxy.value
  return `${proxy.name} (${proxy.protocol}://${proxy.host}:${proxy.port})`
})

const filteredProxies = computed(() => {
  if (!searchQuery.value) {
    return props.proxies
  }
  const query = searchQuery.value.toLowerCase()
  return props.proxies.filter((proxy) => {
    const name = proxy.name.toLowerCase()
    const host = proxy.host.toLowerCase()
    return name.includes(query) || host.includes(query)
  })
})

const openDropdown = () => {
  if (props.disabled) return
  isOpen.value = true
  // Highlight the current selection (index 0 = "No Proxy").
  if (props.modelValue === null) {
    focusedIndex.value = 0
  } else {
    const idx = filteredProxies.value.findIndex((p) => p.id === props.modelValue)
    focusedIndex.value = idx >= 0 ? idx + 1 : 0
  }
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

const closeDropdown = () => {
  isOpen.value = false
  searchQuery.value = ''
  focusedIndex.value = -1
}

const toggle = () => {
  if (props.disabled) return
  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

const selectOption = (value: number | null) => {
  emit('update:modelValue', value)
  closeDropdown()
  triggerRef.value?.focus()
}

/*
 * Keyboard contract, shared with Select via useListboxKeyboard (see the
 * composable for the rationale: the handler must live on the focus-holding
 * element, not on the panel).
 */
const listboxKeyboard = useListboxKeyboard({
  isOpen,
  focusedIndex,
  open: openDropdown,
  close: closeDropdown,
  restoreFocus: () => {
    triggerRef.value?.focus()
  },
  isOptionNavigable: (index) => index >= 0 && index <= filteredProxies.value.length,
  optionCount: () => filteredProxies.value.length + 1,
  selectIndex: (index) => {
    if (index === 0) {
      selectOption(null)
    } else {
      const proxy = filteredProxies.value[index - 1]
      if (proxy) selectOption(proxy.id)
    }
  },
  scrollToFocused: () => {
    nextTick(() => {
      const list = containerRef.value?.querySelector('.select-options') as HTMLElement | null | undefined
      if (!list) return
      const focusedEl = list.children[focusedIndex.value] as HTMLElement | undefined
      if (!focusedEl) return
      if (focusedEl.offsetTop < list.scrollTop) {
        list.scrollTop = focusedEl.offsetTop
      } else if (focusedEl.offsetTop + focusedEl.offsetHeight > list.scrollTop + list.offsetHeight) {
        list.scrollTop = focusedEl.offsetTop + focusedEl.offsetHeight - list.offsetHeight
      }
    })
  },
  spaceSelects: true
})

const onKeydown = listboxKeyboard.handleKeydown

// The search input shares the contract, but Space must type into the query.
const onSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === ' ' || event.key === 'Spacebar') return
  onKeydown(event)
}

const handleTestProxy = async (proxy: Proxy) => {
  if (testingProxyIds.has(proxy.id)) return

  testingProxyIds.add(proxy.id)
  try {
    const result = await adminAPI.proxies.testProxy(proxy.id)
    testResults[proxy.id] = result
  } catch (error: any) {
    testResults[proxy.id] = {
      success: false,
      message: error.response?.data?.detail || 'Test failed'
    }
  } finally {
    testingProxyIds.delete(proxy.id)
  }
}

const handleBatchTest = async () => {
  if (batchTesting.value || props.proxies.length === 0) return

  batchTesting.value = true

  // Test all proxies in parallel
  const testPromises = props.proxies.map(async (proxy) => {
    testingProxyIds.add(proxy.id)
    try {
      const result = await adminAPI.proxies.testProxy(proxy.id)
      testResults[proxy.id] = result
    } catch (error: any) {
      testResults[proxy.id] = {
        success: false,
        message: error.response?.data?.detail || 'Test failed'
      }
    } finally {
      testingProxyIds.delete(proxy.id)
    }
  })

  await Promise.all(testPromises)
  batchTesting.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.select-trigger {
  /* 契约镜像：.input 外观（与 Select 一致） */
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--r-control);
  border: 0.5px solid var(--separator-strong);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  cursor: pointer;
  transition: box-shadow 0.18s var(--ease), border-color 0.18s var(--ease), opacity 0.18s var(--ease);
}

.select-trigger:hover {
  border-color: var(--text-tertiary);
}

.select-trigger:focus-visible {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.select-trigger-open {
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-soft);
}

.select-trigger-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.select-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
  display: inline-flex;
}

.select-dropdown {
  /* 契约镜像：不透明浮出面板 */
  position: absolute;
  z-index: 100;
  margin-top: 8px;
  width: 100%;
  background: var(--glass-bg-strong);
  border-radius: var(--r-lg);
  border: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight), var(--shadow-pop);
  overflow: hidden;
}

.select-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 0.5px solid var(--separator);
}

.select-search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
}

.select-search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--text-primary);
  font-family: inherit;
}

.select-search-input::placeholder {
  color: var(--text-tertiary);
}

.batch-test-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-pill);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}

.batch-test-btn:hover:not(:disabled) {
  background: var(--fill);
  color: var(--green);
}

.batch-test-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.select-options {
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
}

.select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  border-radius: var(--r-sm);
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s var(--ease);
}

.select-option:hover {
  background: var(--fill);
}

.select-option-focused {
  background: var(--fill-hover);
}

.select-option-selected {
  background: var(--blue-soft);
  color: var(--blue);
}

.select-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--text-tertiary);
}

.test-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r-pill);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}

.test-btn:hover:not(:disabled) {
  background: var(--fill);
  color: var(--green);
}

.test-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Dropdown animation */
.select-dropdown-enter-active,
.select-dropdown-leave-active {
  transition: opacity 0.2s var(--ease), transform 0.2s var(--ease);
}

.select-dropdown-enter-from,
.select-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
