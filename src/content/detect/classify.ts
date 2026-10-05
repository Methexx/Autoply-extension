import { RawField } from '../adapters/types'
import { STANDARD_FIELD_MATCHERS, StandardFieldType } from './standard-map'

export type FieldClassification =
  | { category: 'standard'; standardType: StandardFieldType }
  | { category: 'open_ended' }
  | { category: 'ignore'; reason: string }

const SENSITIVE_IGNORE_KEYWORDS = [
  // EEO & Demographic
  'gender',
  'race',
  'ethnicity',
  'veteran',
  'disability',
  'sexual orientation',
  'hispanic',
  'latino',
  'demographic',
  'self-identify',
  'equal opportunity',

  // Work Authorization / Visa
  'visa',
  'sponsorship',
  'authorized to work',
  'work authorization',
  'legal right to work',
  'legally authorized',

  // Compensation / Salary
  'salary',
  'compensation',
  'desired pay',
  'pay expectation',
  'expected compensation',
  'hourly rate',

  // Agreements / Consent / Security
  'captcha',
  'consent',
  'acknowledgement',
  'terms',
]

/**
 * Checks if a field should be ignored due to sensitivity (EEO, visa, salary, etc.)
 */
export function isSensitiveField(field: RawField): boolean {
  const targetText = `${field.label} ${field.el.name || ''} ${field.el.id || ''}`.toLowerCase()

  for (const keyword of SENSITIVE_IGNORE_KEYWORDS) {
    if (targetText.includes(keyword)) {
      return true
    }
  }

  return false
}

/**
 * Checks if a field matches any standard profile field
 */
export function matchStandardField(field: RawField): StandardFieldType | null {
  const autocomplete = (field.el.getAttribute('autocomplete') || '').toLowerCase().trim()
  const type = (field.el instanceof HTMLInputElement ? field.el.type : '').toLowerCase()
  const label = field.label.toLowerCase()
  const name = (field.el.name || '').toLowerCase()
  const id = (field.el.id || '').toLowerCase()

  // 1. Try matching by autocomplete
  if (autocomplete) {
    for (const matcher of STANDARD_FIELD_MATCHERS) {
      if (matcher.autocomplete.includes(autocomplete)) {
        return matcher.type
      }
    }
  }

  // 2. Try matching by input type and keywords
  for (const matcher of STANDARD_FIELD_MATCHERS) {
    // Check specific inputTypes
    if (matcher.inputTypes && matcher.inputTypes.includes(type)) {
      // Direct type match for email/tel
      if (matcher.type === 'email' || matcher.type === 'phone') {
        return matcher.type
      }
    }

    // Check label keywords
    for (const kw of matcher.labelKeywords) {
      // Exact word boundary matching or inclusion for distinct terms
      const regex = new RegExp(`\\b${kw}\\b`, 'i')
      if (regex.test(label) || regex.test(name) || regex.test(id)) {
        return matcher.type
      }
    }
  }

  // Handle generic "name" label when not first/last
  if (/\bname\b/i.test(label) && !/\b(company|org|school|first|last|middle|user)\b/i.test(label)) {
    return 'fullName'
  }

  return null
}

/**
 * Checks if a field looks like an open-ended question for the LLM
 */
export function isOpenEndedQuestion(field: RawField): boolean {
  // Textareas are open-ended by default unless standard/ignored
  if (field.kind === 'textarea') {
    return true
  }

  const label = field.label.trim()

  // Label ends with a question mark
  if (label.endsWith('?')) {
    return true
  }

  // Starts with common open-ended prompt words
  if (/^(why|describe|tell us|what|how|explain|share|please share|detail|list)\b/i.test(label)) {
    return true
  }

  // Text inputs with high character limit (e.g. >= 100)
  if (field.kind === 'text' && field.maxLength && field.maxLength >= 100) {
    return true
  }

  // Select or radio questions with multiple choices that aren't standard/ignored
  if ((field.kind === 'select' || field.kind === 'radio') && field.options && field.options.length > 0) {
    return true
  }

  return false
}

/**
 * Classifies a detected raw field into standard, open-ended, or ignore
 */
export function classifyField(field: RawField): FieldClassification {
  // 1. Sensitive fields are strictly ignored (EEO, visa, salary, etc.)
  if (isSensitiveField(field)) {
    return { category: 'ignore', reason: 'sensitive_field' }
  }

  // 2. Check standard fields (autofilled from profile)
  const standardType = matchStandardField(field)
  if (standardType) {
    return { category: 'standard', standardType }
  }

  // 3. Check open-ended questions (drafted by Gemini)
  if (isOpenEndedQuestion(field)) {
    return { category: 'open_ended' }
  }

  // 4. Default: unclassified fields are safely ignored
  return { category: 'ignore', reason: 'unclassified' }
}
