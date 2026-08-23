# v3 Upstream Main Rebase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase `codex/apple-liquid-glass-v3` linearly onto the latest `upstream/main`, retain every upstream capability, and adapt conflicted user-facing controls to the v3 Apple design.

**Architecture:** Use a standard rebase so obsolete upstream-sync merge commits disappear and only substantive v3 commits replay on the new upstream base. Resolve the three production conflicts first to the pre-feature v3 structure, use upstream and v3 tests to establish red states, then add the smallest v3-styled behavior needed to pass. Verify all auto-integrated upstream features separately before full rendered QA and a lease-protected force push.

**Tech Stack:** Git, Vue 3, TypeScript, Vitest, Vue Test Utils, vue-tsc, Vite, Codex in-app Browser.

## Global Constraints

- Preserve the v3 Apple design system, GlobalNav, landing page, command palette, model plaza presentation, chart theme, and component styling.
- Include all upstream frontend and backend functionality present at `d45135d87` or a newer explicitly fetched `upstream/main`.
- Do not retain the three obsolete upstream synchronization merge commits.
- Do not delete, rename, edit, hide, or move any of the 143 existing untracked files whose names contain ` 2`.
- Do not add dependencies, factories, adapters, or new abstraction layers.
- Do not change `main` or `upstream/main`.
- Do not push until focused tests, full tests, type checking, production build, and rendered QA pass.
- Update the remote v3 branch only with an explicit `--force-with-lease=<ref>:<expected-object>`.

---

### Task 1: Protect the Existing Branch and Establish the Baseline

**Files:**
- Read: `docs/superpowers/specs/2026-08-23-v3-upstream-main-rebase-design.md`
- Read: `frontend/package.json`
- No tracked file changes.

**Interfaces:**
- Consumes: local branch `codex/apple-liquid-glass-v3`, remotes `origin` and `upstream`.
- Produces: backup branch `backup/apple-liquid-glass-v3-pre-main-20260823` and safety ref `refs/safety/origin-v3-before-rebase`.

- [ ] **Step 1: Fetch both remotes and verify the target refs**

Run:

```bash
git fetch --prune upstream
git fetch --prune origin
git rev-parse --verify refs/remotes/upstream/main
git rev-parse --verify refs/remotes/origin/codex/apple-liquid-glass-v3
git branch --show-current
```

Expected: the current branch is `codex/apple-liquid-glass-v3`; both remote refs resolve.

- [ ] **Step 2: Verify tracked cleanliness and inventory the protected untracked files**

Run:

```bash
git status --porcelain=v1 | awk 'BEGIN { tracked=0; untracked=0 } /^\?\?/ { untracked++; next } { tracked++ } END { printf "tracked=%d untracked=%d\n", tracked, untracked }'
git status --porcelain=v1 | awk '/^\?\?/ && / 2/ { count++ } END { print count+0 }'
```

Expected: `tracked=0`; the second count is `143`. Stop if either value differs.

- [ ] **Step 3: Create explicit rollback refs**

Run:

```bash
git branch backup/apple-liquid-glass-v3-pre-main-20260823 HEAD
git update-ref refs/safety/origin-v3-before-rebase refs/remotes/origin/codex/apple-liquid-glass-v3
git show-ref --verify refs/heads/backup/apple-liquid-glass-v3-pre-main-20260823
git show-ref --verify refs/safety/origin-v3-before-rebase
```

Expected: both refs point to valid commits; the safety ref records the remote value before history rewriting.

- [ ] **Step 4: Run the focused pre-rebase baseline without package-manager mutation**

Run from `frontend/`:

```bash
./node_modules/.bin/vitest run \
  src/views/__tests__/HomeView.compact.spec.ts \
  src/components/account/__tests__/CNProviderCells.visual.spec.ts \
  src/components/account/__tests__/CreateAccountModal.spec.ts \
  src/components/account/__tests__/EditAccountModal.spec.ts \
  src/components/admin/channel/__tests__/PricingEntryCard.timePricing.spec.ts \
  src/views/admin/__tests__/groupsMessagesDispatch.spec.ts \
  src/api/__tests__/tokenRefresh.spec.ts \
  src/composables/__tests__/useModelWhitelist.spec.ts
```

Expected: all selected pre-rebase tests pass. Stop and report any unexplained baseline failure.

---

### Task 2: Rebase the v3 History and Preserve Deliberate Red States

**Files:**
- Modify while resolving conflicts: `.gitignore`
- Modify while resolving conflicts: `frontend/src/views/HomeView.vue`
- Modify while resolving conflicts: `frontend/src/components/account/CNProviderBalanceCell.vue`
- Modify while resolving conflicts: `frontend/src/components/account/CNProviderQuotaCell.vue`
- Modify while resolving conflicts: `frontend/src/components/account/__tests__/CreateAccountModal.grok.spec.ts`

**Interfaces:**
- Consumes: backup/safety refs from Task 1 and latest `upstream/main`.
- Produces: a linear v3 branch rooted at `upstream/main`, with v3 markup retained in the three production conflict files and upstream tests retained.

- [ ] **Step 1: Start the standard linear rebase**

Run:

```bash
GIT_EDITOR=true git rebase upstream/main
```

Expected: Git replays only v3-specific non-merge commits and pauses on content conflicts.

- [ ] **Step 2: Resolve repository and test conflicts without weakening coverage**

Use `apply_patch` to:

- keep the union of meaningful upstream and v3 `.gitignore` rules;
- keep the upstream official xAI default expectation in `CreateAccountModal.grok.spec.ts`;
- remove every conflict marker.

Run:

```bash
rg -n '^(<<<<<<<|=======|>>>>>>>)' .gitignore frontend/src/components/account/__tests__/CreateAccountModal.grok.spec.ts
git add .gitignore frontend/src/components/account/__tests__/CreateAccountModal.grok.spec.ts
```

Expected: `rg` prints nothing before staging.

- [ ] **Step 3: Resolve the three production files to the existing v3 structure**

Use `apply_patch` to retain the pre-feature v3 structure in:

- `HomeView.vue`: v3 compact/full landing headers, without adding the model plaza link yet;
- `CNProviderBalanceCell.vue`: v3 `gpill` presentation, without the new static-value/action split yet;
- `CNProviderQuotaCell.vue`: v3 quota rows and meter, without the new explicit-action layout yet.

Do not remove upstream tests. Stage the resolved files:

```bash
git add frontend/src/views/HomeView.vue \
  frontend/src/components/account/CNProviderBalanceCell.vue \
  frontend/src/components/account/CNProviderQuotaCell.vue
```

Expected: these files contain v3 markup and no conflict markers, so the upstream behavior tests can establish the red state after the rebase completes.

- [ ] **Step 4: Continue until the rebase finishes**

Run after every resolved stop:

```bash
GIT_EDITOR=true git rebase --continue
```

Repeat conflict inspection and precise `apply_patch` resolution until Git reports success. Never use `git checkout --`, `git reset --hard`, or an unconditional force operation.

- [ ] **Step 5: Verify the new history shape**

Run:

```bash
git merge-base --is-ancestor upstream/main HEAD
git rev-list --merges upstream/main..HEAD
git log --oneline --decorate --first-parent upstream/main..HEAD
```

Expected: the ancestor check exits 0; the merge list is empty; the log contains the substantive v3 commits plus the design/plan documentation commits.

- [ ] **Step 6: Confirm the intended red failures**

Run from `frontend/`:

```bash
./node_modules/.bin/vitest run \
  src/views/__tests__/HomeView.compact.spec.ts \
  src/components/account/__tests__/CNProviderBalanceCell.spec.ts \
  src/components/account/__tests__/CNProviderQuotaCell.spec.ts
```

Expected failures:

- Home tests cannot find `/model-plaza` in the compact/default v3 headers.
- Balance tests cannot find `data-test="cn-provider-balance-value"` and `data-test="cn-provider-balance-probe"`.
- Quota tests cannot find `data-test="cn-provider-quota-probe"` and the readable-layout hooks.

These are behavior failures, not compilation or import errors.

---

### Task 3: Expose Model Plaza from Both v3 Home Headers

**Files:**
- Modify: `frontend/src/views/HomeView.vue`
- Test: `frontend/src/views/__tests__/HomeView.compact.spec.ts`

**Interfaces:**
- Consumes: `FeatureFlags.modelPlaza`, `isFeatureFlagEnabled()`, `cachedPublicSettings.model_plaza_require_auth`, and `authStore.isAuthenticated`.
- Produces: computed `showModelPlazaEntry: ComputedRef<boolean>` and a `/model-plaza` router link in each built-in v3 home header.

- [ ] **Step 1: Tighten the failing test around the v3 link contract**

Keep the upstream visibility matrix and add this assertion to the public/default-header case:

```ts
const plazaLink = wrapper
  .findAllComponents(RouterLinkStub)
  .find((link) => link.props('to') === '/model-plaza')

expect(plazaLink?.attributes('aria-label')).toBe('nav.modelPlaza')
```

Run:

```bash
./node_modules/.bin/vitest run src/views/__tests__/HomeView.compact.spec.ts
```

Expected: FAIL because the v3 home contains no `/model-plaza` link.

- [ ] **Step 2: Add the upstream visibility computation**

Add to `HomeView.vue`:

```ts
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'

const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))
const modelPlazaRequiresAuth = computed(
  () => appStore.cachedPublicSettings?.model_plaza_require_auth === true
)
const showModelPlazaEntry = computed(
  () => modelPlazaEnabled.value && (isAuthenticated.value || !modelPlazaRequiresAuth.value)
)
```

- [ ] **Step 3: Add the v3-styled link to compact and full headers**

Insert once in each built-in header action group:

```vue
<router-link
  v-if="showModelPlazaEntry"
  to="/model-plaza"
  class="icon-btn"
  :aria-label="t('nav.modelPlaza')"
  :title="t('nav.modelPlaza')"
>
  <Icon name="grid" size="md" />
</router-link>
```

Do not add the link to custom HTML/iframe home modes because those modes intentionally own their full page.

- [ ] **Step 4: Verify green and commit**

Run:

```bash
./node_modules/.bin/vitest run src/views/__tests__/HomeView.compact.spec.ts
git add src/views/HomeView.vue src/views/__tests__/HomeView.compact.spec.ts
git commit -m "fix(frontend): expose model plaza on v3 home"
```

Expected: all HomeView compact/default tests pass.

---

### Task 4: Split CN Provider Data from Explicit Query Actions

**Files:**
- Modify: `frontend/src/components/account/CNProviderBalanceCell.vue`
- Modify: `frontend/src/components/account/CNProviderQuotaCell.vue`
- Modify: `frontend/src/components/account/__tests__/CNProviderQuotaCell.spec.ts`
- Modify: `frontend/src/components/account/__tests__/CNProviderCells.visual.spec.ts`
- Test: `frontend/src/components/account/__tests__/CNProviderBalanceCell.spec.ts`

**Interfaces:**
- Consumes: existing `balanceLabel`, `handleProbe()`, `data.tiers`, `windowLabel()`, v3 classes `gpill`, `b-blue`, `quota-row`, `quota-label-wide`, `quota-meter`, `quota-value`.
- Produces: static balance/quota display hooks and explicit translated query buttons without changing API calls or snapshot behavior.

- [ ] **Step 1: Adapt the layout regression test to the v3 design contract**

In `CNProviderQuotaCell.spec.ts`, replace upstream Tailwind-specific label assertions with:

```ts
const root = wrapper.get('[data-test="cn-provider-quota"]')
expect(root.classes()).toContain('min-w-[220px]')

const probeButton = root.get('[data-test="cn-provider-quota-probe"]')
expect(probeButton.classes()).toEqual(
  expect.arrayContaining(['quota-probe', 'gpill', 'b-blue', 'whitespace-nowrap'])
)

for (const tier of root.findAll('[data-test="cn-provider-quota-tier"]')) {
  expect(tier.classes()).toContain('quota-row')
}

for (const label of root.findAll('[data-test="cn-provider-quota-label"]')) {
  expect(label.classes()).toEqual(expect.arrayContaining(['quota-label', 'quota-label-wide']))
}
```

In `CNProviderCells.visual.spec.ts`, assert that the balance value is not a button and the query control retains the v3 pill:

```ts
expect(wrapper.get('[data-test="cn-provider-balance-value"]').element.tagName).toBe('SPAN')
expect(
  wrapper.get('[data-test="cn-provider-balance-probe"]').classes()
).toEqual(expect.arrayContaining(['quota-probe', 'gpill', 'b-blue']))
```

Run:

```bash
./node_modules/.bin/vitest run \
  src/components/account/__tests__/CNProviderBalanceCell.spec.ts \
  src/components/account/__tests__/CNProviderQuotaCell.spec.ts \
  src/components/account/__tests__/CNProviderCells.visual.spec.ts
```

Expected: FAIL because the v3 components still combine values/captions with the click target.

- [ ] **Step 2: Split the balance value and action**

Replace the top of the balance template with this structure while preserving the existing low-balance badge and SVG:

```vue
<div class="flex flex-wrap items-center gap-1.5">
  <span
    data-test="cn-provider-balance-value"
    class="gpill"
    :class="platformTextClass(account.platform)"
    :title="t('admin.accounts.cnProviders.balanceProbeTooltip')"
  >
    {{ balanceLabel }}
  </span>
  <!-- existing low-balance badge -->
</div>
<div class="flex flex-wrap items-center gap-1.5">
  <button
    type="button"
    data-test="cn-provider-balance-probe"
    class="quota-probe gpill b-blue"
    :disabled="loading"
    :title="t('admin.accounts.cnProviders.balanceProbeTooltip')"
    @click="handleProbe"
  >
    <!-- existing refresh SVG -->
    {{ t('admin.accounts.cnProviders.probe') }}
  </button>
</div>
```

Do not change `currentEntries`, snapshot precedence, failure handling, or the query API.

- [ ] **Step 3: Put quota tiers before the explicit action**

Use this v3 structure:

```vue
<div
  v-if="visible"
  data-test="cn-provider-quota"
  class="min-w-[220px] space-y-1"
>
  <div v-if="data?.success && data.tiers?.length" class="space-y-1">
    <div
      v-for="tier in data.tiers"
      :key="tier.window"
      data-test="cn-provider-quota-tier"
      class="quota-row"
    >
      <span
        data-test="cn-provider-quota-label"
        class="quota-label quota-label-wide"
      >
        {{ windowLabel(tier.window) }}
      </span>
      <!-- existing v3 meter, percentage, and reset-time markup -->
    </div>
  </div>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      type="button"
      data-test="cn-provider-quota-probe"
      class="quota-probe gpill b-blue whitespace-nowrap"
      :disabled="loading"
      :title="t('admin.accounts.cnProviders.probeTooltip')"
      @click="handleProbe()"
    >
      <!-- existing refresh SVG -->
      {{ t('admin.accounts.cnProviders.probe') }}
    </button>
  </div>
  <!-- existing error row -->
</div>
```

Do not change stale-snapshot detection, auto-probe debounce, utilization thresholds, or reset formatting.

- [ ] **Step 4: Verify green and commit**

Run:

```bash
./node_modules/.bin/vitest run \
  src/components/account/__tests__/CNProviderBalanceCell.spec.ts \
  src/components/account/__tests__/CNProviderQuotaCell.spec.ts \
  src/components/account/__tests__/CNProviderCells.visual.spec.ts
git add \
  src/components/account/CNProviderBalanceCell.vue \
  src/components/account/CNProviderQuotaCell.vue \
  src/components/account/__tests__/CNProviderQuotaCell.spec.ts \
  src/components/account/__tests__/CNProviderCells.visual.spec.ts
git commit -m "fix(frontend): align CN quota actions with v3"
```

Expected: all three files' tests pass; manual queries still call the account ID once and failed queries retain snapshot data.

---

### Task 5: Verify Every Automatically Integrated Upstream Capability

**Files:**
- Verify: `frontend/src/components/account/CreateAccountModal.vue`
- Verify: `frontend/src/components/account/EditAccountModal.vue`
- Verify: `frontend/src/components/account/credentialsBuilder.ts`
- Verify: `frontend/src/components/account/longContextBilling.ts`
- Verify: `frontend/src/api/admin/channels.ts`
- Verify: `frontend/src/components/admin/channel/IntervalRow.vue`
- Verify: `frontend/src/components/admin/channel/PricingEntryCard.vue`
- Verify: `frontend/src/components/admin/channel/types.ts`
- Verify: `frontend/src/constants/platforms.ts`
- Verify: `frontend/src/views/admin/GroupsView.vue`
- Verify: `frontend/src/views/admin/groupsMessagesDispatch.ts`
- Verify: `frontend/src/views/admin/ops/components/OpsErrorDetailModal.vue`
- Verify: `frontend/src/api/tokenRefresh.ts`
- Verify: `frontend/src/composables/useModelWhitelist.ts`

**Interfaces:**
- Consumes: upstream implementations replayed before v3 commits.
- Produces: evidence that v3 replay did not silently erase upstream behavior.

- [ ] **Step 1: Run account protocol, header override, and long-context tests**

Run from `frontend/`:

```bash
./node_modules/.bin/vitest run \
  src/components/account/__tests__/credentialsBuilder.cnAdaptive.spec.ts \
  src/components/account/__tests__/credentialsBuilder.spec.ts \
  src/components/account/__tests__/longContextBilling.spec.ts \
  src/components/account/__tests__/BulkEditAccountModal.spec.ts \
  src/components/account/__tests__/CreateAccountModal.spec.ts \
  src/components/account/__tests__/EditAccountModal.spec.ts
```

Expected: adaptive protocol URLs, `api_base_urls`, CN header overrides, legacy protocol compatibility, and long-context gating all pass.

- [ ] **Step 2: Run channel pricing tests**

Run:

```bash
./node_modules/.bin/vitest run \
  src/components/admin/channel/__tests__/types.spec.ts \
  src/components/admin/channel/__tests__/PricingEntryCard.timePricing.spec.ts
```

Expected: Fast/Flex and interval input/output/cache multipliers round-trip and reject non-positive values.

- [ ] **Step 3: Run Composite and platform-catalog tests**

Run:

```bash
./node_modules/.bin/vitest run \
  src/constants/__tests__/platforms.spec.ts \
  src/views/admin/__tests__/GroupsView.compositePlatforms.spec.ts \
  src/views/admin/__tests__/channelPlatformOptions.spec.ts \
  src/views/admin/__tests__/groupsMessagesDispatch.spec.ts \
  src/views/admin/__tests__/platformFilterCatalogUsage.spec.ts
```

Expected: Kimi, Zhipu, and DeepSeek appear across concrete/composite selectors, and Messages dispatch accepts OpenAI and Composite only.

- [ ] **Step 4: Run Ops, refresh-lock, and Grok model tests**

Run:

```bash
./node_modules/.bin/vitest run \
  src/views/admin/ops/components/__tests__/OpsErrorDetailModal.spec.ts \
  src/api/__tests__/tokenRefresh.spec.ts \
  src/composables/__tests__/useModelWhitelist.spec.ts \
  src/components/account/__tests__/CreateAccountModal.grok.spec.ts
```

Expected: upstream status/root-cause/payload sections, cross-tab refresh behavior, and the current Grok catalog/default endpoint pass.

- [ ] **Step 5: Confirm the key production markers exist once**

Run:

```bash
rg -n 'defaultCNAdaptiveBaseUrls|api_base_urls' src/components/account
rg -n 'fast_multiplier|input_multiplier' src/api/admin/channels.ts src/components/admin/channel
rg -n 'supportsMessagesDispatchPlatform|CONCRETE_PLATFORM_OPTIONS' src/views src/components src/constants
rg -n 'diagnosticPayloadSections|upstreamStatusClass' src/views/admin/ops/components/OpsErrorDetailModal.vue
rg -n 'grok-imagine-image-2.0' src/composables/useModelWhitelist.ts
```

Expected: every marker is present in its upstream implementation and consumers; no duplicate compatibility implementation is added.

---

### Task 6: Run Full Static and Behavioral Verification

**Files:**
- Verify all tracked frontend source and tests.
- Do not create reports, traces, or screenshots inside the repository.

**Interfaces:**
- Consumes: completed Tasks 1-5.
- Produces: fresh full-suite, type-check, and production-build evidence.

- [ ] **Step 1: Run the complete frontend test suite while excluding protected copies**

Run from `frontend/`:

```bash
./node_modules/.bin/vitest run --exclude '**/* 2.ts'
```

Expected: all tracked frontend tests pass with zero failures.

- [ ] **Step 2: Run type checking**

Run:

```bash
./node_modules/.bin/vue-tsc --noEmit
```

Expected: exit 0 with no TypeScript errors. If an error originates only from an untracked ` 2` file, report the protected-file blocker instead of editing that file.

- [ ] **Step 3: Run the production build**

Run:

```bash
./node_modules/.bin/vite build
```

Expected: exit 0 and a successful production bundle.

- [ ] **Step 4: Verify source cleanliness**

Run from the repository root:

```bash
git diff --check
git status --porcelain=v1 | awk 'BEGIN { tracked=0; untracked=0 } /^\?\?/ { untracked++; next } { tracked++ } END { printf "tracked=%d untracked=%d\n", tracked, untracked }'
```

Expected: no whitespace errors; tracked changes are zero after commits; protected untracked count remains 143.

---

### Task 7: Validate the Rendered v3 UI

**Files:**
- Read: `frontend/src/views/HomeView.vue`
- Read: `frontend/src/components/account/CNProviderBalanceCell.vue`
- Read: `frontend/src/components/account/CNProviderQuotaCell.vue`
- Screenshots: save outside the repository.

**Interfaces:**
- Consumes: built frontend, project dev server, Codex in-app Browser.
- Produces: desktop/mobile DOM, console, screenshot, and interaction evidence.

- [ ] **Step 1: Read the Browser control skill and define the target flows**

Read `/Users/zhanghjay/.codex/plugins/cache/openai-bundled/browser/26.818.41509/skills/control-in-app-browser/SKILL.md` completely.

Record:

```text
Flow 1: / -> enabled public model plaza link -> /model-plaza renders.
Flow 2: /admin/accounts -> CN balance/quota cell -> explicit query action enters loading and returns to a stable result/error state.
```

- [ ] **Step 2: Start a temporary public-settings endpoint and the existing Vite app**

First verify the dedicated QA ports are unused:

```bash
lsof -nP -iTCP:18080 -sTCP:LISTEN
lsof -nP -iTCP:4173 -sTCP:LISTEN
```

Expected: both commands print nothing. Stop instead of terminating an unrelated process if either port is occupied.

Start this temporary stdlib-only endpoint outside the repository; it exposes public model plaza settings and returns an unauthenticated response for other API paths:

```bash
python3 -c 'from http.server import BaseHTTPRequestHandler,HTTPServer; import json
class H(BaseHTTPRequestHandler):
 def do_GET(self):
  body={"code":0,"data":{"site_name":"V3 QA","site_subtitle":"Upstream integration QA","registration_enabled":True,"model_plaza_enabled":True,"model_plaza_require_auth":False,"compact_home_enabled":False}} if self.path=="/api/v1/settings/public" else {"code":401,"message":"unauthenticated"}
  raw=json.dumps(body).encode(); self.send_response(200 if self.path=="/api/v1/settings/public" else 401); self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(raw))); self.end_headers(); self.wfile.write(raw)
 def log_message(self,*args): pass
HTTPServer(("127.0.0.1",18080),H).serve_forever()'
```

In a second session, run from `frontend/`:

```bash
VITE_DEV_PROXY_TARGET=http://127.0.0.1:18080 \
  ./node_modules/.bin/vite --host 127.0.0.1 --port 4173
```

Expected: `http://127.0.0.1:4173/` renders the v3 home with the public model plaza link. Flow 2 remains proven by the real Vue component interaction tests from Task 4 because the temporary endpoint intentionally contains no admin account fixture; record that as the browser-only limitation.

- [ ] **Step 3: Run the in-app Browser checks**

Use the Browser skill sequence:

```text
nameSession -> selected/new tab -> goto -> url/title -> domSnapshot
-> console warn/error logs -> target interaction -> state assertion -> screenshot
```

For Flow 1, verify desktop and mobile widths, no clipping in the sticky header, correct link visibility, navigation to `/model-plaza`, and no framework overlay.

For Flow 2 when the fixture exists, verify the balance/quota text is static, the explicit translated query action is separately focusable/clickable, the loading icon/state changes, and the row does not overlap at desktop and narrow table widths.

- [ ] **Step 4: Stop only the processes started for this validation**

Stop the recorded dev-server sessions without touching unrelated local processes.

Expected: no repository file changes and no orphaned validation process.

---

### Task 8: Final History Verification and Lease-Protected Push

**Files:**
- No file changes.

**Interfaces:**
- Consumes: passing verification and `refs/safety/origin-v3-before-rebase`.
- Produces: updated `origin/codex/apple-liquid-glass-v3` with recoverable local backup retained.

- [ ] **Step 1: Re-fetch without discarding the recorded lease**

Run:

```bash
git fetch --prune origin
git show-ref --verify refs/safety/origin-v3-before-rebase
git show-ref --verify refs/heads/backup/apple-liquid-glass-v3-pre-main-20260823
```

Expected: safety refs still exist. Compare the freshly fetched remote v3 hash to the safety ref; stop if they differ.

- [ ] **Step 2: Re-run the final proof commands**

Run:

```bash
git merge-base --is-ancestor upstream/main HEAD
test -z "$(git rev-list --merges upstream/main..HEAD)"
git status --porcelain=v1 | awk 'BEGIN { tracked=0 } !/^\?\?/ { tracked++ } END { exit tracked != 0 }'
```

Expected: all commands exit 0.

- [ ] **Step 3: Push with the explicit recorded lease**

Run:

```bash
expected=$(git rev-parse refs/safety/origin-v3-before-rebase)
git push \
  --force-with-lease=refs/heads/codex/apple-liquid-glass-v3:$expected \
  origin HEAD:refs/heads/codex/apple-liquid-glass-v3
```

Expected: the remote branch updates; a concurrent remote change causes a safe rejection.

- [ ] **Step 4: Verify local, remote, and upstream ancestry**

Run:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse refs/remotes/origin/codex/apple-liquid-glass-v3
git merge-base --is-ancestor upstream/main refs/remotes/origin/codex/apple-liquid-glass-v3
```

Expected: local and remote v3 hashes match and the upstream ancestry check exits 0. Keep the local backup branch for rollback.
