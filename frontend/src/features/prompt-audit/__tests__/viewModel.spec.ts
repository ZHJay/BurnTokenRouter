import { describe, expect, it } from 'vitest'
import type { PromptAuditConfig } from '../types'
import {
  buildUpdateRequest,
  configToDraft,
  decisionOptions,
  DECISION_IDS,
  draftFingerprint,
  emptyEventFilters,
  eventFilterPayload,
  hasExplicitDeleteRange,
  riskOptions,
  RISK_LEVEL_IDS,
  SCANNER_CATALOG,
} from '../viewModel'

const config = (): PromptAuditConfig => ({
  enabled: true,
  blocking_enabled: false,
  store_pass_events: false,
  effective_mode: 'async_audit',
  strategy: 'priority',
  worker_count: 4,
  queue_capacity: 100,
  scanners: SCANNER_CATALOG.map((item) => item.id),
  all_groups: true,
  group_ids: [],
  endpoints: [{
    id: 'guard-1', name: 'Guard One', protocol: 'openai_compatible', base_url: 'http://127.0.0.1:8000',
    model: 'sileader/qwen3guard:0.6b', timeout_ms: 3000, input_limit: 4000, enabled: true,
    has_token: true, token_status: 'configured',
  }],
  config_version: 7,
  updated_at: '2026-07-16T00:00:00Z',
  updated_by: 1,
  change_summary: '{}',
})

describe('Prompt Audit view model', () => {
  const t = (key: string) => key

  it('offers decision and risk filters as SelectOption lists with the blank "all" entry first', () => {
    // Blank-first is load-bearing: PromptEventFilters models "no filter" as ''
    // and eventQueryParams drops empty strings, so the first entry is what
    // clears the filter rather than querying for a literal empty decision.
    const decisions = decisionOptions(t)
    expect(decisions[0]).toEqual({ value: '', label: 'common.all' })
    expect(decisions.map((option) => option.value)).toEqual(['', ...DECISION_IDS])
    expect(decisions.at(-1)?.label).toBe('admin.promptAudit.decisions.critical')

    const risks = riskOptions(t)
    expect(risks[0]).toEqual({ value: '', label: 'common.all' })
    expect(risks.map((option) => option.value)).toEqual(['', ...RISK_LEVEL_IDS])
    expect(risks.at(-1)?.label).toBe('admin.promptAudit.riskLevels.critical')

    // Every option carries both keys Select.vue reads.
    for (const option of [...decisions, ...risks]) {
      expect(Object.keys(option).sort()).toEqual(['label', 'value'])
      expect(typeof option.label).toBe('string')
    }
  })

  it('keeps the filter enums aligned with the values the API accepts', () => {
    expect(DECISION_IDS).toEqual(['pass', 'flag', 'critical'])
    expect(RISK_LEVEL_IDS).toEqual(['low', 'medium', 'high', 'critical'])
  })

  it('reads datetime-local minute precision through to the ISO query, and would lose the end day at date granularity', () => {
    /* This is the evidence behind keeping native datetime-local on both the
       list filter and the delete dialog instead of adopting the date-only
       DateRangePicker. Two separate losses:
         1. precision — a minute-level boundary survives the round trip;
         2. parsing mode — 'YYYY-MM-DD' is parsed as UTC while
            'YYYY-MM-DDTHH:mm' is parsed as local time, so the same calendar
            day maps to two different instants outside UTC.
       The backend compares created_at <= end_at as a closed interval with no
       end-of-day expansion, so a date-only end_at silently excludes the whole
       final day. */
    const precise = eventFilterPayload({ ...emptyEventFilters(), start_at: '2026-07-01T09:30', end_at: '2026-07-01T09:45' })
    expect(new Date(String(precise.end_at)).getTime() - new Date(String(precise.start_at)).getTime()).toBe(15 * 60 * 1000)

    const dateOnly = eventFilterPayload({ ...emptyEventFilters(), start_at: '2026-07-01', end_at: '2026-07-01' })
    expect(dateOnly.start_at).toBe(dateOnly.end_at)
    // A whole selected day collapses to a zero-width window at date granularity.
    expect(new Date(String(dateOnly.end_at)).getTime() - new Date(String(dateOnly.start_at)).getTime()).toBe(0)
    // ...and it is not even the same instant as local midnight of that day.
    const localMidnight = eventFilterPayload({ ...emptyEventFilters(), start_at: '2026-07-01T00:00', end_at: '2026-07-02T00:00' })
    const skewMs = new Date(String(localMidnight.start_at)).getTime() - new Date(String(dateOnly.start_at)).getTime()
    // getTimezoneOffset() is negative east of UTC, so in Asia/Shanghai this is
    // -8h: local midnight is 8 hours *before* the UTC-parsed date-only value.
    expect(skewMs).toBe(new Date('2026-07-01T00:00').getTimezoneOffset() * 60 * 1000)
  })

  it('normalizes legacy null collections from the public config', () => {
    const legacy = { ...config(), group_ids: null, scanners: null, endpoints: null } as unknown as PromptAuditConfig
    expect(configToDraft(legacy)).toMatchObject({ group_ids: [], scanners: [], endpoints: [] })
  })

  it('models all nine official input scanners', () => {
    expect(SCANNER_CATALOG).toHaveLength(9)
    expect(SCANNER_CATALOG.map((item) => item.id)).toContain('suicide_and_self_harm')
  })

  it('keeps, replaces, or explicitly clears a saved token without copying plaintext from the server', () => {
    const draft = configToDraft(config())
    expect(draft.endpoints[0].token).toBe('')
    expect(buildUpdateRequest(draft).endpoints[0]).toMatchObject({ token: undefined, clear_token: false })

    draft.endpoints[0].token = 'temporary-canary-token'
    expect(buildUpdateRequest(draft).endpoints[0]).toMatchObject({ token: 'temporary-canary-token', clear_token: false })

    draft.endpoints[0].token = ''
    draft.endpoints[0].clear_token = true
    expect(buildUpdateRequest(draft).endpoints[0]).toMatchObject({ token: undefined, clear_token: true })
  })

  it('tracks dirty state from the full normalized save payload', () => {
    const original = configToDraft(config())
    const changed = configToDraft(config())
    expect(draftFingerprint(changed)).toBe(draftFingerprint(original))
    changed.queue_capacity += 1
    expect(draftFingerprint(changed)).not.toBe(draftFingerprint(original))
  })

  it('requires a valid explicit range and sends canonical ISO timestamps for filter deletion', () => {
    const filters = emptyEventFilters()
    expect(hasExplicitDeleteRange(filters)).toBe(false)
    filters.start_at = '2026-07-15T10:00'
    filters.end_at = '2026-07-16T10:00'
    filters.group_id = '9'
    expect(hasExplicitDeleteRange(filters)).toBe(true)
    expect(eventFilterPayload(filters)).toMatchObject({
      group_id: 9,
      start_at: new Date(filters.start_at).toISOString(),
      end_at: new Date(filters.end_at).toISOString(),
    })
  })
})
