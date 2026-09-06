#!/usr/bin/env python3
"""Sub2API design-demo / Phase B 页面 QA 截图脚本。

用法：
  /opt/miniconda3/bin/python qa-screenshot.py <页面名...>
  DEMO_DIR=/path/to/pages DEMO_SHOTS_DIR=/tmp/shots python qa-screenshot.py login

默认截取 design-demo 下的静态 HTML（file:// 协议）。
Phase B 可将 DEMO_DIR 指向 dev server 路由截图（需自行扩展为 http:// URL）。
输出：light/dark × 桌面 1440 / 移动 375 ×（浮出展开态、汉堡菜单态，如适用）。
"""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

DEMO_DIR = Path(os.environ.get("DEMO_DIR", str(Path(__file__).parent)))
OUT_DIR = Path(os.environ.get("DEMO_SHOTS_DIR", "/tmp/demo-shots"))
OUT_DIR.mkdir(parents=True, exist_ok=True)
# 本机 Playwright 浏览器路径；如失效，运行 playwright install 后更新此路径
SHELL = os.environ.get("CHROME_HEADLESS_SHELL", os.path.expanduser(
    "~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"
))


def shoot(page, name, dark=False, mobile=False, hover_flyout=False, open_mobile_menu=False):
    page.evaluate(f"localStorage.setItem('demo-theme','{'dark' if dark else 'light'}'); location.reload()")
    page.wait_for_timeout(400)
    if hover_flyout:
        page.locator(".gn-item[data-flyout] > .gn-link").first.hover()
        page.wait_for_timeout(500)
    if open_mobile_menu:
        page.locator(".gn-burger").click()
        page.wait_for_timeout(500)
    suffix = f"{'-dark' if dark else '-light'}{'-mobile' if mobile else ''}{'-flyout' if hover_flyout else ''}{'-menu' if open_mobile_menu else ''}"
    page.screenshot(path=str(OUT_DIR / f"{name}{suffix}.png"), full_page=True)
    print(f"  ✓ {name}{suffix}.png")


def main():
    pages = sys.argv[1:] or ["index"]
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=SHELL)
        for name in pages:
            f = DEMO_DIR / f"{name}.html"
            if not f.exists():
                print(f"  ✗ {name}.html 不存在，跳过")
                continue
            ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
            pg = ctx.new_page()
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(f.as_uri())
            pg.wait_for_timeout(600)
            shoot(pg, name, dark=False)
            shoot(pg, name, dark=True)
            if pg.locator(".gn-item[data-flyout]").count():
                shoot(pg, name, dark=False, hover_flyout=True)
                shoot(pg, name, dark=True, hover_flyout=True)
            if errors:
                print(f"  ⚠ {name} JS 错误: {errors}")
            ctx.close()
            ctx = browser.new_context(viewport={"width": 375, "height": 812}, device_scale_factor=2, is_mobile=True)
            pg = ctx.new_page()
            pg.goto(f.as_uri())
            pg.wait_for_timeout(600)
            shoot(pg, name, dark=False, mobile=True)
            shoot(pg, name, dark=True, mobile=True)
            if pg.locator(".gn-burger").is_visible():
                shoot(pg, name, dark=False, mobile=True, open_mobile_menu=True)
            ctx.close()
        browser.close()
    print(f"\n输出目录: {OUT_DIR}")


if __name__ == "__main__":
    main()
