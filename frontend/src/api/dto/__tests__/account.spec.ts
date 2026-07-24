import { describe, expect, it } from 'vitest'

import { mapAccount, mapAccountList } from '@/api/dto'
import type { Account, Group, PaginatedResponse } from '@/types'

/**
 * Build a fully-populated backend Account. Tests then omit or add fields to
 * exercise the forward-compatibility behaviour of the mappers.
 */
function makeAccount(overrides: Partial<Account> = {}): Account {
  const base = {
    id: 42,
    name: 'primary',
    notes: 'ops note',
    platform: 'anthropic',
    type: 'oauth',
    proxy_id: null,
    concurrency: 4,
    priority: 10,
    rate_multiplier: 1.5,
    status: 'active',
    error_message: null,
    last_used_at: '2026-07-01T00:00:00Z',
    expires_at: 1893456000,
    auto_pause_on_expired: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    groups: [{ id: 1, name: 'team-a' } as Group],
    schedulable: true,
    rate_limited_at: null,
    rate_limit_reset_at: null,
    overload_until: null,
    temp_unschedulable_until: null,
    temp_unschedulable_reason: null,
    session_window_start: null,
    session_window_end: null,
    session_window_status: null,
  }

  return { ...base, ...overrides } as Account
}

describe('mapAccount', () => {
  it('maps a fully-populated account into the stable view model', () => {
    const view = mapAccount(makeAccount())

    expect(view).toMatchObject({
      id: 42,
      name: 'primary',
      platform: 'anthropic',
      platformType: 'oauth',
      status: 'active',
      schedulable: true,
      priority: 10,
      notes: 'ops note',
      rateMultiplier: 1.5,
      createdAt: '2026-01-01T00:00:00Z',
      lastUsedAt: '2026-07-01T00:00:00Z',
      expiresAt: 1893456000,
    })
    expect(view.groups).toEqual([{ id: 1, name: 'team-a' }])
    // The raw payload is passed through untouched for edge cases.
    expect(view.raw.id).toBe(42)
  })

  it('applies safe defaults when optional fields are missing', () => {
    // Simulate a partial backend payload missing many optional fields.
    const partial = {
      id: 7,
      name: 'minimal',
      platform: 'openai',
      type: 'apikey',
    } as unknown as Account

    const view = mapAccount(partial)

    expect(view.schedulable).toBe(false)
    expect(view.groups).toEqual([])
    expect(view.priority).toBe(0)
    expect(view.rateMultiplier).toBe(0)
    expect(view.status).toBe('inactive')
    expect(view.notes).toBeNull()
    expect(view.createdAt).toBe('')
    expect(view.lastUsedAt).toBeNull()
    expect(view.expiresAt).toBeNull()
  })

  it('never throws and stays defined on a nullish payload', () => {
    const view = mapAccount(undefined as unknown as Account)

    expect(view.id).toBe(0)
    expect(view.name).toBe('')
    expect(view.schedulable).toBe(false)
    expect(view.groups).toEqual([])
  })

  it('ignores unknown/extra backend fields (forward compatibility)', () => {
    const withExtras = makeAccount()
    ;(withExtras as Record<string, unknown>).brand_new_backend_field = 'surprise'
    ;(withExtras as Record<string, unknown>).another_unknown = { nested: true }

    const view = mapAccount(withExtras)

    // Extra fields are not surfaced onto the curated view...
    expect((view as Record<string, unknown>).brand_new_backend_field).toBeUndefined()
    // ...but remain reachable through the raw passthrough.
    expect((view.raw as Record<string, unknown>).brand_new_backend_field).toBe('surprise')
  })
})

describe('mapAccountList', () => {
  it('maps a normal paginated response', () => {
    const response: PaginatedResponse<Account> = {
      items: [makeAccount({ id: 1 }), makeAccount({ id: 2 })],
      total: 2,
      page: 1,
      page_size: 20,
      pages: 1,
    }

    const result = mapAccountList(response)

    expect(result.items).toHaveLength(2)
    expect(result.items.map((a) => a.id)).toEqual([1, 2])
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20 })
  })

  it('applies safe defaults for empty pagination', () => {
    const result = mapAccountList({} as unknown as PaginatedResponse<Account>)

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(0)
  })

  it('applies safe defaults for partial pagination metadata', () => {
    const partial = {
      items: [makeAccount({ id: 5 })],
    } as unknown as PaginatedResponse<Account>

    const result = mapAccountList(partial)

    expect(result.items).toHaveLength(1)
    // total/pageSize fall back to the item count; page defaults to 1.
    expect(result.total).toBe(1)
    expect(result.pageSize).toBe(1)
    expect(result.page).toBe(1)
  })

  it('never throws on a nullish response', () => {
    const result = mapAccountList(null as unknown as PaginatedResponse<Account>)

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })
})
