# v3 Rebase onto Upstream Main Design

## Context

The `codex/apple-liquid-glass-v3` branch currently points to `0a094f355` and contains 24 commits not present in `upstream/main`. The latest upstream baseline is `d45135d87`. The branches diverge by 163 upstream commits and 24 v3 commits. Three of the v3-side commits are historical upstream synchronization merges.

The latest upstream frontend changes 54 files relative to the current shared base. A three-way merge reports content conflicts in `.gitignore`, `HomeView.vue`, the two CN provider quota/balance cells, and one Grok account test. The v3 branch must retain its Apple visual system while exposing every current upstream behavior.

## Goals

- Rebase the v3 design branch linearly onto the latest `upstream/main`.
- Preserve the v3 Apple design system, GlobalNav, landing page, command palette, model plaza presentation, chart theme, and component styling.
- Include all upstream frontend and backend functionality present at `d45135d87`.
- Adapt upstream's new user-visible controls to the v3 design language instead of restoring upstream's older visual markup.
- Verify behavior with focused red-green tests, the complete frontend test suite, type checking, a production build, and rendered desktop/mobile browser checks.
- Update `origin/codex/apple-liquid-glass-v3` only after verification, using `--force-with-lease`.

## Non-goals

- Do not redesign unrelated v3 surfaces.
- Do not retain obsolete upstream synchronization merge commits.
- Do not delete, rename, or edit the 143 existing untracked files whose names contain ` 2`.
- Do not add dependencies or new abstraction layers.
- Do not change `main` or `upstream/main`.

## History Strategy

Create a local backup branch at the current v3 tip before rewriting history. Perform a standard linear rebase of `codex/apple-liquid-glass-v3` onto `upstream/main`; do not use `--rebase-merges`. Git will omit upstream commits already reachable from the new base and replay only the v3-specific non-merge commits. This intentionally removes the old v3 synchronization merges while preserving the substantive design commits.

Work in the current checkout because the target branch is already checked out there and must be rewritten in place. The untracked ` 2` files do not share paths with tracked files and remain outside the rebase. If Git reports an untracked-path collision, abort the rebase and stop without moving those files.

After all checks pass, push the rewritten branch with an explicit lease tied to the previously fetched remote v3 commit. Never use an unconditional force push.

## Conflict Resolution Design

### Public home and model plaza

Keep the v3 compact and full landing page structures. Add a model plaza link to both home headers using the existing v3 `icon-btn`, button, spacing, and responsive conventions. Visibility must continue to use the upstream `modelPlaza` feature flag and `model_plaza_require_auth` setting:

- feature disabled: no link;
- public plaza: anonymous and authenticated visitors see the link;
- authentication required: only authenticated visitors see the link.

Router-owned access control remains authoritative.

### CN provider quota and balance cells

Keep the v3 `gpill`, quota meter, semantic color, and error presentation. Split the static balance/quota data from the manual action so the action has an explicit translated verb label. Preserve upstream snapshot rendering, stale-snapshot probing, auto-probe debounce, loading lock, failure passthrough, and test hooks. Ensure quota labels, bars, percentages, and reset times cannot overlap at narrow table widths.

### Grok account test

Use the current upstream official xAI endpoint expectation while preserving the v3 account-modal behavior. Resolve the test conflict without weakening its assertions.

### Repository ignore rules

Resolve `.gitignore` by keeping the union of relevant v3 and upstream rules. Do not add ignore patterns specifically to conceal the existing ` 2` files.

## Automatically Integrated Upstream Features

The rebase must retain the upstream implementations and tests for:

- Kimi, Zhipu GLM, and DeepSeek adaptive protocol routing and per-protocol base URLs;
- header overrides for eligible CN provider API-key accounts;
- channel Fast/Flex and token-interval input/output/cache multipliers;
- group-aware account long-context billing visibility while keeping WebSocket mode available;
- Composite routing to CN providers and Messages dispatch for Composite groups;
- the centralized platform option catalog across account, group, subscription, error-rule, channel, and Ops filters;
- enhanced Ops error details with upstream status, root-cause selection, and deduplicated diagnostic payloads;
- the cross-tab token refresh lock-loop correction;
- the latest Grok model catalog;
- all backend-only compatibility, routing, billing, retry, and provider fixes from upstream main.

Auto-merged code is not assumed correct merely because Git accepts it. Focused tests must cover these integration surfaces.

## Test-Driven Integration

For each manually resolved behavior, first restore the existing v3 production structure without adding the new behavior, then run the upstream/new focused test and confirm the expected failure:

1. Home model plaza visibility matrix.
2. CN balance static display plus explicit query action.
3. CN quota static tiers plus explicit query action and narrow-layout contract.
4. Grok account endpoint expectation if the replay leaves a behavioral mismatch.

Only after the red result should production markup or logic be changed. Each focused test must pass before moving to the next conflict. Existing upstream tests for adaptive protocols, channel multipliers, platform catalogs, Composite dispatch, Ops errors, token refresh, and Grok models must also pass after the rebase.

## Validation

Run, in order:

1. Focused Vitest files for the manually resolved conflicts and newly integrated upstream features.
2. Complete frontend Vitest run.
3. `vue-tsc --noEmit` type checking.
4. Vite production build.
5. Browser validation against the local app using the available in-app Browser tooling.

Rendered checks cover desktop and mobile viewports for the public home header and the authenticated account-management table. Confirm page identity, meaningful DOM, no framework overlay, no relevant console errors, screenshots, and interaction evidence for the model plaza link and CN query actions. Backend-dependent probe responses may be stubbed only through the project's existing test/dev mechanisms; the control state transition must still be exercised.

## Safety and Rollback

- The local backup branch is the rollback point for the pre-rebase v3 history.
- Any unexpected untracked-file collision, unresolved dependency mutation, or unexplained baseline failure stops the rebase.
- If verification fails after conflict resolution, keep the rewritten branch local and do not push.
- If the remote v3 branch changes after the initial fetch, `--force-with-lease` must reject the push; fetch and reassess instead of overriding the new remote state.

## Success Criteria

- `codex/apple-liquid-glass-v3` is based directly on `d45135d87` or a newer explicitly fetched `upstream/main` commit.
- The rewritten history contains the substantive v3 design commits without the three obsolete synchronization merges.
- All upstream features listed above are present and usable in the v3 frontend.
- The public home and CN quota/balance components follow v3 styling and upstream behavior.
- Focused and full tests, type checking, production build, and rendered browser checks pass.
- The remote v3 branch is updated with a successful lease-protected force push.
- No existing untracked ` 2` file is modified.
