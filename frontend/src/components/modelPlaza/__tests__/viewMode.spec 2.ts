import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  DEFAULT_PLAZA_VIEW,
  PLAZA_VIEW_STORAGE_KEY,
  isPlazaViewMode,
  persistPlazaView,
  readStoredPlazaView
} from '../viewMode'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.removeItem(PLAZA_VIEW_STORAGE_KEY)
})

describe('模型广场视图偏好', () => {
  it('默认卡片视图', () => {
    expect(DEFAULT_PLAZA_VIEW).toBe('cards')
    expect(readStoredPlazaView()).toBe('cards')
  })

  it('持久化后可读回(跨会话保留密集表格模式)', () => {
    persistPlazaView('table')
    expect(localStorage.getItem(PLAZA_VIEW_STORAGE_KEY)).toBe('table')
    expect(readStoredPlazaView()).toBe('table')
  })

  it('存储里是非法值时回退默认,不把脏值透给组件', () => {
    localStorage.setItem(PLAZA_VIEW_STORAGE_KEY, 'grid-view-9000')
    expect(readStoredPlazaView()).toBe('cards')
    expect(isPlazaViewMode('grid-view-9000')).toBe(false)
  })

  it('localStorage 被拒(Safari 隐私模式)时读写都不抛,视图仍可用', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(readStoredPlazaView()).toBe('cards')
    expect(() => persistPlazaView('table')).not.toThrow()
  })
})
