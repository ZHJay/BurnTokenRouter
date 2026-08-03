/**
 * Shared `@/api/admin` mock factory for admin view specs.
 *
 * Why this exists
 * ---------------
 * Hand-written `vi.mock('@/api/admin', () => ({ adminAPI: { groups: { list, ... } } }))`
 * factories only declare the handful of endpoints a spec cares about. Every other
 * endpoint is simply absent, so the moment the component under test calls one
 * (typically from `onMounted`), it throws `TypeError: adminAPI.<ns>.<fn> is not a
 * function`. Inside a `void`-discarded async call that surfaces as an
 * *unhandled rejection*, which Vitest attributes to whichever spec file happened to
 * be running when the microtask flushed — making a local mock gap look like
 * cross-file test pollution.
 *
 * This factory derives the mock from the *real* module surface via `importActual`
 * and replaces every function with a `vi.fn()` that resolves. Adding a new endpoint
 * to `src/api/admin/**` therefore cannot break these specs: the method always
 * exists on the mock. Specs pass `overrides` only for the endpoints they assert on.
 *
 * Usage (inside a spec):
 *
 *   const { listGroups } = vi.hoisted(() => ({ listGroups: vi.fn() }))
 *
 *   vi.mock('@/api/admin', async () => {
 *     const { createAdminAPIMock } = await import('./helpers/adminApiMock')
 *     return createAdminAPIMock({ groups: { list: listGroups } })
 *   })
 */
import { vi } from 'vitest'

type AdminAPIModule = typeof import('@/api/admin')

type UnknownRecord = Record<string, unknown>

/** Nested, partial override tree keyed by admin API namespace, e.g. `{ groups: { list: fn } }`. */
export type AdminAPIOverrides = Record<string, UnknownRecord | unknown>

/** Plain objects get cloned + auto-mocked; class instances / arrays are passed through. */
function isPlainObject(value: unknown): value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Recursively clone `source`, replacing every function with a resolving `vi.fn()`.
 *
 * `seen` preserves reference identity so that aliases in the real module
 * (`adminAPI.groups === groupsAPI`, `default === adminAPI`) stay aliases in the mock.
 * Without this, overriding `adminAPI.groups.list` would not be visible to a component
 * that imports `groupsAPI` directly.
 */
function autoMock<T>(source: T, seen: Map<object, unknown>): T {
  if (typeof source === 'function') {
    // Resolve rather than return `undefined` so callers can safely chain
    // `.then/.catch/.finally` on an endpoint the spec never stubbed.
    return vi.fn(() => Promise.resolve(undefined)) as unknown as T
  }

  if (!isPlainObject(source)) return source

  const cached = seen.get(source)
  if (cached) return cached as T

  const clone: UnknownRecord = {}
  seen.set(source, clone)
  for (const key of Object.keys(source)) {
    clone[key] = autoMock((source as UnknownRecord)[key], seen)
  }
  return clone as unknown as T
}

/** Deep-merge spec-supplied spies into the auto-mocked tree, mutating `target` in place. */
function applyOverrides(target: UnknownRecord, overrides: UnknownRecord): void {
  for (const [key, value] of Object.entries(overrides)) {
    const current = target[key]
    if (isPlainObject(value) && isPlainObject(current)) {
      applyOverrides(current, value)
      continue
    }
    target[key] = value
  }
}

/**
 * Build a complete mock of the `@/api/admin` module namespace.
 *
 * Every export is preserved and every function is a `vi.fn()` resolving to
 * `undefined`, except the endpoints supplied in `overrides`.
 *
 * @param overrides Nested spies keyed by namespace, e.g. `{ groups: { list: listGroups } }`.
 *                  Applied to `adminAPI` (and therefore to the aliased named exports).
 */
export async function createAdminAPIMock(
  overrides: AdminAPIOverrides = {}
): Promise<AdminAPIModule> {
  const actual = await vi.importActual<AdminAPIModule>('@/api/admin')
  const mocked = autoMock(actual as unknown as UnknownRecord, new Map())
  applyOverrides(mocked.adminAPI as UnknownRecord, overrides as UnknownRecord)
  return mocked as unknown as AdminAPIModule
}
