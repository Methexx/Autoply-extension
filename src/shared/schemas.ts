import { z } from 'zod'

export const EducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  startYear: z.number().int().optional(),
  endYear: z.number().int().optional(),
  notes: z.string().max(600).optional(),
})

export const ExperienceSchema = z.object({
  organization: z.string().min(1),
  role: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().max(600),
})

export const ProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(600),
  technologies: z.array(z.string()).max(60),
  url: z.string().url().optional().or(z.literal('')),
})

export const ProfileSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  location: z.string(),
  links: z.object({
    linkedin: z.string().url().optional().or(z.literal('')),
    github: z.string().url().optional().or(z.literal('')),
    website: z.string().url().optional().or(z.literal('')),
  }),
  summary: z.string().max(1000),
  skills: z.array(z.string()).max(60),
  education: z.array(EducationSchema).max(10),
  experience: z.array(ExperienceSchema).max(15),
  projects: z.array(ProjectSchema).max(15),
})

export const SettingsSchema = z.object({
  geminiApiKey: z.string(),
  model: z.string(),
  jobTextMaxChars: z.number().int().positive(),
})

// ─── Draft related ──────────────────────────────────────────────────────────

export const FieldKindSchema = z.enum([
  'text',
  'email',
  'tel',
  'url',
  'textarea',
  'select',
  'radio',
])

export const QuestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: FieldKindSchema,
  maxLength: z.number().int().optional(),
  options: z.array(z.string()).optional(),
})

export const DraftStatusSchema = z.enum(['ok', 'needs_input'])

export const DraftSchema = z.object({
  id: z.string(),
  status: DraftStatusSchema,
  answer: z.string(),
})

export const JobContextSchema = z.object({
  title: z.string(),
  company: z.string(),
  description: z.string(),
  url: z.string(),
})

// ─── Messaging ───────────────────────────────────────────────────────────────

export const ErrorCodeSchema = z.enum([
  'NO_PROFILE',
  'NO_KEY',
  'INVALID_KEY',
  'RATE_LIMITED',
  'NETWORK',
  'BAD_MODEL_OUTPUT',
  'NO_FIELDS',
  'UNSUPPORTED_PAGE',
])

export const AppErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
})

export const AppMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('DRAFT_REQUEST'),
    job: JobContextSchema,
    questions: z.array(QuestionSchema),
  }),
  z.object({
    type: z.literal('REGENERATE_REQUEST'),
    job: JobContextSchema,
    question: QuestionSchema,
    hint: z.string().optional(),
  }),
  z.object({ type: z.literal('TEST_KEY') }),
  z.object({
    type: z.literal('OPEN_OPTIONS'),
    reason: z.enum(['no_profile', 'no_key']),
  }),
])

export const DraftReplySchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), drafts: z.array(DraftSchema) }),
  z.object({ ok: z.literal(false), error: AppErrorSchema }),
])

// ─── TypeScript Type Inference ──────────────────────────────────────────────

export type Education = z.infer<typeof EducationSchema>
export type Experience = z.infer<typeof ExperienceSchema>
export type Project = z.infer<typeof ProjectSchema>
export type Profile = z.infer<typeof ProfileSchema>
export type Settings = z.infer<typeof SettingsSchema>

export type FieldKind = z.infer<typeof FieldKindSchema>
export type Question = z.infer<typeof QuestionSchema>
export type DraftStatus = z.infer<typeof DraftStatusSchema>
export type Draft = z.infer<typeof DraftSchema>
export type JobContext = z.infer<typeof JobContextSchema>

export type ErrorCode = z.infer<typeof ErrorCodeSchema>
export type AppError = z.infer<typeof AppErrorSchema>
export type AppMessage = z.infer<typeof AppMessageSchema>
export type DraftReply = z.infer<typeof DraftReplySchema>

// Content-script internal review types
export type ReviewState = 'pending' | 'approved' | 'skipped'

export interface ReviewItem {
  question: Question
  draft: Draft
  editedAnswer: string
  state: ReviewState
}

export interface DetectedField {
  id: string
  label: string
  kind: FieldKind
  required: boolean
  maxLength?: number
  options?: string[]
  selectorHint: string
}
