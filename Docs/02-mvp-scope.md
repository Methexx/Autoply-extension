# 02 — MVP Scope

Each feature has an ID used by the roadmap and tests. "AC" = acceptance criteria.

## 1. MVP features (must build)

### F1 — Profile setup
Options page where the user stores their profile locally.
- Fields: full name, email, phone, location, LinkedIn, GitHub, website/portfolio, education entries, skills, projects (title + short description), work experience entries, short CV summary.
- **AC1:** Saving persists to `chrome.storage.local` and survives browser restart.
- **AC2:** Invalid email/URL shows an inline error and blocks save.
- **AC3:** Reopening the page loads saved values.

### F2 — API key settings
- Field to paste a Gemini API key, stored in `chrome.storage.local`, masked after save.
- "Test key" button makes a minimal Gemini request and reports success or a readable error.
- **AC1:** Key is never shown in full after saving.
- **AC2:** Test returns distinct messages for invalid key, rate limit, and network failure.
- **AC3:** Key is not accessible from the content script or page context.

### F3 — Trigger and form detection
- User clicks the toolbar button on the active tab; Autoply injects the content script on demand.
- Detects `input[type=text|email|tel|url]`, `textarea`, `select`, and radio groups with their labels.
- Greenhouse and Lever hosted pages supported via adapters; a generic fallback handles other simple forms.
- **AC1:** Detection returns, per field: id, label text, type, required flag, options (for select/radio), max length when present.
- **AC2:** On saved fixtures for both platforms, ≥ 95% of visible fields are detected.
- **AC3:** Nothing runs on a page until the user clicks the toolbar button.

### F4 — Standard autofill (no AI)
- Maps detected fields to profile values (name, email, phone, links, location) using label/name/autocomplete heuristics.
- **AC1:** Mapped fields are filled and the page's framework registers the value (form validation sees it).
- **AC2:** Unmapped fields are left untouched.
- **AC3:** Standard fields are filled locally and **never sent to the LLM**.

### F5 — AI drafts for open-ended questions
- Open-ended = textarea or long text inputs not mapped by F4.
- One batched Gemini call per page returns a draft (or `NEEDS_INPUT`) per question.
- Inputs to the model: the question list, job title/company/description text, and relevant profile facts (summary, skills, projects, experience, education).
- **AC1:** Response is validated against the JSON schema; malformed output triggers one retry, then a readable error.
- **AC2:** Drafts only use facts from the profile; unknowns return `NEEDS_INPUT`.
- **AC3:** Select/radio questions return one of the provided options exactly, or `NEEDS_INPUT`.
- **AC4:** Respect `maxLength` when present.

### F6 — Review overlay
- Shadow-DOM overlay injected by the content script lists each question with its editable draft.
- Per question: Approve, Regenerate (optional hint), Skip. A "Fill approved" action at the bottom.
- `NEEDS_INPUT` items are highlighted and require the user to type an answer or skip.
- **AC1:** Nothing is written to the form until the user approves.
- **AC2:** Edited text is what gets filled, not the original draft.
- **AC3:** Overlay styling cannot be broken by, and does not break, page CSS.
- **AC4:** Overlay can be closed at any time without side effects.

### F7 — Submit-safety rule
- The extension never submits or clicks submit/apply buttons.
- **AC1:** Static test greps the source for forbidden calls (`.submit(`, `requestSubmit`, clicking elements matching submit selectors).
- **AC2:** E2E test asserts a fixture form's submit handler is never triggered by Autoply.
- **AC3:** README and overlay copy state "You submit the application."

### F8 — Error handling
- Readable messages for: no profile, no key, invalid key, rate limit (429), network failure, model returned invalid JSON, no fields detected, unsupported page.
- **AC1:** Each error has a distinct message and a suggested next step.
- **AC2:** No error message contains the API key or profile text.

## 2. Good to have (v1.1, after MVP works)

- **F9 Saved answers:** store approved question/answer pairs and suggest them for similar questions before calling the LLM.
- **F10 Tone/length hints** on Regenerate (shorter, more formal, more technical).
- **F11 Profile export/import** as JSON.
- **F12 Character-limit awareness** in prompts and live counters in the overlay.

## 3. Later (not MVP — do not build yet)

- Job queue and collecting jobs from listing pages (Glassdoor-style).
- Job fit scoring and filtering.
- More ATS adapters (Workday, Ashby, SmartRecruiters…).
- File upload handling (CV, cover letter).
- Application tracking log.
- Multiple profiles / CV versions.
- Additional LLM providers (provider interface is prepared in MVP; only Gemini implemented).
- Optional backend for non-technical users.

## 4. Out of scope (never)

- Auto-submit.
- Account creation, CAPTCHA solving, email verification.
- Unattended or bulk application running.
- Telemetry or analytics without an explicit decision.

## 5. MVP definition of done

1. On Greenhouse and Lever fixtures and one real hosted application each, the full flow (profile → trigger → detect → fill → draft → review → fill approved) works.
2. All AC above pass in unit/e2e tests or the manual checklist in `11-testing.md`.
3. The extension never submits (F7 verified).
4. README documents setup, key creation, privacy, and the ToS note.
