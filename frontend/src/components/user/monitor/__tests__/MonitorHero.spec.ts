import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MonitorHero, { type MonitorWindow, type OverallStatus } from '../MonitorHero.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        if (key === 'channelStatus.title') return 'Channel Status'
        if (key === 'monitorCommon.pollEvery') return `${params?.n}s polling`
        if (key === 'monitorCommon.updatedAt') return `Updated ${params?.time}`
        return key
      },
    }),
  }
})

function mountHero(
  overrides: Partial<{
    overallStatus: OverallStatus
    window: MonitorWindow
    loading: boolean
    intervalSeconds: number
    lastUpdatedAt: number | null
  }> = {},
) {
  return mount(MonitorHero, {
    props: {
      overallStatus: 'operational' as OverallStatus,
      intervalSeconds: 300,
      window: '7d' as MonitorWindow,
      loading: false,
      ...overrides,
    },
  })
}

describe('MonitorHero surface', () => {
  it('是不透明 .card 而非玻璃:控制行随内容滚动,玻璃只留给内容穿过其下的 chrome', () => {
    const root = mountHero().find('section')
    expect(root.classes()).toContain('card')
    expect(root.classes()).toContain('p-4')
    expect(root.classes().some((c) => c.startsWith('glass') || c === 'card-glass')).toBe(false)
  })

  it('两端对齐而非全部右推:左侧主体 + 右侧控件', () => {
    const row = mountHero().find('section > div')
    expect(row.classes()).toContain('justify-between')
    expect(row.classes()).not.toContain('justify-end')
  })
})

describe('MonitorHero left cluster', () => {
  it('渲染标题与元信息,让这一行有主体', () => {
    const wrapper = mountHero({ intervalSeconds: 300 })
    expect(wrapper.find('.stat-label').text()).toBe('Channel Status')
    expect(wrapper.text()).toContain('300s polling')
  })

  it('状态磁贴按状态着色:正常 success,降级 warning', () => {
    const ok = mountHero({ overallStatus: 'operational' }).find('.stat-icon')
    expect(ok.classes()).toContain('stat-icon-success')
    expect(ok.classes()).toContain('h-8')
    expect(ok.classes()).toContain('w-8')

    const bad = mountHero({ overallStatus: 'degraded' }).find('.stat-icon')
    expect(bad.classes()).toContain('stat-icon-warning')
  })

  it('有 lastUpdatedAt 时元信息带上更新时刻,没有时只显示轮询间隔', () => {
    const withTs = mountHero({ lastUpdatedAt: Date.parse('2026-08-03T04:05:06Z') })
    expect(withTs.text()).toContain('Updated')
    expect(withTs.text()).toContain('300s polling')

    const without = mountHero({ lastUpdatedAt: null })
    expect(without.text()).not.toContain('Updated')
    expect(without.text()).toContain('300s polling')
  })
})

describe('MonitorHero controls', () => {
  it('刷新按钮用 btn-secondary(不透明卡片上 ghost 没有可点提示),尺寸交给 btn-icon 的 36px', () => {
    const btn = mountHero()
      .findAll('button')
      .find((b) => b.classes().includes('btn-icon'))!
    expect(btn.classes()).toContain('btn')
    expect(btn.classes()).toContain('btn-secondary')
    expect(btn.classes()).not.toContain('btn-ghost')
    expect(btn.classes()).not.toContain('h-8')
    expect(btn.classes()).not.toContain('w-8')
  })

  it('保留 radiogroup 语义与切换事件', () => {
    const wrapper = mountHero({ window: '7d' })
    const group = wrapper.find('[role="radiogroup"]')
    expect(group.exists()).toBe(true)

    const radios = group.findAll('[role="radio"]')
    expect(radios).toHaveLength(3)
    expect(radios[0].attributes('aria-checked')).toBe('true')

    radios[2].trigger('click')
    expect(wrapper.emitted('update:window')?.[0]).toEqual(['30d'])
  })

  it('刷新按钮可派发 refresh,loading 时禁用', () => {
    const wrapper = mountHero()
    const btn = wrapper.findAll('button').find((b) => b.classes().includes('btn-icon'))!
    btn.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)

    const busy = mountHero({ loading: true })
    const busyBtn = busy.findAll('button').find((b) => b.classes().includes('btn-icon'))!
    expect(busyBtn.attributes('disabled')).toBeDefined()
  })
})
