/**
 * 主题 composable —— 全站主题唯一事实来源（B1 落地）。
 *
 * 存储契约（铁律，改动会丢老用户偏好）：
 * - localStorage key 固定为 `theme`
 * - 值只有 `'dark'` / `'light'`（不存在 `'system'`）
 * - key 不存在 = 跟随系统 `prefers-color-scheme`
 *
 * 模块级共享响应式状态：main.ts 与所有组件调用 useTheme() 拿到的都是
 * 同一个 isDark ref，任何一处切换全站同步。
 */
import { ref } from 'vue'
import type { Ref } from 'vue'

const THEME_KEY = 'theme'

const darkMedia = window.matchMedia('(prefers-color-scheme: dark)')

/** 模块级共享状态（chart 组件仍通过 html.dark class 只读判断，天然兼容） */
const isDark = ref<boolean>(document.documentElement.classList.contains('dark'))

function applyTheme(dark: boolean): void {
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
}

function resolveInitial(): boolean {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark') return true
  if (saved === 'light') return false
  return darkMedia.matches
}

/**
 * 启动初始化：在 mount 之前调用一次（main.ts）。
 * 同时监听系统主题实时变化 —— 仅在用户没有显式存储偏好时跟随。
 */
export function initTheme(): void {
  applyTheme(resolveInitial())
  darkMedia.addEventListener('change', (event) => {
    if (!localStorage.getItem(THEME_KEY)) applyTheme(event.matches)
  })
}

/** 翻转主题，并持久化显式偏好 */
export function toggleTheme(): void {
  applyTheme(!isDark.value)
  localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
}

/** 设置显式主题，并持久化 */
export function setTheme(mode: 'dark' | 'light'): void {
  applyTheme(mode === 'dark')
  localStorage.setItem(THEME_KEY, mode)
}

export interface UseTheme {
  /** 共享的响应式暗色标记（只读约定：改主题请走 toggleTheme/setTheme） */
  isDark: Ref<boolean>
  toggleTheme: () => void
  setTheme: (mode: 'dark' | 'light') => void
}

/** 组件侧入口：const { isDark, toggleTheme, setTheme } = useTheme() */
export function useTheme(): UseTheme {
  return { isDark, toggleTheme, setTheme }
}
