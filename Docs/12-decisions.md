# 12 — Decision Log and Open Questions

Record every decision that changes scope, architecture, permissions, data handling, or dependencies. Newest entries go at the bottom of each section. Agents: if you change something covered by another doc, add an entry here and update that doc in the same change.

Entry format: `D-NNN · Date · Decision · Why · Alternatives considered · Status`.

## Decisions

### D-001 · Chrome extension as the delivery form
- **Decision:** Build Autoply as a Manifest V3 Chrome extension.
- **Why:** It can read and fill the live form on the page the user already has open, which is the whole point of the product.
- **Alternatives:** Web app where the user pastes questions and copies answers (simpler but loses most of the convenience); external automation (Playwright/Puppeteer) which is harder to ship and more bot-like.
- **Status:** Accepted.

### D-002 · Human approval gate; never submit
- **Decision:** Every AI answer must be approved in a review overlay before filling, and the extension never submits or clicks submit controls.
- **Why:** Protects the user from wrong or fabricated answers, avoids bot-like behaviour, and is the project's differentiator from mass auto-apply tools.
- **Alternatives:** Optional auto-submit (rejected: product-defining safety rule).
- **Status:** Accepted. Changing this requires revisiting the product definition.

### D-003 · No backend; bring your own key (BYOK)
- **Decision:** No Autoply server. Users supply their own Gemini API key, stored in `chrome.storage.local`, used only from the service worker.
- **Why:** Zero hosting cost, no secrets to protect on a server, simple privacy story, easy to share as open source.
- **Alternatives:** Hosted proxy with accounts (needed only for non-technical users; deferred).
- **Status:** Accepted for MVP.

### D-004 · Gemini as the first LLM, behind a provider interface
- **Decision:** Implement Gemini first; keep an `LlmProvider` interface so other providers can be added.
- **Why:** The free API tier suits a personal tool and BYOK; the interface prevents lock-in.
- **Alternatives:** OpenAI or Anthropic APIs; local models via Ollama (lower answer quality, needs a capable machine).
- **Status:** Accepted. Verify model ID and free-tier limits when implementing; they change.

### D-005 · On-demand injection with `activeTab`
- **Decision:** No always-on content scripts; inject via `chrome.scripting` after the user clicks the toolbar button, using `activeTab`.
- **Why:** Minimal permissions, better privacy, easier store review, matches the "assistive, not automated" stance.
- **Alternatives:** Declared content scripts on specific ATS domains (always-on access to those sites).
- **Status:** Accepted. Note: some multi-step flows need a re-click per step.

### D-006 · Review UI as a Shadow DOM overlay (not the side-panel API)
- **Decision:** The content script mounts a React overlay inside a Shadow DOM on the job page.
- **Why:** Style isolation from host pages; the UI sits next to the form; no extra permission; keeps messaging simple.
- **Alternatives:** `chrome.sidePanel` (needs a user gesture to open and a separate messaging path); popup window (disconnected from the page).
- **Status:** Accepted.

### D-007 · Contact details never sent to the LLM
- **Decision:** Email, phone, location, and links are filled locally and excluded from prompts.
- **Why:** Data minimisation; drafts don't need them.
- **Alternatives:** Send the full profile (simpler, but needlessly exposes data).
- **Status:** Accepted.

### D-008 · Sensitive question types are left to the user
- **Decision:** EEO/demographic, work-authorisation/visa, salary, and consent questions are classified `ignore` in the MVP.
- **Why:** High stakes, legally or personally sensitive, and easy for a model to get wrong.
- **Alternatives:** Draft them with extra warnings (possible later, with explicit design).
- **Status:** Accepted.

### D-009 · MVP supports Greenhouse and Lever hosted pages plus a generic fallback
- **Decision:** Two adapters first; no Workday or iframe-embedded forms.
- **Why:** These forms are comparatively simple and common for internships/tech roles; keeps scope solvable by a solo developer.
- **Alternatives:** Broad support from day one (high effort, low reliability).
- **Status:** Accepted.

### D-010 · Project name and repository name
- **Decision:** Product name **Autoply**; repository name `autoply`.
- **Why:** Short, memorable, and clearly "auto + apply"; the description and topics carry the AI/LLM angle.
- **Alternatives:** `autoply-extension`, `autoply-ai` (can be revisited if more repos are added).
- **Status:** Accepted.

## Open questions

Resolve these before or during the milestone noted; then move the answer into the decisions list.

| ID | Question | Needed by |
|----|----------|-----------|
| Q-001 | Which exact Gemini model ID is the default, and what are the current free-tier limits? | M2-T3 |
| Q-002 | Should the first/last name split be derived from `fullName`, or should the profile store them separately? | M4-T5 |
| Q-003 | Should "location" ever be sent to the LLM for relocation-type questions (with an approval prompt)? | Post-MVP |
| Q-004 | Which license (MIT suggested)? | M6-T4 |
| Q-005 | Do we ship a dev-only playground (M3-T4) in production builds? Default: no. | M3-T4 |
| Q-006 | How should the extension behave on Lever when the job description is only on the posting page, not the apply page? Default: empty description + overlay notice. | M4-T4 |
| Q-007 | Chrome Web Store listing vs unpacked distribution for the first public release? | M6 |

## Change history of this document

- Initial version: decisions D-001 to D-010 and open questions Q-001 to Q-007 recorded before development starts.
