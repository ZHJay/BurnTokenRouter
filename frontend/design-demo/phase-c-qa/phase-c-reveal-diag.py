#!/usr/bin/env python3
"""Diagnose why .lp-reveal elements below the fold don't reach opacity 1.

Hypotheses to separate:
  A) the page isn't actually scrolling (scrollY stays 0)
  B) IntersectionObserver never delivers for off-screen nodes in headless
  C) IO fires and `is-in` lands, but the CSS transition hasn't finished when sampled
Distinguishing A/B from C matters: C is a harness artifact, A/B would be a real bug.
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

REPO_ROOT = Path(__file__).resolve().parents[3]
DIST = REPO_ROOT / "backend" / "internal" / "web" / "dist"
PORT = int(os.environ.get("QA_PORT", "5397"))
SHELL = os.environ.get(
    "CHROME_HEADLESS_SHELL",
    os.path.expanduser(
        "~/Library/Caches/ms-playwright/chromium_headless_shell-1234/"
        "chrome-headless-shell-mac-arm64/chrome-headless-shell"
    ),
)
SETTINGS = {
    "registration_enabled": True, "site_name": "Sub2API QA",
    "site_subtitle": "AI API Gateway Platform", "doc_url": "https://docs.example.com",
    "home_content": "", "compact_home_enabled": False, "turnstile_enabled": False,
}


class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        p = self.translate_path(self.path)
        if not os.path.exists(p) or os.path.isdir(p):
            if "." not in os.path.basename(self.path.split("?")[0]):
                self.path = "/index.html"
        return super().do_GET()

    def log_message(self, *a):
        pass


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT),
                                partial(SPAHandler, directory=str(DIST)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    def handler(route):
        url = route.request.url
        if "/auth/me" in url:
            return route.fulfill(status=401, content_type="application/json", body="{}")
        if "/settings/public" in url:
            return route.fulfill(status=200, content_type="application/json",
                                 body=json.dumps(SETTINGS))
        if "announcement" in url:
            return route.fulfill(status=200, content_type="application/json", body="[]")
        return route.fulfill(status=200, content_type="application/json",
                             body=json.dumps({"data": [], "items": [], "total": 0}))

    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=SHELL)
            ctx = b.new_context(viewport={"width": 1440, "height": 900})
            ctx.route(re.compile(r".*/(api/v1|api|setup)/(?!.*\.(?:js|css|mjs)$).*"), handler)
            ctx.route(re.compile(r".*/auth/.*"), handler)
            ctx.add_init_script(
                "window.__APP_CONFIG__=" + json.dumps(SETTINGS) + ";"
                "localStorage.setItem('theme','light');")
            page = ctx.new_page()
            page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
            page.wait_for_function("() => document.querySelector('#app')?.children.length > 0")
            page.wait_for_selector("[data-testid='landing-full']", state="attached")
            page.wait_for_timeout(800)

            print("=== A) is the document scrollable / does it scroll? ===")
            print(json.dumps(page.evaluate("""
              () => ({
                docScrollH: document.documentElement.scrollHeight,
                docClientH: document.documentElement.clientHeight,
                bodyScrollH: document.body.scrollHeight,
                htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
                bodyOverflowY: getComputedStyle(document.body).overflowY,
                landingOverflow: (() => {
                  const l = document.querySelector('.landing');
                  const cs = l && getComputedStyle(l);
                  return cs ? { x: cs.overflowX, y: cs.overflowY, h: cs.height } : null;
                })(),
                revealCount: document.querySelectorAll('.lp-reveal').length,
                ioSupported: typeof IntersectionObserver !== 'undefined',
              })
            """), indent=2))

            page.evaluate("() => window.scrollTo(0, 2000)")
            page.wait_for_timeout(400)
            print("after scrollTo(0,2000):", json.dumps(page.evaluate(
                "() => ({ scrollY: window.scrollY, pageYOffset: window.pageYOffset })")))

            print("\n=== B/C) per-step: how many carry .is-in vs reach opacity 1 ===")
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(600)

            probe = """
              () => {
                const els = [...document.querySelectorAll('.lp-reveal')];
                return {
                  scrollY: Math.round(window.scrollY),
                  isIn: els.filter(e => e.classList.contains('is-in')).length,
                  opaque: els.filter(e => getComputedStyle(e).opacity === '1').length,
                  total: els.length,
                };
              }
            """
            print("baseline:", json.dumps(page.evaluate(probe)))
            for step in range(1, 12):
                page.evaluate(f"() => window.scrollTo(0, {step * 700})")
                page.wait_for_timeout(350)
                print(f"  step {step:2d} ->", json.dumps(page.evaluate(probe)))

            # Settle: if `is-in` is complete but opacity lags, it's purely transition timing.
            page.wait_for_timeout(1500)
            print("after 1.5s settle:", json.dumps(page.evaluate(probe)))

            print("\n=== which nodes are still not opaque, and where are they? ===")
            print(json.dumps(page.evaluate("""
              () => [...document.querySelectorAll('.lp-reveal')]
                .map((e, i) => ({ i, isIn: e.classList.contains('is-in'),
                                  op: getComputedStyle(e).opacity,
                                  top: Math.round(e.getBoundingClientRect().top),
                                  h: Math.round(e.getBoundingClientRect().height),
                                  cls: (e.className||'').toString().slice(0,50) }))
                .filter(x => x.op !== '1')
                .slice(0, 12)
            """), indent=2))

            b.close()
    finally:
        httpd.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
