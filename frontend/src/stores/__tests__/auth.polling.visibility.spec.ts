import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

/**
 * 锁住 authStore 60s 用户轮询的页面可见性行为（审计 PF4）：
 *  hidden（后台标签页）时不再触发 refreshUser，visible 时恢复；
 *  logout 后监听被清理，不会再重启轮询。
 */

const mockLogin = vi.fn()
const mockLogout = vi.fn()
const mockGetCurrentUser = vi.fn()
const mockRegister = vi.fn()
const mockRefreshToken = vi.fn()

vi.mock('@/api', () => ({
  authAPI: {
    login: (...args: any[]) => mockLogin(...args),
    login2FA: vi.fn(),
    logout: (...args: any[]) => mockLogout(...args),
    getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
    register: (...args: any[]) => mockRegister(...args),
    refreshToken: (...args: any[]) => mockRefreshToken(...args),
  },
  isTotp2FARequired: (response: any) => response?.requires_2fa === true,
}))

const fakeUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'user' as const,
  balance: 100,
  concurrency: 5,
  status: 'active' as const,
  allowed_groups: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
}

let hidden = false
let store: ReturnType<typeof useAuthStore> | null = null

function setHidden(value: boolean) {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useAuthStore 轮询可见性暂停', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.useFakeTimers()
    vi.clearAllMocks()
    hidden = false
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })
    store = useAuthStore()
  })

  afterEach(async () => {
    // 确保每个用例结束都移除 visibilitychange 监听，不泄漏进下一个用例
    store?.logout()
    store = null
    vi.useRealTimers()
  })

  it('hidden 时暂停 60s 轮询，visible 时恢复', async () => {
    localStorage.setItem('auth_token', 'saved-token')
    localStorage.setItem('auth_user', JSON.stringify(fakeUser))
    mockGetCurrentUser.mockResolvedValue({ data: fakeUser })
    mockLogout.mockResolvedValue(undefined)

    store!.checkAuth()
    // checkAuth 会立即拉一次用户信息
    await vi.advanceTimersByTimeAsync(0)
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1)

    // 隐藏：定时器被停掉，推进超过一个周期也不触发
    setHidden(true)
    await vi.advanceTimersByTimeAsync(180_000)
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1)

    // 恢复可见：定时器重启，60s 后再次触发
    setHidden(false)
    await vi.advanceTimersByTimeAsync(60_100)
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(2)

    // 再次隐藏：不再触发
    setHidden(true)
    await vi.advanceTimersByTimeAsync(180_000)
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(2)
  })

  it('logout 后 visibilitychange 监听被清理，不再重启轮询', async () => {
    localStorage.setItem('auth_token', 'saved-token')
    localStorage.setItem('auth_user', JSON.stringify(fakeUser))
    mockGetCurrentUser.mockResolvedValue({ data: fakeUser })
    mockLogout.mockResolvedValue(undefined)

    store!.checkAuth()
    await vi.advanceTimersByTimeAsync(0)
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1)

    await store!.logout()
    expect(store!.isAuthenticated).toBe(false)

    // 注销后即使派发 visible 事件，也不应重启轮询
    setHidden(false)
    await vi.advanceTimersByTimeAsync(180_000)
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1)
  })
})
