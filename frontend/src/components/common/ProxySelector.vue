<template>
  <div class="relative" ref="containerRef">
    <button
      type="button"
      @click="toggle"
      :disabled="disabled"
      :class="[
        'select-trigger',
        isOpen && 'select-trigger-open',
        disabled && 'select-trigger-disabled'
      ]"
    >
      <span class="select-value">
        {{ selectedLabel }}
      </span>
      <span class="select-icon">
        <Icon
          name="chevronDown"
          size="md"
          :class="['transition-transform duration-fast ease-apple-out', isOpen && 'rotate-180']"
        />
      </span>
    </button>

    <Transition name="select-dropdown">
      <div v-if="isOpen" class="select-dropdown">
        <!-- Search and Batch Test Header -->
        <div class="select-header">
          <div class="select-search">
            <Icon name="search" size="sm" class="text-gray-400" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              :placeholder="t('admin.proxies.searchProxies')"
              class="select-search-input"
              @click.stop
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
            @click="selectOption(null)"
            :class="['select-option', modelValue === null && 'select-option-selected']"
          >
            <span class="select-option-label">{{ t('admin.accounts.noProxy') }}</span>
            <Icon v-if="modelValue === null" name="check" size="sm" class="text-primary-500" />
          </div>

          <!-- Proxy options -->
          <div
            v-for="proxy in filteredProxies"
            :key="proxy.id"
            @click="selectOption(proxy.id)"
            :class="['select-option', modelValue === proxy.id && 'select-option-selected']"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">{{ proxy.name }}</span>
                <!-- Account count badge -->
                <span
                  v-if="proxy.account_count !== undefined"
                  class="badge badge-gray tabular flex-shrink-0 px-1.5"
                >
                  {{ proxy.account_count }}
                </span>
                <!-- Test result badges -->
                <template v-if="testResults[proxy.id]">
                  <span
                    v-if="testResults[proxy.id].success"
                    class="badge badge-success tabular flex-shrink-0 px-1.5"
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
                    class="badge badge-danger flex-shrink-0 px-1.5"
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
const containerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

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

const toggle = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
}

const selectOption = (value: number | null) => {
  emit('update:modelValue', value)
  isOpen.value = false
  searchQuery.value = ''
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
    isOpen.value = false
    searchQuery.value = ''
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
    searchQuery.value = ''
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
/* 触发器读作 input：不透明表面 + 内嵌发丝线，聚焦时 accent 环 */
.select-trigger {
  @apply flex w-full items-center justify-between gap-2;
  @apply cursor-pointer rounded-lg px-4 py-2.5 text-sm;
  background-color: var(--surface-secondary);
  color: var(--label);
  border: 0;
  box-shadow: inset 0 0 0 1px var(--separator);
  letter-spacing: -0.006em;
  transition:
    box-shadow 240ms var(--ease-out),
    background-color 240ms var(--ease-out);
}

.select-trigger:hover:not(:disabled) {
  box-shadow: inset 0 0 0 1px var(--label-quaternary);
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

.select-trigger-disabled {
  @apply cursor-not-allowed opacity-60;
}

.select-value {
  @apply flex-1 truncate text-left;
}

.select-icon {
  @apply flex-shrink-0 text-gray-400 dark:text-dark-400;
}

/* 弹层：短暂出现的浮层走 thin 材质 + 四层玻璃边缘 */
.select-dropdown {
  @apply absolute z-[100] mt-2 w-full;
  @apply overflow-hidden rounded-xl;
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

.select-header {
  @apply flex items-center gap-2 px-3 py-2;
  border: 0;
  box-shadow: inset 0 -0.5px 0 var(--separator);
}

.select-search {
  @apply flex flex-1 items-center gap-2;
}

.select-search-input {
  @apply flex-1 bg-transparent text-sm;
  @apply focus:outline-none;
  color: var(--label);
}

.select-search-input::placeholder {
  color: var(--label-tertiary);
}

.batch-test-btn {
  @apply flex-shrink-0 rounded-full p-1.5;
  @apply text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400;
  @apply hover:bg-emerald-50 dark:hover:bg-emerald-900/20;
  @apply transition-colors duration-fast ease-apple-out active:scale-[0.96];
  @apply disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100;
}

.select-options {
  @apply max-h-60 overflow-y-auto py-1;
}

.select-option {
  @apply flex items-center justify-between gap-2;
  @apply px-4 py-2.5 text-sm;
  @apply cursor-pointer;
  color: var(--label);
  transition: background-color 100ms var(--ease-out);
}

.select-option:hover {
  background-color: var(--surface-hover);
}

.select-option-selected {
  background-color: var(--surface-selected);
  color: var(--accent);
}

.select-option-label {
  @apply truncate;
}

.select-empty {
  @apply px-4 py-8 text-center text-sm;
  color: var(--label-secondary);
}

.test-btn {
  @apply flex-shrink-0 rounded-full p-1;
  @apply text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400;
  @apply hover:bg-emerald-50 dark:hover:bg-emerald-900/20;
  @apply transition-colors duration-fast ease-apple-out active:scale-[0.96];
  @apply disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100;
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

/* 为什么需要这个本地块：style.css 的减弱动效分支用
   `[class*='active:scale']:active` 匹配 class 属性，只在模板里裸写工具类时生效。
   这两个按钮的按压缩放是 `@apply active:scale-[0.96]`，编译后落在
   `.batch-test-btn:active` 上，元素的 class 属性里没有 `active:scale` 这个串，
   全局那条匹配不到 —— 已用 compileStyleAsync + 本仓 tailwind 配置编译核对。

   补的是全局规则的形状，不是 SettingsView / CustomPageView 的形状：全局那条把
   scale-kill 与 filter: brightness(0.94) 成对使用（style.css:1718），这里沿用同
   一个配对与同一个值，不新造颜色。与本仓另外两种形状的差别是有意的，不要照着它们
   改这里：
   - SettingsView:12202 / :12355 与 CustomPageView:488 只写 transform: none，
     不带 brightness；
   - .btn 的按压缩放同样来自 @apply（style.css:386）、同样躲开上面那个属性选择器，
     它落在 style.css:1734 的 `transform: none !important`，也不带 brightness。
   即减弱动效下的按压反馈在本仓共有三种形状，这里取带 brightness 的那一种。

   为什么这里要带 brightness：这两个按钮除缩放外只有 hover 反馈，而 hover 在触屏上
   不触发，缩放是唯一的按压通道，去掉后必须补一个不引发前庭反应的替代通道。

   不动 transition-property：这两处走的是 `transition-colors`，编译产物为
   color/background-color/border-color/text-decoration-color/fill/stroke，
   本就不含 transform；写一行收窄只会顺手删掉 fill/stroke 过渡。

   `:not(:disabled)` 是这两处独有的：禁用按钮实测仍然匹配 :active，而上面两条 @apply
   显式写了 `disabled:active:scale-100`，即禁用态本就不给按压反馈；brightness 是按压
   反馈的替代通道，禁用态补上就等于凭空造出一个「按下去有反应」的假象。
   判据是有没有那条 `disabled:active:scale-100`，不是有没有禁用态：GroupsView 的
   .row-action 带禁用态（GroupsView:376 的 :disabled + disabled:opacity-50）却没写它，
   禁用态照样吃 active:scale-[0.96]，那边补 brightness 只是平移既有反馈，故不需要这
   一层；.toc-toggle-btn / .settings-tab 连禁用态都没有。 */
@media (prefers-reduced-motion: reduce) {
  .batch-test-btn:active:not(:disabled),
  .test-btn:active:not(:disabled) {
    transform: none;
    filter: brightness(0.94);
  }
}
</style>
