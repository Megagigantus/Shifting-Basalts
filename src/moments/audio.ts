import { useSyncExternalStore } from 'react'
import { Howl, Howler } from 'howler'
import { getDeviceSettings, subscribeDeviceSettings } from './device'
import { THEME, type MomentTheme } from './theme'

interface HowlEntry {
  howl: Howl
  settled: boolean
  settledPromise: Promise<void>
}

const howlCache = new Map<string, HowlEntry>()
const unlockListeners = new Set<() => void>()
let unlocked = false

function syncHowlerVolume(): void {
  const { soundOn, volume } = getDeviceSettings()
  try {
    Howler.volume(soundOn ? volume : 0)
  } catch {
    // Ignore environments without audio support.
  }
}

syncHowlerVolume()
subscribeDeviceSettings(syncHowlerVolume)

function markUnlocked(): void {
  if (unlocked) return
  unlocked = true
  for (const listener of unlockListeners) {
    listener()
  }
}

function subscribeAudioUnlocked(listener: () => void): () => void {
  unlockListeners.add(listener)
  return () => {
    unlockListeners.delete(listener)
  }
}

/** Look up a sound URL for a key in the moment theme's sound map. */
export function soundUrl(key: string, theme: MomentTheme = THEME): string | null {
  if (!Object.hasOwn(theme.sounds, key)) return null
  const url = theme.sounds[key]
  return typeof url === 'string' && url.length > 0 ? url : null
}

function getOrCreateHowl(key: string): HowlEntry | null {
  const existing = howlCache.get(key)
  if (existing) return existing

  const url = soundUrl(key)
  if (!url) return null

  try {
    let settled = false
    let resolveSettled!: () => void
    const settledPromise = new Promise<void>((resolve) => {
      resolveSettled = resolve
    })
    let entry: HowlEntry | undefined
    const markSettled = () => {
      if (settled) return
      settled = true
      if (entry) entry.settled = true
      resolveSettled()
    }

    const howl = new Howl({
      src: [url],
      preload: true,
      html5: false,
      onload: markSettled,
      onloaderror: markSettled,
      onunlock: markUnlocked,
    })

    const alreadyLoaded = settled || howl.state() === 'loaded'
    entry = {
      howl,
      settled: alreadyLoaded,
      settledPromise,
    }
    if (alreadyLoaded) {
      resolveSettled()
    }
    howlCache.set(key, entry)
    return entry
  } catch {
    return null
  }
}

/** Preload known sound keys, resolving when all load/error or when the timeout elapses. Never rejects. */
export function preloadSounds(
  keys: string[],
  timeoutMs: number = THEME.playback.preloadTimeoutMs,
): Promise<void> {
  const pending: Promise<void>[] = []
  for (const key of new Set(keys)) {
    const entry = getOrCreateHowl(key)
    if (!entry) continue
    if (entry.howl.state() === 'loaded') {
      entry.settled = true
      continue
    }
    if (!entry.settled) {
      pending.push(entry.settledPromise)
    }
  }

  if (pending.length === 0) {
    return Promise.resolve()
  }

  const waitMs = Math.max(0, timeoutMs)
  return new Promise<void>((resolve) => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, waitMs)
    Promise.all(pending).then(finish, finish)
  })
}

/** Play a sound by theme key when sound is enabled and unlocked; silent on errors. */
export function playSound(key: string): void {
  const settings = getDeviceSettings()
  if (!settings.soundOn || !isAudioUnlocked()) return

  const entry = getOrCreateHowl(key)
  if (!entry) return

  try {
    Howler.volume(settings.volume)
    entry.howl.play()
  } catch {
    // Missing or broken audio must fail silently.
  }
}

/** Unlock browser audio from a user gesture and notify subscribers. */
export function unlockAudio(): void {
  try {
    const ctx = Howler.ctx
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {})
    }
  } catch {
    // Ignore environments without Web Audio.
  }
  markUnlocked()
}

/** Whether browser audio has been unlocked (or the Web Audio context is already running). */
export function isAudioUnlocked(): boolean {
  if (unlocked) return true
  try {
    if (Howler.ctx?.state === 'running') {
      unlocked = true
      return true
    }
  } catch {
    // Ignore environments without Web Audio.
  }
  return false
}

/** React hook tracking whether browser audio is currently unlocked. */
export function useAudioUnlocked(): boolean {
  return useSyncExternalStore(subscribeAudioUnlocked, isAudioUnlocked, () => false)
}

/** Stop every currently playing sound. */
export function stopAllSounds(): void {
  try {
    Howler.stop()
  } catch {
    // Ignore environments without audio support.
  }
}
