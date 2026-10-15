import { getAdapterForPage } from './adapters'
import { RawField } from './adapters/types'
import { classifyField } from './detect/classify'
import { fillStandardFields } from './fill/fill-standard'
import { getProfile } from '../shared/storage'
import { Draft, DraftReplySchema, Question, ReviewItem } from '../shared/schemas'
import { mountOverlay } from './overlay/Overlay'
import { extractJobContext } from './detect/job'
import { fillApprovedItems } from './fill/fill-approved'

function toReviewItems(questions: Question[], drafts: Draft[]): ReviewItem[] {
  const byId = new Map(drafts.map(draft => [draft.id, draft]))
  return questions.map(question => {
    const draft = byId.get(question.id) ?? {
      id: question.id,
      status: 'needs_input' as const,
      answer: '',
    }
    return { question, draft, editedAnswer: draft.answer, state: 'pending' as const }
  })
}

function sendMessage(message: unknown): Promise<unknown> {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve))
}

declare global {
  interface Window {
    __autoplyInjected?: boolean
  }
}

export async function runAutoplyScan(): Promise<{
  adapterName: string
  filledStandardCount: number
  openEndedQuestions: Question[]
}> {
  const overlay = mountOverlay('scanning')
  const url = new URL(window.location.href)
  const adapter = getAdapterForPage(url, document)

  const formRoot = adapter.findFormRoot(document)
  if (!formRoot) {
    overlay.setState('drafting')
    return {
      adapterName: adapter.name,
      filledStandardCount: 0,
      openEndedQuestions: [],
    }
  }

  const rawFields = adapter.findFields(formRoot)
  const fieldsById = new Map<string, RawField>()
  for (const field of rawFields) {
    const id = field.el.id || field.el.name
    if (id) fieldsById.set(id, field)
  }
  const openEndedQuestions: Question[] = []

  let qIndex = 0
  for (const field of rawFields) {
    const classification = classifyField(field)

    if (classification.category === 'open_ended') {
      qIndex++
      const fieldId = field.el.id || field.el.name || `q_${qIndex}`
      openEndedQuestions.push({
        id: fieldId,
        label: field.label,
        kind: field.kind,
        ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
        ...(field.options !== undefined ? { options: field.options } : {}),
      })
    }
  }

  // Auto-fill standard fields from candidate profile if present
  let filledStandardCount = 0
  const profile = await getProfile()
  if (profile) {
    const filled = fillStandardFields(rawFields, profile)
    filledStandardCount = filled.length
  }

  overlay.setState('drafting')
  if (openEndedQuestions.length > 0) {
    const job = extractJobContext(url, document)
    const response = DraftReplySchema.safeParse(
      await sendMessage({ type: 'DRAFT_REQUEST', job, questions: openEndedQuestions }),
    )
    if (response.success && response.data.ok) {
      overlay.showReview(
        toReviewItems(openEndedQuestions, response.data.drafts),
        async (question, hint) => {
          const regenerated = DraftReplySchema.safeParse(
            await sendMessage({
              type: 'REGENERATE_REQUEST',
              job,
              question,
              ...(hint ? { hint } : {}),
            }),
          )
          return regenerated.success && regenerated.data.ok
            ? (regenerated.data.drafts[0] ?? null)
            : null
        },
        items => fillApprovedItems(items, fieldsById),
      )
    }
  }

  return {
    adapterName: adapter.name,
    filledStandardCount,
    openEndedQuestions,
  }
}

// Auto-run when injected via chrome.scripting.executeScript in extension context
if (
  typeof window !== 'undefined' &&
  typeof chrome !== 'undefined' &&
  chrome.runtime?.id &&
  !window.__autoplyInjected
) {
  window.__autoplyInjected = true
  void runAutoplyScan()
}
