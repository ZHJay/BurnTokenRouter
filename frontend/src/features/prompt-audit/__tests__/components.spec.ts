import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import EndpointPool from '../components/EndpointPool.vue'
import PolicyPanel from '../components/PolicyPanel.vue'
import EventWorkspace from '../components/EventWorkspace.vue'
import EventDetailDialog from '../components/EventDetailDialog.vue'
import FilterDeleteDialog from '../components/FilterDeleteDialog.vue'
import type { PromptAuditDraft, PromptAuditEndpointDraft, PromptAuditEvent, PromptEventFilters } from '../types'
import { emptyEventFilters, resolveDeleteRangeFilters, SCANNER_CATALOG } from '../viewModel'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ locale: { value: 'en' }, t: (key: string, params?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, token) => String(params?.[token] ?? `{${token}}`)) }) }
})

const DialogStub = defineComponent({ props: ['show', 'title'], emits: ['close'], template: '<div v-if="show" data-test="dialog"><slot /><slot name="footer" /></div>' })
const PaginationStub = defineComponent({ props: ['total', 'page', 'pageSize'], emits: ['update:page', 'update:pageSize'], template: '<div data-test="pagination" />' })

/* The decision / risk filters are real Select.vue instances, not native
   <select>. Select renders a role="combobox" trigger and teleports its listbox
   to document.body, so these helpers drive it the way a user does — open the
   popover, click the option with the given label — instead of asserting on
   component internals. Driving the real component is also what proves the
   dark-mode fix: the option list is app-rendered markup that the theme reaches,
   which is precisely what a native <select>'s OS-drawn dropdown never was. */
const openSelect = async (wrapper: VueWrapper, dataTest: string) => {
  await wrapper.get(`[data-test="${dataTest}"] button.select-trigger`).trigger('click')
  await nextTick()
}

// Toggle shut via the trigger. Do NOT clear document.body here: these wrappers
// are attachTo: document.body, so wiping innerHTML would take the component
// with it.
const closeSelect = openSelect

const selectOptionLabels = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.select-option')).map((el) => el.textContent?.trim() ?? '')

const pickSelectOption = async (wrapper: VueWrapper, dataTest: string, label: string) => {
  await openSelect(wrapper, dataTest)
  const option = Array.from(document.body.querySelectorAll<HTMLElement>('.select-option'))
    .find((el) => el.textContent?.trim() === label)
  if (!option) throw new Error(`option "${label}" not found; got: ${selectOptionLabels().join(' | ')}`)
  option.click()
  await nextTick()
}

const selectTriggerLabel = (wrapper: VueWrapper, dataTest: string) =>
  wrapper.get(`[data-test="${dataTest}"] .select-value`).text()

afterEach(() => {
  // Select teleports to body; without this the next test sees a stale listbox.
  document.body.innerHTML = ''
})

const endpoint = (): PromptAuditEndpointDraft => ({
  id: 'guard-1', name: 'Guard One', protocol: 'openai_compatible', base_url: 'http://127.0.0.1:8000',
  model: 'guard-model', timeout_ms: 3000, input_limit: 4000, enabled: true,
  has_token: true, token_status: 'configured', token: '', clear_token: false,
})

describe('Prompt Audit components', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('edits a saved endpoint with blank-secret keep, explicit clear, replacement, and probe actions', async () => {
    const wrapper = mount(EndpointPool, {
      props: { endpoints: [endpoint()], probeResults: {}, probingIds: [] },
      global: { stubs: { BaseDialog: DialogStub } },
    })
    expect(wrapper.text()).toContain('admin.promptAudit.pool.configured')
    const edit = wrapper.findAll('button').find((button) => button.text().includes('common.edit'))
    expect(edit).toBeTruthy()
    await edit!.trigger('click')
    const token = wrapper.get<HTMLInputElement>('[aria-label="admin.promptAudit.pool.apiKey"]')
    expect(token.element.value).toBe('')
    expect(token.attributes('placeholder')).toContain('admin.promptAudit.pool.keepSecret')

    await wrapper.get<HTMLInputElement>('[aria-label="admin.promptAudit.pool.clearSecret"]').setValue(true)
    await token.setValue('replacement-canary')
    await wrapper.get('[data-test="save-endpoint"]').trigger('click')
    const updated = wrapper.emitted('update:endpoints')?.at(-1)?.[0] as PromptAuditEndpointDraft[]
    expect(updated[0]).toMatchObject({ token: 'replacement-canary', clear_token: false })

    const probe = wrapper.findAll('button').find((button) => button.text().includes('admin.promptAudit.pool.probe'))
    await probe!.trigger('click')
    expect(wrapper.emitted('probe')?.[0]?.[0]).toMatchObject({ id: 'guard-1' })
  })

  it('surfaces an undecryptable saved credential and prompts for re-entry', async () => {
    const invalidEndpoint = { ...endpoint(), token_status: 'invalid' }
    const wrapper = mount(EndpointPool, {
      props: { endpoints: [invalidEndpoint], probeResults: {}, probingIds: [] },
      global: { stubs: { BaseDialog: DialogStub } },
    })
    expect(wrapper.text()).toContain('admin.promptAudit.pool.invalid')
    expect(wrapper.text()).not.toContain('admin.promptAudit.pool.configured')

    const edit = wrapper.findAll('button').find((button) => button.text().includes('common.edit'))
    await edit!.trigger('click')
    const token = wrapper.get<HTMLInputElement>('[aria-label="admin.promptAudit.pool.apiKey"]')
    expect(token.attributes('placeholder')).toContain('admin.promptAudit.pool.reenterSecret')
  })

  it('supports group search, stale configured groups, nine scanners, and bounded worker inputs', async () => {
    const draft: PromptAuditDraft = {
      enabled: true, blocking_enabled: false, blocking_latest_turn_only: false, store_pass_events: false, effective_mode: 'async_audit', strategy: 'priority',
      worker_count: 4, queue_capacity: 100, scanners: SCANNER_CATALOG.map((item) => item.id), all_groups: false, group_ids: [1, 99],
      endpoints: [endpoint()], config_version: 1, updated_at: '', updated_by: 0, change_summary: '',
    }
    const wrapper = mount(PolicyPanel, {
      props: { draft, groups: [{ id: 1, name: 'Alpha', platform: 'openai', status: 'active' }, { id: 2, name: 'Beta', platform: 'claude', status: 'inactive' }] },
    })
    expect(wrapper.text()).toContain('99')
    expect(wrapper.findAll('input[type="checkbox"]').filter((input) => SCANNER_CATALOG.some((scanner) => input.attributes('aria-label') === `admin.promptAudit.scanners.${scanner.id}`))).toHaveLength(9)
    await wrapper.get('[aria-label="admin.promptAudit.policy.searchGroups"]').setValue('Beta')
    expect(wrapper.text()).toContain('Beta')
    expect(wrapper.text()).not.toContain('Alpha')
    await wrapper.get('[aria-label="admin.promptAudit.policy.workerCount"]').setValue('6')
    const emitted = wrapper.emitted('update:draft')?.at(-1)?.[0] as PromptAuditDraft
    expect(emitted.worker_count).toBe(6)
  })

  it('keeps identity fields separate, supports selection, and opens filter deletion from the toolbar', async () => {
    const event: PromptAuditEvent = {
      id: 1, job_id: 1, decision: 'critical', risk_level: 'critical', action: 'Block', categories: ['pii'], matched_scanners: ['pii'], scanner_scores: { pii: 1 }, scanner_evidence: { pii: 'redacted' }, scanner_backend: 'qwen3guard-openai', scanner_version: '1', guard_endpoint_id: 'guard-1', policy_id: 'priority', policy_version: 1, config_version: 1, chunk_total: 1, latency_ms: 10, issue_summaries: [], created_at: '2026-07-16T00:00:00Z',
      snapshot: { request_id: 'req-1', user_id: 1, username: 'alice', user_email: 'alice@example.test', api_key_id: 2, api_key_name: 'alice-key', group_id: 3, group_name: 'Alpha', provider: 'openai', endpoint: '/v1/chat/completions', protocol: 'openai_chat', model: 'gpt-test', prompt_hash: 'a'.repeat(64), redacted_preview: 'redacted preview', full_prompt: 'full prompt text', prompt_length: 10, message_count: 1, stage: 'http' },
    }
    const wrapper = mount(EventWorkspace, {
      props: { events: [event], total: 1, page: 1, pageSize: 20, filters: emptyEventFilters(), selectedIds: [], loading: false, error: '' },
      global: { stubs: { Pagination: PaginationStub } },
    })
    expect(wrapper.text()).toContain('alice')
    expect(wrapper.text()).toContain('alice@example.test')
    expect(wrapper.text()).toContain('alice-key')
    expect(wrapper.text()).toContain('admin.promptAudit.decisions.critical · admin.promptAudit.riskLevels.critical')
    expect(wrapper.text()).toContain('admin.promptAudit.scanners.pii')
    expect(wrapper.get('[data-test="filter-delete"]').attributes()).not.toHaveProperty('disabled')
    await wrapper.get('[data-test="filter-delete"]').trigger('click')
    expect(wrapper.emitted('preview-delete')).toHaveLength(1)
    await wrapper.get('[aria-label="admin.promptAudit.events.selectEvent"]').setValue(true)
    expect(wrapper.emitted('selection')?.at(-1)?.[0]).toEqual([1])
  })

  it('filters decision and risk through Select.vue, keeping the change handlers firing', async () => {
    const wrapper = mount(EventWorkspace, {
      props: { events: [], total: 0, page: 1, pageSize: 20, filters: emptyEventFilters(), selectedIds: [], loading: false, error: '' },
      attachTo: document.body,
      global: { stubs: { Pagination: PaginationStub, transition: true } },
    })

    // No native <select> is left on the filter row: with .input's
    // appearance: none a native one is the case style.css cannot reach.
    expect(wrapper.findAll('select')).toHaveLength(0)
    expect(wrapper.findAll('[role="combobox"]')).toHaveLength(2)

    await openSelect(wrapper, 'filter-decision')
    expect(selectOptionLabels()).toEqual([
      'common.all',
      'admin.promptAudit.decisions.pass',
      'admin.promptAudit.decisions.flag',
      'admin.promptAudit.decisions.critical',
    ])
    await closeSelect(wrapper, 'filter-decision')

    await pickSelectOption(wrapper, 'filter-decision', 'admin.promptAudit.decisions.flag')
    expect((wrapper.emitted('filters-change')?.at(-1)?.[0] as PromptEventFilters).decision).toBe('flag')
    expect(selectTriggerLabel(wrapper, 'filter-decision')).toBe('admin.promptAudit.decisions.flag')

    await pickSelectOption(wrapper, 'filter-risk', 'admin.promptAudit.riskLevels.high')
    const afterRisk = wrapper.emitted('filters-change')?.at(-1)?.[0] as PromptEventFilters
    expect(afterRisk.risk_level).toBe('high')
    expect(afterRisk.decision).toBe('flag')

    // The blank first option clears back to "no filter", not a literal ''
    // decision query — eventQueryParams drops empty strings.
    await pickSelectOption(wrapper, 'filter-decision', 'common.all')
    expect((wrapper.emitted('filters-change')?.at(-1)?.[0] as PromptEventFilters).decision).toBe('')

    // aria-label is passed through, so each combobox still has an accessible name.
    expect(wrapper.get('[data-test="filter-decision"] button.select-trigger').attributes('aria-label'))
      .toBe('admin.promptAudit.events.decision')
    expect(wrapper.get('[data-test="filter-risk"] button.select-trigger').attributes('aria-label'))
      .toBe('admin.promptAudit.events.risk')
  })

  it('keeps minute-precision datetime-local on the two list filter fields', async () => {
    const wrapper = mount(EventWorkspace, {
      props: { events: [], total: 0, page: 1, pageSize: 20, filters: emptyEventFilters(), selectedIds: [], loading: false, error: '' },
      global: { stubs: { Pagination: PaginationStub } },
    })
    const start = wrapper.get<HTMLInputElement>('[aria-label="admin.promptAudit.events.startAt"]')
    const end = wrapper.get<HTMLInputElement>('[aria-label="admin.promptAudit.events.endAt"]')
    // Native datetime-local, not a date-only picker: the API compares
    // created_at against an RFC3339 closed interval with no end-of-day
    // expansion, so day granularity would drop the selected end day.
    expect(start.attributes('type')).toBe('datetime-local')
    expect(end.attributes('type')).toBe('datetime-local')
    await start.setValue('2026-07-01T09:30')
    expect((wrapper.emitted('filters-change')?.at(-1)?.[0] as PromptEventFilters).start_at).toBe('2026-07-01T09:30')
  })

  it('uses outline red for the dialog-opening delete and full-size buttons for the filter submits', () => {
    const wrapper = mount(EventWorkspace, {
      props: { events: [], total: 0, page: 1, pageSize: 20, filters: emptyEventFilters(), selectedIds: [], loading: false, error: '' },
      global: { stubs: { Pagination: PaginationStub } },
    })
    // "Delete by filter" only opens a preview dialog, so it sits one rung below
    // the solid .btn-danger that the dialog's own confirm keeps.
    const filterDelete = wrapper.get('[data-test="filter-delete"]')
    expect(filterDelete.classes()).toContain('btn-outline-danger')
    expect(filterDelete.classes()).not.toContain('btn-danger')

    // Search / Reset are this block's submits, not in-row table controls.
    const search = wrapper.findAll('button').find((button) => button.text() === 'common.search')!
    const reset = wrapper.findAll('button').find((button) => button.text() === 'common.reset')!
    expect(search.classes()).toContain('btn')
    expect(search.classes()).not.toContain('btn-sm')
    expect(reset.classes()).not.toContain('btn-sm')

    // Labels use the design system's field-label class, not a surface-ramp
    // value (dark-200) pressed into service as a text colour.
    const labels = wrapper.findAll('form label span.input-label')
    expect(labels.length).toBeGreaterThanOrEqual(11)
    expect(wrapper.find('form label.text-xs').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('dark:text-dark-200')

    // 11 fields + 1 actions cell = 12, which tiles evenly at 2 / 3 / 6 columns.
    const form = wrapper.get('form')
    expect(form.classes()).toContain('sm:grid-cols-2')
    expect(form.classes()).toContain('lg:grid-cols-3')
    expect(form.classes()).toContain('xl:grid-cols-6')
    expect(form.classes()).not.toContain('lg:grid-cols-4')
  })

  it('resolves delete range presets to an epoch start and a cutoff end', () => {
    const now = Date.parse('2026-07-17T12:00:00.000Z')
    const sevenDays = resolveDeleteRangeFilters(emptyEventFilters(), '7d', now)
    expect(sevenDays.start_at).toBe('1970-01-01T00:00:00.000Z')
    expect(sevenDays.end_at).toBe('2026-07-10T12:00:00.000Z')
    const all = resolveDeleteRangeFilters(emptyEventFilters(), 'all', now)
    expect(all.start_at).toBe('1970-01-01T00:00:00.000Z')
    expect(all.end_at).toBe('2026-07-17T12:00:00.000Z')
    const customSource = { ...emptyEventFilters(), start_at: '2026-07-01T00:00', end_at: '2026-07-02T00:00' }
    expect(resolveDeleteRangeFilters(customSource, 'custom', now)).toEqual(customSource)
  })

  it('drives filter deletion through presets, custom validation, preview, and confirm', async () => {
    const wrapper = mount(FilterDeleteDialog, {
      props: { show: true, initialFilters: emptyEventFilters(), preview: null, previewing: false, deleting: false },
      attachTo: document.body,
      global: { stubs: { BaseDialog: DialogStub, transition: true } },
    })
    expect(wrapper.get<HTMLInputElement>('[data-test="range-preset-7d"]').element.checked).toBe(true)
    expect(wrapper.find('[data-test="custom-range"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="delete-preview-empty"]').exists()).toBeTruthy()
    // A valid preset is enough: confirm is armed immediately (one-click flow)
    // and needs no disabled-reason hint.
    expect(wrapper.get('[data-test="confirm-filter-delete"]').attributes()).not.toHaveProperty('disabled')
    expect(wrapper.find('[data-test="confirm-disabled-reason"]').exists()).toBe(false)
    await wrapper.get('[data-test="confirm-filter-delete"]').trigger('click')
    const directConfirm = wrapper.emitted('confirm')?.at(-1)?.[0] as PromptEventFilters
    expect(directConfirm.start_at).toBe('1970-01-01T00:00:00.000Z')
    expect(Date.now() - new Date(directConfirm.end_at).getTime()).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000)

    await wrapper.get('[data-test="range-preset-30d"]').setValue()
    expect(wrapper.emitted('criteria-change')?.length).toBeGreaterThan(0)
    await pickSelectOption(wrapper, 'delete-risk', 'admin.promptAudit.riskLevels.high')
    await wrapper.get('[data-test="run-delete-preview"]').trigger('click')
    const presetPreview = wrapper.emitted('preview')?.at(-1)?.[0] as PromptEventFilters
    expect(presetPreview.risk_level).toBe('high')
    expect(presetPreview.start_at).toBe('1970-01-01T00:00:00.000Z')
    expect(Date.now() - new Date(presetPreview.end_at).getTime()).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000)

    await wrapper.get('[data-test="range-preset-custom"]').setValue()
    expect(wrapper.find('[data-test="custom-range"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="run-delete-preview"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('[data-test="confirm-filter-delete"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('[data-test="confirm-disabled-reason"]').text()).toBe('admin.promptAudit.events.filterDeleteConfirmInvalidRange')
    expect(wrapper.get('[data-test="confirm-filter-delete"]').attributes('title')).toBe('admin.promptAudit.events.filterDeleteConfirmInvalidRange')
    await wrapper.get('[data-test="custom-range"] [aria-label="admin.promptAudit.events.startAt"]').setValue('2026-07-01T00:00')
    await wrapper.get('[data-test="custom-range"] [aria-label="admin.promptAudit.events.endAt"]').setValue('2026-07-02T00:00')
    expect(wrapper.get('[data-test="run-delete-preview"]').attributes()).not.toHaveProperty('disabled')
    expect(wrapper.get('[data-test="confirm-filter-delete"]').attributes()).not.toHaveProperty('disabled')
    expect(wrapper.find('[data-test="confirm-disabled-reason"]').exists()).toBe(false)
    await wrapper.get('[data-test="run-delete-preview"]').trigger('click')
    const customPreview = wrapper.emitted('preview')?.at(-1)?.[0] as PromptEventFilters
    expect(customPreview.start_at).toBe('2026-07-01T00:00')
    expect(customPreview.end_at).toBe('2026-07-02T00:00')

    await wrapper.setProps({
      preview: { matched_count: 3, filter_summary: {}, snapshot_max_id: 9, filter_hash: 'b'.repeat(64), confirmation_token: 'tok', expires_at: '2026-07-16T00:05:00Z' },
    })
    expect(wrapper.get('[data-test="delete-preview-result"]').text()).toContain('admin.promptAudit.events.filterDeleteCount')
    expect(wrapper.find('[data-test="confirm-disabled-reason"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="confirm-filter-delete"]').attributes()).not.toHaveProperty('disabled')
    await wrapper.get('[data-test="confirm-filter-delete"]').trigger('click')
    const confirmed = wrapper.emitted('confirm')?.at(-1)?.[0] as PromptEventFilters
    expect(confirmed.start_at).toBe('2026-07-01T00:00')
    expect(confirmed.end_at).toBe('2026-07-02T00:00')
  })

  it('explains that a zero-match preview leaves nothing to delete', async () => {
    const wrapper = mount(FilterDeleteDialog, {
      props: {
        show: true,
        initialFilters: emptyEventFilters(),
        preview: { matched_count: 0, filter_summary: {}, snapshot_max_id: 0, filter_hash: 'c'.repeat(64), confirmation_token: 'tok', expires_at: '2026-07-16T00:05:00Z' },
        previewing: false,
        deleting: false,
      },
      global: { stubs: { BaseDialog: DialogStub } },
    })
    expect(wrapper.get('[data-test="confirm-filter-delete"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('[data-test="confirm-disabled-reason"]').text()).toBe('admin.promptAudit.events.filterDeleteConfirmNoMatches')
    await wrapper.setProps({ previewing: true })
    expect(wrapper.find('[data-test="confirm-disabled-reason"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="confirm-filter-delete"]').attributes()).toHaveProperty('disabled')
  })

  it('inherits an explicit list-filter range as the custom preset', async () => {
    const initialFilters = { ...emptyEventFilters(), start_at: '2026-07-01T00:00', end_at: '2026-07-02T00:00', decision: 'critical' }
    const wrapper = mount(FilterDeleteDialog, {
      props: { show: true, initialFilters, preview: null, previewing: false, deleting: false },
      attachTo: document.body,
      global: { stubs: { BaseDialog: DialogStub, transition: true } },
    })
    expect(wrapper.get<HTMLInputElement>('[data-test="range-preset-custom"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-test="custom-range"] [aria-label="admin.promptAudit.events.startAt"]').element.value).toBe('2026-07-01T00:00')
    // Select shows the option label, not the raw value.
    expect(selectTriggerLabel(wrapper, 'delete-decision')).toBe('admin.promptAudit.decisions.critical')
    expect(wrapper.get('[data-test="run-delete-preview"]').attributes()).not.toHaveProperty('disabled')
  })

  it('keeps explicit datetime boundaries native in the destructive dialog while its enum filters use Select', async () => {
    const wrapper = mount(FilterDeleteDialog, {
      props: {
        show: true,
        initialFilters: { ...emptyEventFilters(), start_at: '2026-07-01T09:30', end_at: '2026-07-02T09:45' },
        preview: null,
        previewing: false,
        deleting: false,
      },
      attachTo: document.body,
      global: { stubs: { BaseDialog: DialogStub, transition: true } },
    })

    /* The one place that deliberately keeps a native control. This dialog
       defines the exact boundary of an irreversible bulk delete: the operator
       should confirm the same explicit timestamps that go to the server, with
       no preset layer that drifts with the moment the dialog opened. Precision
       beats visual consistency at the point of no return. */
    const start = wrapper.get<HTMLInputElement>('[data-test="custom-range"] [aria-label="admin.promptAudit.events.startAt"]')
    const end = wrapper.get<HTMLInputElement>('[data-test="custom-range"] [aria-label="admin.promptAudit.events.endAt"]')
    expect(start.attributes('type')).toBe('datetime-local')
    expect(end.attributes('type')).toBe('datetime-local')
    expect(start.classes()).toContain('input')
    expect(start.classes()).toContain('h-9')

    // The minute component survives to the emitted criteria untouched.
    await wrapper.get('[data-test="run-delete-preview"]').trigger('click')
    const emitted = wrapper.emitted('preview')?.at(-1)?.[0] as PromptEventFilters
    expect(emitted.start_at).toBe('2026-07-01T09:30')
    expect(emitted.end_at).toBe('2026-07-02T09:45')

    // Enum filters, by contrast, are Select instances — no native dropdown left.
    expect(wrapper.findAll('select')).toHaveLength(0)
    await pickSelectOption(wrapper, 'delete-decision', 'admin.promptAudit.decisions.critical')
    expect(wrapper.emitted('criteria-change')?.length).toBeGreaterThan(0)
    await wrapper.get('[data-test="run-delete-preview"]').trigger('click')
    expect((wrapper.emitted('preview')?.at(-1)?.[0] as PromptEventFilters).decision).toBe('critical')

    // The dialog's own confirm keeps solid red: this one IS the irreversible commit.
    expect(wrapper.get('[data-test="confirm-filter-delete"]').classes()).toContain('btn-danger')
  })

  it('shows the full unredacted prompt and structured guard return on the risks tab', async () => {
    const event: PromptAuditEvent = {
      id: 1, job_id: 1, decision: 'critical', risk_level: 'critical', action: 'Block',
      categories: ['sexual_content_or_sexual_acts'], matched_scanners: ['sexual_content_or_sexual_acts'],
      scanner_scores: { sexual_content_or_sexual_acts: 1 },
      scanner_evidence: { sexual_content_or_sexual_acts: 'Sexual Content or Sexual Acts' },
      scanner_backend: 'qwen3guard-openai', scanner_version: 'qwen3guard', guard_endpoint_id: 'guard-1',
      policy_id: 'priority', policy_version: 1, config_version: 1, chunk_total: 1, latency_ms: 12,
      issue_summaries: [{
        category: 'sexual_content_or_sexual_acts', scanner_id: 'sexual_content_or_sexual_acts',
        title: '性内容或性行为', description: 'Sexual content or sexual acts', severity: 'critical',
        severity_label: '严重', action: 'Block', action_label: '阻止',
        code: 'prompt_audit_sexual_content_or_sexual_acts', score: 1,
        evidence: 'Sexual Content or Sexual Acts', evidence_hash: 'abc',
      }],
      created_at: '2026-07-16T00:00:00Z',
      snapshot: {
        request_id: 'req-1', user_id: 1, username: 'alice', user_email: 'alice@example.test',
        api_key_id: 2, api_key_name: 'alice-key', group_id: 3, group_name: 'Alpha', provider: 'openai',
        endpoint: '/v1/chat/completions', protocol: 'openai_chat', model: 'gpt-test',
        prompt_hash: 'a'.repeat(64), redacted_preview: 'redacted prompt body', full_prompt: 'complete unmasked prompt body', prompt_length: 20,
        message_count: 1, stage: 'http',
      },
    }
    const wrapper = mount(EventDetailDialog, {
      props: { show: true, event, loading: false },
      global: { stubs: { BaseDialog: DialogStub } },
    })
    const panel = wrapper.get('[data-test="event-detail-tab-panel"]')
    expect(panel.classes()).toContain('h-[min(62vh,36rem)]')
    expect(panel.classes()).toContain('overflow-y-auto')

    const riskTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text().includes('admin.promptAudit.events.tabs.risks'))
    expect(riskTab).toBeTruthy()
    await riskTab!.trigger('click')
    expect(wrapper.get('[data-test="event-detail-tab-panel"]').classes()).toContain('h-[min(62vh,36rem)]')
    expect(wrapper.get('[data-test="risk-prompt-preview"]').text()).toContain('complete unmasked prompt body')
    expect(wrapper.get('[data-test="risk-prompt-preview"]').text()).not.toContain('redacted prompt body')
    expect(wrapper.get('[data-test="risk-prompt-full"]').classes()).toContain('overflow-auto')
    expect(wrapper.get('[data-test="risk-guard-return"]').text()).toContain('"decision": "admin.promptAudit.decisions.critical"')
    expect(wrapper.get('[data-test="risk-guard-return"]').text()).toContain('admin.promptAudit.scanners.sexual_content_or_sexual_acts')
    expect(wrapper.get('[data-test="risk-issue"]').text()).toContain('admin.promptAudit.scanners.sexual_content_or_sexual_acts')
  })

  it('falls back to the redacted preview for events stored before full prompts were kept', async () => {
    const event: PromptAuditEvent = {
      id: 2, job_id: 2, decision: 'flag', risk_level: 'medium', action: 'Warn',
      categories: ['pii'], matched_scanners: ['pii'], scanner_scores: {}, scanner_evidence: {},
      scanner_backend: 'qwen3guard-openai', scanner_version: '1', guard_endpoint_id: 'guard-1',
      policy_id: 'priority', policy_version: 1, config_version: 1, chunk_total: 1, latency_ms: 5,
      issue_summaries: [], created_at: '2026-07-16T00:00:00Z',
      snapshot: {
        request_id: 'req-2', user_id: 1, username: 'bob', user_email: '', api_key_id: 2,
        api_key_name: 'bob-key', group_id: 3, group_name: 'Alpha', provider: 'openai',
        endpoint: '/v1/chat/completions', protocol: 'openai_chat', model: 'gpt-test',
        prompt_hash: 'b'.repeat(64), redacted_preview: 'legacy redacted preview', full_prompt: '', prompt_length: 20,
        message_count: 1, stage: 'http',
      },
    }
    const wrapper = mount(EventDetailDialog, {
      props: { show: true, event, loading: false },
      global: { stubs: { BaseDialog: DialogStub } },
    })
    const riskTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text().includes('admin.promptAudit.events.tabs.risks'))
    await riskTab!.trigger('click')
    expect(wrapper.get('[data-test="risk-prompt-full"]').text()).toContain('legacy redacted preview')
  })
})
