import { Draft, JobContext, Question } from '../../shared/schemas'
import { LlmProfile } from '../../shared/profile'

export interface DraftInput {
  profile: LlmProfile
  job: JobContext
  questions: Question[]
  hint?: string
}

export interface LlmProvider {
  draftAnswers(input: DraftInput, apiKey: string, model: string): Promise<Draft[]>
  testKey(apiKey: string, model: string): Promise<void>
}
