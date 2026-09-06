/**
 * 模型广场视图模式：卡片网格（默认）/ 密集表格。
 *
 * 表格在跨模型比价时信息密度更高，所以保留为可切换的密集模式，
 * 用户的选择跨会话持久化。localStorage 在 Safari 隐私模式下会抛异常，
 * 全部读写都要兜住，切换视图不能把页面搞崩。
 */

export type PlazaViewMode = 'cards' | 'table'

export const PLAZA_VIEW_STORAGE_KEY = 'model-plaza-view'

export const DEFAULT_PLAZA_VIEW: PlazaViewMode = 'cards'

export function isPlazaViewMode(value: unknown): value is PlazaViewMode {
  return value === 'cards' || value === 'table'
}

/** 读取持久化的视图偏好；缺失或非法值回退默认卡片视图。 */
export function readStoredPlazaView(): PlazaViewMode {
  try {
    const raw = localStorage.getItem(PLAZA_VIEW_STORAGE_KEY)
    return isPlazaViewMode(raw) ? raw : DEFAULT_PLAZA_VIEW
  } catch {
    return DEFAULT_PLAZA_VIEW
  }
}

export function persistPlazaView(mode: PlazaViewMode): void {
  try {
    localStorage.setItem(PLAZA_VIEW_STORAGE_KEY, mode)
  } catch {
    // 隐私模式下写入被拒：视图仍可切换，只是不跨会话保留。
  }
}
