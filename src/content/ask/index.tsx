import { useCallback, useEffect, useState } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { z } from 'zod'
import { DraftReplySchema } from '../../shared/schemas'

type Turn = { role: 'user' | 'assistant'; text: string }
const OpenAskSchema = z.object({ type: z.literal('AUTOPLY_OPEN_ASK'), selection: z.string().min(1).max(4000) })

declare global { interface Window { __autoplyAskInstalled?: boolean } }

export function getPageContext(doc: Document): string {
  const source = doc.querySelector('main, article, [role="main"]') ?? doc.body
  if (!source) return ''
  const walker = doc.createTreeWalker(source, NodeFilter.SHOW_TEXT)
  const parts: string[] = []
  let length = 0
  let node: Node | null
  while ((node = walker.nextNode()) && length < 2500) {
    const parent = node.parentElement
    if (!parent || parent.closest('form, input, textarea, select, button, script, style, noscript, [contenteditable], [hidden], [aria-hidden="true"], #autoply-ask-root, #autoply-root')) continue
    let visible = true
    for (let el: Element | null = parent; el; el = el.parentElement) {
      const style = doc.defaultView?.getComputedStyle(el)
      if (style?.display === 'none' || style?.visibility === 'hidden') { visible = false; break }
      if (el === source) break
    }
    if (!visible) continue
    const text = node.textContent?.replace(/\s+/g, ' ').trim()
    if (text) { parts.push(text); length += text.length + 1 }
  }
  return parts.join(' ').slice(0, 2500)
}

function AskPanel({ selection, close }: { selection: string; close: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [context] = useState(() => getPageContext(document))
  const [pageTitle] = useState(() => document.title.slice(0, 300))

  const ask = useCallback(async (history: Turn[]) => {
    setBusy(true)
    setError('')
    try {
      const raw: unknown = await chrome.runtime.sendMessage({ type: 'ASK_REQUEST', selection, context, pageTitle, conversation: history.slice(-12) })
      const response = DraftReplySchema.safeParse(raw)
      if (!response.success) throw new Error('Autoply could not read the response. Reload the extension and try again.')
      if (!response.data.ok) throw new Error(response.data.error.message)
      const draft = response.data.drafts[0]
      const answer = draft?.status === 'ok' && draft.answer.trim() ? draft.answer : 'I need more information to answer that accurately. Tell me what to include.'
      setTurns([...history, { role: 'assistant', text: answer.slice(0, 4000) }])
    } catch (cause) {
      setTurns(history)
      setError(cause instanceof Error ? cause.message : 'Could not generate an answer. Please try again.')
    } finally { setBusy(false) }
  }, [selection, context, pageTitle])

  useEffect(() => { void ask([]) }, [ask]) // Start only on the explicit context-menu action.

  function send() {
    const text = question.trim().slice(0, 4000)
    if (!text || busy) return
    const history: Turn[] = [...turns, { role: 'user', text }]
    setQuestion('')
    setTurns(history)
    void ask(history)
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setError('Copy failed. Select the answer text and copy it manually.') }
  }

  return <div className="panel">
    <header><strong>Ask Autoply</strong><button type="button" onClick={close} aria-label="Close Ask Autoply">×</button></header>
    <p className="notice">Your selection, up to 2,500 characters of page text, relevant profile facts, and this chat are sent to your configured AI provider. Fallback may send them to both providers.</p>
    <div className="conversation" aria-live="polite">
      <div className="selection"><small>SELECTED TEXT</small><p>{selection}</p></div>
      {turns.map((turn, index) => <div key={index} className={turn.role}><small>{turn.role === 'user' ? 'YOU' : 'AUTOPLY'}</small><p>{turn.text}</p>{turn.role === 'assistant' && <button type="button" onClick={() => void copy(turn.text)}>{copied ? 'Copied' : 'Copy answer'}</button>}</div>)}
      {busy && <p>Thinking…</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => void ask(turns)} disabled={busy}>Retry</button></div>}
    </div>
    <div className="composer"><label htmlFor="ask-followup">Ask a follow-up</label><textarea id="ask-followup" value={question} maxLength={4000} onChange={e => setQuestion(e.target.value)} placeholder="Make it shorter, add detail, or ask another question…" /><button type="button" disabled={busy || !question.trim()} onClick={send}>Send</button></div>
    <footer>Review answers yourself. Autoply never submits applications.</footer>
  </div>
}

const css = `:host{all:initial} *{box-sizing:border-box} .panel{position:fixed;z-index:2147483647;right:16px;top:16px;bottom:16px;width:min(420px,calc(100vw - 32px));display:flex;flex-direction:column;background:#171717;color:#f5f5f5;border:1px solid #4b5563;border-radius:14px;box-shadow:0 12px 45px #0008;font:14px/1.5 system-ui,sans-serif;overflow:hidden} header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #333;font-size:18px} button{font:inherit;cursor:pointer;background:#60a5fa;color:#111;border:0;border-radius:6px;padding:7px 12px} button:disabled{opacity:.5;cursor:default} header button{background:transparent;color:white;font-size:24px;padding:0 4px} .notice{margin:0;padding:12px 16px;background:#27272a;color:#ddd;font-size:12px}.conversation{flex:1;overflow:auto;padding:16px}.conversation>div{margin-bottom:14px;padding:12px;background:#292929;border-radius:8px;overflow-wrap:anywhere}.conversation .user{background:#1e3a5f} small{color:#93c5fd;font-size:10px;letter-spacing:.08em} p{white-space:pre-wrap;margin:4px 0 8px} .conversation button{font-size:12px;background:#3f3f46;color:white} .composer{padding:12px 16px;border-top:1px solid #333;display:grid;gap:8px}.composer textarea{width:100%;height:75px;resize:vertical;background:#262626;color:white;border:1px solid #666;border-radius:6px;padding:8px;font:inherit} footer{padding:0 16px 12px;color:#aaa;font-size:11px}`

let root: Root | undefined
function openAsk(selection: string) {
  root?.unmount()
  document.getElementById('autoply-ask-root')?.remove()
  const host = document.createElement('div')
  host.id = 'autoply-ask-root'
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  const container = document.createElement('div')
  shadow.append(style, container)
  document.documentElement.append(host)
  root = createRoot(container)
  root.render(<AskPanel selection={selection} close={() => { root?.unmount(); root = undefined; host.remove() }} />)
}

if (typeof chrome !== 'undefined' && chrome.runtime?.id && !window.__autoplyAskInstalled) {
  window.__autoplyAskInstalled = true
  chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    const parsed = OpenAskSchema.safeParse(message)
    if (sender.id !== chrome.runtime.id || !parsed.success) return
    openAsk(parsed.data.selection)
    respond({ ok: true })
  })
}
