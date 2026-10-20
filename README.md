 # Autoply

> A local-first browser extension that fills the repetitive parts of a job application and drafts tailored answers for your review.

Autoply is an assistive tool for job applications. It fills standard details from your saved profile, then uses your own Gemini or OpenAI API key to draft answers for open-ended questions such as **“Why do you want to work here?”** or **“Message / Cover Letter.”**

You stay in control: AI-written text is never put into a form until you approve it, and Autoply never submits an application.

## What Autoply does

- Fills standard fields locally: name, email, phone, location, LinkedIn, GitHub, and website.
- Detects open-ended questions, including message and cover-letter fields.
- Drafts concise, job-specific cover letters using the stated role, company, job description, and facts in your profile.
- Shows every AI draft in an editable review panel before it can be filled.
- Leaves sensitive questions—such as salary, work authorisation, demographics, and consent—for you to answer yourself.
- Supports Greenhouse and Lever application pages, plus a best-effort generic fallback for simple forms.

## What Autoply never does

- Never clicks **Apply**, **Submit**, or any other form button.
- Never writes AI-generated text before you approve it.
- Never creates accounts, solves CAPTCHAs, uploads a CV to an application, or applies in bulk.
- Never sends your API key to a job site.
- Never uses an Autoply backend, analytics, or telemetry.

## How it works

```text
Your saved profile ──> standard fields filled locally
                         │
Job page + relevant profile facts ──> Gemini or OpenAI ──> editable review panel
                                                        │
                                             You approve selected drafts
                                                        │
                                             Approved answers fill the form
                                                        │
                                              You review and submit yourself
```

## Install it locally

Autoply is currently distributed as an unpacked extension for Chrome, Microsoft Edge, and other Chromium browsers.

### 1. Build the extension

Install [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/), then run:

```bash
pnpm install
pnpm build
```

### 2. Load the `dist` folder

**Chrome**

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Select this project's `dist` folder.

**Microsoft Edge**

1. Open `edge://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Select this project's `dist` folder.

After every code update, run `pnpm build`, then use **Reload** on the Autoply card and refresh the job page.

## First-time setup

1. Open **Autoply Options** from the browser extension menu.
2. Add your profile manually, or select **Import CV with Gemini**.
   - CV import accepts a PDF or plain-text file up to 5 MB.
   - You must explicitly consent before the selected CV is sent to Gemini.
   - Autoply does not store the original CV; review the extracted details and save the profile yourself.
3. Enter a Gemini API key from [Google AI Studio](https://aistudio.google.com/) or an OpenAI API key from the [OpenAI platform](https://platform.openai.com/api-keys), then use the corresponding **Test** button. A ChatGPT subscription alone is not an API key.
4. Choose your preferred provider and save your settings and profile. If you have both keys, you can enable fallback: on a technical failure, Autoply will try the other provider. This may send the same drafting data to both providers and incur charges.

## Fill an application

1. Open the actual application form—rather than a job listing page.
2. Click the Autoply icon in the browser toolbar.
3. Select **Fill this page’s form**.
4. Autoply fills matching standard fields first.
5. For open-ended questions, wait for the review panel.
6. Edit, approve, skip, or regenerate each draft.
7. Select **Fill approved**.
8. Check the completed form and submit it yourself.

You can also right-click inside a web page and select **Fill this page’s form with Autoply**.

### Cover letters and messages

For a field labelled **Cover Letter**, **Message**, or **Message to the hiring team**, Autoply asks the selected provider to write a concise, tailored draft. It relates the job description to relevant facts from your saved profile, without inventing experience or making unsupported company claims. You can edit the result before approving it.

## If something does not work

| What you see | What to do |
|---|---|
| “I couldn't find an application form on this page.” | Open the actual application form. Embedded iframe forms and many non-ATS listing pages are not supported in this MVP. |
| The popup says Chrome/Edge blocked Autoply | In the extension menu, set **Site access** to **Allow only when clicked** or **Allowed on this site**, reload the extension, then refresh the page. |
| The page only has standard fields | Autoply shows a completion message after filling them. There is no AI draft panel when no open-ended question exists. |
| Gemini rejects the key | Confirm that it is an active Gemini API key from Google AI Studio, save it, and use **Test Key** again. |
| Gemini is rate-limited or temporarily unavailable | Wait briefly and use **Retry** in the review panel. |
| Changes do not appear after updating code | Run `pnpm build`, reload Autoply in `chrome://extensions` or `edge://extensions`, and refresh the page. |

## Privacy and data

Autoply stores your profile and configured API keys in `chrome.storage.local` inside your browser. There is no Autoply server.

For normal draft generation, Autoply sends the following to your selected provider, Google Gemini or OpenAI, using your own key:

- application questions and selectable options;
- job title, company, and a shortened job description;
- profile summary, skills, education, experience, and projects.

The draft content excludes your email, phone number, location, links, and unrelated field values. The selected provider receives its own API key for authentication; job sites do not receive it. If fallback is enabled, both providers may receive the draft content.

If you explicitly use CV import, the selected CV—including contact information it contains—is sent once to Gemini for extraction. The original file is not stored by Autoply.

Gemini free-tier terms may allow submitted content to be used to improve Google's products. Review Google's current terms before using a free key with sensitive information.
Review OpenAI's current API data and billing terms as well before using an OpenAI key.

## Supported browsers and sites

- Browsers: Chrome, Microsoft Edge, and other Chromium-based browsers with Manifest V3 support.
- Fully tested application platforms: Greenhouse and Lever.
- Other simple HTML forms: best-effort generic support only.

## Development

```bash
pnpm dev          # development build
pnpm typecheck    # TypeScript validation
pnpm lint         # ESLint
pnpm test         # Vitest unit tests
pnpm build        # production extension build
pnpm test:e2e     # Playwright fixture tests
```

Automated tests use local fixtures and mocked Gemini responses only—never a real key or live job page.

## Project status

The MVP is close to release. Automated tests are in place; final real-page validation on one Greenhouse and one Lever application is still required. See the [roadmap](docs/10-roadmap.md) for the current checklist.

## Terms of use

Autoply is designed as a single-page, user-triggered assistant. You are responsible for following each job site's terms of service and for checking every answer before you submit an application.

## Documentation

- [Product overview](docs/01-product-overview.md)
- [Architecture](docs/03-architecture.md)
- [LLM integration](docs/06-llm-integration.md)
- [Form detection and filling](docs/07-form-detection-and-filling.md)
- [Security and privacy](docs/09-security-and-privacy.md)
- [Testing](docs/11-testing.md)
- [Decision log](docs/12-decisions.md)

## License

[MIT](LICENSE)
