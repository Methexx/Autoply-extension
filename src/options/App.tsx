import React, { useEffect, useState } from 'react'
import { getProfile, getSettings, initStorage } from '../shared/storage'
import { Profile, Settings } from '../shared/schemas'
import { ProfileSection } from './components/ProfileSection'
import { SettingsSection } from './components/SettingsSection'
import { ClearDataSection } from './components/ClearDataSection'
import { Sparkles } from 'lucide-react'

export function App() {
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<Profile | null>(null)
  const [settingsData, setSettingsData] = useState<Settings | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function load() {
      await initStorage()
      const p = await getProfile()
      const s = await getSettings()
      setProfileData(p)
      setSettingsData(s)
      setLoading(false)
    }
    void load()
  }, [refreshKey])

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  }

  const handleCleared = () => {
    setProfileData(null)
    setSettingsData(null)
    setRefreshKey(k => k + 1)
    window.scrollTo(0, 0)
  }

  return (
    <>
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Sparkles size={32} style={{ color: 'var(--border-focus)' }} />
        <h1 style={{ margin: 0, border: 'none', padding: 0 }}>Autoply Options</h1>
      </header>

      <SettingsSection initialData={settingsData} key={`settings-${refreshKey}`} />
      <ProfileSection initialData={profileData} key={`profile-${refreshKey}`} />
      <ClearDataSection onCleared={handleCleared} />
    </>
  )
}
