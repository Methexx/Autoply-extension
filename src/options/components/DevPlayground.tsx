import { FormEvent, useState } from 'react'
import { DraftReplySchema } from '../../shared/schemas'
import { buildPlaygroundRequest } from '../playground'

type PlaygroundStatus = 'idle' | 'drafting' | 'error' | 'success'

function sendMessage(message: ReturnType<typeof buildPlaygroundRequest>) {
  return new Promise<unknown>((resolve) => {
    chrome.runtime.sendMessage(message, resolve)
  })
}

export function DevPlayground() {
  const [question, setQuestion] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [status, setStatus] = useState<PlaygroundStatus>('idle')
  const [result, setResult] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = buildPlaygroundRequest({ question, jobTitle, company, jobDescription })
    if (!message) {
      setStatus('error')
      setResult('Enter a question before drafting.')
      return
    }

    setStatus('drafting')
    setResult('')
    try {
      const reply = DraftReplySchema.safeParse(await sendMessage(message))
      if (!reply.success) {
        setStatus('error')
        setResult('The service worker returned an unexpected response.')
        return
      }
      if (!reply.data.ok) {
        setStatus('error')
        setResult(reply.data.error.message)
        return
      }

      const draft = reply.data.drafts[0]
      if (!draft) {
        setStatus('error')
        setResult('No draft was returned.')
        return
      }
      setStatus('success')
      setResult(
        draft.status === 'needs_input'
          ? 'NEEDS_INPUT — the profile does not support a truthful answer.'
          : draft.answer,
      )
    } catch {
      setStatus('error')
      setResult('Could not contact the extension service worker. Reload this page and try again.')
    }
  }

  return (
    <section className="section" data-testid="dev-playground">
      <h2>Development prompt playground</h2>
      <p className="text-sm">
        Development-only: use this to review drafts against the saved profile. The API key remains in
        the service worker; contact details are not sent.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-group">
          <label htmlFor="playground-question">Application question</label>
          <textarea id="playground-question" className="input" value={question} onChange={(event) => setQuestion(event.target.value)} required />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label htmlFor="playground-job-title">Job title</label>
            <input id="playground-job-title" className="input" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="playground-company">Company</label>
            <input id="playground-company" className="input" value={company} onChange={(event) => setCompany(event.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="playground-job-description">Job description</label>
          <textarea id="playground-job-description" className="input" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={status === 'drafting'}>
          {status === 'drafting' ? 'Drafting…' : 'Generate draft'}
        </button>
      </form>
      {status !== 'idle' && (
        <div className={status === 'error' ? 'error-message mt-4' : 'notice mt-4'} aria-live="polite">
          {result}
        </div>
      )}
    </section>
  )
}
