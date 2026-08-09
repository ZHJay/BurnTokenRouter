import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ChannelsView from '@/views/admin/ChannelsView.vue'
import GroupsView from '@/views/admin/GroupsView.vue'
import ProxiesView from '@/views/admin/ProxiesView.vue'

const {
  channelsList,
  groupsList,
  groupsGetAll,
  liveCapability,
  modelsCandidates,
  usageSummary,
  capacitySummary,
  proxiesList,
  proxiesGetAllWithCount,
  webSearchConfig,
} = vi.hoisted(() => ({
  channelsList: vi.fn(),
  groupsList: vi.fn(),
  groupsGetAll: vi.fn(),
  liveCapability: vi.fn(),
  modelsCandidates: vi.fn(),
  usageSummary: vi.fn(),
  capacitySummary: vi.fn(),
  proxiesList: vi.fn(),
  proxiesGetAllWithCount: vi.fn(),
  webSearchConfig: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    channels: {
      list: channelsList,
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      syncPricingModels: vi.fn(),
    },
    groups: {
      list: groupsList,
      getAll: groupsGetAll,
      getLiveCapability: liveCapability,
      getModelsListCandidates: modelsCandidates,
      getUsageSummary: usageSummary,
      getCapacitySummary: capacitySummary,
      duplicate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateSortOrder: vi.fn(),
    },
    settings: {
      getWebSearchEmulationConfig: webSearchConfig,
    },
    proxies: {
      list: proxiesList,
      getAllWithCount: proxiesGetAllWithCount,
    },
    accounts: {
      list: vi.fn(),
      getById: vi.fn(),
    },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    isCurrentStep: vi.fn(() => false),
    nextStep: vi.fn(),
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const AppLayoutStub = defineComponent({
  template: '<main><slot /></main>',
})

const TablePageLayoutStub = defineComponent({
  template:
    '<section><slot name="filters" /><slot name="table" /><slot name="pagination" /><slot /></section>',
})

const DataTableStub = defineComponent({
  props: {
    data: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  template:
    '<div><div v-for="row in data" :key="row.id"><slot name="cell-actions" :row="row" /></div></div>',
})

// VTU 的 stub:true 不渲染 default slot（<base-dialog-stub> 为空），
// 而表单 Select 在对话框内容里 —— 需要透传 slot 的桩才能断言「表单 Select 不带 filter 类」。
const BaseDialogStub = defineComponent({
  props: { show: { type: Boolean, default: false } },
  template: '<div v-if="show"><slot /></div>',
})

const COMMON_STUBS = {
  AppLayout: AppLayoutStub,
  TablePageLayout: TablePageLayoutStub,
  DataTable: DataTableStub,
  Pagination: true,
  BaseDialog: BaseDialogStub,
  ConfirmDialog: true,
  EmptyState: true,
  Icon: true,
  PlatformIcon: true,
  Toggle: true,
}

function mountChannels() {
  return mount(ChannelsView, {
    global: {
      stubs: {
        ...COMMON_STUBS,
        PricingEntryCard: true,
      },
    },
  })
}

function mountProxies() {
  return mount(ProxiesView, {
    global: {
      stubs: {
        ...COMMON_STUBS,
        ImportDataModal: true,
        ProxyAdBanner: true,
        PlatformTypeBadge: true,
      },
    },
  })
}

function mountGroups() {
  return mount(GroupsView, {
    global: {
      stubs: {
        ...COMMON_STUBS,
        GroupCapacityBadge: true,
        GroupRateMultipliersModal: true,
        GroupRPMOverridesModal: true,
        VueDraggable: true,
      },
    },
  })
}

describe('筛选栏 Select 使用 variant="filter"（36px 家族，与同排 SearchInput/.search 对齐）', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const fn of [
      channelsList,
      groupsList,
      groupsGetAll,
      liveCapability,
      modelsCandidates,
      usageSummary,
      capacitySummary,
      proxiesList,
      proxiesGetAllWithCount,
      webSearchConfig,
    ]) {
      fn.mockReset()
    }
    channelsList.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
    groupsList.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
    groupsGetAll.mockResolvedValue([])
    liveCapability.mockResolvedValue({ supported: false })
    modelsCandidates.mockResolvedValue([])
    usageSummary.mockResolvedValue([])
    capacitySummary.mockResolvedValue([])
    proxiesList.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
    proxiesGetAllWithCount.mockResolvedValue([])
    webSearchConfig.mockResolvedValue({ enabled: false, providers: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ChannelsView 筛选栏 Select 带 filter 类；表单内 Select 保持默认 44px（不带 filter 类）', async () => {
    const wrapper = mountChannels()
    await flushPromises()

    const filterTriggers = wrapper.find('.toolbar').findAll('.select-trigger')
    expect(filterTriggers.length).toBeGreaterThanOrEqual(1)
    for (const trigger of filterTriggers) {
      expect(trigger.classes()).toContain('select-trigger-filter')
    }

    await wrapper.get('.btn-primary').trigger('click') // open create dialog
    await flushPromises()
    const formTriggers = wrapper
      .findAll('.select-trigger')
      .filter((t) => !t.classes().includes('select-trigger-filter'))
    expect(formTriggers.length).toBeGreaterThanOrEqual(1)
    expect(formTriggers[0].classes()).toContain('select-trigger')
    wrapper.unmount()
  })

  it('ProxiesView 两个筛选栏 Select 都带 filter 类；创建表单内 Select 保持默认', async () => {
    const wrapper = mountProxies()
    await flushPromises()

    const filterTriggers = wrapper.find('.toolbar').findAll('.select-trigger')
    expect(filterTriggers).toHaveLength(2)
    for (const trigger of filterTriggers) {
      expect(trigger.classes()).toContain('select-trigger-filter')
    }

    await wrapper.get('.btn-primary').trigger('click') // open create dialog
    await flushPromises()
    const formTriggers = wrapper
      .findAll('.select-trigger')
      .filter((t) => !t.classes().includes('select-trigger-filter'))
    expect(formTriggers.length).toBeGreaterThanOrEqual(1)
    expect(formTriggers[0].classes()).toContain('select-trigger')
    wrapper.unmount()
  })

  it('GroupsView 三个筛选栏 Select 都带 filter 类', async () => {
    const wrapper = mountGroups()
    await flushPromises()

    const filterTriggers = wrapper.find('.toolbar').findAll('.select-trigger')
    expect(filterTriggers).toHaveLength(3)
    for (const trigger of filterTriggers) {
      expect(trigger.classes()).toContain('select-trigger-filter')
    }
    wrapper.unmount()
  })
})
