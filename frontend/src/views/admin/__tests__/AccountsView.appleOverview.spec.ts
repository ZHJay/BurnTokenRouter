import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import AccountsView from '../AccountsView.vue'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AccountsView.vue')
const componentSource = readFileSync(componentPath, 'utf8')

const {
  listAccounts,
  listWithEtag,
  getBatchTodayStats,
  getAllProxies,
  getAllGroups
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listWithEtag: vi.fn(),
  getBatchTodayStats: vi.fn(),
  getAllProxies: vi.fn(),
  getAllGroups: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      listWithEtag,
      getBatchTodayStats,
      getUpstreamBillingProbeSettings: vi.fn().mockResolvedValue({
        enabled: true,
        interval_minutes: 30
      }),
      delete: vi.fn(),
      batchClearError: vi.fn(),
      batchRefresh: vi.fn(),
      toggleSchedulable: vi.fn()
    },
    proxies: { getAll: getAllProxies },
    groups: { getAll: getAllGroups }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn()
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'test-token',
    isSimpleMode: false
  })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params?.count == null ? key : `${key}:${String(params.count)}`
    })
  }
})

const baseAccount = {
  platform: 'openai',
  type: 'oauth',
  concurrency: 1,
  priority: 0,
  error_message: null,
  last_used_at: null,
  expires_at: null,
  auto_pause_on_expired: false,
  rate_limited_at: null,
  rate_limit_reset_at: null,
  overload_until: null,
  temp_unschedulable_until: null,
  temp_unschedulable_reason: null,
  session_window_start: null,
  session_window_end: null,
  session_window_status: null,
  created_at: '2026-07-23T00:00:00Z',
  updated_at: '2026-07-23T00:00:00Z'
}

function mountView() {
  return mount(AccountsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: {
          template:
            '<div><slot name="actions" /><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>'
        },
        DataTable: { template: '<div data-test="data-table"></div>' },
        HelpTooltip: true,
        Pagination: true,
        ConfirmDialog: true,
        AccountTableActions: { template: '<div><slot name="after" /></div>' },
        AccountTableFilters: true,
        AccountBulkActionsBar: true,
        AccountActionMenu: true,
        ImportDataModal: true,
        ReAuthAccountModal: true,
        AccountTestModal: true,
        AccountStatsModal: true,
        ScheduledTestsPanel: true,
        SyncFromCrsModal: true,
        TempUnschedStatusModal: true,
        ErrorPassthroughRulesModal: true,
        TLSFingerprintProfilesModal: true,
        CreateAccountModal: true,
        EditAccountModal: true,
        BulkEditAccountModal: true,
        PlatformTypeBadge: true,
        AccountCapacityCell: true,
        AccountStatusIndicator: true,
        AccountTodayStatsCell: true,
        AccountGroupsCell: true,
        AccountUsageCell: true,
        UpstreamBillingRateCell: true,
        Icon: { template: '<span />' }
      }
    }
  })
}

describe('admin AccountsView Apple overview', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()

    listAccounts.mockReset()
    listWithEtag.mockReset()
    getBatchTodayStats.mockReset()
    getAllProxies.mockReset()
    getAllGroups.mockReset()

    listAccounts.mockResolvedValue({
      items: [
        { ...baseAccount, id: 1, name: 'healthy', status: 'active', schedulable: true },
        {
          ...baseAccount,
          id: 2,
          name: 'rate-limited',
          status: 'active',
          // Configuration remains enabled, but a future reset means this
          // account is not currently schedulable.
          schedulable: true,
          rate_limited_at: '2026-07-23T01:00:00Z',
          rate_limit_reset_at: '2099-07-23T02:00:00Z'
        },
        { ...baseAccount, id: 3, name: 'errored', status: 'error', schedulable: false },
        { ...baseAccount, id: 4, name: 'paused', status: 'inactive', schedulable: false }
      ],
      total: 248,
      page: 1,
      page_size: 20,
      pages: 13
    })
    listWithEtag.mockResolvedValue({ notModified: true, etag: null, data: null })
    getBatchTodayStats.mockResolvedValue({ stats: {} })
    getAllProxies.mockResolvedValue([])
    getAllGroups.mockResolvedValue([])
  })

  it('renders global total plus page-scoped scheduling health metrics', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('[data-test="account-overview-card"]')).toHaveLength(4)
    expect(wrapper.get('[data-test="account-overview-total"] [data-test="value"]').text()).toBe('248')
    expect(wrapper.get('[data-test="account-overview-schedulable"] [data-test="value"]').text()).toBe('1')
    expect(wrapper.get('[data-test="account-overview-limited"] [data-test="value"]').text()).toBe('1')
    expect(wrapper.get('[data-test="account-overview-error"] [data-test="value"]').text()).toBe('1')

    expect(wrapper.findAll('[data-test="account-overview-page-scope"]')).toHaveLength(3)
  })

  it('keeps all four overview metrics in a compact two-column mobile grid', () => {
    const overviewGridBlock =
      componentSource.match(/\.account-overview-grid\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

    expect(overviewGridBlock).toContain('@apply grid grid-cols-2')
    expect(overviewGridBlock).toContain('xl:grid-cols-4')
    expect(overviewGridBlock).not.toContain('grid-cols-1')
  })

  it('keeps the core reference columns visible in the default account table', () => {
    const hiddenColumnsMatch = componentSource.match(
      /const DEFAULT_HIDDEN_COLUMNS = \[([^\]]*)\]/
    )
    const hiddenColumns = hiddenColumnsMatch?.[1] ?? ''

    expect(hiddenColumns).not.toContain("'today_stats'")
    expect(hiddenColumns).not.toContain("'proxy'")
    expect(hiddenColumns).not.toContain("'priority'")
    expect(hiddenColumns).not.toContain("'rate_multiplier'")
    expect(hiddenColumns).toContain("'id'")
    expect(hiddenColumns).toContain("'scheduler_score'")
  })

  it('keeps the neutral OpenAI compact-auto state out of the dense default row', () => {
    expect(componentSource).toContain(
      'getOpenAICompactMeta(row) && getOpenAICompactState(row) !== \'auto\''
    )
  })

  it('migrates existing saved layouts to the reference core columns once', () => {
    expect(componentSource).toContain("const APPLE_REFERENCE_VISIBLE_COLUMNS = ['today_stats', 'proxy', 'priority', 'rate_multiplier']")
    expect(componentSource).toContain('APPLE_REFERENCE_VISIBLE_COLUMNS.forEach(key => hiddenColumns.delete(key))')
  })

  it('locks the accepted desktop overview height and asymmetric section rhythm', () => {
    const cardBlock = componentSource.match(/\.account-overview-card\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

    expect(cardBlock).toContain('min-height: 10.375rem')
    expect(componentSource).toContain(
      '.accounts-page-layout :deep(.layout-section-fixed:first-child)'
    )
    expect(componentSource).toContain('margin-bottom: 0.375rem')
  })

  it('exposes the accepted platform segmented control without removing advanced filters', () => {
    expect(componentSource).toContain('data-test="account-platform-segmented"')
    expect(componentSource).toContain('v-for="platform in platformSegments"')
    expect(componentSource).toContain('selectPlatformSegment(platform.value)')
  })
})
