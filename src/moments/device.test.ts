import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DEVICE_SETTINGS,
  DEVICE_SETTINGS_KEY,
  getDeviceSettings,
  readDeviceSettings,
  setDeviceSettings,
  subscribeDeviceSettings,
  writeDeviceSettings,
} from './device'

function createFakeStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('device settings storage', () => {
  it('returns defaults when storage is empty or null', () => {
    expect(readDeviceSettings(createFakeStorage())).toEqual(DEFAULT_DEVICE_SETTINGS)
    expect(readDeviceSettings(null)).toEqual(DEFAULT_DEVICE_SETTINGS)
  })

  it('round-trips settings through writeDeviceSettings and readDeviceSettings', () => {
    const storage = createFakeStorage()
    const custom = { soundOn: false, volume: 0.35 }

    writeDeviceSettings(custom, storage)

    expect(readDeviceSettings(storage)).toEqual(custom)
  })

  it('returns defaults for malformed JSON or non-object JSON', () => {
    expect(
      readDeviceSettings(createFakeStorage({ [DEVICE_SETTINGS_KEY]: '{not valid json' })),
    ).toEqual(DEFAULT_DEVICE_SETTINGS)
    expect(
      readDeviceSettings(createFakeStorage({ [DEVICE_SETTINGS_KEY]: 'null' })),
    ).toEqual(DEFAULT_DEVICE_SETTINGS)
    expect(
      readDeviceSettings(createFakeStorage({ [DEVICE_SETTINGS_KEY]: '[]' })),
    ).toEqual(DEFAULT_DEVICE_SETTINGS)
  })

  it('defaults fields with wrong types while keeping valid fields', () => {
    const badBoth = createFakeStorage({
      [DEVICE_SETTINGS_KEY]: JSON.stringify({ soundOn: 'yes', volume: 'loud' }),
    })
    expect(readDeviceSettings(badBoth)).toEqual(DEFAULT_DEVICE_SETTINGS)

    const badSoundOnly = createFakeStorage({
      [DEVICE_SETTINGS_KEY]: JSON.stringify({ soundOn: 'yes', volume: 0.4 }),
    })
    expect(readDeviceSettings(badSoundOnly)).toEqual({ soundOn: true, volume: 0.4 })

    const nanVolume = createFakeStorage({
      [DEVICE_SETTINGS_KEY]: JSON.stringify({ soundOn: false, volume: null }),
    })
    expect(readDeviceSettings(nanVolume)).toEqual({ soundOn: false, volume: 0.7 })
  })

  it('clamps volume to 0..1', () => {
    const tooHigh = createFakeStorage({
      [DEVICE_SETTINGS_KEY]: JSON.stringify({ soundOn: true, volume: 1.7 }),
    })
    expect(readDeviceSettings(tooHigh).volume).toBe(1)

    const tooLow = createFakeStorage({
      [DEVICE_SETTINGS_KEY]: JSON.stringify({ soundOn: true, volume: -3 }),
    })
    expect(readDeviceSettings(tooLow).volume).toBe(0)
  })

  it('handles throwing storage without throwing', () => {
    const throwingStorage: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }

    expect(() => readDeviceSettings(throwingStorage)).not.toThrow()
    expect(readDeviceSettings(throwingStorage)).toEqual(DEFAULT_DEVICE_SETTINGS)
    expect(() => writeDeviceSettings({ soundOn: false, volume: 0.5 }, throwingStorage)).not.toThrow()
  })
})

describe('device settings store', () => {
  afterEach(() => {
    setDeviceSettings(DEFAULT_DEVICE_SETTINGS)
  })

  it('merges partial updates, clamps volume, and works in memory without localStorage', () => {
    setDeviceSettings({ soundOn: false })
    expect(getDeviceSettings()).toEqual({ soundOn: false, volume: DEFAULT_DEVICE_SETTINGS.volume })

    setDeviceSettings({ volume: 1.7 })
    expect(getDeviceSettings()).toEqual({ soundOn: false, volume: 1 })

    setDeviceSettings({ volume: -3 })
    expect(getDeviceSettings()).toEqual({ soundOn: false, volume: 0 })

    setDeviceSettings({ volume: Number.NaN })
    expect(getDeviceSettings()).toEqual({ soundOn: false, volume: 0 })
  })

  it('keeps the same snapshot reference between changes and notifies subscribers once per change', () => {
    const before = getDeviceSettings()
    expect(getDeviceSettings()).toBe(before)

    const listener = vi.fn()
    const unsubscribe = subscribeDeviceSettings(listener)

    setDeviceSettings({ volume: 0.45 })
    const after = getDeviceSettings()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(after).not.toBe(before)
    expect(after).toEqual({ soundOn: true, volume: 0.45 })
    expect(getDeviceSettings()).toBe(after)

    unsubscribe()
    setDeviceSettings({ soundOn: false })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
