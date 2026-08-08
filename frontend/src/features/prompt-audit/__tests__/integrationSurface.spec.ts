import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import zh from '@/i18n/locales/zh'
import {
  applyFeatureFlags,
  buildAdminNavItems,
  groupAdminNav,
  type NavDeps,
} from '@/components/layout/navItems'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(resolve(here, path), 'utf8')

describe('Prompt Audit integration surface', () => {
  it('registers an admin and risk-control guarded route', () => {
    const router = read('../../../router/index.ts')
    expect(router).toContain("path: '/admin/prompt-audit'")
    const route = router.slice(router.indexOf("path: '/admin/prompt-audit'"), router.indexOf("path: '/admin/usage'"))
    expect(route).toContain('requiresAuth: true')
    expect(route).toContain('requiresAdmin: true')
    expect(route).toContain('requiresRiskControl: true')
  })

  it('keeps the legacy content moderation route and adds both pages under an expand-only security group', () => {
    const allFlagsOn: NavDeps['flags'] = {
      channelMonitor: () => true,
      payment: () => true,
      availableChannels: () => true,
      affiliate: () => true,
      riskControl: () => true,
      opsMonitoring: () => true,
      adminPayment: () => true,
      batchImageAccess: () => true,
    }
    const deps: NavDeps = {
      isSimpleMode: false,
      customMenuItemsForUser: [],
      customMenuItemsForAdmin: [],
      flags: allFlagsOn,
    }
    const items = buildAdminNavItems(deps)
    const security = items.find((i) => i.path === '/admin/security-audit')
    expect(security?.expandOnly).toBe(true)
    expect(security?.children?.some((c) => c.path === '/admin/risk-control')).toBe(true)
    expect(security?.children?.some((c) => c.path === '/admin/prompt-audit')).toBe(true)

    // Both pages stay reachable in the GlobalNav flyout (Analytics ▸ Security).
    const grouped = groupAdminNav(applyFeatureFlags(items))
    const analytics = grouped.groups.find((g) => g.key === 'analytics')
    const securityColumn = analytics?.columns.find((c) => c.titleKey === 'nav.securitySection')
    expect(securityColumn?.items.map((i) => i.path)).toEqual(
      expect.arrayContaining(['/admin/risk-control', '/admin/prompt-audit']),
    )
  })

  it('keeps Prompt Audit locale trees symmetric and all operational controls named', () => {
    expect(Object.keys(zh.admin.promptAudit)).toEqual(Object.keys(en.admin.promptAudit))
    expect(zh.nav.securityAudit).toBeTruthy()
    expect(en.nav.securityAudit).toBeTruthy()
    const endpoint = read('../components/EndpointPool.vue')
    const events = read('../components/EventWorkspace.vue')
    expect(endpoint).toContain('aria-label')
    expect(events).toContain('aria-label')
    expect(events).toContain('overflow-x-auto')
    expect(events).toContain('sm:grid-cols-2')
  })
})
