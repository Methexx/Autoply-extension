import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SettingsSchema, Settings } from '../../shared/schemas'
import { setSettings } from '../../shared/storage'
import { Eye, EyeOff, Save, KeyRound, CheckCircle, XCircle } from 'lucide-react'
import { GEMINI_MODEL } from '../../shared/constants'

function extensionResponseError(message: string | undefined): string {
  if (!message || /receiving end does not exist|could not establish connection|message port closed/i.test(message)) {
    return 'Autoply’s service worker is not running. Reload the unpacked extension in chrome://extensions, then reopen this page.'
  }
  return 'Autoply could not contact its service worker. Reload the unpacked extension in chrome://extensions, then try again.'
}

export function SettingsSection({ initialData }: { initialData: Settings | null }) {
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  const { register, handleSubmit, getValues, formState: { errors, isDirty } } = useForm<Settings>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: initialData || {
      geminiApiKey: '',
      model: GEMINI_MODEL,
      jobTextMaxChars: 2500
    }
  })

  const onSubmit = async (data: Settings) => {
    await setSettings(data)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 3000)
  }

  const onTestKey = async (provider: 'gemini' | 'openai') => {
    const values = getValues()
    if (!(provider === 'gemini' ? values.geminiApiKey : values.openaiApiKey)) {
      setTestState('error')
      setTestMessage('Please enter a key first.')
      return
    }

    setTestState('testing')
    setTestMessage('Testing connection...')
    
    try {
      // Ensure key is saved in storage so service worker can read it
      await setSettings(values)

      const response = await new Promise<{ ok: boolean; error?: { message?: string } } | undefined>(
        (resolve) => {
          chrome.runtime.sendMessage({ type: 'TEST_KEY', provider }, (res: unknown) => {
            const runtimeError = chrome.runtime.lastError?.message
            if (runtimeError) {
              resolve({ ok: false, error: { message: extensionResponseError(runtimeError) } })
              return
            }
            resolve(res as { ok: boolean; error?: { message?: string } } | undefined)
          })
        },
      )

      if (response?.ok) {
        setTestState('success')
        setTestMessage(`${provider === 'gemini' ? 'Gemini' : 'OpenAI'} connection successful!`)
      } else {
        setTestState('error')
        setTestMessage(response?.error?.message || extensionResponseError(undefined))
      }
    } catch {
      setTestState('error')
      setTestMessage('Autoply could not start the key test. Reload the options page and try again.')
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
          Keys are stored locally. Drafting sends questions, job details, and relevant profile facts to your chosen provider (Google Gemini or OpenAI); contact details are excluded. If fallback is enabled, both providers may receive this information and charge for usage. CV import uses Gemini and sends the selected CV after your consent.
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
              onClick={() => { void onTestKey('gemini') }} 
              disabled={testState === 'testing'}
            >
              Test Gemini
            </button>
          </div>
          {errors.geminiApiKey && <span className="error-message">{errors.geminiApiKey.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="openaiApiKey">OpenAI API Key</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input id="openaiApiKey" type="password" className="input" placeholder="sk-..." {...register('openaiApiKey')} />
            <button type="button" className="btn btn-secondary" onClick={() => { void onTestKey('openai') }} disabled={testState === 'testing'}>Test OpenAI</button>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="primaryProvider">Preferred AI provider</label>
          <select id="primaryProvider" className="input" {...register('primaryProvider')} defaultValue={initialData?.primaryProvider ?? 'gemini'}>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div className="form-group">
          <label><input type="checkbox" {...register('fallbackEnabled')} /> Try the other provider if the preferred provider fails (requires both keys)</label>
        </div>
        <button type="submit" className="btn" disabled={!isDirty && !isSaved}><Save size={16} /> {isSaved ? 'Saved!' : 'Save'}</button>

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
