import { AppMessage, Question } from '../shared/schemas'

export interface PlaygroundInput {
  question: string
  jobTitle: string
  company: string
  jobDescription: string
}

/**
 * Keeps the dev playground on the same validated message path as a real page.
 * It deliberately contains no profile or API-key data.
 */
export function buildPlaygroundRequest(input: PlaygroundInput): AppMessage | null {
  const label = input.question.trim()
  if (!label) return null

  const question: Question = {
    id: 'playground-question',
    label,
    kind: 'textarea',
  }

  return {
    type: 'DRAFT_REQUEST',
    job: {
      title: input.jobTitle.trim(),
      company: input.company.trim(),
      description: input.jobDescription.trim(),
      url: 'autoply://dev-playground',
    },
    questions: [question],
  }
}
