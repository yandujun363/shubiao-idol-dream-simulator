import { computed, ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'mouse-idol-theme-v1'

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

const mode = ref<ThemeMode>(readMode())
const systemDark = ref(true)

export const resolvedTheme = computed<ResolvedTheme>(() =>
  mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value,
)

function apply() {
  document.documentElement.dataset.theme = resolvedTheme.value
  document.documentElement.style.colorScheme = resolvedTheme.value
}

let started = false

export function initTheme() {
  if (started) return
  started = true

  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = mq.matches
  const onChange = (e: MediaQueryListEvent) => {
    systemDark.value = e.matches
  }
  if (mq.addEventListener) mq.addEventListener('change', onChange)
  else mq.addListener(onChange)

  apply()

  watch(mode, () => {
    try {
      localStorage.setItem(STORAGE_KEY, mode.value)
    } catch {
      /* ignore */
    }
  })
  watch(resolvedTheme, apply)
}

export function setThemeMode(m: ThemeMode) {
  mode.value = m
}

export function cycleThemeMode() {
  const order: ThemeMode[] = ['system', 'light', 'dark']
  const i = order.indexOf(mode.value)
  mode.value = order[(i + 1) % order.length]
}

export function useTheme() {
  return {
    mode,
    resolved: resolvedTheme,
    systemDark,
    setMode: setThemeMode,
    cycle: cycleThemeMode,
  }
}
