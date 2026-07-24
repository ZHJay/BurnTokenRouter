/**
 * Self-contained screenshot harness for the /admin/accounts admin page.
 *
 * What it does:
 *  1. Boots the Vite dev server as a child process on a chosen port.
 *  2. Launches the cached Playwright Chromium.
 *  3. For each theme (light, dark):
 *       - seeds localStorage (auth session + theme) BEFORE app scripts run,
 *       - intercepts every /api/v1/** (and /setup, /settings) request with
 *         JSON fixtures so no Go backend is needed,
 *       - navigates to /admin/accounts,
 *       - waits for the overview cards / table to render (robust fallbacks),
 *       - writes a full-page screenshot to design-demo/accounts-<theme>.png.
 *
 * Run it with:
 *     node design-demo/screenshot.mjs
 *
 * Optional env:
 *     VITE_DEV_PORT   dev-server port (default 3100)
 *
 * NOTE: This script only reads app source at runtime (via the dev server) and
 * never modifies it. It lives entirely under design-demo/.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { statSync } from 'node:fs'
import { chromium } from 'playwright'

import {
  accounts,
  accountsData,
  accountsPage,
  billingProbeSettings,
  complianceStatus,
  currentUser,
  groups,
  localStorageSeed,
  proxies,
  publicSettings,
  setupStatus,
} from './fixtures.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendDir = resolve(__dirname, '..')

const PORT = Number(process.env.VITE_DEV_PORT || 3100)
const ORIGIN = `http://localhost:${PORT}`
const THEMES = ['light', 'dark']
const NAV_TIMEOUT_MS = 60_000
const SERVER_READY_TIMEOUT_MS = 120_000

function log(...args) {
  console.log('[screenshot]', ...args)
}

/** Poll the dev server until it responds (any HTTP status is "up"). */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastErr
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      // Vite responds 200 for index.html; treat any response as ready.
      if (res.status > 0) return true
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(
    `Dev server did not become ready at ${url} within ${timeoutMs}ms` +
      (lastErr ? ` (last error: ${lastErr.message})` : ''),
  )
}

/** Spawn `pnpm vite --port <PORT>`; returns the child process. */
function startDevServer() {
  log(`starting Vite dev server on port ${PORT} ...`)
  const child = spawn(
    'pnpm',
    ['exec', 'vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: frontendDir,
      env: {
        ...process.env,
        VITE_DEV_PORT: String(PORT),
        // The inject-public-settings plugin tries to fetch the backend; keep
        // its timeout short and harmless (it already swallows failures).
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  child.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`))
  return child
}

/** localStorage seed executed before any app script runs. */
function makeInitScript(theme) {
  const expiresAt = Date.now() + localStorageSeed.tokenTtlMs
  return ({ user, token, refresh, expires, themeName }) => {
    try {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('refresh_token', refresh)
      localStorage.setItem('token_expires_at', String(expires))
      localStorage.setItem('auth_user', JSON.stringify(user))
      localStorage.setItem('theme', themeName)
    } catch {
      /* ignore */
    }
    // Apply the dark class immediately to avoid a light flash before app boot.
    try {
      document.documentElement.classList.toggle('dark', themeName === 'dark')
    } catch {
      /* ignore */
    }
  }
}

/** JSON route fulfiller. */
function jsonRoute(route, body, status = 200, extraHeaders = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', ...extraHeaders },
    body: JSON.stringify(body),
  })
}

/**
 * Install network mocks. Handles specific endpoints first, then a generic
 * catch-all so nothing thrown by an unmocked request breaks rendering.
 */
async function installMocks(context) {
  // Specific API endpoints.
  await context.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api\/v1/, '')

    // Accounts list (also handles listWithEtag's If-None-Match: just 200 body).
    if (/^\/admin\/accounts\/?$/.test(path)) {
      return jsonRoute(route, accountsPage(), 200, { etag: '"demo-accounts-v1"' })
    }
    if (/^\/admin\/accounts\/data\/?$/.test(path)) {
      return jsonRoute(route, accountsData())
    }
    if (/^\/admin\/accounts\/upstream-billing-probe\/settings\/?$/.test(path)) {
      return jsonRoute(route, billingProbeSettings())
    }
    // Batch today-stats / per-account today-stats -> empty-but-valid.
    if (/^\/admin\/accounts\/today-stats\/batch\/?$/.test(path)) {
      return jsonRoute(route, { code: 0, message: 'ok', data: {} })
    }
    if (/^\/admin\/accounts\/\d+\/today-stats\/?$/.test(path)) {
      return jsonRoute(route, { code: 0, message: 'ok', data: {} })
    }
    if (/^\/admin\/proxies\/all\/?$/.test(path)) {
      return jsonRoute(route, { code: 0, message: 'ok', data: proxies })
    }
    if (/^\/admin\/groups\/all\/?$/.test(path)) {
      return jsonRoute(route, { code: 0, message: 'ok', data: groups })
    }
    if (/^\/admin\/compliance\/?$/.test(path)) {
      return jsonRoute(route, complianceStatus())
    }
    if (/^\/auth\/me\/?$/.test(path)) {
      return jsonRoute(route, currentUser())
    }
    if (/^\/settings\/public\/?$/.test(path)) {
      return jsonRoute(route, publicSettings())
    }
    // Announcements list is consumed as an array.
    if (/^\/announcements\/?$/.test(path)) {
      return jsonRoute(route, { code: 0, message: 'ok', data: [] })
    }
    if (/^\/auth\/refresh\/?$/.test(path)) {
      // Return a valid refreshed token bundle just in case.
      return jsonRoute(route, {
        code: 0,
        message: 'ok',
        data: { access_token: 'demo', refresh_token: 'demo', expires_in: 86400 },
      })
    }

    // Generic fallback: return an empty object so callers don't throw.
    // Use [] for endpoints that look list-like (plural collection paths).
    const looksListLike =
      /(all|list|records|items|announcements|accounts|groups|proxies|users|keys)$/.test(path)
    return jsonRoute(route, { code: 0, message: 'ok', data: looksListLike ? [] : {} })
  })

  // Setup status lives outside /api/v1.
  await context.route('**/setup/status**', (route) => jsonRoute(route, setupStatus()))

  // Any other /setup/* -> empty ok.
  await context.route('**/setup/**', (route) =>
    jsonRoute(route, { code: 0, message: 'ok', data: {} }),
  )
}

/** Wait for the accounts UI to be meaningfully rendered. */
async function waitForAccountsRendered(page) {
  // Prefer the overview cards; fall back to a table, then a generic timeout.
  const selectors = [
    '[data-test="account-overview-card"]',
    'table tbody tr',
    '.account-overview-grid',
  ]
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { timeout: 8_000, state: 'visible' })
      log(`rendered (matched selector: ${sel})`)
      return
    } catch {
      /* try next */
    }
  }
  log('no known selector matched; falling back to networkidle + delay')
  try {
    await page.waitForLoadState('networkidle', { timeout: 8_000 })
  } catch {
    /* ignore */
  }
  await page.waitForTimeout(1_500)
}

async function captureTheme(browser, theme) {
  log(`capturing theme: ${theme}`)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  })

  await installMocks(context)

  // Seed localStorage + theme class before any app script executes.
  await context.addInitScript(makeInitScript(theme), {
    user: localStorageSeed.authUser,
    token: 'demo',
    refresh: 'demo',
    expires: Date.now() + localStorageSeed.tokenTtlMs,
    themeName: theme,
  })

  const page = await context.newPage()
  page.setDefaultTimeout(NAV_TIMEOUT_MS)
  page.on('console', (msg) => {
    if (msg.type() === 'error') log(`page console.error: ${msg.text()}`)
  })

  await page.goto(`${ORIGIN}/admin/accounts`, {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT_MS,
  })

  await waitForAccountsRendered(page)
  // Small settle for fonts / layout transitions.
  await page.waitForTimeout(600)

  const outPath = resolve(__dirname, `accounts-${theme}.png`)
  await page.screenshot({ path: outPath, fullPage: true })
  await context.close()

  const { size } = statSync(outPath)
  log(`wrote ${outPath} (${(size / 1024).toFixed(1)} KB)`)
  return { outPath, size }
}

async function main() {
  const devServer = startDevServer()
  let browser
  let exitCode = 0

  const cleanup = () => {
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM')
      // Force-kill shortly after if it lingers.
      setTimeout(() => {
        if (!devServer.killed) devServer.kill('SIGKILL')
      }, 2_000).unref?.()
    }
  }

  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(143)
  })

  try {
    await waitForServer(ORIGIN, SERVER_READY_TIMEOUT_MS)
    log('dev server ready')

    browser = await chromium.launch({ headless: true })
    log(`launched chromium: ${chromium.executablePath()}`)

    const results = []
    for (const theme of THEMES) {
      results.push(await captureTheme(browser, theme))
    }

    log('done:')
    for (const r of results) {
      log(`  - ${r.outPath} (${(r.size / 1024).toFixed(1)} KB)`)
    }
  } catch (err) {
    exitCode = 1
    console.error('[screenshot] FAILED:', err)
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {
        /* ignore */
      }
    }
    cleanup()
  }

  process.exit(exitCode)
}

main()
