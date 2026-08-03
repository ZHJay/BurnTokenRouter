import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MonitorCardGrid from '../MonitorCardGrid.vue'
import type { UserMonitorView } from '@/api/channelMonitor'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

function view(overrides: Partial<UserMonitorView> = {}): UserMonitorView {
  return {
    id: 1,
    name: 'Anthropic Primary',
    provider: 'anthropic',
    group_name: 'Anthropic Pool',
    primary_model: 'claude-sonnet-4-5',
    primary_status: 'operational',
    primary_latency_ms: 148,
    primary_ping_latency_ms: 32,
    availability_7d: 99.95,
    extra_models: [],
    timeline: [],
    ...overrides,
  } as UserMonitorView
}

function mountGrid(props: Partial<InstanceType<typeof MonitorCardGrid>['$props']> = {}) {
  return mount(MonitorCardGrid, {
    props: {
      items: [],
      window: '7d' as const,
      countdownSeconds: 30,
      loading: false,
      detailCache: {},
      ...props,
    },
  })
}

describe('MonitorCardGrid spacing', () => {
  it('实际网格用 gap-4(16px),与 .grid-4 / .grid-chart 的原型值一致', () => {
    const grid = mountGrid({ items: [view()] }).find('.grid')
    expect(grid.classes()).toContain('gap-4')
    expect(grid.classes()).not.toContain('gap-5')
  })

  it('骨架屏与实际网格用同一 gap,加载完成不会发生位移', () => {
    const grid = mountGrid({ loading: true }).find('.grid')
    expect(grid.classes()).toContain('gap-4')
    expect(grid.classes()).not.toContain('gap-5')
  })

  it('列数保持不变', () => {
    const grid = mountGrid({ items: [view()] }).find('.grid')
    for (const cls of ['grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-3', '2xl:grid-cols-4']) {
      expect(grid.classes()).toContain(cls)
    }
  })
})

describe('MonitorCardGrid empty state', () => {
  it('空状态包在 .card 里,不再浮在裸背景上', () => {
    const wrapper = mountGrid({ items: [], loading: false })
    const card = wrapper.find('.card')
    expect(card.exists()).toBe(true)
    expect(card.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('channelStatus.empty.title')
  })

  it('有数据时不渲染空状态', () => {
    const wrapper = mountGrid({ items: [view()] })
    expect(wrapper.find('.empty-state').exists()).toBe(false)
  })
})
