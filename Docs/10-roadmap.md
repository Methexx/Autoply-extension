# 10 — Roadmap and Task List

Work top to bottom. Each task has an ID, the docs to read, and acceptance criteria (AC). An agent should take **one task at a time**, finish it, and update the status here. Feature IDs (F1–F8) refer to `02-mvp-scope.md`.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## M0 — Project setup

Goal: an empty extension builds, loads in Chrome, and tooling works.

- [x] **M0-T1 Scaffold repo.** Vite + CRXJS + React + TypeScript (strict), pnpm, folder layout from `AGENTS.md` §6.
  - Read: `04-tech-stack.md`
  - AC: `pnpm dev` and `pnpm build` succeed; `dist/` loads as an unpacked extension.
- [x] **M0-T2 Manifest.** MV3 manifest with exactly the permissions in `04` §3.
  - AC: Extension loads; toolbar button visible; no extra permissions.
- [x] **M0-T3 Tooling.** ESLint, Prettier, Vitest, `typecheck`, `lint`, `test` scripts; CI workflow running them.
  - AC: A trivial test passes in CI.
- [x] **M0-T4 Forbidden-call guard.** A test/lint check that fails if `src/` contains `.submit(`, `requestSubmit(`, or `.click(` outside tests.
  - Read: `07` §6, `09`
  - AC: Introducing `.click(` in `src/` makes the check fail.

## M1 — Shared foundation (F1, F2 prerequisites)

- [x] **M1-T1 Types and schemas.** Implement `types.ts` and `schemas.ts` per `05-data-models.md`.
  - AC: Zod schemas for Profile, Settings, Message, Draft; unit tests for valid/invalid samples.
- [x] **M1-T2 Storage wrapper.** Typed `getProfile/setProfile/getSettings/setSettings/clearAll`, schemaVersion init.
  - AC: Values round-trip; invalid stored data is rejected safely (returns null/default, no crash).
- [x] **M1-T3 `toLlmProfile`.** Pure function excluding email, phone, location, links.
  - AC: Unit test asserts excluded fields are absent from output.

## M2 — Options page (F1, F2)

- [x] **M2-T1 Profile form.** Sections and validation per `08` §2.2.
  - AC: F1 AC1–AC3.
- [x] **M2-T2 API key section.** Save/mask/remove per `08` §2.1.
  - AC: F2 AC1.
- [x] **M2-T3 Gemini client + test key.** `llm/gemini.ts` minimal request, `TEST_KEY` message, error mapping.
  - Read: `06`
  - AC: F2 AC2 (distinct messages for invalid key / rate limit / network) using mocked `fetch` in tests; manual test with a real key.
- [x] **M2-T4 Clear all data.** Button + confirm.
  - AC: All Autoply keys removed from storage.

## M3 — Prototype drafting pipeline (F5 core, no page integration)

- [x] **M3-T1 Prompt builders.** `prompt.ts` with canonical system prompt and user prompt layout.
  - Read: `06` §5–6
  - AC: Unit tests: no contact details in output, job text truncated, hint included, page text not in system prompt.
- [x] **M3-T2 Response parsing.** `parse.ts` with Zod validation and id reconciliation.
  - AC: Tests for valid, missing ids, extra ids, invalid JSON, wrong enum, option not in list.
- [x] **M3-T3 Draft pipeline in service worker.** `DRAFT_REQUEST`/`REGENERATE_REQUEST` handlers with retry rules and error codes.
  - AC: Mocked-fetch tests cover 429, 401, network failure, bad JSON (retry once), success.
- [ ] **M3-T4 Dev playground (temporary).** A dev-only page in options where you paste a question and job text and see the draft.
  - AC: Used to tune prompt quality (10 sample questions reviewed per `11` §5). Remove or hide in production builds.

## M4 — Detection and filling (F3, F4)

- [x] **M4-T1 Fixtures.** Save sanitised HTML of one Greenhouse and one Lever application page to `tests/fixtures/`.
  - AC: Fixtures contain no personal data; served locally in tests.
- [ ] **M4-T2 Label resolution + generic detector.** Per `07` §2–3.
  - AC: Unit tests with jsdom pass on hand-written snippets.
- [ ] **M4-T3 Greenhouse adapter.** AC: F3 AC2 on the Greenhouse fixture (≥95% of visible fields).
- [ ] **M4-T4 Lever adapter.** AC: F3 AC2 on the Lever fixture.
- [ ] **M4-T5 Classification.** Standard vs open-ended vs ignore per `07` §4.
  - AC: Table-driven tests; sensitive fields (EEO, visa, salary) are classified `ignore`.
- [ ] **M4-T6 Safe fill.** `setNativeValue`, select, radio per `07` §5.
  - AC: F4 AC1–AC2; framework-style inputs register values (test with a small React fixture).
- [ ] **M4-T7 Job context extraction.** Title, company, description per `07` §7.
  - AC: Extracts correct title/company on both fixtures.
- [ ] **M4-T8 On-demand injection.** Toolbar click → check profile/key → inject content script → run scan.
  - AC: F3 AC3 (nothing runs before click); missing profile/key opens options.

## M5 — Review overlay (F6, F7, F8)

- [ ] **M5-T1 Overlay shell.** Shadow DOM host, styles, open/close, scanning/drafting states.
  - AC: F6 AC3–AC4; page CSS does not break overlay and vice versa.
- [ ] **M5-T2 Review items.** Editable drafts, approve/skip/regenerate, `needs_input` styling, char counters.
  - Read: `08` §4
  - AC: F6 AC1–AC2.
- [ ] **M5-T3 Fill approved.** Writes only approved, edited text; blocks over-limit items; shows final message.
  - AC: F6 AC1–AC2; rerun does not overwrite user-changed fields.
- [ ] **M5-T4 Error states.** All codes in `08` §4.6 with correct actions; standard fields still filled when drafting fails.
  - AC: F8 AC1–AC2.
- [ ] **M5-T5 Submit-safety verification.** E2E asserts fixture submit handler never fires; copy states user submits.
  - AC: F7 AC1–AC3.

## M6 — Hardening and release prep

- [ ] **M6-T1 E2E suite.** Playwright: full flow on both fixtures with mocked Gemini.
  - AC: Passes in CI headless.
- [ ] **M6-T2 Security checklist.** Complete `09` §6 checklist.
  - AC: Every box checked or exception documented.
- [ ] **M6-T3 Manual test pass** on one real Greenhouse and one real Lever application (do not submit).
  - AC: Checklist in `11` §6 completed.
- [ ] **M6-T4 README and privacy copy.** Setup, key creation, privacy notice, ToS note, screenshots/GIF.
  - AC: A new user can install and complete a fill from the README alone.
- [ ] **M6-T5 Tag `v0.1.0`.** MVP definition of done met (`02` §5).

---

## Post-MVP backlog (do not start before M6 is done)

- v1.1: saved answers (F9), tone hints (F10), profile export/import (F11), char-limit awareness polish (F12).
- Chrome Web Store listing, `SECURITY.md`, privacy policy page.
- Additional ATS adapters, multi-step form helpers.
- Job queue/collector and fit scoring (requires revisiting `09` §6.1 and a decision entry).
- Additional LLM providers behind `LlmProvider`.
