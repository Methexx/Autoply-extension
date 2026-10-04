// ─────────────────────────────────────────────────────────────────────────────
// Shared constants — storage keys, limits, and selectors that must never be
// clicked (enforced in M0-T4 via lint + the test in tests/unit/submit-guard).
// ─────────────────────────────────────────────────────────────────────────────

// chrome.storage.local keys
export const STORAGE_KEY_PROFILE = 'autoply_profile' as const
export const STORAGE_KEY_SETTINGS = 'autoply_settings' as const
export const SCHEMA_VERSION = 1 as const

// Gemini model — keep as a constant so it's easy to update in one place.
// Use a fast, low-cost Flash-class model; verify current ID at:
// https://ai.google.dev/gemini-api/docs/models/gemini
export const GEMINI_MODEL = 'gemini-1.5-flash' as const
export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` as const

// Maximum characters we'll send from the job description to the LLM.
// Keeps prompt size and cost bounded.
export const JOB_DESCRIPTION_MAX_CHARS = 4000 as const

// CSS selectors that identify submit/apply buttons.
// These are stored here so the lint guard and future tests share one list.
// AGENTS.md hard rule §3.1: code must NEVER .click() any of these.
export const SUBMIT_BUTTON_SELECTORS = [
  '[type=submit]',
  'button[data-qa="btn-submit"]', // Greenhouse
  'button[data-qa="save-application"]', // Lever
  'button[aria-label*="submit" i]',
  'button[aria-label*="apply" i]',
] as const
