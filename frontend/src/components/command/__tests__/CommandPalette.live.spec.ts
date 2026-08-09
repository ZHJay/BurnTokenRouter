/**
 * Command palette result-count live region (fix_cmdk A/B).
 *
 * Separate spec file with its own i18n mock so the announcement texts can be
 * asserted verbatim, including `nav.searchResultCount` ({count} interpolation)
 * — the key requested from root in the fix_cmdk handoff. The main
 * CommandPalette.spec.ts keeps resolving against the real zh locale.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import CommandPalette from '@/components/command/CommandPalette.vue'
import { resetBodyScrollLock } from '@/composables/useCommandPalette'
import type { CommandEntry } from '@/components/layout/navItems'

const messages: Record<string, string> = {
  'common.close': '关闭',
  'nav.commandPalette': '命令面板',
  'nav.search': '搜索',
  'nav.searchPlaceholder': '搜索页面、功能、文档…',
  'nav.searchNoResults': '未找到匹配的页面',
  'nav.searchResults': '搜索结果',
  'nav.searchResultCount': '找到 {count} 条结果',
  'nav.commandGroupPages': '页面',
  'nav.commandGroupAccount': '我的账户',
  'nav.commandHintSelect': '选择',
  'nav.commandHintOpen': '打开',
  'nav.commandHintClose': '关闭',
}

vi.mock('vue-i18n', () => {
  const t = (key: string, params?: Record<string, string | number>): string => {
    const template = messages[key] ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
  }
  return { useI18n: () => ({ t }) }
})

function entry(path: string, label: string, group = 'pages'): CommandEntry {
  return {
    path,
    label,
    groupKey: group,
    groupLabelKey: group === 'pages' ? 'nav.commandGroupPages' : 'nav.commandGroupAccount',
  }
}

const ENTRIES: CommandEntry[] = [
  entry('/admin/dashboard', '仪表盘'),
  entry('/admin/users', '用户管理'),
  entry('/admin/usage', '使用记录'),
  entry('/admin/channels/monitor', 'Channel Monitor'),
  entry('/keys', 'API 密钥', 'account'),
  entry('/profile', '个人资料', 'account'),
]

const Harness = defineComponent({
  name: 'PaletteLiveHarness',
  components: { CommandPalette },
  props: {
    entries: { type: Array as () => CommandEntry[], default: () => ENTRIES },
  },
  setup(props) {
    const open = ref(false)
    return { open, props }
  },
  template: `
    <div>
      <button class="outside-trigger" @click="open = true">open</button>
      <CommandPalette v-model:open="open" :entries="props.entries" />
    </div>
  `,
})

function mountPalette(entries: CommandEntry[] = ENTRIES) {
  return mount(Harness, { props: { entries }, attachTo: document.body })
}

const liveRegion = (wrapper: VueWrapper) => wrapper.find('.gn-cmdk-live')
const emptyState = (wrapper: VueWrapper) => wrapper.find('.gn-cmdk-empty')
const input = (wrapper: VueWrapper) => wrapper.find('input[role="combobox"]')

async function openPalette(wrapper: VueWrapper) {
  await wrapper.find('.outside-trigger').trigger('click')
  await nextTick()
}

let mounted: VueWrapper[] = []

beforeEach(() => {
  resetBodyScrollLock()
  mounted = []
})

afterEach(() => {
  for (const wrapper of mounted) wrapper.unmount()
  resetBodyScrollLock()
})

describe('CommandPalette — result-count live region', () => {
  it('mounts a polite status region that stays silent on open', async () => {
    const wrapper = mountPalette()
    mounted.push(wrapper)
    await openPalette(wrapper)

    const live = liveRegion(wrapper)
    expect(live.exists()).toBe(true)
    expect(live.attributes('role')).toBe('status')
    expect(live.attributes('aria-live')).toBe('polite')
    // Opening with an empty query must not announce anything.
    expect(live.text()).toBe('')
  })

  it('announces the result count and updates it as the count changes', async () => {
    const wrapper = mountPalette()
    mounted.push(wrapper)
    await openPalette(wrapper)

    await input(wrapper).setValue('用户')
    await nextTick()
    expect(liveRegion(wrapper).text()).toBe('找到 1 条结果')

    await input(wrapper).setValue('用')
    await nextTick()
    expect(liveRegion(wrapper).text()).toBe('找到 2 条结果')
  })

  it('does not re-announce while the count is unchanged', async () => {
    // Paths have no letters in common with the queries, so the counts below
    // are exact: 'g' -> Gamma only, 'ga' -> Gamma only.
    const customEntries = [
      entry('/x1', 'Alpha'),
      entry('/x2', 'Beta'),
      entry('/x3', 'Gamma'),
    ]
    const wrapper = mountPalette(customEntries)
    mounted.push(wrapper)
    await openPalette(wrapper)

    await input(wrapper).setValue('g')
    await nextTick()
    const first = liveRegion(wrapper).text()
    expect(first).toBe('找到 1 条结果')

    // Typing more characters that keep the same result set: same count, so
    // the region content must not change (identical text is never
    // re-announced by screen readers).
    await input(wrapper).setValue('ga')
    await nextTick()
    expect(liveRegion(wrapper).text()).toBe(first)
    expect(input(wrapper).element.getAttribute('aria-expanded')).toBe('true')
  })

  it('announces no-results through the role=status empty state', async () => {
    const wrapper = mountPalette()
    mounted.push(wrapper)
    await openPalette(wrapper)

    await input(wrapper).setValue('zzzzz')
    await nextTick()

    expect(liveRegion(wrapper).text()).toBe('')
    const empty = emptyState(wrapper)
    expect(empty.exists()).toBe(true)
    expect(empty.attributes('role')).toBe('status')
    expect(empty.text()).toBe('未找到匹配的页面')
  })

  it('keeps aria-expanded=true while the panel is open with zero results', async () => {
    const wrapper = mountPalette()
    mounted.push(wrapper)
    await openPalette(wrapper)

    expect(input(wrapper).element.getAttribute('aria-expanded')).toBe('true')
    await input(wrapper).setValue('zzzzz')
    await nextTick()
    // The listbox is still open (showing the no-results state) — expanded
    // must reflect panel visibility, not the result count.
    expect(emptyState(wrapper).exists()).toBe(true)
    expect(input(wrapper).element.getAttribute('aria-expanded')).toBe('true')
  })
})
