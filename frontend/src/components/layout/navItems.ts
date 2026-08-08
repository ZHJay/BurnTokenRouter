/**
 * GlobalNav navigation model.
 *
 * Ported from `AppSidebar.vue` (deleted in the Phase B nav rewrite) so the
 * filtering / feature-flag / simple-mode / custom-menu-item behavior can be
 * unit-tested against a plain TypeScript module instead of Vue component
 * source. Behavior must stay byte-for-byte compatible with the old sidebar:
 *
 *  - `applyFeatureFlags` recursively drops items whose `featureFlag()`
 *    returns `false` (children included). `undefined` / `true` means show —
 *    a lenient contract that avoids menu flicker while public settings are
 *    still loading (see `utils/featureFlags.ts` for opt-in vs opt-out).
 *  - Simple mode (`isSimpleMode`) drops every item with
 *    `hideInSimpleMode: true` AFTER flag filtering.
 *  - Admin simple mode re-appends `/keys`, `/admin/settings` and admin
 *    custom menu items.
 *  - Custom menu items (`custom_menu_items` from public settings with
 *    `visibility === 'user'`, or `adminSettingsStore.customMenuItems` with
 *    `visibility === 'admin'`) are sorted by `sort_order`, appended last and
 *    keyed `/custom/<id>`.
 *  - `expandOnly: true` groups (channels, security-audit, affiliates, orders)
 *    are containers, not links.
 *  - Active detection is path based: `route.path === p || startsWith(p + '/')`.
 *  - Non-admin users in backend mode see no nav (handled by the component).
 */

import type { CustomMenuItem } from '@/types'

export interface NavItem {
  /** Link target — also the stable key used for dedupe / active state. */
  path: string
  /** i18n key under the `nav` section for built-in items. */
  labelKey?: string
  /** Literal label for custom menu items (never translated). */
  label?: string
  /** Raw SVG string for custom menu items (sanitized before rendering). */
  iconSvg?: string
  /** Hidden in simple mode (after feature-flag filtering). */
  hideInSimpleMode?: boolean
  children?: NavItem[]
  /**
   * When true the parent item only toggles expand/collapse and does NOT
   * navigate to its `path`. The `path` is purely a stable key.
   */
  expandOnly?: boolean
  /**
   * Optional feature-switch getter. When it returns `false` the item is
   * hidden; `undefined`/`true` means show (lenient until settings load).
   * Reactive sources read inside the getter are tracked automatically.
   */
  featureFlag?: () => boolean | undefined
}

/** All feature-flag getters consumed by the nav (see AppSidebar 1.2). */
export interface NavFlags {
  channelMonitor: () => boolean | undefined
  payment: () => boolean | undefined
  availableChannels: () => boolean | undefined
  affiliate: () => boolean | undefined
  riskControl: () => boolean | undefined
  opsMonitoring: () => boolean | undefined
  adminPayment: () => boolean | undefined
  batchImageAccess: () => boolean | undefined
}

export interface NavDeps {
  isSimpleMode: boolean
  customMenuItemsForUser: CustomMenuItem[]
  customMenuItemsForAdmin: CustomMenuItem[]
  flags: NavFlags
}

/**
 * Recursive feature-flag filter. `featureFlag() === false` hides the node
 * (and, for groups, every descendant). `undefined`/`true` keeps it.
 */
export function applyFeatureFlags(items: NavItem[]): NavItem[] {
  const out: NavItem[] = []
  for (const item of items) {
    if (item.featureFlag && item.featureFlag() === false) continue
    if (item.children) {
      out.push({ ...item, children: applyFeatureFlags(item.children) })
    } else {
      out.push(item)
    }
  }
  return out
}

/**
 * Two-pass filter: feature flags first, then simple-mode hiding. Mirrors the
 * old `finalizeNav` used for the user / personal nav lists.
 */
export function finalizeNav(items: NavItem[], isSimpleMode: boolean): NavItem[] {
  const visible = applyFeatureFlags(items)
  return isSimpleMode ? visible.filter((item) => !item.hideInSimpleMode) : visible
}

export function customItemToNav(item: CustomMenuItem): NavItem {
  return { path: `/custom/${item.id}`, label: item.label, iconSvg: item.icon_svg }
}

export function sortCustomItems(items: CustomMenuItem[]): CustomMenuItem[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * User-facing nav (also shared by the admin "my account" section via
 * `withDashboard = false`). Order: keys → usage → available channels →
 * channel status → subscriptions/payment → redeem/profile.
 */
export function buildSelfNavItems(deps: NavDeps, withDashboard: boolean): NavItem[] {
  const items: NavItem[] = []
  if (withDashboard) {
    items.push({ path: '/dashboard', labelKey: 'nav.dashboard' })
  }
  items.push(
    { path: '/keys', labelKey: 'nav.apiKeys' },
    {
      path: '/batch-image',
      labelKey: 'nav.batchImage',
      hideInSimpleMode: true,
      featureFlag: deps.flags.batchImageAccess,
    },
    { path: '/usage', labelKey: 'nav.usage', hideInSimpleMode: true },
    {
      path: '/available-channels',
      labelKey: 'nav.availableChannels',
      hideInSimpleMode: true,
      featureFlag: deps.flags.availableChannels,
    },
    { path: '/monitor', labelKey: 'nav.channelStatus', featureFlag: deps.flags.channelMonitor },
    { path: '/subscriptions', labelKey: 'nav.mySubscriptions', hideInSimpleMode: true },
    {
      path: '/purchase',
      labelKey: 'nav.buySubscription',
      hideInSimpleMode: true,
      featureFlag: deps.flags.payment,
    },
    {
      path: '/orders',
      labelKey: 'nav.myOrders',
      hideInSimpleMode: true,
      featureFlag: deps.flags.payment,
    },
    { path: '/redeem', labelKey: 'nav.redeem', hideInSimpleMode: true },
    {
      path: '/affiliate',
      labelKey: 'nav.affiliate',
      hideInSimpleMode: true,
      featureFlag: deps.flags.affiliate,
    },
    { path: '/profile', labelKey: 'nav.profile' },
    ...deps.customMenuItemsForUser.map(customItemToNav),
  )
  return items
}

/**
 * Admin nav. Mirrors the old `adminNavItems` computed exactly: feature flags
 * are applied to the base list first, then simple mode filters
 * `hideInSimpleMode` and re-appends `/keys` + `/admin/settings` + admin
 * custom items; normal mode appends `/admin/settings` + admin custom items.
 */
export function buildAdminNavItems(deps: NavDeps): NavItem[] {
  const baseItems: NavItem[] = [
    { path: '/admin/dashboard', labelKey: 'nav.dashboard' },
    { path: '/admin/ops', labelKey: 'nav.ops', featureFlag: deps.flags.opsMonitoring },
    { path: '/admin/users', labelKey: 'nav.users', hideInSimpleMode: true },
    { path: '/admin/groups', labelKey: 'nav.groups', hideInSimpleMode: true },
    {
      path: '/admin/channels',
      labelKey: 'nav.channelManagement',
      hideInSimpleMode: true,
      expandOnly: true,
      children: [
        { path: '/admin/channels/pricing', labelKey: 'nav.channelPricing' },
        {
          path: '/admin/channels/monitor',
          labelKey: 'nav.channelMonitor',
          featureFlag: deps.flags.channelMonitor,
        },
      ],
    },
    { path: '/admin/subscriptions', labelKey: 'nav.subscriptions', hideInSimpleMode: true },
    { path: '/admin/accounts', labelKey: 'nav.accounts' },
    { path: '/admin/announcements', labelKey: 'nav.announcements' },
    { path: '/admin/proxies', labelKey: 'nav.proxies' },
    {
      path: '/admin/security-audit',
      labelKey: 'nav.securityAudit',
      hideInSimpleMode: true,
      expandOnly: true,
      featureFlag: deps.flags.riskControl,
      children: [
        { path: '/admin/risk-control', labelKey: 'nav.contentModeration' },
        { path: '/admin/prompt-audit', labelKey: 'nav.promptAudit' },
      ],
    },
    { path: '/admin/redeem', labelKey: 'nav.redeemCodes', hideInSimpleMode: true },
    { path: '/admin/promo-codes', labelKey: 'nav.promoCodes', hideInSimpleMode: true },
    {
      path: '/admin/affiliates',
      labelKey: 'nav.affiliateManagement',
      hideInSimpleMode: true,
      expandOnly: true,
      featureFlag: deps.flags.affiliate,
      children: [
        { path: '/admin/affiliates/invites', labelKey: 'nav.affiliateInviteRecords' },
        { path: '/admin/affiliates/rebates', labelKey: 'nav.affiliateRebateRecords' },
        { path: '/admin/affiliates/transfers', labelKey: 'nav.affiliateTransferRecords' },
      ],
    },
    {
      path: '/admin/orders',
      labelKey: 'nav.orderManagement',
      hideInSimpleMode: true,
      expandOnly: true,
      featureFlag: deps.flags.adminPayment,
      children: [
        { path: '/admin/orders/dashboard', labelKey: 'nav.paymentDashboard' },
        { path: '/admin/orders', labelKey: 'nav.orderManagement' },
        { path: '/admin/orders/plans', labelKey: 'nav.paymentPlans' },
      ],
    },
    { path: '/admin/usage', labelKey: 'nav.usage' },
    { path: '/admin/audit-logs', labelKey: 'nav.auditLogs', hideInSimpleMode: true },
  ]

  const visible = applyFeatureFlags(baseItems)

  // Simple mode: drop hidden items, then re-append /keys + settings + admin custom items.
  if (deps.isSimpleMode) {
    const filtered = visible.filter((item) => !item.hideInSimpleMode)
    filtered.push({ path: '/keys', labelKey: 'nav.apiKeys' })
    filtered.push({ path: '/admin/settings', labelKey: 'nav.settings' })
    for (const cm of deps.customMenuItemsForAdmin) {
      filtered.push(customItemToNav(cm))
    }
    return filtered
  }

  visible.push({ path: '/admin/settings', labelKey: 'nav.settings' })
  for (const cm of deps.customMenuItemsForAdmin) {
    visible.push(customItemToNav(cm))
  }
  return visible
}

/* ---------------------------------------------------------------------------
 * Admin flyout mega-menu grouping (Phase B handoff, §B2):
 *
 *   Dashboard | Resources▾ (accounts, groups, channels, IP/proxies
 *                           | channel pricing, channel monitor)
 *             | Operations▾ (users, subscriptions, orders, plans
 *                            | redeem, promo codes, announcements, affiliates)
 *             | Analytics▾  (usage, ops monitoring, payment overview
 *                            | risk control/moderation, prompt audit, audit logs)
 *             | Settings
 *
 * The old sidebar exposed a flat admin list; the flyout reorganizes the same
 * entries into columns. Containers (expandOnly groups) are flattened into
 * their children and are NOT rendered as links themselves.
 *
 * Why containers stay unlinked: `/admin/channels` and `/admin/affiliates` are
 * redirect-only routes (`/admin/channels` → `/admin/channels/pricing`,
 * `/admin/affiliates` → `/admin/affiliates/invites`), and both redirect targets
 * already appear in the same flyout column. Listing the container too would
 * render two links to one destination. The old sidebar had the same shape:
 * these were `expandOnly` group headers, never navigable. `/admin/security-audit`
 * has no route at all; `/admin/orders` is both container and child, and the
 * child already covers the path.
  * ------------------------------------------------------------------------- */

export interface AdminFlyoutColumn {
  titleKey: string
  paths: string[]
}

export interface AdminFlyoutGroup {
  key: string
  labelKey: string
  columns: AdminFlyoutColumn[]
}

export const ADMIN_FLYOUT_GROUPS: AdminFlyoutGroup[] = [
  {
    key: 'resources',
    labelKey: 'nav.resources',
    columns: [
      {
        titleKey: 'nav.resourceManagement',
        paths: ['/admin/accounts', '/admin/groups', '/admin/proxies'],
      },
      {
        titleKey: 'nav.channelSection',
        paths: ['/admin/channels/pricing', '/admin/channels/monitor'],
      },
    ],
  },
  {
    key: 'operations',
    labelKey: 'nav.operations',
    columns: [
      {
        titleKey: 'nav.userAndOrders',
        paths: ['/admin/users', '/admin/subscriptions', '/admin/orders', '/admin/orders/plans'],
      },
      {
        titleKey: 'nav.marketing',
        paths: [
          '/admin/redeem',
          '/admin/promo-codes',
          '/admin/announcements',
          '/admin/affiliates/invites',
          '/admin/affiliates/rebates',
          '/admin/affiliates/transfers',
        ],
      },
    ],
  },
  {
    key: 'analytics',
    labelKey: 'nav.analytics',
    columns: [
      {
        titleKey: 'nav.dataSection',
        paths: ['/admin/usage', '/admin/ops', '/admin/orders/dashboard'],
      },
      {
        titleKey: 'nav.securitySection',
        paths: ['/admin/risk-control', '/admin/prompt-audit', '/admin/audit-logs'],
      },
    ],
  },
]

const FLYOUT_PATH_TO_GROUP = new Map<string, { group: AdminFlyoutGroup; column: AdminFlyoutColumn }>()
for (const group of ADMIN_FLYOUT_GROUPS) {
  for (const column of group.columns) {
    for (const path of column.paths) {
      FLYOUT_PATH_TO_GROUP.set(path, { group, column })
    }
  }
}

export interface GroupedAdminFlyout {
  key: string
  labelKey: string
  columns: { titleKey: string; items: NavItem[] }[]
}

export interface GroupedAdminNav {
  /** Plain top-level links: dashboard, settings, custom items, extras. */
  topLevel: NavItem[]
  /** Flyout mega-menu groups (non-simple mode only). */
  groups: GroupedAdminFlyout[]
  /** Filtered leaves that matched no flyout column (kept reachable). */
  extra: NavItem[]
}

/**
 * Reorganize the filtered flat admin list into the flyout structure.
 * Containers are flattened into children; container paths listed in the flyout
 * spec are kept as links unless a child already covers the same path.
 */
export function groupAdminNav(items: NavItem[]): GroupedAdminNav {
  const leaves: NavItem[] = []
  for (const item of items) {
    if (item.children?.length) {
      for (const child of item.children) leaves.push(child)
      const coveredByChild = item.children.some((c) => c.path === item.path)
      if (!coveredByChild && FLYOUT_PATH_TO_GROUP.has(item.path)) {
        leaves.push({ ...item, children: undefined })
      }
    } else {
      leaves.push(item)
    }
  }

  const topLevel: NavItem[] = []
  const extra: NavItem[] = []
  const byPath = new Map<string, NavItem>()
  for (const leaf of leaves) {
    // Dashboard, settings and custom items are plain top-level links.
    if (
      leaf.path === '/admin/dashboard' ||
      leaf.path === '/admin/settings' ||
      leaf.path.startsWith('/custom/')
    ) {
      topLevel.push(leaf)
      continue
    }
    if (!FLYOUT_PATH_TO_GROUP.has(leaf.path)) {
      extra.push(leaf)
      continue
    }
    byPath.set(leaf.path, leaf)
  }

  const groups: GroupedAdminFlyout[] = []
  for (const group of ADMIN_FLYOUT_GROUPS) {
    const columns: GroupedAdminFlyout['columns'] = []
    for (const column of group.columns) {
      const items: NavItem[] = []
      for (const path of column.paths) {
        const item = byPath.get(path)
        if (item) items.push(item)
      }
      if (items.length > 0) columns.push({ titleKey: column.titleKey, items })
    }
    if (columns.length > 0) groups.push({ key: group.key, labelKey: group.labelKey, columns })
  }

  return { topLevel, groups, extra }
}

export function resolveNavLabel(item: NavItem, t: (key: string) => string): string {
  if (item.label !== undefined) return item.label
  if (item.labelKey) return t(item.labelKey)
  return item.path
}

/** Active-route detection: exact match or prefix match on path segments. */
export function isPathActive(path: string, currentPath: string): boolean {
  return currentPath === path || currentPath.startsWith(path + '/')
}

/* ---------------------------------------------------------------------------
 * Command palette (⌘K) source — Phase C.
 *
 * The palette is deliberately fed the SAME already-filtered NavItem lists the
 * bar renders, never the raw builders. That is a functional requirement, not a
 * stylistic one: `featureFlag` and `hideInSimpleMode` decide what a given user
 * is allowed to see, so re-deriving the list here (or walking the unfiltered
 * `buildAdminNavItems` output) would surface disabled or unauthorized features
 * in search results — a real privilege/UX leak rather than a visual bug.
 *
 * Therefore: callers pass `finalizeNav(...)` / `groupAdminNav(...)` output.
 * `buildCommandEntries` only flattens, dedupes and labels.
 * ------------------------------------------------------------------------- */

/** One searchable palette row. */
export interface CommandEntry {
  /** Router target — also the dedupe key and DOM id seed. */
  path: string
  /** Resolved, already-translated display label. */
  label: string
  /** i18n key of the owning group heading (results are rendered grouped). */
  groupLabelKey: string
  /** Stable group key for grouping/ordering results. */
  groupKey: string
}

/** A group of already-filtered nav items to expose in the palette. */
export interface CommandGroupSource {
  key: string
  labelKey: string
  items: NavItem[]
}

/**
 * Flatten grouped nav items into palette entries.
 *
 * - Containers (`expandOnly`) are never emitted as entries: they have no
 *   navigable route (see the flyout notes above), only their children do.
 * - Dedupe is global and first-wins, so a path listed in several groups is
 *   attributed to the first group that claims it (mirrors the bar, where the
 *   flyout column wins over the personal list).
 */
export function buildCommandEntries(
  sources: CommandGroupSource[],
  t: (key: string) => string,
): CommandEntry[] {
  const entries: CommandEntry[] = []
  const seen = new Set<string>()

  const walk = (items: NavItem[], source: CommandGroupSource): void => {
    for (const item of items) {
      if (!item.expandOnly && !seen.has(item.path)) {
        seen.add(item.path)
        entries.push({
          path: item.path,
          label: resolveNavLabel(item, t),
          groupKey: source.key,
          groupLabelKey: source.labelKey,
        })
      }
      // Defensive: the grouped admin nav is already flattened, but the user /
      // simple-mode lists come straight from the builders where a group may
      // still carry children.
      if (item.children?.length) walk(item.children, source)
    }
  }

  for (const source of sources) walk(source.items, source)
  return entries
}
