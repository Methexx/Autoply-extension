import { describe, expect, it } from 'vitest'
import { RawField } from '../../src/content/adapters/types'
import { fillApprovedItems } from '../../src/content/fill/fill-approved'
import { ReviewItem } from '../../src/shared/schemas'

const makeItem = (state: ReviewItem['state'], answer: string, maxLength?: number): ReviewItem => ({
  question: { id: 'answer', label: 'Why?', kind: 'textarea', ...(maxLength ? { maxLength } : {}) },
  draft: { id: 'answer', status: 'ok', answer: 'Draft' },
  editedAnswer: answer,
  state,
})

describe('fillApprovedItems', () => {
  it('writes only approved, in-limit edited answers', () => {
    const textarea = document.createElement('textarea')
    const field: RawField = { el: textarea, label: 'Why?', kind: 'textarea', required: false }
    const count = fillApprovedItems(
      [makeItem('approved', 'Edited'), makeItem('skipped', 'Ignored')],
      new Map([['answer', field]]),
    )

    expect(count).toBe(1)
    expect(textarea.value).toBe('Edited')
  })

  it('does not write an answer beyond its limit', () => {
    const textarea = document.createElement('textarea')
    const field: RawField = { el: textarea, label: 'Why?', kind: 'textarea', required: false }

    expect(
      fillApprovedItems([makeItem('approved', 'Too long', 3)], new Map([['answer', field]])),
    ).toBe(0)
    expect(textarea.value).toBe('')
  })
})
