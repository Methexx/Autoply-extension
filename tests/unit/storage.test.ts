import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProfile, setProfile, getSettings, setSettings, clearAll, initStorage } from '../../src/shared/storage'
import { STORAGE_KEY_PROFILE, STORAGE_KEY_SETTINGS, SCHEMA_VERSION } from '../../src/shared/constants'
import { Profile, Settings } from '../../src/shared/schemas'

describe('Storage Wrapper', () => {
  let mockStorage: Record<string, any> = {}

  beforeEach(() => {
    mockStorage = {}
    
    // Mock chrome.storage.local
    global.chrome = {
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[]) => {
            if (typeof keys === 'string') {
              return { [keys]: mockStorage[keys] }
            }
            const result: Record<string, any> = {}
            keys.forEach(k => {
              if (mockStorage[k] !== undefined) result[k] = mockStorage[k]
            })
            return result
          }),
          set: vi.fn(async (items: Record<string, any>) => {
            Object.assign(mockStorage, items)
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            if (typeof keys === 'string') {
              delete mockStorage[keys]
            } else {
              keys.forEach(k => delete mockStorage[k])
            }
          }),
        }
      }
    } as any
    
    // Silence console.warn for invalid parse tests
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('initStorage sets schemaVersion if missing', async () => {
    await initStorage()
    expect(mockStorage['schemaVersion']).toBe(SCHEMA_VERSION)
  })

  it('initStorage does not overwrite existing schemaVersion', async () => {
    mockStorage['schemaVersion'] = 999
    await initStorage()
    expect(mockStorage['schemaVersion']).toBe(999)
  })

  it('getProfile returns null if missing', async () => {
    expect(await getProfile()).toBeNull()
  })

  it('getProfile returns null and warns if data is invalid', async () => {
    mockStorage[STORAGE_KEY_PROFILE] = { fullName: 123 } // invalid
    const profile = await getProfile()
    expect(profile).toBeNull()
    expect(console.warn).toHaveBeenCalled()
  })

  it('setProfile and getProfile round-trip valid data', async () => {
    const validProfile: Profile = {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+123',
      location: 'Earth',
      links: {},
      summary: 'Summary',
      skills: ['JS'],
      education: [],
      experience: [],
      projects: []
    }
    await setProfile(validProfile)
    const fetched = await getProfile()
    expect(fetched).toEqual(validProfile)
  })

  it('getSettings returns null if missing or invalid', async () => {
    expect(await getSettings()).toBeNull()
    
    mockStorage[STORAGE_KEY_SETTINGS] = { geminiApiKey: 123 }
    expect(await getSettings()).toBeNull()
  })

  it('setSettings and getSettings round-trip valid data', async () => {
    const validSettings: Settings = {
      geminiApiKey: 'key',
      model: 'model',
      jobTextMaxChars: 1000
    }
    await setSettings(validSettings)
    expect(await getSettings()).toEqual(validSettings)
  })

  it('clearAll removes profile and settings', async () => {
    mockStorage[STORAGE_KEY_PROFILE] = {}
    mockStorage[STORAGE_KEY_SETTINGS] = {}
    await clearAll()
    expect(mockStorage[STORAGE_KEY_PROFILE]).toBeUndefined()
    expect(mockStorage[STORAGE_KEY_SETTINGS]).toBeUndefined()
  })
})
