#!/usr/bin/env python3
"""Is dark mode actually broken, or is the washed-out full-page shot an artifact?

The QA harness asserted body background == rgb(0,0,0) and --blue == #0a84ff and
passed, yet the full_page screenshot looks light gray. Exactly one of those is
wrong. Separating the two:

  * computed styles at several scroll depths  -> is the CSS right?
  * viewport-sized shots (no stitching)       -> does the browser paint it right?
  * full_page at dsf=1 and dsf=2              -> is the stitch the thing lying?
  * mean pixel RGB per crop                   -> objective, not my eyes on a
                                                 downscaled PNG

Known related trap (HANDOFF lesson #4): full_page=True smears position:
sticky/fixed elements. `body::before` carries the ambient gradient and IS fixed,
so it is a prime suspect for polluting a stitched capture.
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
OUT = Path("/tmp/phase-c-landing/dark-probe")
OUT.mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get("QA_PORT", "5399"))
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


def mocks(route):
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


STYLE_PROBE = """
  () => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color, bgImage: s.backgroundImage.slice(0, 60) };
    };
    const before = getComputedStyle(document.body, '::before');
    return {
      htmlHasDark: document.documentElement.classList.contains('dark'),
      blue: getComputedStyle(document.documentElement).getPropertyValue('--blue').trim(),
      bgVar: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      bgElevated: getComputedStyle(document.documentElement)
                    .getPropertyValue('--bg-elevated').trim(),
      html: cs('html'), body: cs('body'),
      bodyBeforePosition: before.position,
      bodyBeforeZ: before.zIndex,
      landing: cs('.landing'),
      section: cs('.lp-section'),
      card: cs('.lp-feature'),
      faq: cs('.lp-faq-item'),
      ctaBand: cs('.lp-cta-band'),
      scrollY: Math.round(window.scrollY),
    };
  }
"""


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT),
                                partial(SPAHandler, directory=str(DIST)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=SHELL)

            for dsf in (2, 1):
                ctx = b.new_context(viewport={"width": 1440, "height": 900},
                                    device_scale_factor=dsf)
                ctx.route(re.compile(r".*/(api/v1|api|setup)/(?!.*\.(?:js|css|mjs)$).*"), mocks)
                ctx.route(re.compile(r".*/auth/.*"), mocks)
                ctx.add_init_script(
                    "window.__APP_CONFIG__=" + json.dumps(SETTINGS) + ";"
                    "localStorage.setItem('theme','dark');")
                page = ctx.new_page()
                page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
                page.wait_for_function("() => document.querySelector('#app')?.children.length>0")
                page.wait_for_selector("[data-testid='landing-full']", state="attached")
                page.wait_for_timeout(900)

                if dsf == 2:
                    print("=== computed styles at top (dark, dsf=2) ===")
                    print(json.dumps(page.evaluate(STYLE_PROBE), indent=2))

                # viewport shot: no stitching involved, so this is the honest one
                page.screenshot(path=str(OUT / f"dark-viewport-top-dsf{dsf}.png"))

                page.evaluate("() => window.scrollTo(0, 2600)")
                page.wait_for_timeout(800)
                if dsf == 2:
                    print("\n=== computed styles at scrollY=2600 ===")
                    print(json.dumps(page.evaluate(STYLE_PROBE), indent=2))
                page.screenshot(path=str(OUT / f"dark-viewport-mid-dsf{dsf}.png"))

                page.evaluate("() => window.scrollTo(0, 0)")
                page.wait_for_timeout(400)
                page.screenshot(path=str(OUT / f"dark-fullpage-dsf{dsf}.png"), full_page=True)
                ctx.close()

            b.close()
    finally:
        httpd.shutdown()

    # Objective check: mean RGB of the top-left region of each capture.
    try:
        from PIL import Image
        print("\n=== mean RGB of a 200x200 crop near top-left (dark => near 0,0,0) ===")
        for f in sorted(OUT.glob("*.png")):
            im = Image.open(f).convert("RGB")
            crop = im.crop((20, 200, 220, 400))
            px = list(crop.getdata())
            n = len(px)
            mean = tuple(round(sum(c[i] for c in px) / n, 1) for i in range(3))
            print(f"  {f.name:34s} size={im.size} mean_rgb={mean}")
    except ImportError:
        print("\n(PIL unavailable — inspect the PNGs visually)")
    print(f"\nshots -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
