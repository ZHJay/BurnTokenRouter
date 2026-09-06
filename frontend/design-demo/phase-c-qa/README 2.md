# Phase C QA harness — landing page (`HomeView`)

Playwright harnesses for the Phase C landing-page work, kept **here rather than
`frontend/scripts/`** because `.gitignore` line 125 is a bare `scripts` rule and
git applies it to a directory of that name at *any* depth. Anything under
`frontend/scripts/` is invisible to the next agent:

```
$ git check-ignore -v frontend/scripts/
.gitignore:125:scripts	frontend/scripts/
$ git ls-files frontend/scripts/ | wc -l
0
```

Before adding a tool anywhere, run `git check-ignore -v <path>` and confirm it
exits **1**. "I moved the file" is not evidence — that is exactly the trap
recorded as lesson 8.12 in `HANDOFF-PHASE-C.md`.

## Files

| File | Purpose |
| --- | --- |
| `phase-c-landing-qa.py` | Main acceptance harness, **75/75**. 3 breakpoints × light/dark, reduced-motion, CTA gating, long-`site_name` truncation. |
| `phase-c-dark-probe.py` | Reproduces the alpha=35 capture artifact documented below. Kept because that mechanism is still unexplained — if you see a "washed out" dark screenshot, start here. |
| `phase-c-reveal-diag.py` | Per-scroll-step diagnosis of `IntersectionObserver` reveal delivery (`is-in` count vs computed opacity). |

Four single-use probes were **not** migrated — they existed only to isolate the
alpha artifact and their conclusions are recorded below, so re-running them adds
nothing: `phase-c-veil-probe.py` (per-route control), `phase-c-backdrop-test.py`
(falsified `backdrop-filter`), `phase-c-paint-control.py` (inject-known-colour
test), `phase-c-renderer-compare.py` (headless-shell vs full Chromium). They are
still in `frontend/scripts/` (untracked) at the time of writing.

## Running

```bash
# Build first. Do NOT write into the shared backend/internal/web/dist while
# other agents are working — send output to a temp dir and point QA_DIST at it.
cd frontend && ./node_modules/.bin/vite build --outDir /tmp/phase-c-dist --emptyOutDir

QA_DIST=/tmp/phase-c-dist PYTHONDONTWRITEBYTECODE=1 /opt/miniconda3/bin/python \
  frontend/design-demo/phase-c-qa/phase-c-landing-qa.py
```

Never use the `pnpm` CLI in this repo — **including `pnpm exec`**. pnpm 11.16
runs an install check before any subcommand and rewrites
`frontend/pnpm-lock.yaml`, dropping three security pins (`js-cookie`,
`form-data`, `postcss`). Call binaries directly via `./node_modules/.bin/*`.

### Environment

| Var | Default | Meaning |
| --- | --- | --- |
| `QA_DIST` | `<repo>/backend/internal/web/dist` | Build to serve. **Set this** to avoid the shared dist. |
| `QA_SHOTS` | `/tmp/phase-c-landing/shots` | Screenshot output (never written into the repo). |
| `QA_PORT` | 5391 (qa) / 5397 (reveal) / 5399 (dark) | Static server port. |
| `CHROME_HEADLESS_SHELL` | `~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell` | Browser binary. |

`REPO_ROOT` is derived as `Path(__file__).resolve().parents[3]` — this directory
is four levels below the repo root. **If you move these scripts, update that
index.**

> **Correction (/root).** An earlier draft of this README claimed
> `phase-b-qa/verify.py:33` had the same path bug because it uses `parents[2]`.
> **That claim was wrong — do not act on it.** The two scripts differ in what
> they take `parents[]` of, and both land on the repo root:
>
> - `phase-b-qa/verify.py` first does `_HERE = Path(__file__).resolve().parent`
>   (= `.../design-demo/phase-b-qa`), then `_HERE.parents[2]`:
>   `design-demo` → `frontend` → repo root. ✓
> - `phase-c-qa/*.py` take `parents[3]` of the **file**:
>   `phase-c-qa` → `design-demo` → `frontend` → repo root. ✓
>
> They are arithmetically identical. Empirical proof: `verify.py` was run with
> **no `QA_DIST` set** and scored 144/146 — impossible if its default `DIST`
> did not resolve. Only its line-31 *comment* is stale (it still names the old
> `frontend/scripts/` home); the code is correct.

## What `phase-c-landing-qa.py` asserts (75 checks)

- **Zero horizontal overflow at 375 / 768 / 1440**, re-checked *after* scrolling
  (revealed sections change layout). Offenders are walked up the ancestor chain
  to `<body>`, printing each ancestor's rect + `display` / `overflow-x` / `flex` /
  `min-width` / `max-width` — reporting only the overflowing element never finds
  the cause, because that element is usually the victim, not the culprit.
  Elements inside a deliberate `overflow-x: auto` scroller are excluded.
- **Theme correctness**: `html.dark` present and `--blue` resolving to `#0a84ff`
  dark / `#0071e3` light.
- **Zero `<img>`** anywhere (branding is a text wordmark; no logo images).
- **Wordmark integrity**: holds the real `site_name` and keeps real width — a
  48-char name must ellipsis-truncate, never collapse (Phase B squashed it to "S").
- **Hero readable above the fold**: `opacity == 1` with no entrance-animation gate.
- **Heading hierarchy**: exactly one `<h1>`, ≥6 `<h2>`, ≥10 `<h3>`.
- **No `display:flex/grid` on any `<td>`/`<th>`** (Phase A: broke `table-cell`,
  cost a column 12px of height and 8px of offset).
- **Reveal cycle**: below-fold wrappers start without `is-in`, and after scrolling
  nothing remains hidden.
- **`prefers-reduced-motion`**: every `.lp-reveal` visible *without* scrolling.
- **CTA gating**: `registration_enabled: true` → `/register` + trial note;
  `false` → `/login`, no note; authenticated → `/dashboard`.
- No console or page errors.

### Two harness traps already paid for

1. **`networkidle` is unusable here.** Dashboards poll so they never idle, and on
   a cold start it returns *before* Vue mounts. Wait for a real mount signal:
   `#app` has children, then `[data-testid="landing-full"]`. The landing page
   renders **no `.gn` global nav**, so do not wait for one.
2. **Sampling reveal state too early reads as a failure.** The first version
   scrolled in 90ms steps and slept 450ms; transitions are 0.55s + up to 140ms
   stagger, so it reported 33/38 "hidden" while the product was fine. Wait on the
   contract (`is-in` on every wrapper) and only then let the transition settle.
   `full_page=True` also smears `position: sticky`, so the nav is pinned to
   `static` before full-page captures and stickiness is judged from viewport shots.

## ⚠️ The alpha=35 artifact — dark screenshots look washed out, and dark mode is FINE

**Read this before concluding "dark mode is broken". It is not.** Reproduce with
`phase-c-dark-probe.py`.

### Symptom

Any dark-mode screenshot of a page whose full-height wrapper paints
`background: var(--bg)` reads as flat light grey, mean RGB ≈ **(220, 221, 223)**,
while every computed style is correct (`html.dark` present, `body` and `.landing`
both `rgb(0, 0, 0)`, cards `rgb(28, 28, 30)`, `--blue: #0a84ff`).

### Root cause (as far as it was established)

Capture with `omit_background=True` and inspect the alpha channel:

| theme | crop | RGB (omit_background) | alpha |
| --- | --- | --- | --- |
| dark | 100px below the nav | **(0.1, 0.1, 0.1)** — correct black | **35** / 255 |
| dark | left page margin | (1.7, 8.1, 19.7) — correct blue-tinted near-black | **35** / 255 |
| light | 100px below the nav | (244.4, 244.4, 246.4) | **255** |

The **colours are right**; only the coverage is wrong. The hero's blue tint is
exactly the ambient `rgba(10, 132, 255, 0.14)` gradient over `#000`. Alpha 35/255
≈ 13.7%, so compositing over Playwright's white backdrop gives
`0.863 × 255 ≈ 220` — precisely the grey observed. Light mode captures at alpha
255 and is unaffected.

### Hypotheses tested and FALSIFIED — do not re-run these

1. **Full-page stitching artifact.** No: viewport-sized shots at both
   `device_scale_factor` 1 and 2 wash identically.
2. **`backdrop-filter` / glass nav.** No: forcing
   `backdrop-filter: none` globally changed nothing — (220.2, 221.1, 222.6) →
   (220.2, 221.2, 222.7).
3. **SwiftShader software rendering in `chrome-headless-shell`.** No: full
   Chromium (`chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app`)
   reproduces it identically — alpha **36** vs **35**.
4. **A landing-page defect.** No: `/key-usage`, a route Phase C never touched,
   washes identically at (220, 220, 220). `/login` does **not** wash — it lacks
   the full-height `background: var(--bg)` wrapper.

Also confirmed: forcing `.landing` to lime yields (220.2, **253.9**, 222.9) — the
green channel saturates while red/blue stay pinned near 220, i.e. every layer
composites against the same ~13.7% ceiling regardless of colour. So this is a
coverage/compositing issue in the capture path, not a CSS colour problem.

### Unresolved

Why alpha lands at 35/255 in dark mode but 255 in light was **not** determined.

### Practical workaround

RGB is already correct, so drop the alpha channel instead of compositing over
white — this recovers the true appearance for visual review:

```python
from PIL import Image
im = Image.open('dark-omit.png').convert('RGBA')
r, g, b, _ = im.split()
Image.merge('RGB', (r, g, b)).save('dark-recovered.png')
```

A recovered capture was reviewed and dark mode is production-grade: true `#000`
field, gradient wordmark, `#1c1c1e` elevated cards with hairline borders, iOS
blue CTA, readable secondary text, ambient corner gradients.

**Do not "fix" dark mode based on a raw screenshot.** Assert computed styles, or
use `omit_background` and read the RGB channels.
