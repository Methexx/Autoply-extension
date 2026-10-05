import { z } from 'zod'
import { Draft, DraftSchema } from '../../shared/schemas'

const GeminiResponseSchema = z.object({
  drafts: z.array(DraftSchema)
})

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

export function parseDrafts(jsonText: string, expectedIds: string[]): Draft[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new ParseError('Invalid JSON returned by the model.')
  }

  const result = GeminiResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new ParseError('Model output did not match the expected schema.')
  }

  const returnedDrafts = result.data.drafts
  const draftsMap = new Map<string, Draft>()
  
  for (const d of returnedDrafts) {
    if (!draftsMap.has(d.id)) {
      draftsMap.set(d.id, d)
    }
  }

  // Ensure every requested id has exactly one draft, drop extra ones
  return expectedIds.map(id => {
    const found = draftsMap.get(id)
    if (found) {
      return found
    }
    return { id, status: 'needs_input', answer: '' }
  })
}
