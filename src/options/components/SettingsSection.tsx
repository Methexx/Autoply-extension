import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SettingsSchema, Settings } from '../../shared/schemas'
import { setSettings } from '../../shared/storage'
import { Eye, EyeOff, Save, KeyRound, CheckCircle, XCircle } from 'lucide-react'
import { GEMINI_MODEL } from '../../shared/constants'

export function SettingsSection({ initialData }: { initialData: Settings | null }) {
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isDirty } } = useForm<Settings>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: initialData || {
      geminiApiKey: '',
      model: GEMINI_MODEL,
      jobTextMaxChars: 6000
    }
  })

  const currentKey = watch('geminiApiKey')

  const onSubmit = async (data: Settings) => {
    await setSettings(data)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 3000)
  }

  const onTestKey = async () => {
    if (!currentKey) {
      setTestState('error')
      setTestMessage('Please enter a key first.')
      return
    }

    setTestState('testing')
    setTestMessage('Testing connection...')
    
    try {
      // Ensure key is saved in storage so service worker can read it
      await setSettings({
        geminiApiKey: currentKey,
        model: GEMINI_MODEL,
        jobTextMaxChars: 6000,
      })

      const response = (await chrome.runtime.sendMessage({ type: 'TEST_KEY' })) as
        | { ok: boolean; error?: { message: string } }
        | undefined

      if (response?.ok) {
        setTestState('success')
        setTestMessage('Connection successful!')
      } else {
        setTestState('error')
        setTestMessage(response?.error?.message || 'Connection failed.')
      }
    } catch (err: unknown) {
      setTestState('error')
      setTestMessage(err instanceof Error ? err.message : 'Connection failed.')
    }
  }

  return (
    <section className="section">
      <div className="flex-gap mb-4">
        <KeyRound className="text-muted" size={24} />
        <h2 style={{ margin: 0, border: 'none', padding: 0 }}>API Configuration</h2>
      </div>
      
      <div className="notice">
        <p className="text-sm" style={{ margin: 0 }}>
          Your key is stored only in this browser and used only to call Google's Gemini API. 
          When you generate drafts, the question text, job description, and your profile summary, skills, education, experience, and projects are sent to Google's Gemini API. Contact details are not sent.
        </p>
      </div>

      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <div className="form-group">
          <label htmlFor="geminiApiKey">Gemini API Key</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                id="geminiApiKey"
                type={showKey ? 'text' : 'password'}
                className={`input ${errors.geminiApiKey ? 'input-error' : ''}`}
                placeholder="AIzaSy..."
                {...register('geminiApiKey')}
              />
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                style={{ position: 'absolute', right: '0.25rem', top: '0.25rem', padding: '0.375rem', border: 'none' }}
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => { void onTestKey() }} 
              disabled={testState === 'testing'}
            >
              Test Key
            </button>
            <button type="submit" className="btn" disabled={!isDirty && !isSaved}>
              <Save size={16} /> {isSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          {errors.geminiApiKey && <span className="error-message">{errors.geminiApiKey.message}</span>}
        </div>

        {testState !== 'idle' && (
          <div 
            className={`mt-4 flex-gap text-sm ${testState === 'error' ? 'text-danger' : ''}`}
            aria-live="polite"
          >
            {testState === 'success' && <CheckCircle size={16} style={{ color: '#10b981' }}/>}
            {testState === 'error' && <XCircle size={16} />}
            {testMessage}
          </div>
        )}
      </form>
    </section>
  )
}
