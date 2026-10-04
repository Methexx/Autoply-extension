# 07 — Form Detection and Filling

All code here lives in `src/content/` and runs in the job page. Page content is **untrusted**.

## 1. Pipeline

```
trigger → pick adapter → detect fields → extract job → classify fields
        → fill standard fields → (draft via SW) → review → fill approved
```

## 2. Adapter interface

```ts
// src/content/adapters/types.ts
export interface Adapter {
  name: 'greenhouse' | 'lever' | 'generic'
  matches(url: URL, doc: Document): boolean
  findFormRoot(doc: Document): HTMLElement | null
  findFields(root: HTMLElement): RawField[]
  extractJob(doc: Document): JobContext
}

export interface RawField {
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  label: string
  kind: FieldKind
  required: boolean
  maxLength?: number
  options?: string[]
}
```

Selection order: Greenhouse → Lever → Generic. First `matches` wins.

### Greenhouse adapter (hosted pages)
- URL patterns: `boards.greenhouse.io`, `job-boards.greenhouse.io`.
- Form root: the application form container; fields are typically wrapped in elements with a `label` and an input/textarea. Record real selectors from saved fixtures in `tests/fixtures/greenhouse/` rather than guessing; adapters must be written against the fixtures.
- Job title/company from the page heading and header area.

### Lever adapter (hosted pages)
- URL pattern: `jobs.lever.co`.
- Application form is at the `/apply` path of a posting; custom questions appear as labelled textareas/inputs.
- Job description may be on the posting page, not the apply page; if absent, fall back to the page title and mark the description as empty (drafts become more generic; the overlay should say so).

### Generic adapter (fallback)
- Root: the largest `<form>` containing at least 3 visible inputs; else `document.body`.
- Collect visible, enabled, non-hidden `input` (text/email/tel/url), `textarea`, `select`, and radio groups.
- Exclude: `type=hidden|password|file|checkbox|submit|button|search`, elements in `display:none`/`visibility:hidden`/`aria-hidden`, honeypot-style fields (offscreen or zero-size).

## 3. Label resolution (in priority order)

1. `<label for=id>` text.
2. Wrapping `<label>` text.
3. `aria-labelledby` target text, then `aria-label`.
4. Nearest preceding text in the same field group (`legend`, heading, or `div` label).
5. `placeholder`, then `name` attribute (humanised).

Normalise: trim, collapse whitespace, strip trailing `*` and "(required)", cap at 300 chars. Record `required` from the `required` attribute, `aria-required`, or a `*` in the label.

## 4. Field classification

For each detected field, classify as **standard**, **open-ended**, or **ignore**.

### Standard (filled locally, no AI)
Match by `autocomplete` attribute first, then label/name/id keywords:

| Profile value | Signals |
|---------------|---------|
| full name | `autocomplete=name`, label "full name", "name" (when no first/last pair) |
| first / last name | `given-name`/`family-name`, "first name", "last name" (derive from `fullName` by splitting on the last space; allow manual override later) |
| email | `autocomplete=email`, `type=email`, "email" |
| phone | `autocomplete=tel`, `type=tel`, "phone", "mobile" |
| location | "location", "city", "where are you based" (short inputs only) |
| LinkedIn / GitHub / website | label or name contains "linkedin", "github", "portfolio", "website", `type=url` |

Put keyword lists in one table in `src/content/detect/standard-map.ts` with unit tests. When confidence is low, **do not fill**; leave it for the user.

### Open-ended (sent to the LLM)
- `textarea` fields not classified as standard.
- `text` inputs whose label looks like a question (ends with `?`, or starts with "why", "describe", "tell us", "what", "how") or has `maxLength` ≥ 100.
- `select`/radio fields that are not standard (e.g. "How did you hear about us?") **only when** they have options; the model must choose an option string exactly or return `needs_input`.

### Ignore
- Anything sensitive or not suited to drafting by default: EEO/demographic questions (gender, race, veteran, disability), work-authorisation/visa questions, salary expectations, consent/acknowledgement checkboxes, CAPTCHA, file uploads. Leave these entirely to the user (MVP).

## 5. Safe filling

React/Vue-style forms track values internally, so setting `.value` alone can leave the form thinking the field is empty. Use native setters and dispatch real events.

```ts
// src/content/fill/set-value.ts
export function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('blur', { bubbles: true }))
}
```

- `select`: find the option whose text or value matches exactly (case-insensitive), set `selectedIndex`, dispatch `change`.
- Radio: find the radio whose label matches the option, set `checked = true`, dispatch `input` and `change` on it. Do **not** call `.click()` (see hard rule below).
- Respect `maxLength`: if the approved text is longer, do not truncate silently; the overlay must block "Fill approved" for that item and show a counter.
- After filling, do not focus-trap or scroll aggressively; at most scroll the first filled field into view.

## 6. Hard rule: never submit

The fill code must never:
- call `form.submit()` or `form.requestSubmit()`,
- call `.click()` on any element matching `button[type=submit]`, `input[type=submit]`, or any button/link whose text matches `/submit|apply|send|finish|continue|next/i`,
- dispatch keyboard events (Enter) on fields.

Define the forbidden selector/regex once in `src/shared/constants.ts` (`NEVER_CLICK_SELECTORS`, `NEVER_CLICK_TEXT`). Add a lint/unit test that fails if source files outside tests contain `.submit(`, `requestSubmit(`, or `.click(`.

## 7. Job context extraction

- `title`: first matching of adapter-specific selector → `h1` → `document.title`.
- `company`: adapter-specific selector → `og:site_name` meta → hostname-derived (Greenhouse/Lever board name).
- `description`: adapter-specific container text → main content text; trim, collapse whitespace, truncate to `jobTextMaxChars`.
- If extraction fails, send `""` and show a notice: drafts will be generic.

## 8. Multi-step forms

The MVP handles the currently visible step only. If new fields appear after the user clicks Next, they click the Autoply button again. Already-filled fields are skipped (non-empty value).

## 9. Idempotency and safety checks

- Re-running on the same page must not overwrite fields the user already changed: only fill empty fields unless the user explicitly chooses "Overwrite".
- Mark filled elements with a `data-autoply-filled` attribute (removable) so a rerun can tell what it touched.
- Never read values from password fields or from fields outside the detected form root.

## 10. Testing

- Unit: label resolution, classification, `setNativeValue` against jsdom inputs, standard-map keyword table.
- Fixtures: save HTML of one real Greenhouse and one real Lever application page into `tests/fixtures/` (strip personal data). Adapters are developed and verified against these.
- E2E: Playwright loads the built extension, serves fixtures locally, triggers fill, asserts values and that no submit occurred. See `11-testing.md`.
