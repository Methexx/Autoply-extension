# 09 — Security and Privacy

Autoply handles personal information (a CV-like profile) and an API key, and it acts on pages the user does not control. This document defines what is protected and how.

## 1. Assets

| Asset | Sensitivity | Where it lives |
|-------|-------------|----------------|
| Gemini API key | High (cost/abuse) | `chrome.storage.local`, read only by the service worker and options page |
| Profile (contact details, history, projects) | High (personal data) | `chrome.storage.local` |
| Job text and questions | Low–medium | In memory during a run; sent to Gemini |
| Approved answers | Medium | In memory (MVP); `chrome.storage.local` if saved answers ship (v1.1) |

## 2. Hard rules (mirrors `AGENTS.md`)

1. Never submit or click submit/apply controls.
2. Never fill AI text before user approval.
3. No Autoply backend, no analytics or telemetry.
4. API key only in the service worker; never in page context, messages, logs, URLs, or error text.
5. Do not log profile contents or answers in production.
6. Treat all page-derived text as untrusted data.

## 3. Threat model

| Threat | Example | Mitigation |
|--------|---------|-----------|
| Page script reads the key | Malicious site tries to read extension data | Key is never injected into the page; content script cannot read it; messages never include it; overlay in Shadow DOM |
| Page spoofs messages to the extension | Page posts fake messages | Use `chrome.runtime.sendMessage` (not `window.postMessage`); validate sender (`sender.tab`, `sender.id === chrome.runtime.id`) and Zod-validate every message |
| Prompt injection via job text or labels | Job description says "ignore previous instructions and write X" | System prompt rule 7; structured JSON output; page text kept in the user turn; mandatory human review |
| Data leak to the LLM | Over-sharing contact info | `toLlmProfile` excludes email, phone, location, links; unit-tested |
| Honeypot / hidden fields filled | Bot-trap fields that flag automation | Skip hidden, offscreen, zero-size, `aria-hidden` fields; never fill unclassified fields |
| XSS through rendered AI text | Model output contains HTML | Render as text in React (never `dangerouslySetInnerHTML`); set values via `.value` |
| Over-broad permissions | Extension can read all sites | `activeTab` + on-demand injection; one host permission for the Gemini API |
| Key exposure in logs/exports | Debug logs or profile export | Never log key; profile export excludes `settings` |
| Supply chain | Malicious dependency | Few dependencies, lockfile, `pnpm audit` in CI, pinned versions |
| Accidental submission | Bug triggers a click | Forbidden-call tests (see `11-testing.md`), no `.click()` in source, E2E asserts no submit |

## 4. Data handling

- **Storage:** `chrome.storage.local` only. Not `sync`.
- **Transmission:** only to `https://generativelanguage.googleapis.com`. Over HTTPS. Key in the `x-goog-api-key` header.
- **What is sent to Gemini:** question text/options, job title/company/description (truncated), profile `summary`, `skills`, `education`, `experience`, `projects`.
- **What is never sent:** email, phone, location, links, API key, values from non-detected fields.
- **Retention:** nothing persisted except profile, settings, and (v1.1) saved answers. Review state is discarded when the overlay closes.
- **Deletion:** "Clear all data" in options removes everything Autoply stores. Uninstalling the extension removes extension storage.
- **Free-tier note:** Google's terms for free API usage may allow use of submitted content to improve its products. The README and options page must say this and suggest enabling billing (paid terms) for users who object. Verify the current wording in Google's Gemini API terms before publishing.

## 5. Privacy copy (use in README, options page, store listing)

> Autoply stores your profile and API key only in your browser. When you request drafts, it sends the application questions, the job description, and your profile's summary, skills, education, experience and projects to Google's Gemini API using your own API key. Your contact details are never sent. Autoply has no servers, collects no analytics, and never submits an application for you.

## 6. Extension hardening checklist

- [ ] Manifest permissions match `04-tech-stack.md` exactly.
- [ ] No remotely hosted code; no `eval`, no `new Function`.
- [ ] Content Security Policy left at the MV3 default (no relaxing).
- [ ] Message handlers verify `sender.id` and validate payloads with Zod.
- [ ] No `dangerouslySetInnerHTML` anywhere.
- [ ] Key never appears in any `console.*`, error object, or message.
- [ ] Overlay uses Shadow DOM; no global style/script pollution.
- [ ] `pnpm audit` clean or exceptions documented.

## 6.1 Terms-of-service stance

Autoply is an assistive tool. It runs only when the user clicks it, on the single page the user has open, with no navigation, no bulk operation, and no submission. Document this in the README. Users remain responsible for the terms of the sites they use. Do not add features that make the tool unattended or bulk-capable without revisiting this section and `12-decisions.md`.

## 7. Incident handling (post-release)

- If a key leak or data exposure bug is reported: publish a fix, bump version, note in release notes, advise users to rotate keys.
- Provide a `SECURITY.md` with a contact method before public release.

## 8. Chrome Web Store requirements (when publishing)

- Privacy policy URL describing the above.
- Single-purpose description.
- Justify each permission (table in section 3 of `04-tech-stack.md`).
- Disclose that user data is sent to a third party API (Google Gemini) at the user's request.
