# 05 — Data Models

All types live in `src/shared/types.ts`; Zod schemas in `src/shared/schemas.ts` mirror them. **Every read from storage, every message, and every LLM response is parsed with a schema before use.**

## 1. Storage layout (`chrome.storage.local`)

| Key | Type | Notes |
|-----|------|-------|
| `schemaVersion` | `number` | Current: `1`. Used for migrations. |
| `profile` | `Profile` | Set from the options page. |
| `settings` | `Settings` | Includes the API key. Only the service worker and options page read it. |
| `savedAnswers` | `SavedAnswer[]` | v1.1 only. Do not create in MVP. |

Do not use `chrome.storage.sync` (it would send profile data to Google's sync servers).

## 2. Profile

```ts
export interface Profile {
  fullName: string
  email: string
  phone: string
  location: string            // free text, e.g. "Colombo, Sri Lanka"
  links: {
    linkedin?: string
    github?: string
    website?: string
  }
  summary: string             // short CV summary, 2–5 sentences
  skills: string[]
  education: Education[]
  experience: Experience[]
  projects: Project[]
}

export interface Education {
  institution: string
  degree: string
  field?: string
  startYear?: number
  endYear?: number           // omit if ongoing
  notes?: string
}

export interface Experience {
  organization: string
  role: string
  startDate?: string         // "YYYY-MM"
  endDate?: string           // "YYYY-MM", omit if current
  description: string        // what you did, factual
}

export interface Project {
  name: string
  description: string        // 1–3 sentences
  technologies: string[]
  url?: string
}
```

### Validation rules (Zod)
- `fullName`, `email`: required, non-empty. `email` must be a valid email.
- Links: valid `https://` URLs when present.
- `summary` ≤ 1,000 chars; each `description` ≤ 600 chars (keeps prompts small).
- Arrays capped: skills ≤ 60, education ≤ 10, experience ≤ 15, projects ≤ 15.

### Which profile fields go to the LLM
- **Sent:** `summary`, `skills`, `education`, `experience`, `projects`.
- **Never sent:** `email`, `phone`, `location` (unless a question explicitly asks about location/relocation and the user approves in a later version), `links` (not needed for drafting).
- Implemented by a pure function `toLlmProfile(profile): LlmProfile` with a unit test asserting excluded fields are absent.

## 3. Settings

```ts
export interface Settings {
  geminiApiKey: string        // never logged, never sent to content script
  model: string               // defaults to GEMINI_MODEL
  jobTextMaxChars: number     // default 6000; truncation limit for job descriptions
}
```

## 4. Page-derived data

```ts
export type FieldKind = 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select' | 'radio'

export interface DetectedField {
  id: string                  // stable within this scan, e.g. "f_12"
  label: string               // normalised label text
  kind: FieldKind
  required: boolean
  maxLength?: number
  options?: string[]          // for select/radio
  selectorHint: string        // internal use by the filler; not sent to the LLM
}

export interface JobContext {
  title: string
  company: string
  description: string         // truncated to settings.jobTextMaxChars
  url: string
}
```

## 5. Question and draft types (LLM contract)

```ts
export interface Question {
  id: string                  // DetectedField.id
  label: string
  kind: FieldKind
  maxLength?: number
  options?: string[]
}

export type DraftStatus = 'ok' | 'needs_input'

export interface Draft {
  id: string                  // matches Question.id
  status: DraftStatus
  answer: string              // empty string when needs_input
}
```

## 6. Review-state types (content script only, in memory)

```ts
export type ReviewState = 'pending' | 'approved' | 'skipped'

export interface ReviewItem {
  question: Question
  draft: Draft
  editedAnswer: string        // what the user will actually fill
  state: ReviewState
}
```

Review state is **not persisted** in the MVP; closing the overlay discards it.

## 7. Saved answers (v1.1, for reference only)

```ts
export interface SavedAnswer {
  id: string
  questionNormalized: string  // lowercased, punctuation-stripped label
  answer: string
  createdAt: number
  lastUsedAt: number
}
```

## 8. Message types

```ts
export type Message =
  | { type: 'DRAFT_REQUEST'; job: JobContext; questions: Question[] }
  | { type: 'REGENERATE_REQUEST'; job: JobContext; question: Question; hint?: string }
  | { type: 'TEST_KEY' }
  | { type: 'OPEN_OPTIONS'; reason: 'no_profile' | 'no_key' }

export type DraftReply =
  | { ok: true; drafts: Draft[] }
  | { ok: false; error: AppError }

export type ErrorCode =
  | 'NO_PROFILE' | 'NO_KEY' | 'INVALID_KEY' | 'RATE_LIMITED'
  | 'NETWORK' | 'BAD_MODEL_OUTPUT' | 'NO_FIELDS' | 'UNSUPPORTED_PAGE'

export interface AppError {
  code: ErrorCode
  message: string             // user-readable, no secrets
  retryable: boolean
}
```

## 9. Migrations

- On startup, the service worker reads `schemaVersion`. If missing, set to `1`.
- Future changes add a migration function per version; never delete user data silently.
