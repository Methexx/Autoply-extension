import { Profile, ProfileSchema, Settings, SettingsSchema } from './schemas'
import { STORAGE_KEY_PROFILE, STORAGE_KEY_SETTINGS, SCHEMA_VERSION } from './constants'

export async function getProfile(): Promise<Profile | null> {
  const data: Record<string, unknown> = await chrome.storage.local.get(STORAGE_KEY_PROFILE)
  const profile = data[STORAGE_KEY_PROFILE]

  if (!profile) return null

  const parsed = ProfileSchema.safeParse(profile)
  if (parsed.success) {
    return parsed.data
  }

  console.warn('[Autoply] Invalid profile data in storage:', parsed.error)
  return null
}

export async function setProfile(profile: Profile): Promise<void> {
  // Validate before saving to ensure we don't save garbage
  const validProfile = ProfileSchema.parse(profile)
  await chrome.storage.local.set({ [STORAGE_KEY_PROFILE]: validProfile })
}

export async function getSettings(): Promise<Settings | null> {
  const data: Record<string, unknown> = await chrome.storage.local.get(STORAGE_KEY_SETTINGS)
  const settings = data[STORAGE_KEY_SETTINGS]

  if (!settings) return null

  const parsed = SettingsSchema.safeParse(settings)
  if (parsed.success) {
    return parsed.data
  }

  console.warn('[Autoply] Invalid settings data in storage:', parsed.error)
  return null
}

export async function setSettings(settings: Settings): Promise<void> {
  const validSettings = SettingsSchema.parse(settings)
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: validSettings })
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY_PROFILE, STORAGE_KEY_SETTINGS])
}

export async function initStorage(): Promise<void> {
  const data = await chrome.storage.local.get('schemaVersion')
  if (!data['schemaVersion']) {
    await chrome.storage.local.set({ schemaVersion: SCHEMA_VERSION })
  }
}
