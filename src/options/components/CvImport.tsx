import { ChangeEvent, useState } from 'react'
import { FileUp, LoaderCircle } from 'lucide-react'
import { CvFileSchema, ExtractedProfile, ExtractedProfileSchema } from '../../shared/schemas'

const MAX_FILE_BYTES = 5 * 1024 * 1024

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  }
  return btoa(binary)
}

export function CvImport({ onExtracted }: { onExtracted: (profile: ExtractedProfile) => void }) {
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<'idle' | 'extracting' | 'error' | 'done'>('idle')
  const [message, setMessage] = useState('')

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!consent) { setState('error'); setMessage('Confirm that you want to send this CV to Gemini first.'); return }
    const mimeType = file.type === 'application/pdf' ? 'application/pdf' : file.type === 'text/plain' ? 'text/plain' : null
    if (!mimeType) { setState('error'); setMessage('Choose a PDF or plain-text CV.'); return }
    if (file.size > MAX_FILE_BYTES) { setState('error'); setMessage('Choose a CV smaller than 5 MB.'); return }
    setState('extracting'); setMessage('')
    const payload = CvFileSchema.safeParse({ mimeType, data: toBase64(new Uint8Array(await file.arrayBuffer())) })
    if (!payload.success) { setState('error'); setMessage('This CV could not be prepared safely.'); return }
    chrome.runtime.sendMessage({ type: 'CV_EXTRACT_REQUEST', file: payload.data }, (response: unknown) => {
      const parsed = ExtractedProfileSchema.safeParse((response as { profile?: unknown } | undefined)?.profile)
      if ((response as { ok?: boolean } | undefined)?.ok && parsed.success) {
        onExtracted(parsed.data); setState('done'); setMessage('CV details were added as editable, unsaved profile fields.')
      } else {
        setState('error'); setMessage('CV extraction failed. Check your Gemini key and try again.')
      }
    })
  }

  return <section className="section cv-import">
    <div className="flex-gap mb-4"><FileUp className="text-muted" size={24} /><h2 style={{ margin: 0, border: 'none', padding: 0 }}>Import CV with Gemini</h2></div>
    <p className="text-sm">Upload a PDF or plain-text CV (up to 5 MB). Autoply sends it directly to Google&apos;s Gemini API using your key, extracts suggested fields, and does not store the original file.</p>
    <label className="cv-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I understand my CV will be sent to Gemini for extraction.</label>
    <label className="btn cv-upload" aria-disabled={!consent || state === 'extracting'}>
      {state === 'extracting' ? <LoaderCircle size={16} className="spin" /> : <FileUp size={16} />}
      {state === 'extracting' ? 'Extracting CV…' : 'Choose CV'}
      <input type="file" accept="application/pdf,text/plain,.pdf,.txt" disabled={!consent || state === 'extracting'} onChange={e => { void onFile(e) }} />
    </label>
    {state !== 'idle' && <p className={state === 'error' ? 'error-message cv-message' : 'cv-message'} aria-live="polite">{message}</p>}
  </section>
}
