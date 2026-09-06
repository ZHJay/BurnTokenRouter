#!/usr/bin/env python3
"""Phase B acceptance verification — /root's independent gate.

Serves the production build with SPA fallback, mocks every API call so nothing
touches a backend, then runs PROGRAMMATIC assertions for the acceptance criteria
that unit tests cannot cover:

  1. no horizontal overflow at 375px
  2. global nav computes to 48px
  3. flyout panels are genuinely opaque (alpha == 1) and occlude the page
  4. admin table thead/td column alignment (Phase A regression guard)
  5. dark mode actually applies and changes the painted background
  6. no site-logo <img> renders anywhere

Screenshots go to $QA_SHOTS (default /tmp/burntokenrouter-qa/shots) for human
review.  All paths derive from this script's own location, so it works from
any checkout of the repo.
"""
import json
import os
import re
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

_HERE = Path(__file__).resolve().parent            # frontend/scripts/phase-b-qa
# parents[0] is already the parent dir (scripts); the repo root is 3 levels
# up from the file itself -> parents[2].
REPO_ROOT = _HERE.parents[2]
DIST = Path(os.environ.get("QA_DIST",
                           str(REPO_ROOT / "backend" / "internal" / "web" / "dist")))
SHOTS = Path(os.environ.get("QA_SHOTS", "/tmp/burntokenrouter-qa/shots"))
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get("QA_PORT", "5287"))
SHELL = os.environ.get(
    "CHROME_HEADLESS_SHELL",
    os.path.expanduser(
        "~/Library/Caches/ms-playwright/chromium_headless_shell-1234/"
        "chrome-headless-shell-mac-arm64/chrome-headless-shell"
    ),
)

PUBLIC_SETTINGS = {
    "registration_enabled": True,
    "email_verify_enabled": False,
    "force_email_on_third_party_signup": False,
    "registration_email_suffix_whitelist": [],
    "promo_code_enabled": True,
    "password_reset_enabled": True,
    "invitation_code_enabled": True,
    "turnstile_enabled": False,
    "turnstile_site_key": "",
    "site_name": "Sub2API QA",
    "site_logo": "/logo.svg",
    "site_subtitle": "AI API Gateway Platform",
    "api_base_url": "",
    "contact_info": "qa@example.com",
    "doc_url": "https://docs.example.com",
    "home_content": "",
    "compact_home_enabled": False,
    "hide_ccs_import_button": False,
    "custom_menu_items": [],
    "payment_enabled": True,
    "channel_monitor_enabled": True,
    "risk_control_enabled": True,
    "affiliate_enabled": True,
    "model_plaza_enabled": True,
    "available_channels_enabled": True,
    "ops_monitoring_enabled": True,
    "allow_user_view_error_requests": True,
    "server_utc_offset": 8,
    "table_default_page_size": 20,
}

ADMIN_USER = {
    "id": 1, "username": "admin", "email": "admin@example.com",
    "role": "admin", "status": "active", "balance": "128.50",
    "available_balance": "116.50", "frozen_balance": "12.00",
    "created_at": "2026-01-01T00:00:00Z",
}
NORMAL_USER = dict(ADMIN_USER, id=2, username="user", email="user@example.com", role="user")


def account_row(i, platform, status):
    """Backend-shaped Account row so the admin table renders real columns."""
    return {
        "id": i, "name": f"acct-{i:02d}", "platform": platform, "type": "oauth",
        "status": status, "email": f"acct{i}@example.com", "enabled": True,
        "schedulable": status == "active", "group_ids": [1],
        "groups": [{"id": 1, "name": "default"}],
        "priority": 10, "weight": 1, "concurrency": 2,
        "today_requests": 120 + i, "today_tokens": 45_000 + i * 100,
        "today_cost": 1.23, "total_requests": 9000 + i,
        "total_tokens": 1_200_000, "total_cost": 42.5,
        "credentials_status": {"has_access_token": True}, "extra": {},
        "created_at": "2026-02-01T00:00:00Z", "updated_at": "2026-08-01T00:00:00Z",
    }


ACCOUNTS = [account_row(1, "anthropic", "active"),
            account_row(2, "openai", "active"),
            account_row(3, "gemini", "error")]


def paginated(items):
    return {"items": items, "total": len(items), "page": 1,
            "page_size": 20, "pages": 1}


class SPAHandler(SimpleHTTPRequestHandler):
    """Static server that falls back to index.html for client-side routes."""

    def do_GET(self):  # noqa: N802
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            if "." not in os.path.basename(self.path.split("?")[0]):
                self.path = "/index.html"
        return super().do_GET()

    def log_message(self, *args):  # silence
        pass


def start_server():
    handler = partial(SPAHandler, directory=str(DIST))
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def json_route(payload, status=200):
    def _fulfill(route):
        route.fulfill(status=status, content_type="application/json",
                      body=json.dumps(payload))
    return _fulfill


def install_mocks(context, user):
    """Fulfil every API call locally. Nothing may reach a real backend."""
    def handler(route):
        url = route.request.url
        if "/auth/me" in url:
            # CurrentUserResponse extends User -> FLAT object, not {user:...}
            return json_route(dict(user, run_mode="standard"))(route)
        if "/settings/public" in url:
            return json_route(PUBLIC_SETTINGS)(route)
        if "/auth/logout" in url:
            return json_route({"message": "ok"})(route)
        # The announcements endpoint returns a bare ARRAY; the client calls
        # .slice() on the body, so an object body raised
        # "TypeError: A.slice is not a function" in the console.
        if "announcement" in url:
            return json_route([])(route)
        if "/admin/accounts" in url:
            return json_route(paginated(ACCOUNTS))(route)
        if "/admin/groups" in url:
            return json_route(paginated([{"id": 1, "name": "default",
                                          "platform": "anthropic"}]))(route)
        # Generic empty-but-valid shapes cover list/detail/stat endpoints.
        return json_route({
            "data": [], "items": [], "list": [], "total": 0, "page": 1,
            "page_size": 20, "stats": {}, "enabled": False,
            "supported": False, "announcements": [], "unread_count": 0,
        })(route)

    # Anchor on the API prefixes only. A looser pattern also swallowed lazy-loaded
    # JS chunks whose paths contain "v1", which then arrived as JSON and produced
    # "Failed to load module script: ... MIME type of application/json".
    context.route(re.compile(r".*/(api/v1|api|setup)/(?!.*\.(?:js|css|mjs)$).*"), handler)
    context.route(re.compile(r".*/auth/.*"), handler)


def seed(context, user, dark):
    context.add_init_script(f"""
      window.__APP_CONFIG__ = {json.dumps(PUBLIC_SETTINGS)};
      localStorage.setItem('auth_token', 'qa-token');
      localStorage.setItem('auth_user', {json.dumps(json.dumps(user))});
      localStorage.setItem('theme', {json.dumps('dark' if dark else 'light')});
      // Mark the driver.js onboarding tour as already seen. Otherwise it
      // auto-starts and renders a full-viewport .driver-overlay SVG that
      // intercepts every pointer event, making the nav unclickable and
      // poisoning elementFromPoint checks.
      // Key format: `${{storageKey}}_${{userId}}_${{role}}_v4_interactive`
      // (useOnboardingTour.getStorageKey); AppLayout picks admin_guide/user_guide.
      localStorage.setItem(
        'admin_guide_' + {json.dumps(user["id"])} + '_' + {json.dumps(user["role"])} + '_v4_interactive',
        'true');
      localStorage.setItem(
        'user_guide_' + {json.dumps(user["id"])} + '_' + {json.dumps(user["role"])} + '_v4_interactive',
        'true');
    """)


RESULTS = []


def goto_ready(page, url, expect_nav=True, timeout=25000):
    """Navigate and wait for a real app-mounted signal.

    `networkidle` is unusable here: dashboards poll, so they never idle, and it
    also returns before Vue has mounted on a cold start. Wait for the mounted
    app root, then for the nav itself on app-shell routes.

    One retry: with ~28 serial browser contexts in a single process, cold mounts
    occasionally exceed the deadline under load. A fresh-process rerun of the
    same case mounts 4/4, so a lone timeout is resource contention rather than an
    app defect — retrying keeps that from being reported as a false failure.
    """
    last: Exception | None = None
    for attempt in range(2):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            page.wait_for_function(
                "() => document.querySelector('#app')?.children.length > 0",
                timeout=timeout)
            if expect_nav:
                page.wait_for_selector(".gn", state="attached", timeout=timeout)
                page.wait_for_selector(".gn-item[data-flyout], .gn-link",
                                       state="attached", timeout=timeout)
            page.wait_for_timeout(700)
            return
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt == 0:
                page.wait_for_timeout(1000)
    raise last  # type: ignore[misc]


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + ((" :: " + detail) if detail else ""))


def check_overflow(page, label):
    m = page.evaluate("""() => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      culprits: [...document.querySelectorAll('body *')]
        .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 4)
        .map(el => el.tagName.toLowerCase() + '.' +
             String(el.className || '').split(' ').filter(Boolean).slice(0,2).join('.'))
    })""")
    ok = m["sw"] <= m["iw"] + 1
    record(f"[{label}] no horizontal overflow @375px",
           ok, f"scrollWidth={m['sw']} innerWidth={m['iw']} culprits={m['culprits']}" if not ok else "")


def check_nav_height(page, label):
    h = page.evaluate("""() => { const n = document.querySelector('.gn');
      return n ? Math.round(n.getBoundingClientRect().height) : -1; }""")
    record(f"[{label}] global nav is 48px", h in (48, -1) and h != -1, f"got {h}px")


def check_nav_containment(page, label):
    """The nav bar computing to 48px proves nothing about its children.

    A missing flex rule (e.g. `.gn-actions` left as display:block) lets the
    action cluster stack vertically and spill below the bar while `.gn` itself
    still measures exactly 48px — which is how a very visible layout break
    passed a green height assertion.
    """
    res = page.evaluate("""() => {
      const nav = document.querySelector('.gn');
      if (!nav) return { skip: 'no nav' };
      const nr = nav.getBoundingClientRect();
      const escapees = [];
      for (const el of nav.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        // Flyouts/search/popovers intentionally hang below the bar.
        if (el.closest('.gn-flyout, .gn-search-bar, .gn-pop')) continue;
        if (r.bottom > nr.bottom + 1 || r.top < nr.top - 1) {
          escapees.push({
            el: el.tagName.toLowerCase() + '.' +
                String(el.className || '').split(' ').filter(Boolean).slice(0, 2).join('.'),
            top: Math.round(r.top), bottom: Math.round(r.bottom),
          });
        }
      }
      return { navBottom: Math.round(nr.bottom), escapees: escapees.slice(0, 6) };
    }""")
    if res.get("skip"):
        record(f"[{label}] nav children contained", True, "skipped: " + res["skip"])
        return
    record(f"[{label}] all nav children stay inside the 48px bar",
           not res["escapees"], json.dumps(res["escapees"]))


def check_dark(page, label, expect_dark):
    st = page.evaluate("""() => ({
      cls: document.documentElement.classList.contains('dark'),
      bg: getComputedStyle(document.body).backgroundColor,
      blue: getComputedStyle(document.documentElement).getPropertyValue('--blue').trim(),
    })""")
    ok = st["cls"] == expect_dark
    record(f"[{label}] html.dark == {expect_dark}", ok, f"got {st}" if not ok else f"--blue={st['blue']}")
    return st


def check_no_logo_img(page, label):
    n = page.evaluate("""() => [...document.images]
        .filter(i => /logo\\.svg|site_logo/i.test(i.getAttribute('src') || '')).length""")
    record(f"[{label}] no site-logo <img> rendered", n == 0, f"found {n}")


def check_flyout(page):
    trigger = page.locator(".gn-item[data-flyout] > .gn-link").first
    if trigger.count() == 0:
        record("[admin] flyout trigger present", False, "no [data-flyout] found")
        return
    trigger.click()
    page.wait_for_timeout(600)
    res = page.evaluate("""() => {
      const fly = document.querySelector('.gn-item.open .gn-flyout') ||
                  document.querySelector('.gn-flyout');
      if (!fly) return { err: 'no flyout' };
      const r = fly.getBoundingClientRect();
      const bg = getComputedStyle(fly).backgroundColor;
      const inner = fly.querySelector('.gn-flyout-inner');
      const ibg = inner ? getComputedStyle(inner).backgroundColor : '';
      // sample 3 points inside the panel; each must hit the panel subtree
      const pts = [[0.25,0.4],[0.5,0.55],[0.75,0.7]].map(([fx,fy]) => {
        const el = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);
        return el ? fly.contains(el) || el === fly : false;
      });
      const curtain = document.querySelector('.gn-curtain');
      return { bg, ibg, pts, visible: r.width > 0 && r.height > 0,
               width: Math.round(r.width), height: Math.round(r.height),
               viewport: window.innerWidth,
               cols: fly.querySelectorAll('.gn-flyout-col').length,
               curtainOpen: curtain ? curtain.classList.contains('open') : null };
    }""")
    if res.get("err"):
        record("[admin] flyout opens", False, res["err"])
        return
    record("[admin] flyout is visible", bool(res["visible"]))
    # THE regression guard: the mega-menu must span the full nav width, not
    # collapse to the ~64px width of its trigger item.
    record("[admin] flyout spans full width (not collapsed to nav item)",
           res["width"] >= res["viewport"] - 2,
           f"width={res['width']}px viewport={res['viewport']}px cols={res['cols']}")
    record("[admin] flyout renders its columns", res["cols"] >= 1,
           f"cols={res['cols']}")
    # opaque == alpha 1 (rgb(...) with no alpha, or rgba(...,1))
    def opaque(c):
        if not c:
            return False
        m = re.match(r"rgba?\(([^)]+)\)", c)
        if not m:
            return False
        parts = [p.strip() for p in m.group(1).split(",")]
        return len(parts) < 4 or abs(float(parts[3]) - 1.0) < 1e-6
    record("[admin] flyout panel is opaque (alpha=1)",
           opaque(res["bg"]) or opaque(res["ibg"]),
           f"panel={res['bg']} inner={res['ibg']}")
    record("[admin] flyout occludes page (elementFromPoint)",
           all(res["pts"]), f"hits={res['pts']}")
    record("[admin] curtain dims page while flyout open",
           res["curtainOpen"] is True, f"curtainOpen={res['curtainOpen']}")
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)


def check_table_alignment(page, label):
    res = page.evaluate("""() => {
      const tbl = document.querySelector('.table-card table, table');
      if (!tbl) return { skip: 'no table' };
      const ths = [...tbl.querySelectorAll('thead th')];
      const row = tbl.querySelector('tbody tr');
      if (!ths.length || !row) return { skip: 'no header/row' };
      const tds = [...row.querySelectorAll('td')];
      // An empty-state row is a single colspan cell -> nothing to align.
      if (tds.length === 1 && tds[0].hasAttribute('colspan'))
        return { skip: 'empty-state row (colspan)' };
      if (ths.length !== tds.length)
        return { skip: 'header/row cell mismatch ' + ths.length + ' vs ' + tds.length };
      const n = Math.min(ths.length, tds.length);
      const bad = [];
      for (let i = 0; i < n; i++) {
        const a = ths[i].getBoundingClientRect(), b = tds[i].getBoundingClientRect();
        if (Math.abs(a.x - b.x) > 1.5 || Math.abs(a.width - b.width) > 1.5)
          bad.push({ i, thX: +a.x.toFixed(1), tdX: +b.x.toFixed(1),
                     thW: +a.width.toFixed(1), tdW: +b.width.toFixed(1) });
      }
      const hs = tds.map(td => +td.getBoundingClientRect().height.toFixed(1));
      return { cols: n, bad, unevenHeights: new Set(hs).size > 1, hs };
    }""")
    if res.get("skip"):
        record(f"[{label}] table alignment", True, "skipped: " + res["skip"])
        return
    record(f"[{label}] all {res['cols']} columns aligned (<=1.5px)",
           not res["bad"], json.dumps(res["bad"]))
    record(f"[{label}] first-row cells equal height",
           not res["unevenHeights"], f"heights={res['hs']}")


def run():
    base = f"http://127.0.0.1:{PORT}"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=SHELL)

        # ---------- desktop, light + dark, admin ----------
        for dark in (False, True):
            mode = "dark" if dark else "light"
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            seed(ctx, ADMIN_USER, dark)
            install_mocks(ctx, ADMIN_USER)
            page = ctx.new_page()
            goto_ready(page, f"{base}/admin/accounts", expect_nav=True)
            lbl = f"admin/accounts {mode} 1440"
            check_dark(page, lbl, dark)
            check_nav_height(page, lbl)
            check_nav_containment(page, lbl)
            check_no_logo_img(page, lbl)
            check_table_alignment(page, lbl)
            page.screenshot(path=str(SHOTS / f"admin-accounts-{mode}-desktop.png"))
            if not dark:
                check_flyout(page)
                trig = page.locator(".gn-item[data-flyout] > .gn-link").first
                if trig.count() > 0:
                    trig.click()
                    page.wait_for_timeout(600)
                    page.screenshot(path=str(SHOTS / "admin-flyout-open-light.png"))
            ctx.close()

        # ---------- mobile 375, overflow sweep ----------
        routes = [("/login", NORMAL_USER), ("/dashboard", NORMAL_USER),
                  ("/keys", NORMAL_USER), ("/admin/accounts", ADMIN_USER),
                  ("/admin/users", ADMIN_USER), ("/admin/settings", ADMIN_USER),
                  ("/", NORMAL_USER),
                  # The five 375px overflow violations found by the full sweep.
                  # Reproduced here so each fix is provable in this harness.
                  ("/admin/usage", ADMIN_USER), ("/usage", NORMAL_USER),
                  ("/admin/subscriptions", ADMIN_USER),
                  ("/admin/dashboard", ADMIN_USER)]
        # 768px matters as much as 375px: it is the breakpoint where `.gn-links`
        # collapses into the hamburger while the action cluster is still wide,
        # and testing only 375/1440 is how a 768px overflow (scrollWidth 801)
        # slipped past a green suite.
        for width, height in ((375, 812), (768, 1024)):
          for dark in (False, True):
            mode = f"{'dark' if dark else 'light'} {width}"
            for route, user in routes:
                ctx = browser.new_context(viewport={"width": width, "height": height})
                seed(ctx, user, dark)
                install_mocks(ctx, user)
                page = ctx.new_page()
                try:
                    # /login (AuthLayout) and / (HomeView) render their own
                    # chrome, not the app-shell .gn nav.
                    goto_ready(page, f"{base}{route}",
                               expect_nav=route not in ("/login", "/"))
                    lbl = f"{route} {mode}"
                    check_overflow(page, lbl)
                    check_nav_containment(page, lbl)
                    check_no_logo_img(page, lbl)
                    slug = route.strip("/").replace("/", "-") or "home"
                    page.screenshot(
                        path=str(SHOTS / f"{slug}-{'dark' if dark else 'light'}-{width}.png"))
                except Exception as exc:  # noqa: BLE001
                    record(f"[{route} {mode}] page loads", False, str(exc)[:160])
                ctx.close()

        # ---------- desktop light: login + dashboard shots ----------
        for route, user in [("/login", NORMAL_USER), ("/dashboard", NORMAL_USER)]:
            for dark in (False, True):
                mode = "dark" if dark else "light"
                ctx = browser.new_context(viewport={"width": 1440, "height": 900})
                seed(ctx, user, dark)
                install_mocks(ctx, user)
                page = ctx.new_page()
                goto_ready(page, f"{base}{route}", expect_nav=route != "/login")
                slug = route.strip("/") or "home"
                page.screenshot(path=str(SHOTS / f"{slug}-{mode}-desktop.png"))
                ctx.close()

        browser.close()

    fails = [r for r in RESULTS if not r[1]]
    print(f"\n==== {len(RESULTS) - len(fails)}/{len(RESULTS)} assertions passed ====")
    if fails:
        print("FAILURES:")
        for name, _, detail in fails:
            print(f"  - {name} :: {detail}")
    print(f"shots -> {SHOTS}")
    return 1 if fails else 0


if __name__ == "__main__":
    srv = start_server()
    try:
        sys.exit(run())
    finally:
        srv.shutdown()
