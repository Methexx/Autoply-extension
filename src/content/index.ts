import { getAdapterForPage } from './adapters'
import { classifyField } from './detect/classify'
import { fillStandardFields } from './fill/fill-standard'
import { getProfile } from '../shared/storage'
import { Question } from '../shared/schemas'

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
  const url = new URL(window.location.href)
  const adapter = getAdapterForPage(url, document)

  const formRoot = adapter.findFormRoot(document)
  if (!formRoot) {
    return {
      adapterName: adapter.name,
      filledStandardCount: 0,
      openEndedQuestions: [],
    }
  }

  const rawFields = adapter.findFields(formRoot)
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
