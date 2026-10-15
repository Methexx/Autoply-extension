import { ReviewItem } from '../../shared/schemas'
import { RawField } from '../adapters/types'
import { setNativeValue, setRadioValue, setSelectValue } from './set-value'

export function fillApprovedItems(items: ReviewItem[], fields: Map<string, RawField>): number {
  let filled = 0

  for (const item of items) {
    if (item.state !== 'approved') continue
    if (item.question.maxLength !== undefined && item.editedAnswer.length > item.question.maxLength)
      continue

    const field = fields.get(item.question.id)
    if (!field || !item.editedAnswer.trim()) continue

    if (field.el instanceof HTMLSelectElement) {
      if (setSelectValue(field.el, item.editedAnswer)) filled++
      continue
    }
    if (field.kind === 'radio' && field.el instanceof HTMLInputElement && field.el.name) {
      if (setRadioValue(document, field.el.name, item.editedAnswer)) filled++
      continue
    }
    if (field.el instanceof HTMLInputElement || field.el instanceof HTMLTextAreaElement) {
      setNativeValue(field.el, item.editedAnswer)
      filled++
    }
  }

  return filled
}
