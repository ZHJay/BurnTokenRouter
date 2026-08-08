# Layout Components

Vue 3 layout components for the Sub2API frontend, built with Composition API,
TypeScript, and the Phase B Apple Liquid Glass design system.

## Components

### 1. AppLayout.vue

Main application shell: renders `GlobalNav` (replaces the old sidebar +
header), a page head (title/description from route meta — previously rendered
by `AppHeader`), and the default slot for page content.

**Usage:**

```vue
<template>
  <AppLayout>
    <!-- Your page content here -->
    <h1>Dashboard</h1>
    <p>Welcome to your dashboard!</p>
  </AppLayout>
</template>

<script setup lang="ts">
import { AppLayout } from '@/components/layout'
</script>
```

**Features:**

- 48px sticky frosted top bar with centered apple.com-style navigation
- Flyout mega-menus (admin), curtain dim, mobile hamburger menu
- Page head with `pageTitle` / `pageDescription` from `route.meta`
- Onboarding tour setup (`useOnboardingTour`, `replayTour` exposed via
  `defineExpose`)
- Public contract unchanged: `name`, no props, default slot — views that
  import `AppLayout` directly need no edits

---

### 2. GlobalNav.vue

The apple.com-style top navigation. Replaces the deleted `AppSidebar.vue` and
`AppHeader.vue`; the nav data model lives in the plain TS module `navItems.ts`.

**Features:**

- Plain-text wordmark (`site_name`), no logo image anywhere
- User / personal / admin nav lists with the original two-pass filtering:
  `applyFeatureFlags` (opt-in/opt-out via `utils/featureFlags.ts`) then
  simple-mode filtering (`hideInSimpleMode`)
- Admin flyout mega-menus: **Dashboard | Resources▾ | Operations▾ |
  Analytics▾ | Settings** (grouping declared in `ADMIN_FLYOUT_GROUPS`,
  applied by `groupAdminNav`)
- Custom menu items from public settings (`visibility: 'user'`) and
  `adminSettingsStore.customMenuItems` (`visibility: 'admin'`), sorted by
  `sort_order`, keyed `/custom/<id>`
- Curtain (light 18% / dark 45% black) behind open flyouts; opaque flyout,
  popover and search panels (`--glass-bg-strong`)
- Right action cluster: expanding search bar, `AnnouncementBell`, docs link
  (sanitized), Model Plaza link (`embedded=1`), `LocaleSwitcher`,
  `SubscriptionProgressMini`, balance chip with available/frozen/total hover
  breakdown, theme toggle (via `@/composables/useTheme`), user dropdown
  (profile / keys / GitHub / contact support / replay guide / logout /
  `VersionBadge`)
- Mobile (≤768px): hamburger fullscreen accordion menu, body scroll lock,
  `Escape` to close, basic focus trap
- Keyboard navigable: flyout triggers expose `aria-expanded`/`aria-haspopup`,
  icon buttons carry `aria-label`, `:focus-visible` outline styled
- Onboarding tour anchors preserved:
  `#sidebar-channel-manage` (`/admin/accounts`),
  `#sidebar-group-manage` (`/admin/groups`),
  `#sidebar-wallet` (`/admin/redeem`),
  `[data-tour="sidebar-my-keys"]` (`/keys` for users, admin dropdown)

Styles live in `src/styles/global-nav.css` (design tokens only — never
hardcode colors).

---

### 3. AuthLayout.vue

Centered glass card layout for auth pages (login/register/OAuth callbacks).
Brand is a plain-text wordmark (no logo image); fetches public settings on
mount.

**Usage:**

```vue
<template>
  <AuthLayout>
    <form>…</form>
    <template #footer>
      <a href="/register">Create account</a>
    </template>
  </AuthLayout>
</template>

<script setup lang="ts">
import { AuthLayout } from '@/components/layout'
</script>
```

---

### 4. TablePageLayout.vue

Fixed actions/filters/pagination + scrollable table body. Height accounts for
the 48px GlobalNav: `calc(100vh - 48px - 4rem)`. Mobile mode (<1024px) falls
back to natural page scroll.

```vue
<TablePageLayout>
  <template #actions>…</template>
  <template #filters>…</template>
  <template #table>…</template>
  <template #pagination>…</template>
</TablePageLayout>
```

---

### 5. navItems.ts

Typed navigation data model (not a component):

- `NavItem` — path / labelKey / label / hideInSimpleMode / children /
  expandOnly / featureFlag
- `applyFeatureFlags(items)` — recursive flag filter (`false` hides)
- `finalizeNav(items, isSimpleMode)` — flags then simple-mode filter
- `buildSelfNavItems(deps, withDashboard)` — user / personal lists
- `buildAdminNavItems(deps)` — flat admin list incl. simple-mode re-appends
  (`/keys`, `/admin/settings`, admin customs)
- `ADMIN_FLYOUT_GROUPS` + `groupAdminNav(items)` — flyout grouping
- `isPathActive(path, current)` — exact-or-prefix active detection

Non-admin users in backend mode see no nav (handled in `GlobalNav.vue`).
