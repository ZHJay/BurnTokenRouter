/**
 * Mock API fixtures for the /admin/accounts screenshot harness.
 *
 * The real backend wraps every JSON payload in an envelope of the shape
 * `{ code, message, data }`; the axios response interceptor in
 * `src/api/client.ts` unwraps it and hands `data` back to callers. So every
 * mocked response below is wrapped with `envelope(...)`.
 *
 * Types referenced (see `src/types/index.ts`):
 *  - `PaginatedResponse<T>` => { items, total, page, page_size, pages }
 *  - `Account`, `Group`, `Proxy`, `User`
 */

const DAY = 86_400_000
const now = Date.now()
const iso = (offsetMs) => new Date(now + offsetMs).toISOString()

/** Wrap a payload in the backend success envelope. */
export function envelope(data, message = 'ok') {
  return { code: 0, message, data }
}

/** Admin user returned by GET /auth/me and seeded into localStorage. */
export const adminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@demo.dev',
  role: 'admin',
  status: 'active',
  balance: 0,
  frozen_balance: 0,
  concurrency: 100,
  allowed_groups: null,
  balance_notify_enabled: false,
  balance_notify_threshold: null,
  balance_notify_extra_emails: [],
  email_bound: true,
  created_at: iso(-120 * DAY),
  updated_at: iso(-DAY),
}

/** A couple of proxies so accounts can reference proxy_id. */
export const proxies = [
  {
    id: 1,
    name: 'US-West Residential',
    protocol: 'http',
    host: '10.0.0.10',
    port: 8080,
    username: 'proxyuser',
    status: 'active',
    account_count: 3,
    latency_ms: 82,
    latency_status: 'success',
    ip_address: '203.0.113.10',
    country: 'United States',
    country_code: 'US',
    region: 'California',
    city: 'San Jose',
    quality_status: 'healthy',
    quality_score: 94,
    quality_grade: 'A',
    expires_at: iso(90 * DAY),
    fallback_mode: 'none',
  },
  {
    id: 2,
    name: 'EU Datacenter',
    protocol: 'socks5',
    host: '10.0.0.20',
    port: 1080,
    username: null,
    status: 'active',
    account_count: 2,
    latency_ms: 140,
    latency_status: 'success',
    ip_address: '198.51.100.20',
    country: 'Germany',
    country_code: 'DE',
    region: 'Hesse',
    city: 'Frankfurt',
    quality_status: 'warn',
    quality_score: 71,
    quality_grade: 'B',
    expires_at: iso(30 * DAY),
    fallback_mode: 'direct',
  },
]

/** A small set of groups. Shaped loosely against the `Group` interface — the
 *  AccountsView only reads a handful of fields (id / name / platform / status). */
function makeGroup(id, name, platform, extra = {}) {
  return {
    id,
    name,
    description: null,
    platform,
    rate_multiplier: 1,
    is_exclusive: false,
    status: 'active',
    subscription_type: 'none',
    daily_limit_usd: null,
    weekly_limit_usd: null,
    monthly_limit_usd: null,
    allow_image_generation: true,
    allow_batch_image_generation: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    batch_image_discount_multiplier: 1,
    batch_image_hold_multiplier: 1,
    image_price_1k: null,
    image_price_2k: null,
    image_price_4k: null,
    video_rate_independent: false,
    video_rate_multiplier: 1,
    video_price_480p: null,
    video_price_720p: null,
    video_price_1080p: null,
    web_search_price_per_call: null,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    claude_code_only: false,
    fallback_group_id: null,
    fallback_group_id_on_invalid_request: null,
    require_oauth_only: false,
    require_privacy_set: false,
    created_at: iso(-100 * DAY),
    updated_at: iso(-2 * DAY),
    ...extra,
  }
}

export const groups = [
  makeGroup(1, 'Production Pool', 'anthropic'),
  makeGroup(2, 'OpenAI Team', 'openai'),
  makeGroup(3, 'Gemini Sandbox', 'gemini'),
  makeGroup(4, 'Priority (exclusive)', 'anthropic', { is_exclusive: true }),
]

function groupRefs(ids) {
  const byId = new Map(groups.map((g) => [g.id, g]))
  return {
    group_ids: ids,
    groups: ids.map((id) => byId.get(id)).filter(Boolean),
  }
}

/** Build a realistic Account row with sensible defaults. */
function makeAccount(overrides = {}) {
  const base = {
    id: 0,
    name: '',
    notes: null,
    platform: 'anthropic',
    type: 'oauth',
    credentials_status: { has_access_token: true, has_refresh_token: true },
    proxy_id: null,
    concurrency: 5,
    current_concurrency: 0,
    priority: 50,
    rate_multiplier: 1,
    status: 'active',
    error_message: null,
    last_used_at: iso(-3600_000),
    expires_at: null,
    auto_pause_on_expired: true,
    created_at: iso(-30 * DAY),
    updated_at: iso(-DAY),
    schedulable: true,
    rate_limited_at: null,
    rate_limit_reset_at: null,
    overload_until: null,
    temp_unschedulable_until: null,
    temp_unschedulable_reason: null,
    session_window_start: null,
    session_window_end: null,
    session_window_status: null,
    group_ids: [],
    groups: [],
  }
  return { ...base, ...overrides }
}

/** 8 accounts covering multi-platform, limited, error, privacy mode, grouped. */
export const accounts = [
  makeAccount({
    id: 101,
    name: 'anthropic-oauth-prod-01',
    platform: 'anthropic',
    type: 'oauth',
    priority: 90,
    proxy_id: 1,
    last_used_at: iso(-5 * 60_000),
    expires_at: now + 45 * DAY,
    notes: 'Primary Claude Code pool account',
    ...groupRefs([1, 4]),
  }),
  makeAccount({
    id: 102,
    name: 'openai-codex-team-01',
    platform: 'openai',
    type: 'oauth',
    priority: 80,
    proxy_id: 1,
    last_used_at: iso(-12 * 60_000),
    expires_at: now + 20 * DAY,
    extra: { privacy_mode: 'enabled' },
    parent_privacy_mode: 'enabled',
    ...groupRefs([2]),
  }),
  makeAccount({
    id: 103,
    name: 'gemini-service-account-01',
    platform: 'gemini',
    type: 'service_account',
    priority: 60,
    proxy_id: 2,
    credentials_status: { has_service_account_json: true },
    last_used_at: iso(-2 * 3600_000),
    ...groupRefs([3]),
  }),
  makeAccount({
    id: 104,
    name: 'anthropic-oauth-limited-02',
    platform: 'anthropic',
    type: 'oauth',
    priority: 70,
    proxy_id: 1,
    // Currently rate-limited: reset in the future so the "limited" card counts it.
    rate_limited_at: iso(-10 * 60_000),
    rate_limit_reset_at: iso(35 * 60_000),
    session_window_start: iso(-2 * 3600_000),
    session_window_end: iso(3 * 3600_000),
    session_window_status: 'allowed_warning',
    last_used_at: iso(-11 * 60_000),
    ...groupRefs([1]),
  }),
  makeAccount({
    id: 105,
    name: 'openai-apikey-shadow-03',
    platform: 'openai',
    type: 'apikey',
    priority: 40,
    credentials_status: { has_api_key: true },
    schedulable: true,
    quota_limit: 500,
    quota_used: 213.5,
    quota_daily_limit: 50,
    quota_daily_used: 12.75,
    last_used_at: iso(-40 * 60_000),
    ...groupRefs([2]),
  }),
  makeAccount({
    id: 106,
    name: 'anthropic-oauth-error-04',
    platform: 'anthropic',
    type: 'oauth',
    priority: 30,
    proxy_id: 2,
    status: 'error',
    error_message: 'invalid_grant: refresh token expired',
    schedulable: false,
    last_used_at: iso(-6 * 3600_000),
    ...groupRefs([1]),
  }),
  makeAccount({
    id: 107,
    name: 'gemini-oauth-privacy-05',
    platform: 'gemini',
    type: 'oauth',
    priority: 55,
    proxy_id: 2,
    extra: { privacy_mode: 'enabled' },
    parent_privacy_mode: 'enabled',
    temp_unschedulable_until: iso(20 * 60_000),
    temp_unschedulable_reason: 'manual maintenance',
    schedulable: false,
    last_used_at: iso(-90 * 60_000),
    ...groupRefs([3]),
  }),
  makeAccount({
    id: 108,
    name: 'openai-setup-token-06',
    platform: 'openai',
    type: 'setup-token',
    priority: 20,
    credentials_status: { has_access_token: true },
    notes: 'Backup / low priority',
    last_used_at: iso(-8 * 3600_000),
    ...groupRefs([2, 4]),
  }),
]

/** GET /admin/accounts -> PaginatedResponse<Account>. */
export function accountsPage() {
  return envelope({
    items: accounts,
    total: accounts.length,
    page: 1,
    page_size: 20,
    pages: 1,
  })
}

/** GET /admin/accounts/data -> AdminDataPayload-ish object. */
export function accountsData() {
  return envelope({
    accounts,
    proxies,
    groups,
  })
}

/** GET /admin/accounts/upstream-billing-probe/settings. */
export function billingProbeSettings() {
  return envelope({ enabled: false, interval_minutes: 30 })
}

/** GET /auth/me -> current user (optionally with run_mode). */
export function currentUser() {
  return envelope({ ...adminUser, run_mode: 'full' })
}

/** GET /admin/compliance -> AdminComplianceStatus (not required). */
export function complianceStatus() {
  return envelope({
    required: false,
    version: '1.0.0',
    document_path_zh: 'docs/legal/admin-compliance.zh.md',
    document_path_en: 'docs/legal/admin-compliance.en.md',
    document_url_zh: 'https://example.com/zh',
    document_url_en: 'https://example.com/en',
    ack_phrase_zh: '我已阅读并同意',
    ack_phrase_en: 'I have read and agree',
  })
}

/** GET /setup/status -> setup already completed. */
export function setupStatus() {
  return envelope({ needs_setup: false, step: 'done' })
}

/** Public settings blob (used by app store / vite plugin). */
export function publicSettings() {
  return envelope({
    site_name: 'BurnTokenRouter',
    backend_mode_enabled: false,
    payment_enabled: false,
    risk_control_enabled: false,
  })
}

export const localStorageSeed = {
  authUser: adminUser,
  tokenTtlMs: DAY,
}
