import { useSyncExternalStore } from 'react'

/** Per-device moment audio preferences. */
export interface DeviceSettings {
  soundOn: boolean
  volume: number
}

/** Default moment sound settings when nothing valid is saved. */
export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  soundOn: true,
  volume: 0.7,
}

/** localStorage key for per-device moment sound settings. */
export const DEVICE_SETTINGS_KEY = 'sb-moment-sound'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function normalizeVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/** Read and validate saved moment sound settings, falling back to defaults for missing or invalid fields. */
export function readDeviceSettings(
  storage: Pick<Storage, 'getItem'> | null = safeLocalStorage(),
): DeviceSettings {
  if (!storage) return { ...DEFAULT_DEVICE_SETTINGS }

  let raw: string | null = null
  try {
    raw = storage.getItem(DEVICE_SETTINGS_KEY)
  } catch {
    return { ...DEFAULT_DEVICE_SETTINGS }
  }
  if (!raw) return { ...DEFAULT_DEVICE_SETTINGS }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_DEVICE_SETTINGS }
    }
    const record = parsed as Record<string, unknown>
    return {
      soundOn:
        typeof record.soundOn === 'boolean' ? record.soundOn : DEFAULT_DEVICE_SETTINGS.soundOn,
      volume: normalizeVolume(record.volume, DEFAULT_DEVICE_SETTINGS.volume),
    }
  } catch {
    return { ...DEFAULT_DEVICE_SETTINGS }
  }
}

/** Persist moment sound settings to storage, ignoring storage errors (e.g. private browsing). */
export function writeDeviceSettings(
  settings: DeviceSettings,
  storage: Pick<Storage, 'setItem'> | null = safeLocalStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage blocked (private window): settings stay in memory for this session.
  }
}

let currentSettings: DeviceSettings = readDeviceSettings()
const settingsListeners = new Set<() => void>()

/** Current per-device moment sound settings (stable reference between changes). */
export function getDeviceSettings(): DeviceSettings {
  return currentSettings
}

/** Merge a partial settings update, clamp volume, persist, and notify subscribers. */
export function setDeviceSettings(change: Partial<DeviceSettings>): void {
  const next: DeviceSettings = {
    soundOn: typeof change.soundOn === 'boolean' ? change.soundOn : currentSettings.soundOn,
    volume:
      change.volume !== undefined
        ? normalizeVolume(change.volume, currentSettings.volume)
        : currentSettings.volume,
  }
  currentSettings = next
  writeDeviceSettings(next)
  for (const listener of settingsListeners) {
    listener()
  }
}

/** Subscribe to changes in per-device moment sound settings. Returns an unsubscribe function. */
export function subscribeDeviceSettings(listener: () => void): () => void {
  settingsListeners.add(listener)
  return () => {
    settingsListeners.delete(listener)
  }
}

/** React hook returning the shared device settings and an updater. */
export function useDeviceSettings(): [DeviceSettings, (change: Partial<DeviceSettings>) => void] {
  const settings = useSyncExternalStore(
    subscribeDeviceSettings,
    getDeviceSettings,
    getDeviceSettings,
  )
  return [settings, setDeviceSettings]
}

function getReducedMotionMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }
  return window.matchMedia(REDUCED_MOTION_QUERY)
}

function subscribeReducedMotion(listener: () => void): () => void {
  const mql = getReducedMotionMediaQuery()
  if (!mql || typeof mql.addEventListener !== 'function') return () => {}
  mql.addEventListener('change', listener)
  return () => {
    mql.removeEventListener('change', listener)
  }
}

function getReducedMotionSnapshot(): boolean {
  return getReducedMotionMediaQuery()?.matches ?? false
}

/** Whether the device requests reduced motion via prefers-reduced-motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false)
}
