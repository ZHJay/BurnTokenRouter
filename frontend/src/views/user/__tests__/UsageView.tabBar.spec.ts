/**
 * Behaviour spec for the usage/errors tab bar (UsageView ~164).
 *
 * Two things changed at this call site and both are pinned here.
 *
 *  1. It was hand-rolled `.tab` + `.tab-active` buttons on a `border-b` bar,
 *     which was a genuine visual mismatch: `.tab-active` paints the pill-track
 *     treatment (white `--surface` fill, `--shadow-1`, inset hairline), so a
 *     shadowed white pill floated on a bar that has no track. It now delegates
 *     to the shared `Segmented`, which brings its own track and thumb, and the
 *     `border-b` container stays as the structural divider it always was — the
 *     same shape ChannelsView and admin UsageView use.
 *  2. The bar also had NO roles at all: two bare buttons, no tablist, no
 *     aria-selected. Segmented supplies them.
 *
 * The load-bearing detail is the errors segment. Its old handler was
 * `switchToErrors`, which sets the tab AND lazily loads the error list on first
 * entry. Segmented only emits `update:modelValue`, so a mechanical `v-model`
 * migration would have kept the tab switching and silently dropped the fetch,
 * leaving an empty table. The last two tests exist to catch exactly that.
 *
 * Mocking mirrors UsageView.spec.ts, plus `cachedPublicSettings` — the bar is
 * behind `allow_user_view_error_requests` and does not render without it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import UsageView from '../UsageView.vue'

const {
  query,
  getStats,
  getDashboardModels,
  getDashboardSnapshotV2,
  listMyErrorRequests,
  list,
  getAvailable,
  showError,
  showWarning,
  showSuccess,
  showInfo,
  publicSettings,
} = vi.hoisted(() => ({
  query: vi.fn(),
  getStats: vi.fn(),
  getDashboardModels: vi.fn(),
  getDashboardSnapshotV2: vi.fn(),
  listMyErrorRequests: vi.fn(),
  list: vi.fn(),
  getAvailable: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showSuccess: vi.fn(),
  showInfo: vi.fn(),
  publicSettings: { allow_user_view_error_requests: true },
}))

vi.mock('@/api', () => ({
  usageAPI: {
    query,
    getStats,
    getDashboardModels,
    getDashboardSnapshotV2,
    listMyErrorRequests,
  },
  keysAPI: { list },
  userGroupsAPI: { getAvailable },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    showWarning,
    showSuccess,
    showInfo,
    cachedPublicSettings: publicSettings,
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const simpleStub = { template: '<div><slot /></div>' }
const chartStub = { template: '<div />' }

function mountUsageView() {
  return mount(UsageView, {
    global: {
      stubs: {
        AppLayout: simpleStub,
        Pagination: true,
        Select: true,
        DateRangePicker: true,
        Icon: true,
        UsageStatsCards: chartStub,
        UsageTable: chartStub,
        UserErrorRequestsTable: chartStub,
        ModelDistributionChart: chartStub,
        GroupDistributionChart: chartStub,
        EndpointDistributionChart: chartStub,
        TokenUsageTrend: chartStub,
      },
    },
    attachTo: document.body,
  })
}

type UsageWrapper = ReturnType<typeof mountUsageView>

function tabs(wrapper: UsageWrapper) {
  return wrapper.get('[role="tablist"]').findAll('[role="tab"]')
}

describe('user UsageView tab bar', () => {
  beforeEach(() => {
    publicSettings.allow_user_view_error_requests = true
    query.mockReset().mockResolvedValue({ items: [], total: 0, pages: 0 })
    getStats.mockReset().mockResolvedValue({
      total_requests: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cache_tokens: 0,
      total_tokens: 0,
      total_cost: 0,
      total_actual_cost: 0,
      average_duration_ms: 0,
      endpoints: [],
      upstream_endpoints: [],
      endpoint_paths: [],
    })
    getDashboardModels.mockReset().mockResolvedValue({
      models: [],
      start_date: '2026-03-08',
      end_date: '2026-03-08',
    })
    getDashboardSnapshotV2.mockReset().mockResolvedValue({
      generated_at: '2026-03-08T00:00:00Z',
      start_date: '2026-03-08',
      end_date: '2026-03-08',
      granularity: 'hour',
      trend: [],
      groups: [],
    })
    listMyErrorRequests.mockReset().mockResolvedValue({ items: [], total: 0 })
    list.mockReset().mockResolvedValue({ items: [] })
    getAvailable.mockReset().mockResolvedValue([])
    showError.mockReset()
    showWarning.mockReset()
    showSuccess.mockReset()
    showInfo.mockReset()
  })

  it('renders both tabs as Segmented items inside the border-b divider, usage selected', async () => {
    const wrapper = mountUsageView()
    await flushPromises()

    const rendered = tabs(wrapper)
    expect(rendered).toHaveLength(2)
    expect(rendered.every((tab) => tab.classes().includes('segmented-item'))).toBe(true)
    expect(rendered[0].attributes('aria-selected')).toBe('true')
    expect(rendered[1].attributes('aria-selected')).toBe('false')
    // Panel switching, not value picking, so aria-checked must not appear.
    expect(rendered.every((tab) => tab.attributes('aria-checked') === undefined)).toBe(true)
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBeTruthy()

    // The thumb is the selection indicator now, and the outer border-b stays as
    // the structural divider that wraps it — that pairing is the fix for the
    // pill-on-an-underline-bar mismatch.
    const bar = wrapper.get('[role="tablist"]')
    expect(bar.find('.segmented-thumb').exists()).toBe(true)
    expect(bar.element.parentElement?.className).toContain('border-b')

    wrapper.unmount()
  })

  it('hides the bar when error viewing is not permitted', async () => {
    publicSettings.allow_user_view_error_requests = false

    const wrapper = mountUsageView()
    await flushPromises()

    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('runs switchToErrors when the errors segment is chosen, loading the list once', async () => {
    const wrapper = mountUsageView()
    await flushPromises()
    const vm = wrapper.vm as unknown as { activeTab: string }

    expect(listMyErrorRequests).not.toHaveBeenCalled()

    await tabs(wrapper)[1].trigger('click')
    await flushPromises()

    // Both halves of switchToErrors: the tab moved AND the lazy fetch ran. A
    // plain v-model would have satisfied only the first.
    expect(vm.activeTab).toBe('errors')
    expect(tabs(wrapper)[1].attributes('aria-selected')).toBe('true')
    expect(listMyErrorRequests).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('does not re-fetch errors when returning to the tab with rows already loaded', async () => {
    listMyErrorRequests.mockResolvedValue({
      items: [{ id: 1, created_at: '2026-03-08T00:00:00Z', status_code: 500 }],
      total: 1,
    })

    const wrapper = mountUsageView()
    await flushPromises()
    const vm = wrapper.vm as unknown as { activeTab: string }

    await tabs(wrapper)[1].trigger('click')
    await flushPromises()
    expect(listMyErrorRequests).toHaveBeenCalledTimes(1)

    await tabs(wrapper)[0].trigger('click')
    await flushPromises()
    expect(vm.activeTab).toBe('usage')
    expect(tabs(wrapper)[0].attributes('aria-selected')).toBe('true')

    await tabs(wrapper)[1].trigger('click')
    await flushPromises()

    // switchToErrors only fetches when the list is empty, so coming back must
    // reuse what is already there.
    expect(vm.activeTab).toBe('errors')
    expect(listMyErrorRequests).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
