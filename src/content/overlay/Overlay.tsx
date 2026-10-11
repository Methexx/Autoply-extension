import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { useEffect } from 'react'
import styles from './overlay.css?inline'

export type OverlayState = 'scanning' | 'drafting'

interface OverlayProps {
  state: OverlayState
  onClose: () => void
}

export interface OverlayController {
  setState: (state: OverlayState) => void
  close: () => void
}

function Overlay({ state, onClose }: OverlayProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const message = state === 'scanning' ? 'Scanning the form…' : 'Drafting answers with Gemini…'

  return (
    <aside className="autoply-panel" aria-label="Autoply review panel" role="dialog" aria-modal="false">
      <header className="autoply-header">
        <div>
          <p className="autoply-eyebrow">AUTOPLY</p>
          <h2>Review application</h2>
        </div>
        <button className="autoply-close" type="button" onClick={onClose} aria-label="Close Autoply">
          ×
        </button>
      </header>
      <main className="autoply-content" aria-live="polite">
        <span className="autoply-spinner" aria-hidden="true" />
        <p>{message}</p>
      </main>
      <footer className="autoply-footer">Autoply never submits your application.</footer>
    </aside>
  )
}

/** Mounts an isolated, disposable panel without altering the application form. */
export function mountOverlay(initialState: OverlayState = 'scanning'): OverlayController {
  document.getElementById('autoply-root')?.remove()

  const host = document.createElement('div')
  host.id = 'autoply-root'
  host.setAttribute('data-autoply-overlay', 'true')
  document.documentElement.append(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = styles
  const container = document.createElement('div')
  shadow.append(style, container)

  let root: Root | null = createRoot(container)
  let state = initialState

  const close = () => {
    if (!root) return
    root.unmount()
    root = null
    host.remove()
  }

  const render = () => {
    flushSync(() => root?.render(<Overlay state={state} onClose={close} />))
  }

  render()

  return {
    setState: (nextState) => {
      state = nextState
      render()
    },
    close,
  }
}
