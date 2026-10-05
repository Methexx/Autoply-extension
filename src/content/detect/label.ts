/**
 * Label resolution and normalization per docs/07-form-detection-and-filling.md §3
 */

export interface LabelResult {
  label: string
  required: boolean
}

/**
 * Humanizes an input name or id attribute
 * e.g. "job_application[first_name]" -> "First name"
 * e.g. "first_name" -> "First name"
 * e.g. "phoneNumber" -> "Phone number"
 */
export function humanizeAttribute(raw: string): string {
  // Extract last identifier inside brackets if nested e.g. answers[question_1]
  const match = /\[([^\]]+)\]$/.exec(raw)
  let base = match && match[1] ? match[1] : raw

  // Strip common suffixes like _attributes, _value, etc.
  base = base.replace(/_attributes|_value|job_application/g, '')

  // Convert camelCase to spaces
  base = base.replace(/([a-z])([A-Z])/g, '$1 $2')

  // Convert underscores, dashes, dots to spaces
  base = base.replace(/[_\-.]+/g, ' ')

  // Collapse whitespace and trim
  base = base.replace(/\s+/g, ' ').trim()

  if (!base) return ''

  // Capitalize first letter
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()
}

/**
 * Normalizes label text:
 * - Trims
 * - Collapses whitespace
 * - Strips trailing asterisk or (required) / (optional)
 * - Caps at 300 chars
 */
export function normalizeLabelText(raw: string): string {
  if (!raw) return ''

  let text = raw.replace(/\s+/g, ' ').trim()

  // Strip trailing required/optional markers and asterisks
  text = text
    .replace(/\s*\(\s*required\s*\)\s*$/i, '')
    .replace(/\s*\(\s*optional\s*\)\s*$/i, '')
    .replace(/\s*\*+\s*$/, '')
    .replace(/\s*\(\s*required\s*\)\s*$/i, '')
    .trim()

  // Cap at 300 characters
  if (text.length > 300) {
    text = text.slice(0, 300).trim()
  }

  return text
}

/**
 * Detects if a field is required based on its attributes or label contents
 */
export function isFieldRequired(
  el: HTMLElement,
  rawLabelText: string,
): boolean {
  if (el.hasAttribute('required')) return true
  if (el.getAttribute('aria-required') === 'true') return true
  if (/\*|\(required\)/i.test(rawLabelText)) return true
  return false
}

export function escapeCss(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str)
  }
  return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1')
}

/**
 * Resolves the user-facing label and required state for an input/textarea/select element
 */
export function resolveLabel(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): LabelResult {
  const doc = el.ownerDocument || document
  let rawLabel = ''

  // 1. <label for=id>
  if (el.id) {
    const labelFor = doc.querySelector(`label[for="${escapeCss(el.id)}"]`)
    if (labelFor && labelFor.textContent) {
      rawLabel = labelFor.textContent
    }
  }

  // 2. Wrapping <label>
  if (!rawLabel) {
    const wrappingLabel = el.closest('label')
    if (wrappingLabel && wrappingLabel.textContent) {
      // Clone label and remove this input's own text if needed, or get text
      rawLabel = wrappingLabel.textContent
    }
  }

  // 3. aria-labelledby target text, then aria-label
  if (!rawLabel) {
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      const parts: string[] = []
      for (const id of labelledBy.split(/\s+/)) {
        const target = doc.getElementById(id)
        if (target && target.textContent) {
          parts.push(target.textContent.trim())
        }
      }
      if (parts.length > 0) {
        rawLabel = parts.join(' ')
      }
    }
  }

  if (!rawLabel) {
    const ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel) {
      rawLabel = ariaLabel
    }
  }

  // 4. Nearest preceding text in the same field group (legend, heading, or div with class containing label)
  if (!rawLabel) {
    // Check fieldset legend
    const fieldset = el.closest('fieldset')
    if (fieldset) {
      const legend = fieldset.querySelector('legend')
      if (legend && legend.textContent) {
        rawLabel = legend.textContent
      }
    }
  }

  if (!rawLabel) {
    // Check enclosing field wrapper (e.g. .field, .form-group, .application-question)
    const wrapper = el.closest('.field, .form-group, .form-item, .application-question, [class*="field"], [class*="group"]')
    if (wrapper) {
      const headingOrLabel = wrapper.querySelector('h1, h2, h3, h4, h5, h6, .text, [class*="label"], [class*="title"]')
      if (headingOrLabel && headingOrLabel.textContent && !headingOrLabel.contains(el)) {
        rawLabel = headingOrLabel.textContent
      }
    }
  }

  // 5. placeholder, then name attribute
  if (!rawLabel) {
    const placeholder = el.getAttribute('placeholder')
    if (placeholder && placeholder.trim()) {
      rawLabel = placeholder
    }
  }

  if (!rawLabel) {
    const name = el.getAttribute('name')
    if (name) {
      rawLabel = humanizeAttribute(name)
    }
  }

  const required = isFieldRequired(el, rawLabel)
  const normalized = normalizeLabelText(rawLabel)

  return {
    label: normalized,
    required,
  }
}
