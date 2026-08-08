# Phase B QA harnesses — `verify.py` + `sweep.py`

Two proven Playwright harnesses for the Apple Liquid Glass / Phase B restyle,
migrated out of `/tmp/root-qa` (which gets wiped) so the next agent inherits
them.  They were the acceptance gate for Phase B: `verify.py` is the compact
150-assertion gate, `sweep.py` is the full route-matrix evidence sweep.

Both scripts are **self-locating**: `DIST` (the production build) derives from
the script's own file path (`Path(__file__).resolve().parent.parents[2]` =
repo root), so they work from any checkout.  They serve the build locally with
SPA fallback, mock **every** API call (nothing touches a backend or a
database), and seed localStorage before app code runs.

Neither script writes into the repo: screenshots and the results JSON default
to `/tmp` and can be redirected with env vars.  Run with
`PYTHONDONTWRITEBYTECODE=1` to keep `.pyc` files out of the tree (a scoped
`.gitignore` entry for `frontend/design-demo/phase-b-qa/__pycache__/` is also
in place as a backstop).

## `verify.py` — acceptance harness (150/150)

Serves the production build, mocks all APIs, seeds `auth_token` / `auth_user` /
`theme` (+ onboarding-tour suppression), and runs programmatic assertions for
what unit tests cannot see:

- no horizontal overflow at 375px **and** 768px (the 768px breakpoint is where
  `.gn-links` collapses into the hamburger while the action cluster is still
  wide — testing only 375/1440 is how a 768px overflow slipped past once);
- global nav computes to exactly 48px;
- every nav child stays inside the 48px bar (a missing flex rule can spill the
  action cluster while `.gn` itself still measures 48px);
- admin table `thead th` vs first-row `td` alignment (<=1.5px) + equal first-row
  cell heights (Phase A regression guard);
- flyout opens, spans the full nav width, renders columns, is opaque
  (alpha == 1), occludes the page (`elementFromPoint`), and raises the curtain;
- dark mode actually lands (`html.dark` + painted background + `--blue`);
- zero site-logo `<img>` renders anywhere.

**Expected score: 150/150.**  If the count ever differs, report the exact delta
and investigate — do not "fix" it by weakening an assertion.

```bash
# from the repo root
PYTHONDONTWRITEBYTECODE=1 /opt/miniconda3/bin/python \
  frontend/design-demo/phase-b-qa/verify.py
```

Full run: ~3–5 min (50 browser contexts).  Exit code 0 = green.

## `sweep.py` — full route-matrix sweep

Captures every reachable route (59 named + 404) × light/dark × desktop
1440×900 / mobile 375×812 = 246 screenshots, plus interaction states (admin
flyouts ×3, mobile menu, search bar, avatar dropdown, create-account modal),
and per-page asserts: landed-on-route, theme, nav height, table alignment,
text-contrast spot check, mobile overflow, console errors, failed requests.
Results land in `sweep-results.json`.

```bash
# full run (~2 h, 4 workers by default)
PYTHONDONTWRITEBYTECODE=1 /opt/miniconda3/bin/python \
  frontend/design-demo/phase-b-qa/sweep.py

# smoke run — a few routes only (interactions section still runs)
QA_ONLY=login,dashboard,admin-accounts \
  PYTHONDONTWRITEBYTECODE=1 /opt/miniconda3/bin/python \
  frontend/design-demo/phase-b-qa/sweep.py
```

`sweep.py` imports helpers from `verify.py` (`import verify` — server, seed,
`goto_ready`, row factories); it inserts its own directory into `sys.path`, so
the import works no matter what cwd it is invoked from.  Keep both files in the
same directory.

## Env vars

| Var | Default | Used by | Meaning |
| --- | --- | --- | --- |
| `CHROME_HEADLESS_SHELL` | `~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell` | both | Chromium executable |
| `QA_PORT` | 5287 (verify) / 5293 (sweep) | both | Static-server port |
| `QA_DIST` | derived from script location → `backend/internal/web/dist` | both | Production build to serve |
| `QA_SHOTS` | `/tmp/burntokenrouter-qa/shots` | verify | Screenshot dir |
| `QA_SWEEP_SHOTS` | `/tmp/burntokenrouter-qa/shots-full` | sweep | Screenshot dir |
| `QA_SWEEP_OUT` | `/tmp/burntokenrouter-qa` | sweep | Where `sweep-results.json` goes |
| `QA_WORKERS` | `4` | sweep | Parallel route-sweep threads |
| `QA_ONLY` | empty | sweep | Comma-separated route keys to limit the run (e.g. `login,dashboard`) |

The ports differ so the two harnesses can run side-by-side.

## The three traps that cost real time

1. **Onboarding tour overlay.**  The driver.js onboarding tour auto-starts and
   renders a full-viewport `.driver-overlay` SVG that intercepts every pointer
   event, making the nav unclickable and poisoning `elementFromPoint` checks.
   Both harnesses suppress it by seeding the storage keys
   `admin_guide_<userId>_<role>_v4_interactive` / `user_guide_<userId>_<role>_v4_interactive`
   (key format: `getStorageKey()` in `useOnboardingTour`) before app code runs.
   If the nav ever becomes unclickable in a new script, check these keys first.
2. **`networkidle` never fires (and lies about mount).**  Polling dashboards
   never idle, and `networkidle` can return before Vue has mounted on a cold
   start.  Use the `goto_ready()` helper (waits for `#app` children, then the
   `.gn` nav) with a retry instead.
3. **`full_page=True` smears sticky/fixed chrome.**  Full-page screenshots
   duplicate/smear `position: sticky` / `fixed` elements (nav, header, flyout
   overlays), so judge overlays and the nav with **viewport** screenshots only.
   Both harnesses capture with `full_page=False`.

## Notes

- The build lives at `backend/internal/web/dist`.  Rebuild only if it is
  missing or stale: `cd frontend && pnpm build` (use `pnpm exec` — local pnpm
  11 rewrites `pnpm-lock.yaml` and drops its security `overrides`).
- Never start `backend/bin/server` — it attaches to a real database.  These
  harnesses are fully mocked by design.
- Do not move these files under `frontend/scripts/`: the bare `scripts`
  pattern in `.gitignore` makes that whole tree invisible to git.  This
  directory (`frontend/design-demo/phase-b-qa/`) is tracked and was chosen
  deliberately, following the Phase A precedent (`qa-screenshot.py` in
  `frontend/design-demo/`).
