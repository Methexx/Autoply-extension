import { RawField } from '../adapters/types'
import { Profile } from '../../shared/schemas'
import { classifyField } from '../detect/classify'
import { StandardFieldType } from '../detect/standard-map'
import { setNativeValue } from './set-value'

export interface FilledStandardResult {
  field: RawField
  standardType: StandardFieldType
  value: string
}

export function extractProfileStandardValue(
  standardType: StandardFieldType,
  profile: Profile,
): string {
  switch (standardType) {
    case 'fullName':
      return profile.fullName || ''

    case 'firstName': {
      const parts = (profile.fullName || '').trim().split(/\s+/)
      return parts[0] || ''
    }

    case 'lastName': {
      const parts = (profile.fullName || '').trim().split(/\s+/)
      return parts.length > 1 ? parts.slice(1).join(' ') : ''
    }

    case 'email':
      return profile.email || ''

    case 'phone':
      return profile.phone || ''

    case 'location':
      return profile.location || ''

    case 'linkedin':
      return profile.links.linkedin || ''

    case 'github':
      return profile.links.github || ''

    case 'website':
      return profile.links.website || ''
  }
}

/**
 * Automatically fills all detected standard fields from the profile.
 * Respects idempotency: skips fields that are already populated unless overwrite is true.
 */
export function fillStandardFields(
  fields: RawField[],
  profile: Profile,
  overwrite = false,
): FilledStandardResult[] {
  const filled: FilledStandardResult[] = []

  for (const field of fields) {
    const classification = classifyField(field)
    if (classification.category !== 'standard') {
      continue
    }

    const { standardType } = classification
    const value = extractProfileStandardValue(standardType, profile)
    if (!value) continue

    if (field.el instanceof HTMLInputElement || field.el instanceof HTMLTextAreaElement) {
      const currentValue = field.el.value.trim()
      if (!currentValue || overwrite) {
        setNativeValue(field.el, value)
        filled.push({ field, standardType, value })
      }
    }
  }

  return filled
}
