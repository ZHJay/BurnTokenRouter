import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaFilterBar from '../PlazaFilterBar.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) =>
        ({
          'modelPlaza.filters.platformLabel': 'Platform',
          'modelPlaza.filters.groupLabel': 'Group',
          'modelPlaza.filters.rateLabel': 'Rate',
          'modelPlaza.filters.modelLabel': 'Model',
          'modelPlaza.filters.searchPlaceholder': 'Search models',
          'modelPlaza.filters.all': 'All',
        })[key] ?? key,
    }),
  }
})

const GROUPS = [
  { id: 1, name: 'Anthropic Pool', platform: 'anthropic', rate: 1 },
  { id: 2, name: 'OpenAI Codex Pool', platform: 'openai', rate: 0.8 },
]

function mountBar(overrides: Record<string, unknown> = {}) {
  return mount(PlazaFilterBar, {
    props: {
      platforms: ['anthropic', 'openai'],
      groups: GROUPS,
      rates: [0.8, 1],
      platform: 'all',
      groupId: 'all' as const,
      rate: 'all' as const,
      search: '',
      ...overrides,
    },
  })
}

describe('PlazaFilterBar labels', () => {
  it('不再用固定 w-10 装标签:40px 装不下 "Platform" 这类被 tracking 放大的大写文字,溢出会盖到相邻 chip 下面', () => {
    const wrapper = mountBar()
    const labels = wrapper.findAll('.stat-label')
    expect(labels).toHaveLength(4)
    for (const label of labels) {
      expect(label.classes()).not.toContain('w-10')
      // 任何固定宽度都会在下一个语言里再次裂开
      expect(label.classes().some((c) => /^w-\d/.test(c))).toBe(false)
    }
  })

  it('四个标签都渲染出完整文案', () => {
    const text = mountBar().text()
    for (const label of ['Platform', 'Group', 'Rate', 'Model']) {
      expect(text).toContain(label)
    }
  })

  it('每行窄屏纵向堆叠、sm 起横向排列,标签不再与 chip 抢同一行的水平空间', () => {
    const rows = mountBar().findAll('.card > div')
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(row.classes()).toContain('flex-col')
      expect(row.classes()).toContain('sm:flex-row')
      expect(row.classes()).toContain('sm:items-center')
    }
  })
})

describe('PlazaFilterBar surface and metrics', () => {
  it('控件放在不透明 .card 里,与 /dashboard 的时间范围行一致', () => {
    const root = mountBar().find('div')
    expect(root.classes()).toContain('card')
    expect(root.classes()).toContain('p-4')
    expect(root.classes()).toContain('space-y-3')
  })

  it('chip 统一到 36px(px-3.5 py-2),保留 rounded-lg', () => {
    const chips = mountBar().findAll('button')
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) {
      expect(chip.classes()).toContain('px-3.5')
      expect(chip.classes()).toContain('py-2')
      expect(chip.classes()).toContain('rounded-lg')
      expect(chip.classes()).not.toContain('py-1.5')
    }
  })

  it('搜索框保留 .input 并去掉 py-1.5,落回 36px 基线', () => {
    const input = mountBar().find('input')
    expect(input.classes()).toContain('input')
    expect(input.classes()).not.toContain('py-1.5')
  })

  it('保留 chip-tinted / chip-tinted-active 的平台着色', () => {
    const active = mountBar({ platform: 'anthropic' })
    const tinted = active.findAll('.chip-tinted-active')
    expect(tinted.length).toBeGreaterThan(0)
    expect(active.find('.chip-tinted').exists()).toBe(true)
  })
})

describe('PlazaFilterBar behaviour is unchanged', () => {
  it('点击平台/分组/倍率各自派发对应事件', () => {
    const wrapper = mountBar()
    const buttons = wrapper.findAll('button')

    buttons[1].trigger('click')
    expect(wrapper.emitted('update:platform')?.[0]).toEqual(['anthropic'])

    const groupBtn = buttons.find((b) => b.text() === 'Anthropic Pool')!
    groupBtn.trigger('click')
    expect(wrapper.emitted('update:groupId')?.[0]).toEqual([1])

    const rateBtn = buttons.find((b) => b.text() === '0.8x')!
    rateBtn.trigger('click')
    expect(wrapper.emitted('update:rate')?.[0]).toEqual([0.8])
  })

  it('faceted 置灰联动仍生效:选中 openai 后 anthropic 分组不可点', () => {
    const wrapper = mountBar({ platform: 'openai' })
    const anthropicGroup = wrapper.findAll('button').find((b) => b.text() === 'Anthropic Pool')!
    expect(anthropicGroup.attributes('disabled')).toBeDefined()
  })

  it('搜索输入与清空按钮仍派发 update:search', () => {
    const wrapper = mountBar({ search: 'gpt' })
    const input = wrapper.find('input')
    input.setValue('claude')
    expect(wrapper.emitted('update:search')?.[0]).toEqual(['claude'])

    const clear = wrapper.findAll('button').at(-1)!
    clear.trigger('click')
    expect(wrapper.emitted('update:search')?.at(-1)).toEqual([''])
  })
})
