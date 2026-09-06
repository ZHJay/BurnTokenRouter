import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BatchImageGuideView from '@/views/user/BatchImageGuideView.vue'

const { keysList, listBatchImageJobs, listBatchImageModels, fetchPublicSettings } = vi.hoisted(
  () => ({
    keysList: vi.fn(),
    listBatchImageJobs: vi.fn(),
    listBatchImageModels: vi.fn(),
    fetchPublicSettings: vi.fn(),
  }),
)

vi.mock('@/api', () => ({
  keysAPI: { list: keysList },
}))

vi.mock('@/api/batchImage', () => ({
  listBatchImageJobs,
  listBatchImageModels,
  cancelBatchImageJob: vi.fn(),
  deleteBatchImageJobRecord: vi.fn(),
  downloadBatchImageZip: vi.fn(),
  getBatchImageItemContent: vi.fn(),
  getBatchImageJob: vi.fn(),
  listBatchImageItems: vi.fn(),
  saveBlob: vi.fn(),
  submitBatchImageJob: vi.fn(),
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    fetchPublicSettings,
    showSuccess: vi.fn(),
    showError: vi.fn(),
    apiBaseUrl: '',
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: { value: 'zh-CN' } }),
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
  template: '<div />',
})

const keyRow = {
  id: 1,
  key: 'sk-test-1',
  name: 'K1',
  status: 'active',
  group: { platform: 'gemini', allow_batch_image_generation: true },
}

const jobRow = {
  id: 101,
  task_name: 'job-101',
  parent_batch_id: null,
  status: 'pending',
  model: 'gpt-4o',
  provider: 'openai',
  item_count: 1,
  success_count: 0,
  fail_count: 0,
  estimated_cost: '0',
  hold_amount: '0',
  actual_cost: null,
  created_at: '2026-08-09T00:00:00Z',
  downloaded_at: null,
}

describe('BatchImageGuideView 筛选栏 Select', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const fn of [keysList, listBatchImageJobs, listBatchImageModels, fetchPublicSettings]) {
      fn.mockReset()
    }
    keysList.mockResolvedValue({ items: [keyRow], total: 1, page: 1, page_size: 100, pages: 1 })
    listBatchImageJobs.mockResolvedValue({ has_more: false, data: [jobRow] })
    listBatchImageModels.mockResolvedValue([])
    fetchPublicSettings.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('筛选栏 3 个 Select（apiKey/status/downloaded）都带 variant="filter"，与 36px SearchInput 同族', async () => {
    const wrapper = mount(BatchImageGuideView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          TablePageLayout: TablePageLayoutStub,
          DataTable: DataTableStub,
          BaseDialog: true,
        },
      },
    })
    await flushPromises()

    const filterTriggers = wrapper
      .findAll('.select-trigger')
      .filter((t) => t.classes().includes('select-trigger-filter'))
    expect(filterTriggers).toHaveLength(3)

    // 分页「每页条数」Select 不是筛选栏控件，保持默认 44px（与其他视图的分页一致）
    const paginationTriggers = wrapper
      .findAll('.select-trigger')
      .filter((t) => !t.classes().includes('select-trigger-filter'))
    expect(paginationTriggers).toHaveLength(1)
    expect(paginationTriggers[0].classes()).toContain('select-trigger')
    wrapper.unmount()
  })
})
