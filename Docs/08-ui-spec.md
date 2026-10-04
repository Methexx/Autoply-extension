# 08 — UI Spec

Two UIs: the **options page** (profile + key) and the **review overlay** (on the job page). Keep both plain, fast, and readable. The design goal is trust: the user must always see what will be filled and what is sent.

## 1. Design principles

- **Clarity over polish.** Plain labels, clear states, no hidden actions.
- **User in control.** Every AI text is editable; nothing is filled without an explicit action.
- **Honest copy.** Say what is sent to Google and that the user submits the application.
- **Accessible.** Keyboard operable, visible focus, sufficient contrast, labels tied to inputs, `aria-live` for status messages.
- **Light and dark** follow `prefers-color-scheme` (overlay uses its own tokens inside the Shadow DOM).

## 2. Options page (`src/options/`)

Single page with three sections and a sticky save bar.

### 2.1 Gemini API key
- Password-style input + "Show" toggle while editing; after saving, display `••••••••` + last 4 characters only.
- Buttons: **Save**, **Test key**, **Remove key**.
- Helper text: "Your key is stored only in this browser and used only to call Google's Gemini API. Create a free key in Google AI Studio."
- Test result area (`aria-live=polite`): success or the mapped error message.
- Data notice: "When you generate drafts, the question text, job description, and your profile summary, skills, education, experience, and projects are sent to Google's Gemini API. Contact details are not sent."

### 2.2 Profile
Grouped form sections:
1. **Basics:** full name, email, phone, location.
2. **Links:** LinkedIn, GitHub, website.
3. **Summary:** textarea with character counter (max 1,000).
4. **Skills:** tag input (comma or Enter to add).
5. **Education:** repeatable cards (institution, degree, field, years, notes).
6. **Experience:** repeatable cards (organization, role, dates, description).
7. **Projects:** repeatable cards (name, description, technologies, URL).

Behaviour:
- Add/remove/reorder cards; empty cards are dropped on save.
- Inline validation with Zod error messages next to the field.
- Unsaved-changes indicator; warn on navigating away.

### 2.3 Data
- (v1.1) Export/Import profile JSON.
- **Clear all data** button with a confirm dialog; removes `profile`, `settings`, `savedAnswers`.

## 3. Toolbar button (action)

- Click = run Autoply on the active tab.
- If no profile/key: opens the options page with a banner explaining what is missing.
- Badge: none in the MVP.

## 4. Review overlay (`src/content/overlay/`)

### 4.1 Host and isolation
- The content script creates `<div id="autoply-root">` appended to `document.documentElement`, attaches an open Shadow DOM, and mounts React inside it.
- All CSS is injected into the shadow root; no global styles. Use high `z-index` and a fixed-position side panel on the right (about 380 px wide, full height, collapsible).
- Overlay can be closed with an X button and the Escape key; closing discards review state with no changes to the page.

### 4.2 States

| State | What the user sees |
|-------|-------------------|
| `scanning` | Spinner: "Scanning the form…" |
| `drafting` | Standard fields summary + skeleton cards: "Drafting answers with Gemini…" |
| `review` | Header summary + list of review items + footer actions |
| `filled` | Success message: "Filled N answers. Review the form, then submit it yourself." |
| `error` | Error message with next-step button (see 4.5) |

### 4.3 Header (review state)
- "Filled **X** standard fields." with an expandable list (label → value preview).
- Notice when job description couldn't be read: "I couldn't read the job description, so drafts are more generic."
- Notice listing ignored sensitive fields: "Left for you: work authorisation, demographics, salary."

### 4.4 Review item (one per question)
- Question label (with "required" badge if applicable).
- Editable textarea with the draft; live character counter when `maxLength` exists (turns red and blocks approval when exceeded).
- For select/radio: a dropdown of options preselected with the model's choice.
- `needs_input` items: highlighted with the text "I don't have this in your profile. Write an answer or skip."
- Actions: **Approve**, **Skip**, **Regenerate** (opens a small input for an optional hint such as "shorter, more technical").
- Item states shown as a badge: Pending / Approved / Skipped.

### 4.5 Footer
- **Fill approved (N)**: enabled when N ≥ 1. Writes only approved items; uses edited text.
- **Approve all drafts** (convenience): approves all non-`needs_input` items without hiding them; the user can still edit before filling.
- **Close**.
- Persistent copy: "Autoply never submits your application."

### 4.6 Error messages

| Code | Message | Action button |
|------|---------|---------------|
| `NO_PROFILE` | "Add your profile first." | Open options |
| `NO_KEY` | "Add your Gemini API key to get drafts." | Open options |
| `INVALID_KEY` | "Gemini rejected your API key." | Open options |
| `RATE_LIMITED` | "Gemini's rate limit was reached. Wait a minute, then try again." | Retry |
| `NETWORK` | "Couldn't reach Gemini. Check your connection." | Retry |
| `BAD_MODEL_OUTPUT` | "The model's answer couldn't be used." | Retry |
| `NO_FIELDS` | "I couldn't find an application form on this page." | Close |
| `UNSUPPORTED_PAGE` | "This page isn't supported yet." | Close |

Standard fields are still filled even if drafting fails, since they don't need the LLM. Say so in the message.

## 5. Copy rules

- Plain English, no hype ("magic", "auto-apply").
- Always use "draft" for AI text and "approve" for the user's action.
- Never imply the extension submits anything.

## 6. Out of scope for MVP UI

- Settings for tone presets, multiple profiles, themes.
- Application history/tracker.
- Popup window (the toolbar click acts directly).
