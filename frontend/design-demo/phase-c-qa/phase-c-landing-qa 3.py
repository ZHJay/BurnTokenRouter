#!/usr/bin/env python3
"""Phase C · Landing page QA harness.

Serves the production build locally with SPA fallback, mocks every API call
(nothing touches a backend or database), and asserts what unit tests cannot see:
real layout at 375 / 768 / 1440 px across light + dark.

Deliberate choices, each earned from a documented Phase A/B trap:

* `networkidle` is unusable in this app — dashboards poll so they never idle,
  and on a cold start it returns *before* Vue mounts. We wait for a real mount
  signal (`#app` has children) plus the landing root itself.
* The landing page renders no `.gn` global nav, so we must NOT wait for it.
* `full_page=True` smears `position: sticky` elements. For full-page layout
  shots we pin the nav to `static` first; stickiness itself is judged from
  separate viewport-sized shots.
* Reveal animations are driven by IntersectionObserver, so anything below the
  fold stays at `opacity: 0` until scrolled into view. We scroll the page in
  steps before capturing, otherwise every below-fold section photographs blank.
* Reporting "which elements stick out" never finds the cause — the overflowing
  element is usually the victim. We walk each offender up to <body> and print
  every ancestor's rect + display / overflow-x / flex / min-width / max-width.
"""
import json
import os
import re
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[3]
DIST = Path(os.environ.get("QA_DIST", str(REPO_ROOT / "backend" / "internal" / "web" / "dist")))
SHOTS = Path(os.environ.get("QA_SHOTS", "/tmp/phase-c-landing/shots"))
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get("QA_PORT", "5391"))
SHELL = os.environ.get(
    "CHROME_HEADLESS_SHELL",
    os.path.expanduser(
        "~/Library/Caches/ms-playwright/chromium_headless_shell-1234/"
        "chrome-headless-shell-mac-arm64/chrome-headless-shell"
    ),
)

SITE_NAME = "Sub2API QA"
# Admin-configurable and unbounded in practice; used to prove the wordmark
# truncates instead of collapsing to a single character (Phase B defect #7).
LONG_SITE_NAME = "Extremely Long Self-Hosted Gateway Platform Name"


def public_settings(**overrides):
    base = {
        "registration_enabled": True,
        "email_verify_enabled": False,
        "promo_code_enabled": True,
        "password_reset_enabled": True,
        "invitation_code_enabled": True,
        "turnstile_enabled": False,
        "turnstile_site_key": "",
        "site_name": SITE_NAME,
        "site_logo": "/logo.svg",
        "site_subtitle": "AI API Gateway Platform",
        "doc_url": "https://docs.example.com",
        "home_content": "",
        "compact_home_enabled": False,
        "api_base_url": "",
    }
    base.update(overrides)
    return base


VIEWPORTS = {"375": (375, 812), "768": (768, 1024), "1440": (1440, 900)}

RESULTS = []

# Set by the late-settings cases: the static server answers /settings/public
# itself, after a delay, on its own thread. See DELAYED_SETTINGS below.
DELAYED_SETTINGS: dict | None = None
SETTINGS_DELAY_MS = 0


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (f"   {detail}" if detail else ""))


class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        # Serve /settings/public here (not via a Playwright route) when a delay is
        # wanted. ThreadingHTTPServer runs each request on its own thread, so the
        # sleep does NOT block the browser. Sleeping inside a sync Playwright route
        # handler blocks the thread driving the browser, which stalls navigation
        # itself — there is then no observable "settings pending" window to sample,
        # and the check silently measures the settled state instead.
        if DELAYED_SETTINGS is not None and "settings/public" in self.path:
            time.sleep(SETTINGS_DELAY_MS / 1000)
            body = json.dumps(DELAYED_SETTINGS).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            if "." not in os.path.basename(self.path.split("?")[0]):
                self.path = "/index.html"
        return super().do_GET()

    def log_message(self, *args):
        pass


def start_server():
    handler = partial(SPAHandler, directory=str(DIST))
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def install_mocks(context, settings, authenticated=False, defer_settings=False):
    """Fulfil every API call locally. 401 on /auth/me keeps the visitor logged out."""

    def handler(route):
        url = route.request.url
        if "/auth/me" in url:
            if authenticated:
                body = {
                    "id": 7, "email": "qa@example.com", "role": "user",
                    "username": "qa", "balance": 12.5, "run_mode": "standard",
                }
                return route.fulfill(status=200, content_type="application/json",
                                     body=json.dumps(body))
            return route.fulfill(status=401, content_type="application/json",
                                 body=json.dumps({"message": "unauthorized"}))
        if "/settings/public" in url:
            if defer_settings:
                # Hand it to the threaded static server, which delays off-thread.
                return route.continue_()
            return route.fulfill(status=200, content_type="application/json",
                                 body=json.dumps(settings))
        if "announcement" in url:
            # This endpoint returns a bare array; the client calls .slice() on it.
            return route.fulfill(status=200, content_type="application/json", body="[]")
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "data": [], "items": [], "list": [], "total": 0, "page": 1,
            "page_size": 20, "stats": {}, "enabled": False,
        }))

    # Anchor on API prefixes only; a looser pattern also swallows lazy-loaded JS
    # chunks whose paths contain "v1", which then arrive as JSON and fail to parse.
    context.route(re.compile(r".*/(api/v1|api|setup)/(?!.*\.(?:js|css|mjs)$).*"), handler)
    context.route(re.compile(r".*/auth/.*"), handler)


def seed(context, settings, dark, authenticated=False, inject_config=True):
    """Seed theme (+ auth) before app code runs.

    `inject_config=False` omits window.__APP_CONFIG__ so the app must fetch
    /settings/public. That is the only path where the CTA gating is observable:
    with injected config, initSettings() applies it synchronously and
    publicSettingsLoaded is already true at mount.
    """
    script = "localStorage.setItem('theme', " + json.dumps("dark" if dark else "light") + ");\n"
    if inject_config:
        script = "window.__APP_CONFIG__ = " + json.dumps(settings) + ";\n" + script
    if authenticated:
        user = {"id": 7, "email": "qa@example.com", "role": "user", "username": "qa"}
        script += (
            "localStorage.setItem('auth_token', 'qa-token');\n"
            "localStorage.setItem('auth_user', " + json.dumps(json.dumps(user)) + ");\n"
        )
    context.add_init_script(script)


def goto_ready(page, url, timeout=25000):
    """Wait for a real mount signal. The landing page has no `.gn`, so don't wait for it."""
    last = None
    for attempt in range(2):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            page.wait_for_function(
                "() => document.querySelector('#app')?.children.length > 0", timeout=timeout)
            page.wait_for_selector("[data-testid='landing-full']", state="attached",
                                   timeout=timeout)
            page.wait_for_timeout(500)
            return
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt == 0:
                page.wait_for_timeout(1200)
    raise last


# Dwell long enough per step for IntersectionObserver to deliver. 90ms was too
# fast: callbacks were still queued and CSS transitions (0.55s + up to 140ms
# stagger) unfinished, so sampling opacity right after produced false failures.
SCROLL_ALL = """
  () => new Promise((resolve) => {
    const step = Math.round(window.innerHeight * 0.6);
    let y = 0;
    const tick = () => {
      window.scrollTo(0, y);
      y += step;
      if (y < document.body.scrollHeight + step) {
        setTimeout(tick, 200);
      } else {
        setTimeout(resolve, 200);
      }
    };
    tick();
  })
"""

ALL_REVEALED = """
  () => {
    const els = [...document.querySelectorAll('.lp-reveal')];
    return els.length > 0 && els.every(e => e.classList.contains('is-in'));
  }
"""


def reveal_everything(page):
    """Scroll the whole page, then wait on the real contract before sampling.

    Two-phase wait, because they fail differently: `is-in` landing on every
    wrapper proves IntersectionObserver delivered (a product contract), while the
    extra settle only lets the CSS transition finish (a sampling concern). Waiting
    on a fixed sleep alone conflates the two and reports transition lag as a bug.
    """
    page.evaluate(SCROLL_ALL)
    page.wait_for_function(ALL_REVEALED, timeout=20000)
    page.wait_for_timeout(900)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(250)

# Walk every offender up to <body>, printing the real constraint boxes.
OVERFLOW_DIAG = """
  (vw) => {
    const esc = [];
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right <= vw + 0.5 && r.left >= -0.5) continue;
      if (inScroller(el)) continue;          // intentional horizontal scroller
      const chain = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        const nr = n.getBoundingClientRect();
        chain.push({
          tag: n.tagName.toLowerCase(),
          cls: (n.className || '').toString().slice(0, 70),
          x: Math.round(nr.x), w: Math.round(nr.width), r: Math.round(nr.right),
          sw: n.scrollWidth,
          display: cs.display, overflowX: cs.overflowX,
          flex: cs.flex, minW: cs.minWidth, maxW: cs.maxWidth,
        });
      }
      esc.push({ target: chain[0], ancestors: chain.slice(1) });
      if (esc.length >= 4) break;
    }
    return {
      docScrollW: document.documentElement.scrollWidth,
      bodyScrollW: document.body.scrollWidth,
      escapes: esc,
    };
  }
"""


def check_overflow(page, label, vw):
    info = page.evaluate(OVERFLOW_DIAG, vw)
    ok = info["docScrollW"] <= vw + 1 and not info["escapes"]
    detail = f"docScrollW={info['docScrollW']} vw={vw} escapes={len(info['escapes'])}"
    record(f"[{label}] no horizontal overflow", ok, detail)
    if not ok:
        for e in info["escapes"]:
            print("    OFFENDER:", json.dumps(e["target"]))
            for a in e["ancestors"]:
                print("      ^ ", json.dumps(a))
    return ok


def check_no_logo_img(page, label):
    n = page.evaluate("() => document.querySelectorAll('img').length")
    record(f"[{label}] renders zero <img> (text wordmark only)", n == 0, f"count={n}")


def check_wordmark(page, label, expected):
    info = page.evaluate("""
      () => {
        const el = document.querySelector('.wordmark');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), w: Math.round(r.width),
                 right: Math.round(r.right), clipped: el.scrollWidth > el.clientWidth + 1 };
      }
    """)
    if info is None:
        record(f"[{label}] wordmark present", False, "no .wordmark node")
        return
    # Must hold the real site name and keep real width: Phase B once squashed it to "S".
    ok = info["text"] == expected and info["w"] >= 40
    record(f"[{label}] wordmark intact, not crushed", ok, json.dumps(info))


def check_dark(page, label, expect_dark):
    info = page.evaluate("""
      () => ({
        cls: document.documentElement.classList.contains('dark'),
        bg: getComputedStyle(document.body).backgroundColor,
        text: getComputedStyle(document.body).color,
        blue: getComputedStyle(document.documentElement).getPropertyValue('--blue').trim(),
      })
    """)
    ok = info["cls"] == expect_dark
    if expect_dark:
        ok = ok and info["blue"] == "#0a84ff"
    else:
        ok = ok and info["blue"] == "#0071e3"
    record(f"[{label}] theme applied (dark={expect_dark})", ok, json.dumps(info))


def check_headings(page, label):
    info = page.evaluate("""
      () => ({
        h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()),
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length,
      })
    """)
    ok = len(info["h1"]) == 1 and info["h2"] >= 6 and info["h3"] >= 10
    record(f"[{label}] heading hierarchy (1×h1, sections h2, cards h3)", ok, json.dumps(info))


def check_cells_not_flex(page, label):
    bad = page.evaluate("""
      () => [...document.querySelectorAll('td, th')]
        .map(c => ({ cls: (c.className||'').toString(), d: getComputedStyle(c).display }))
        .filter(x => x.d === 'flex' || x.d === 'grid' || x.d === 'inline-flex')
    """)
    record(f"[{label}] no flex/grid directly on td/th", not bad, json.dumps(bad[:3]))


def check_hero_readable(page, label):
    """Above the fold must be readable immediately — no entrance animation gating it."""
    info = page.evaluate("""
      () => {
        const pick = (s) => document.querySelector(s);
        const h1 = pick('.lp-hero-title');
        const cta = pick('.lp-cta-primary');
        const vis = (el) => {
          if (!el) return null;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { op: cs.opacity, vis: cs.visibility, top: Math.round(r.top),
                   inFold: r.top < window.innerHeight };
        };
        return { h1: vis(h1), cta: vis(cta), h1Text: h1 ? h1.textContent.trim() : null };
      }
    """)
    ok = (info["h1"] and float(info["h1"]["op"]) == 1.0 and info["h1"]["inFold"]
          and info["cta"] and float(info["cta"]["op"]) == 1.0)
    record(f"[{label}] hero readable above the fold with no fade gate", ok, json.dumps(info))


def check_reveal_cycle(page, label):
    """Below-fold sections start un-revealed, then reveal once scrolled into view.

    Asserted on the `is-in` class rather than opacity for the "before" sample:
    on-screen wrappers are legitimately mid-transition right after mount, so an
    opacity sample there measures animation timing, not the reveal contract.
    """
    before = page.evaluate("""
      () => {
        const els = [...document.querySelectorAll('.lp-reveal')];
        const last = els[els.length - 1];
        return {
          total: els.length,
          notIn: els.filter(e => !e.classList.contains('is-in')).length,
          lastIsIn: last ? last.classList.contains('is-in') : null,
        };
      }
    """)
    reveal_everything(page)
    after = page.evaluate("""
      () => {
        const els = [...document.querySelectorAll('.lp-reveal')];
        return {
          total: els.length,
          notIn: els.filter(e => !e.classList.contains('is-in')).length,
          hidden: els.filter(e => getComputedStyle(e).opacity !== '1').length,
        };
      }
    """)
    # Deepest wrapper must start un-revealed (proves it is genuinely gated on
    # scroll), and after scrolling nothing may remain hidden.
    ok = (before["notIn"] > 0 and before["lastIsIn"] is False
          and after["notIn"] == 0 and after["hidden"] == 0)
    record(f"[{label}] reveal-on-scroll works and leaves nothing hidden", ok,
           f"before_notIn={before['notIn']} lastIsIn={before['lastIsIn']} "
           f"after_notIn={after['notIn']} after_hidden={after['hidden']} total={after['total']}")


def check_reduced_motion_visible(page, label):
    """prefers-reduced-motion must degrade to plain-visible, never a blank screen."""
    info = page.evaluate("""
      () => {
        const els = [...document.querySelectorAll('.lp-reveal')];
        return { total: els.length,
                 hidden: els.filter(e => getComputedStyle(e).opacity !== '1').length,
                 matches: matchMedia('(prefers-reduced-motion: reduce)').matches };
      }
    """)
    ok = info["matches"] and info["total"] > 0 and info["hidden"] == 0
    record(f"[{label}] reduced-motion: all sections visible without scrolling", ok,
           json.dumps(info))


def check_cta(page, label, expect_href_suffix, expect_note):
    info = page.evaluate("""
      () => {
        const a = document.querySelector('.lp-cta-primary');
        const note = document.querySelector('.lp-hero-note');
        return { href: a ? a.getAttribute('href') : null,
                 text: a ? a.textContent.trim() : null,
                 // The note slot is ALWAYS present so it reserves height and the
                 // layout cannot shift. Visibility is the meaningful signal;
                 // asserting existence would now be vacuously true.
                 noteVisible: !!note && getComputedStyle(note).visibility !== 'hidden',
                 noteSlotPresent: !!note,
                 skeleton: !!document.querySelector('[data-testid="hero-cta-skeleton"]'),
                 secondary: (document.querySelector('.lp-cta-secondary')||{}).getAttribute
                   ? document.querySelector('.lp-cta-secondary').getAttribute('href') : null };
      }
    """)
    # Injected config means settings are ready at mount: real link, no placeholder.
    ok = ((info["href"] or "").endswith(expect_href_suffix)
          and info["noteVisible"] == expect_note
          and info["noteSlotPresent"] is True
          and info["skeleton"] is False)
    record(f"[{label}] primary CTA -> {expect_href_suffix}, note={expect_note}", ok,
           json.dumps(info))


def check_cta_no_flip(page, label, final_label):
    """Late-arriving settings must not produce a visible label flip or a height jump.

    Before settings land, registration_enabled cannot be known, so rendering the
    CTA eagerly would show one label and then swap it (登录 -> 立即开始) right on the
    site's first-impression screen. Contract: a same-size placeholder stands in,
    the final label never appears early, and the CTA row height is unchanged.
    """
    pending = page.evaluate("""
      () => {
        const row = document.querySelector('.lp-hero-cta');
        const note = document.querySelector('.lp-hero-note');
        return {
          skeleton: !!document.querySelector('[data-testid="hero-cta-skeleton"]'),
          link: !!document.querySelector('.lp-cta-primary'),
          rowH: row ? Math.round(row.getBoundingClientRect().height) : null,
          noteSlot: !!note,
          text: document.querySelector('.lp-hero-copy')?.textContent || '',
        };
      }
    """)
    # Wait for settings to land and the real CTA to replace the placeholder.
    page.wait_for_selector(".lp-cta-primary", state="attached", timeout=15000)
    page.wait_for_timeout(400)
    settled = page.evaluate("""
      () => {
        const row = document.querySelector('.lp-hero-cta');
        return {
          skeleton: !!document.querySelector('[data-testid="hero-cta-skeleton"]'),
          link: !!document.querySelector('.lp-cta-primary'),
          rowH: row ? Math.round(row.getBoundingClientRect().height) : null,
          text: document.querySelector('.lp-hero-copy')?.textContent || '',
        };
      }
    """)

    early_label_leaked = final_label in pending["text"]
    ok = (pending["skeleton"] and not pending["link"]
          and not early_label_leaked
          and pending["noteSlot"]
          and settled["link"] and not settled["skeleton"]
          and final_label in settled["text"]
          and pending["rowH"] == settled["rowH"])
    record(f"[{label}] late settings: no label flip, CTA row height stable", ok,
           f"pending={json.dumps(pending['rowH'])} settled={json.dumps(settled['rowH'])} "
           f"pending_skeleton={pending['skeleton']} early_leak={early_label_leaked} "
           f"settled_link={settled['link']}")


def shoot(page, name, full=True):
    path = SHOTS / f"{name}.png"
    if full:
        # Unstick the nav first: full_page compositing smears sticky/fixed elements.
        page.add_style_tag(content=".landing-nav{position:static !important}")
        page.wait_for_timeout(120)
    page.screenshot(path=str(path), full_page=full)
    print(f"  shot  {path}")


def run():
    if not (DIST / "index.html").exists():
        sys.exit(f"dist missing at {DIST} — run ./node_modules/.bin/vite build first")

    httpd = start_server()
    base = f"http://127.0.0.1:{PORT}"
    settings = public_settings()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=SHELL)

            # ---- 3 breakpoints x light/dark, unauthenticated (the public case) ----
            for vp_name, (w, h) in VIEWPORTS.items():
                for dark in (False, True):
                    theme = "dark" if dark else "light"
                    label = f"{vp_name} {theme}"
                    ctx = browser.new_context(viewport={"width": w, "height": h},
                                              device_scale_factor=2)
                    install_mocks(ctx, settings)
                    seed(ctx, settings, dark)
                    page = ctx.new_page()
                    errors = []
                    page.on("pageerror", lambda e: errors.append(str(e)))
                    page.on("console", lambda m: errors.append(m.text)
                            if m.type == "error" else None)

                    print(f"\n=== {label} ===")
                    goto_ready(page, base + "/")

                    check_dark(page, label, dark)
                    check_overflow(page, label, w)
                    check_no_logo_img(page, label)
                    check_wordmark(page, label, SITE_NAME)
                    check_hero_readable(page, label)
                    check_headings(page, label)
                    check_cells_not_flex(page, label)
                    check_reveal_cycle(page, label)
                    # Re-check overflow after scrolling: revealed sections change layout.
                    check_overflow(page, label + " post-scroll", w)
                    record(f"[{label}] no console/page errors", not errors,
                           json.dumps(errors[:3]))

                    shoot(page, f"landing-{vp_name}-{theme}")
                    ctx.close()

            # ---- reduced-motion: every viewport, must be visible without scrolling ----
            for vp_name, (w, h) in VIEWPORTS.items():
                label = f"{vp_name} reduced-motion"
                ctx = browser.new_context(viewport={"width": w, "height": h},
                                          reduced_motion="reduce")
                install_mocks(ctx, settings)
                seed(ctx, settings, False)
                page = ctx.new_page()
                print(f"\n=== {label} ===")
                goto_ready(page, base + "/")
                check_reduced_motion_visible(page, label)
                check_overflow(page, label, w)
                shoot(page, f"landing-{vp_name}-reduced-motion")
                ctx.close()

            # ---- CTA gating: registration on/off, and authenticated ----
            cases = [
                ("reg-on", public_settings(registration_enabled=True), False, "/register", True),
                ("reg-off", public_settings(registration_enabled=False), False, "/login", False),
                ("authed", public_settings(registration_enabled=True), True, "/dashboard", False),
            ]
            for case, cfg, authed, suffix, note in cases:
                label = f"1440 {case}"
                ctx = browser.new_context(viewport={"width": 1440, "height": 900})
                install_mocks(ctx, cfg, authenticated=authed)
                seed(ctx, cfg, False, authenticated=authed)
                page = ctx.new_page()
                print(f"\n=== {label} ===")
                goto_ready(page, base + "/")
                check_cta(page, label, suffix, note)
                ctx.close()

            # ---- late-arriving settings: the CTA must not flip or shift ----
            global DELAYED_SETTINGS, SETTINGS_DELAY_MS
            DELAYED_SETTINGS = settings
            SETTINGS_DELAY_MS = 2500
            for vp_name, (w, h) in VIEWPORTS.items():
                label = f"{vp_name} late-settings"
                ctx = browser.new_context(viewport={"width": w, "height": h})
                install_mocks(ctx, settings, defer_settings=True)
                seed(ctx, settings, False, inject_config=False)
                page = ctx.new_page()
                print(f"\n=== {label} ===")
                goto_ready(page, base + "/")
                check_cta_no_flip(page, label, "Get Started")
                check_overflow(page, label, w)
                ctx.close()
            DELAYED_SETTINGS = None
            SETTINGS_DELAY_MS = 0

            # ---- long site name: wordmark must truncate, never collapse ----
            long_cfg = public_settings(site_name=LONG_SITE_NAME)
            for vp_name, (w, h) in VIEWPORTS.items():
                label = f"{vp_name} long-site-name"
                ctx = browser.new_context(viewport={"width": w, "height": h})
                install_mocks(ctx, long_cfg)
                seed(ctx, long_cfg, False)
                page = ctx.new_page()
                print(f"\n=== {label} ===")
                goto_ready(page, base + "/")
                check_wordmark(page, label, LONG_SITE_NAME)
                check_overflow(page, label, w)
                shoot(page, f"landing-{vp_name}-long-name", full=False)
                ctx.close()

            browser.close()
    finally:
        httpd.shutdown()

    passed = sum(1 for _, ok, _ in RESULTS if ok)
    total = len(RESULTS)
    print(f"\n================  {passed}/{total} passed  ================")
    for name, ok, detail in RESULTS:
        if not ok:
            print(f"  FAILED: {name}   {detail}")
    print(f"shots -> {SHOTS}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(run())
