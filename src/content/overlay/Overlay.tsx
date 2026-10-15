import { flushSync } from 'react-dom'
import { createRoot, Root } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { AppError, Draft, Question, ReviewItem } from '../../shared/schemas'
import styles from './overlay.css?inline'

export type OverlayState = 'scanning' | 'drafting' | 'review' | 'filled' | 'error'
export type RegenerateDraft = (question: Question, hint?: string) => Promise<Draft | null>
export type FillApproved = (items: ReviewItem[]) => number

export interface OverlayController {
  setState: (state: OverlayState) => void
  showReview: (
    items: ReviewItem[],
    regenerate?: RegenerateDraft,
    fillApproved?: FillApproved,
  ) => void
  getReviewItems: () => ReviewItem[]
  showError: (error: AppError, retry?: () => void) => void
  showFilled: (message: string) => void
  close: () => void
}

const ERROR_COPY: Record<AppError['code'], string> = {
  NO_PROFILE: 'Add your profile first.',
  NO_KEY: 'Add your Gemini API key to get drafts.',
  INVALID_KEY: 'Gemini rejected your API key.',
  RATE_LIMITED: "Gemini's rate limit was reached. Wait a minute, then try again.",
  NETWORK: "Couldn't reach Gemini. Check your connection.",
  BAD_MODEL_OUTPUT: "The model's answer couldn't be used.",
  NO_FIELDS: "I couldn't find an application form on this page.",
  UNSUPPORTED_PAGE: "This page isn't supported yet.",
}

const overLimit = (item: ReviewItem) =>
  item.question.maxLength !== undefined && item.editedAnswer.length > item.question.maxLength
const canApprove = (item: ReviewItem) =>
  !overLimit(item) && (item.draft.status !== 'needs_input' || item.editedAnswer.trim().length > 0)

function ReviewPanel({
  items: initialItems,
  onChange,
  regenerate,
  onFillApproved,
}: {
  items: ReviewItem[]
  onChange: (items: ReviewItem[]) => void
  regenerate: RegenerateDraft | undefined
  onFillApproved: (items: ReviewItem[]) => void
}) {
  const [items, setItems] = useState(initialItems)
  const [hints, setHints] = useState<Record<string, string>>({})
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const update = (change: (items: ReviewItem[]) => ReviewItem[]) =>
    setItems(current => {
      const next = change(current)
      onChange(next)
      return next
    })
  const replace = async (item: ReviewItem) => {
    if (!regenerate) return
    setRegenerating(item.question.id)
    const draft = await regenerate(item.question, hints[item.question.id])
    setRegenerating(null)
    if (draft)
      update(current =>
        current.map(entry =>
          entry.question.id === item.question.id
            ? { ...entry, draft, editedAnswer: draft.answer, state: 'pending' }
            : entry,
        ),
      )
  }
  return (
    <main className="autoply-review-list" aria-live="polite">
      {items.map(item => {
        const needsInput = item.draft.status === 'needs_input'
        return (
          <article
            className={`autoply-review-item ${needsInput ? 'autoply-needs-input' : ''}`}
            key={item.question.id}
          >
            <div className="autoply-item-heading">
              <label htmlFor={`autoply-answer-${item.question.id}`}>{item.question.label}</label>
              <span className={`autoply-status autoply-status-${item.state}`}>{item.state}</span>
            </div>
            {needsInput && (
              <p className="autoply-warning">
                I don't have this in your profile. Write an answer or skip.
              </p>
            )}
            {item.question.kind === 'select' || item.question.kind === 'radio' ? (
              <select
                id={`autoply-answer-${item.question.id}`}
                value={item.editedAnswer}
                onChange={event =>
                  update(current =>
                    current.map(entry =>
                      entry.question.id === item.question.id
                        ? { ...entry, editedAnswer: event.target.value }
                        : entry,
                    ),
                  )
                }
              >
                <option value="">Select an answer</option>
                {item.question.options?.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                id={`autoply-answer-${item.question.id}`}
                value={item.editedAnswer}
                onChange={event =>
                  update(current =>
                    current.map(entry =>
                      entry.question.id === item.question.id
                        ? { ...entry, editedAnswer: event.target.value }
                        : entry,
                    ),
                  )
                }
              />
            )}
            {item.question.maxLength !== undefined && (
              <p className={`autoply-counter ${overLimit(item) ? 'autoply-counter-over' : ''}`}>
                {item.editedAnswer.length}/{item.question.maxLength}
              </p>
            )}
            <div className="autoply-item-actions">
              <button
                type="button"
                disabled={!canApprove(item)}
                onClick={() =>
                  update(current =>
                    current.map(entry =>
                      entry.question.id === item.question.id
                        ? { ...entry, state: 'approved' }
                        : entry,
                    ),
                  )
                }
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() =>
                  update(current =>
                    current.map(entry =>
                      entry.question.id === item.question.id
                        ? { ...entry, state: 'skipped' }
                        : entry,
                    ),
                  )
                }
              >
                Skip
              </button>
              <input
                aria-label={`Regeneration hint for ${item.question.label}`}
                placeholder="Optional hint"
                value={hints[item.question.id] ?? ''}
                onChange={event =>
                  setHints(current => ({ ...current, [item.question.id]: event.target.value }))
                }
              />
              <button
                type="button"
                disabled={!regenerate || regenerating === item.question.id}
                onClick={() => void replace(item)}
              >
                {regenerating === item.question.id ? 'Drafting…' : 'Regenerate'}
              </button>
            </div>
          </article>
        )
      })}
      <button
        className="autoply-fill-approved"
        type="button"
        disabled={!items.some(item => item.state === 'approved')}
        onClick={() => onFillApproved(items)}
      >
        Fill approved ({items.filter(item => item.state === 'approved').length})
      </button>
    </main>
  )
}

function ErrorPanel({ error, retry, onClose }: { error: AppError; retry: (() => void) | undefined; onClose: () => void }) {
  const opensOptions = error.code === 'NO_PROFILE' || error.code === 'NO_KEY' || error.code === 'INVALID_KEY'
  const retryable = error.code === 'RATE_LIMITED' || error.code === 'NETWORK' || error.code === 'BAD_MODEL_OUTPUT'
  const action = opensOptions ? 'Open options' : retryable ? 'Retry' : 'Close'
  const runAction = () => {
    if (opensOptions) {
      void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS', reason: error.code === 'NO_PROFILE' ? 'no_profile' : 'no_key' })
      return
    }
    if (retryable) retry?.()
    else onClose()
  }
  return <main className="autoply-content" aria-live="assertive"><p>{ERROR_COPY[error.code]}</p><button className="autoply-fill-approved" type="button" onClick={runAction}>{action}</button></main>
}

function Overlay({
  state,
  onClose,
  reviewItems,
  onReviewChange,
  regenerate,
  onFillApproved,
  filledCount,
  completionMessage,
  error,
  retry,
}: {
  state: OverlayState
  onClose: () => void
  reviewItems: ReviewItem[]
  onReviewChange: (items: ReviewItem[]) => void
  regenerate: RegenerateDraft | undefined
  onFillApproved: (items: ReviewItem[]) => void
  filledCount: number
  completionMessage: string | undefined
  error: AppError | undefined
  retry: (() => void) | undefined
}) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [onClose])
  const defaultCompletionMessage = `Filled ${filledCount} answers. Review the form, then submit it yourself.`
  const message = state === 'scanning' ? 'Scanning the form…' : 'Drafting answers with Gemini…'
  return (
    <aside
      className="autoply-panel"
      aria-label="Autoply review panel"
      role="dialog"
      aria-modal="false"
    >
      <header className="autoply-header">
        <div>
          <p className="autoply-eyebrow">AUTOPLY</p>
          <h2>Review application</h2>
        </div>
        <button
          className="autoply-close"
          type="button"
          onClick={onClose}
          aria-label="Close Autoply"
        >
          ×
        </button>
      </header>
      {state === 'error' && error ? <ErrorPanel error={error} retry={retry} onClose={onClose} /> : state === 'review' ? (
        <ReviewPanel
          key={reviewItems.map(item => item.question.id).join('|')}
          items={reviewItems}
          onChange={onReviewChange}
          regenerate={regenerate}
          onFillApproved={onFillApproved}
        />
      ) : (
        <main className="autoply-content" aria-live="polite">
          <span className="autoply-spinner" aria-hidden="true" />
          <p>{state === 'filled' ? (completionMessage ?? defaultCompletionMessage) : message}</p>
        </main>
      )}
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
  let reviewItems: ReviewItem[] = []
  let regenerate: RegenerateDraft | undefined
  let fillApproved: FillApproved | undefined
  let filledCount = 0
  let completionMessage: string | undefined
  let error: AppError | undefined
  let retry: (() => void) | undefined
  const close = () => {
    if (!root) return
    root.unmount()
    root = null
    host.remove()
  }
  const render = () =>
    flushSync(() =>
      root?.render(
        <Overlay
          state={state}
          onClose={close}
          reviewItems={reviewItems}
          onReviewChange={items => {
            reviewItems = items
          }}
          regenerate={regenerate}
          onFillApproved={items => {
            reviewItems = items
            filledCount = fillApproved?.(items) ?? 0
            completionMessage = undefined
            state = 'filled'
            render()
          }}
          filledCount={filledCount}
          completionMessage={completionMessage}
          error={error}
          retry={retry}
        />,
      ),
    )
  render()
  return {
    setState: next => {
      state = next
      render()
    },
    showReview: (items, nextRegenerate, nextFillApproved) => {
      reviewItems = items
      regenerate = nextRegenerate
      fillApproved = nextFillApproved
      state = 'review'
      render()
    },
    getReviewItems: () => reviewItems,
    showError: (nextError, nextRetry) => {
      error = nextError
      retry = nextRetry
      state = 'error'
      render()
    },
    showFilled: message => {
      completionMessage = message
      state = 'filled'
      render()
    },
    close,
  }
}
