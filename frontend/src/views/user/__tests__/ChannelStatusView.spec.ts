import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ChannelStatusView from '../ChannelStatusView.vue'

const { listMock, statusMock, showError } = vi.hoisted(() => ({
  listMock: vi.fn(),
  statusMock: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

vi.mock('@/api/channelMonitor', () => ({
  list: listMock,
  status: statusMock,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    cachedPublicSettings: { channel_monitor_enabled: true },
  }),
}))

vi.mock('@/components/layout/AppLayout.vue', () => ({
  default: { name: 'AppLayout', template: '<div><slot /></div>' },
}))

vi.mock('@/components/user/MonitorDetailDialog.vue', () => ({
  default: { name: 'MonitorDetailDialog', template: '<div class="detail-dialog-stub"></div>' },
}))

vi.mock('@/components/user/monitor/MonitorCardGrid.vue', () => ({
  default: { name: 'MonitorCardGrid', template: '<div class="grid-stub"></div>' },
}))

vi.mock('@/components/user/monitor/MonitorHero.vue', () => ({
  default: {
    name: 'MonitorHero',
    props: ['overallStatus', 'intervalSeconds', 'window', 'loading', 'lastUpdatedAt', 'autoRefresh'],
    template: '<div class="hero-stub"></div>',
  },
}))

function monitorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Anthropic Primary',
    provider: 'anthropic',
    group_name: 'Anthropic Pool',
    primary_model: 'claude-sonnet-4-5',
    primary_status: 'operational',
    primary_latency_ms: 120,
    primary_ping_latency_ms: 30,
    availability_7d: 100,
    extra_models: [],
    timeline: [],
    ...overrides,
  }
}

async function mountView() {
  const wrapper = mount(ChannelStatusView)
  await flushPromises()
  return wrapper
}

describe('ChannelStatusView layout', () => {
  beforeEach(() => {
    listMock.mockReset().mockResolvedValue({ items: [monitorRow()] })
    statusMock.mockReset().mockResolvedValue({ id: 1, name: 'x', provider: 'anthropic', group_name: 'g', models: [] })
    showError.mockReset()
    localStorage.clear()
  })

  it('三个同级组件包在 space-y-4 里,不再各自贴在一起没有间距', async () => {
    const wrapper = await mountView()
    const spacer = wrapper.find('.space-y-4')
    expect(spacer.exists()).toBe(true)
    expect(spacer.find('.hero-stub').exists()).toBe(true)
    expect(spacer.find('.grid-stub').exists()).toBe(true)
    expect(spacer.find('.detail-dialog-stub').exists()).toBe(true)
  })
})

describe('ChannelStatusView last-updated', () => {
  beforeEach(() => {
    listMock.mockReset().mockResolvedValue({ items: [monitorRow()] })
    statusMock.mockReset()
    showError.mockReset()
    localStorage.clear()
  })

  it('加载成功后把时间戳传给 hero 的元信息行', async () => {
    const wrapper = await mountView()
    const hero = wrapper.findComponent({ name: 'MonitorHero' })
    expect(typeof hero.props('lastUpdatedAt')).toBe('number')
    expect(hero.props('lastUpdatedAt')).toBeGreaterThan(0)
  })

  it('加载失败时不推进时间戳(不谎称刚更新过)', async () => {
    listMock.mockReset().mockRejectedValue(new Error('boom'))
    const wrapper = await mountView()
    const hero = wrapper.findComponent({ name: 'MonitorHero' })
    expect(hero.props('lastUpdatedAt')).toBeNull()
    expect(showError).toHaveBeenCalled()
  })
})

describe('ChannelStatusView overall status', () => {
  beforeEach(() => {
    statusMock.mockReset().mockResolvedValue({ id: 1, name: 'x', provider: 'anthropic', group_name: 'g', models: [] })
    showError.mockReset()
    localStorage.clear()
  })

  it('全部正常时 operational,任一异常时 degraded —— hero 的状态磁贴据此着色', async () => {
    listMock.mockReset().mockResolvedValue({ items: [monitorRow()] })
    const ok = await mountView()
    expect(ok.findComponent({ name: 'MonitorHero' }).props('overallStatus')).toBe('operational')

    listMock.mockReset().mockResolvedValue({
      items: [monitorRow(), monitorRow({ id: 2, primary_status: 'failed' })],
    })
    const bad = await mountView()
    expect(bad.findComponent({ name: 'MonitorHero' }).props('overallStatus')).toBe('degraded')
  })
})
