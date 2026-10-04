# 01 — Product Overview

## 1. One-line pitch

Autoply is a Chrome extension that drafts and fills job application answers from your own profile, so you only review and approve before you submit.

## 2. Problem

Job applications repeat the same work:

- Re-entering contact details, links, education, and work history.
- Re-answering the same open-ended questions ("Why this company?", "Tell us about a project you're proud of").
- Tailoring each answer to the job takes time, so people either copy-paste generic answers or spend hours per application.

Existing "auto-apply" bots solve the volume problem but create new ones: generic or fabricated answers, account bans from bot-like behaviour, and no human oversight of what gets sent.

## 3. Solution

An assistive tool that:

1. Keeps a structured **profile** locally.
2. Detects fields on the application page the user is viewing.
3. Fills standard fields directly from the profile (no AI).
4. Uses an LLM to **draft** answers to open-ended questions, grounded only in the profile and the job description.
5. Shows every draft in a **review overlay**; the user edits and approves.
6. Fills approved answers into the form. **The user clicks Submit.**

## 4. Target users

- **Primary (v1):** the author, a software engineering student applying for internships and graduate roles.
- **Secondary (after public release):** job seekers comfortable with creating a free Gemini API key and installing an unpacked or store-listed Chrome extension.

## 5. Goals

| ID | Goal | Measure |
|----|------|---------|
| G1 | Cut time to complete an application | A supported form is filled and reviewed in under 1 minute of user effort (excluding file uploads) |
| G2 | Keep answers honest | Zero fabricated facts in drafts; unknowns are flagged `NEEDS_INPUT` |
| G3 | Keep the human in control | 100% of AI text is user-approved before it touches the form; extension never submits |
| G4 | Stay private and cheap | No backend; only the minimum data is sent to Gemini; runs on a free API key |
| G5 | Be shareable | Clean repo, clear docs, easy local setup |

## 6. Non-goals (explicitly out of scope)

- Auto-submitting applications, ever.
- Mass or unattended applying; running through job lists without the user present.
- Creating accounts, solving CAPTCHAs, or verifying emails on the user's behalf.
- Uploading files (CV, cover letter) automatically.
- Hosting a backend, user accounts, or syncing across devices.
- Scraping jobs for resale or building a job database.
- Supporting every job site. v1 targets a small set of ATS platforms.

## 7. Key user flow (happy path)

1. User installs Autoply and opens the options page.
2. User fills in the profile and pastes a Gemini API key; the key is validated with a "Test key" button.
3. User opens an application form on a supported site.
4. User clicks the Autoply toolbar button.
5. Autoply detects fields, fills standard ones, and opens the review overlay with drafts for open-ended questions.
6. User edits drafts, approves them (or skips/regenerates some).
7. Autoply writes approved answers into the form.
8. User checks the form and clicks Submit.

## 8. Success criteria for the MVP

The MVP is done when, on at least two supported ATS platforms (Greenhouse and Lever hosted pages), a user can complete the flow above reliably, with correct fills, in under a minute, with the extension never touching the Submit button. See `02-mvp-scope.md` for the feature list.

## 9. Assumptions and constraints

- Users bring their own Gemini API key (free tier is enough for personal use; limits may change).
- Chrome (and Chromium-based browsers) with Manifest V3.
- Job postings can be browsed on aggregator sites (e.g. Glassdoor), but the MVP acts on the application form page, not on the aggregator.
- The author works solo; scope must stay small.

## 10. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Forms differ across ATS platforms | Fills fail or hit wrong fields | Adapter per platform + generic fallback; start with two platforms |
| LLM invents facts | User submits false claims | Strict prompt, `NEEDS_INPUT`, mandatory review |
| Site ToS restricts automation | Account issues | Assistive design: on-demand, single page, no submit |
| Free API limits change | Feature breaks | One batched call per page; clear rate-limit errors; provider-agnostic `llm` module |
| Prompt injection via job text | Model behaves unexpectedly | Treat page text as data; structured output; user review |
| API key theft | Cost / abuse | Key only in the service worker; never in page context |

## 11. Glossary

- **ATS:** Applicant Tracking System (Greenhouse, Lever, Workday…).
- **Adapter:** site-specific code that finds fields on one ATS.
- **Overlay:** the review UI injected into the page in a Shadow DOM.
- **Service worker:** the MV3 background script; owns the API key and Gemini calls.
- **BYOK:** bring your own key.
