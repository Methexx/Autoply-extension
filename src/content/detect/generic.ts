import { RawField, Adapter } from '../adapters/types'
import { FieldKind, JobContext } from '../../shared/schemas'
import { resolveLabel, escapeCss } from './label'

const EXCLUDED_INPUT_TYPES = new Set([
  'hidden',
  'password',
  'file',
  'checkbox',
  'submit',
  'button',
  'search',
  'image',
  'reset',
])

/**
 * Checks if an element is visible in the DOM
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (el.getAttribute('aria-hidden') === 'true') return false
  if (el.hasAttribute('disabled')) return false

  // In test/jsdom environments, getComputedStyle may return default values
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const style = window.getComputedStyle(el)
    if (style.display === 'none') return false
    if (style.visibility === 'hidden') return false
    if (style.opacity === '0') return false
  }

  // Check offsetWidth/offsetHeight if layout engine is active (e.g. browser)
  if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0) {
    // Only apply in environments that compute geometry (offsetWidth > 0 on visible elements)
    if (typeof document !== 'undefined' && document.body && document.body.offsetWidth > 0) {
      return false
    }
  }

  return true
}

/**
 * Maps element to its FieldKind
 */
export function determineFieldKind(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): FieldKind | null {
  if (el instanceof HTMLTextAreaElement) {
    return 'textarea'
  }
  if (el instanceof HTMLSelectElement) {
    return 'select'
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (EXCLUDED_INPUT_TYPES.has(type)) {
      return null
    }
    if (type === 'email') return 'email'
    if (type === 'tel') return 'tel'
    if (type === 'url') return 'url'
    if (type === 'radio') return 'radio'
    return 'text'
  }
  return null
}

/**
 * Finds the form root element (largest form with >= 3 inputs, or body)
 */
export function findGenericFormRoot(doc: Document): HTMLElement {
  const forms = Array.from(doc.querySelectorAll('form'))
  let bestForm: HTMLFormElement | null = null
  let maxInputs = 0

  for (const form of forms) {
    const inputs = form.querySelectorAll('input:not([type=hidden]):not([type=submit]), textarea, select')
    if (inputs.length >= 3 && inputs.length > maxInputs) {
      maxInputs = inputs.length
      bestForm = form
    }
  }

  return bestForm || doc.body
}

/**
 * Detects all raw fields within a root element
 */
export function findGenericFields(root: HTMLElement): RawField[] {
  const elements = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select',
  )

  const rawFields: RawField[] = []
  const processedRadioGroups = new Set<string>()

  for (const el of Array.from(elements)) {
    if (!isElementVisible(el)) continue

    const kind = determineFieldKind(el)
    if (!kind) continue

    // Handle radio button groups
    if (kind === 'radio' && el instanceof HTMLInputElement) {
      const groupName = el.name
      if (!groupName || processedRadioGroups.has(groupName)) {
        continue
      }
      processedRadioGroups.add(groupName)

      // Find all radios in this group within root or doc
      const radios = Array.from(
        (root.ownerDocument || document).querySelectorAll<HTMLInputElement>(
          `input[type="radio"][name="${escapeCss(groupName)}"]`,
        ),
      ).filter(isElementVisible)

      if (radios.length === 0) continue

      // Options from labels of each radio
      const options: string[] = []
      for (const r of radios) {
        const rLabel = resolveLabel(r).label || r.value
        if (rLabel && !options.includes(rLabel)) {
          options.push(rLabel)
        }
      }

      // Group label from fieldset legend or enclosing container heading
      let groupLabel = ''
      const fieldset = radios[0]!.closest('fieldset')
      if (fieldset) {
        const legend = fieldset.querySelector('legend')
        if (legend && legend.textContent) {
          groupLabel = legend.textContent.trim()
        }
      }
      if (!groupLabel) {
        const groupContainer = radios[0]!.closest(
          '.field, .application-question, .form-group, [class*="question"], [class*="group"]',
        )
        if (groupContainer) {
          const headingOrTitle = groupContainer.querySelector(
            'h1, h2, h3, h4, h5, h6, .text, [class*="label"], [class*="title"]',
          )
          if (headingOrTitle && headingOrTitle.textContent) {
            groupLabel = headingOrTitle.textContent.trim()
          }
        }
      }
      if (!groupLabel) {
        groupLabel = humanizeAttribute(groupName)
      }

      rawFields.push({
        el: radios[0]!,
        label: groupLabel,
        kind: 'radio',
        required: radios.some((r) => r.required),
        options,
      })
      continue
    }

    // Handle select options
    let options: string[] | undefined
    if (el instanceof HTMLSelectElement) {
      options = Array.from(el.options)
        .map((opt) => opt.text.trim() || opt.value.trim())
        .filter((val) => val.length > 0 && !/^(--|select)/i.test(val))
    }

    // Handle maxLength
    let maxLength: number | undefined
    const maxAttr = el.getAttribute('maxlength')
    if (maxAttr) {
      const parsed = parseInt(maxAttr, 10)
      if (!isNaN(parsed) && parsed > 0) {
        maxLength = parsed
      }
    }

    const { label, required } = resolveLabel(el)

    const field: RawField = {
      el,
      label,
      kind,
      required,
      ...(maxLength !== undefined ? { maxLength } : {}),
      ...(options !== undefined ? { options } : {}),
    }

    rawFields.push(field)
  }

  return rawFields
}

/**
 * Extracts job context fallback for generic adapter
 */
export function extractGenericJobContext(doc: Document): JobContext {
  const h1 = doc.querySelector('h1')?.textContent?.trim()
  const title = h1 || doc.title.trim()

  const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim()
  const company = ogSiteName || ''

  // Look for main job description text container
  const descEl = doc.querySelector('main, article, #content, .job-description, .description')
  const description = descEl?.textContent?.replace(/\s+/g, ' ').trim() || ''

  return {
    title,
    company,
    description,
    url: doc.location?.href || '',
  }
}

/**
 * Generic fallback adapter
 */
export const genericAdapter: Adapter = {
  name: 'generic',
  matches: () => true, // Fallback matches everything
  findFormRoot: (doc) => findGenericFormRoot(doc),
  findFields: (root) => findGenericFields(root),
  extractJob: (doc) => extractGenericJobContext(doc),
}

function humanizeAttribute(name: string): string {
  return name.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
}
