/**
 * Anti-corruption layer for the ACCOUNTS domain.
 *
 * This module isolates views from the raw backend `Account` contract. Views
 * should consume the curated {@link AccountView} instead of the wire model, so
 * that future backend field/endpoint renames only touch the mapper here.
 *
 * Design rules:
 * - Pure module: no axios / no side effects. Only type + mapping logic.
 * - Forward-compatible: unknown/extra backend fields are ignored, and missing
 *   fields fall back to safe defaults. Mappers never throw on shape drift.
 * - Stable, camelCase field names owned by the frontend.
 */
import type { Account, Group, PaginatedResponse } from '@/types'

/**
 * Curated, stable frontend view model for an account.
 *
 * Only the fields views actually need are surfaced here. Anything exotic can be
 * reached through {@link AccountView.raw} as an escape hatch, but new UI code is
 * encouraged to extend this interface (and the mapper) rather than read `raw`.
 */
export interface AccountView {
  /** Backend primary key. */
  id: number
  /** Human-friendly account name. */
  name: string
  /** Upstream platform, e.g. 'anthropic' | 'openai' | 'gemini' | ... */
  platform: Account['platform']
  /**
   * Account credential type, e.g. 'oauth' | 'apikey' | ...
   * Mapped from the backend `type` field to a clearer, stable name.
   */
  platformType: Account['type']
  /** Lifecycle status. */
  status: Account['status']
  /** Whether the scheduler may pick this account. */
  schedulable: boolean
  /** Scheduling priority (higher wins). */
  priority: number
  /** Preloaded group objects this account belongs to. */
  groups: Group[]
  /** Free-form operator notes. */
  notes: string | null
  /** Billing multiplier (>= 0, 0 means free). */
  rateMultiplier: number
  /** ISO timestamp string for creation. */
  createdAt: string
  /** ISO timestamp string for last use, or null if never used. */
  lastUsedAt: string | null
  /** Unix-epoch expiry (seconds) as provided by the backend, or null. */
  expiresAt: number | null
  /** Passthrough to the untouched backend model for edge cases. */
  raw: Account
}

/**
 * Map a single raw backend {@link Account} to the stable {@link AccountView}.
 *
 * Forward-compatible by design:
 * - Unknown/extra backend fields are ignored (they simply are not read).
 * - Missing optional fields get safe defaults instead of throwing.
 */
export function mapAccount(raw: Account): AccountView {
  // Defensive against a null/undefined payload so callers never blow up on a
  // partial or malformed response.
  const src = (raw ?? {}) as Account

  return {
    id: src.id ?? 0,
    name: src.name ?? '',
    platform: src.platform,
    platformType: src.type,
    status: src.status ?? 'inactive',
    schedulable: src.schedulable ?? false,
    priority: src.priority ?? 0,
    groups: src.groups ?? [],
    notes: src.notes ?? null,
    rateMultiplier: src.rate_multiplier ?? 0,
    createdAt: src.created_at ?? '',
    lastUsedAt: src.last_used_at ?? null,
    expiresAt: src.expires_at ?? null,
    raw: src,
  }
}

/** Shape returned by {@link mapAccountList}. */
export interface AccountListView {
  items: AccountView[]
  total: number
  page: number
  pageSize: number
}

/**
 * Map a paginated backend response into a stable list view.
 *
 * Pagination fields fall back to safe defaults when the backend omits them, and
 * a missing/empty `items` array yields an empty list rather than throwing.
 */
export function mapAccountList(
  raw: PaginatedResponse<Account>,
): AccountListView {
  const src = (raw ?? {}) as Partial<PaginatedResponse<Account>>
  const items = Array.isArray(src.items) ? src.items : []

  return {
    items: items.map(mapAccount),
    total: src.total ?? items.length,
    page: src.page ?? 1,
    pageSize: src.page_size ?? items.length,
  }
}
