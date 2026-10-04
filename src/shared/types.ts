// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types.
// Fully implemented in M1-T1; stubs here keep the build green at scaffold time.
// ─────────────────────────────────────────────────────────────────────────────

// Re-exported from schemas.ts once Zod infers them. Stub until M1.
export type Profile = Record<string, unknown>
export type Settings = Record<string, unknown>

// ─── Message union ───────────────────────────────────────────────────────────
// All cross-context chrome.runtime messages use this discriminated union.
// Full implementation in M1-T1.

export type AppMessage =
  | { type: 'TEST_KEY' }
  | { type: 'OPEN_OPTIONS'; reason: string }
  | { type: 'DRAFT_REQUEST'; job: unknown; questions: unknown[] }
  | { type: 'REGENERATE_REQUEST'; job: unknown; question: unknown; hint?: string }

export type AppMessageResponse =
  | { type: 'DRAFT_RESPONSE'; drafts: unknown[] }
  | { type: 'DRAFT_ERROR'; code: ErrorCode; message: string }
  | { type: 'TEST_KEY_RESULT'; ok: true }
  | { type: 'TEST_KEY_RESULT'; ok: false; code: ErrorCode; message: string }

// ─── Error codes ─────────────────────────────────────────────────────────────
export type ErrorCode =
  | 'NO_PROFILE'
  | 'NO_KEY'
  | 'INVALID_KEY'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'BAD_MODEL_OUTPUT'
  | 'NO_FIELDS'
  | 'UNSUPPORTED_PAGE'
