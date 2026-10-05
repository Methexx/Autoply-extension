import { describe, it, expect, beforeEach } from 'vitest'
import { resolveLabel, humanizeAttribute, normalizeLabelText } from '../../src/content/detect/label'
import { findGenericFields, findGenericFormRoot, extractGenericJobContext } from '../../src/content/detect/generic'

describe('Label resolution and normalization (M4-T2)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('humanizes nested and camelCase attribute names', () => {
    expect(humanizeAttribute('job_application[first_name]')).toBe('First name')
    expect(humanizeAttribute('phoneNumber')).toBe('Phone number')
    expect(humanizeAttribute('user_email_address')).toBe('User email address')
    expect(humanizeAttribute('applicant[portfolio_url]')).toBe('Portfolio url')
  })

  it('normalizes label text and strips trailing required markers', () => {
    expect(normalizeLabelText('  First Name  *  ')).toBe('First Name')
    expect(normalizeLabelText('Email Address (required)')).toBe('Email Address')
    expect(normalizeLabelText('Phone Number (optional)')).toBe('Phone Number')
    expect(normalizeLabelText('Why do you want to join?   ***')).toBe('Why do you want to join?')
  })

  it('resolves label via <label for=id>', () => {
    document.body.innerHTML = `
      <div>
        <label for="f_name">Full Name <span class="req">*</span></label>
        <input id="f_name" type="text" />
      </div>
    `
    const input = document.getElementById('f_name') as HTMLInputElement
    const result = resolveLabel(input)
    expect(result.label).toBe('Full Name')
    expect(result.required).toBe(true)
  })

  it('resolves label via wrapping <label>', () => {
    document.body.innerHTML = `
      <label>
        <span>Email Address (required)</span>
        <input id="email_input" type="email" />
      </label>
    `
    const input = document.getElementById('email_input') as HTMLInputElement
    const result = resolveLabel(input)
    expect(result.label).toBe('Email Address')
    expect(result.required).toBe(true)
  })

  it('resolves label via aria-labelledby and aria-label', () => {
    document.body.innerHTML = `
      <span id="title_1">Senior Role</span>
      <span id="title_2">Experience</span>
      <textarea id="exp_input" aria-labelledby="title_1 title_2"></textarea>
      <input id="tel_input" aria-label="Mobile Number" />
    `
    const textarea = document.getElementById('exp_input') as HTMLTextAreaElement
    const result1 = resolveLabel(textarea)
    expect(result1.label).toBe('Senior Role Experience')

    const tel = document.getElementById('tel_input') as HTMLInputElement
    const result2 = resolveLabel(tel)
    expect(result2.label).toBe('Mobile Number')
  })

  it('resolves label via fieldset legend', () => {
    document.body.innerHTML = `
      <fieldset>
        <legend>Are you authorized to work in the US? *</legend>
        <input type="radio" id="r_yes" name="auth" value="yes" />
      </fieldset>
    `
    const radio = document.getElementById('r_yes') as HTMLInputElement
    const result = resolveLabel(radio)
    expect(result.label).toBe('Are you authorized to work in the US?')
    expect(result.required).toBe(true)
  })

  it('falls back to placeholder and then humanized name', () => {
    document.body.innerHTML = `
      <input id="p_holder" placeholder="Enter your GitHub URL" />
      <input name="job_application[cover_letter]" />
    `
    const pInput = document.getElementById('p_holder') as HTMLInputElement
    expect(resolveLabel(pInput).label).toBe('Enter your GitHub URL')

    const nameInput = document.querySelector('input[name="job_application[cover_letter]"]') as HTMLInputElement
    expect(resolveLabel(nameInput).label).toBe('Cover letter')
  })
})

describe('Generic form detector (M4-T2)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('finds largest form root with >= 3 inputs', () => {
    document.body.innerHTML = `
      <form id="search_bar">
        <input type="search" />
      </form>
      <form id="apply_form">
        <input type="text" name="name" />
        <input type="email" name="email" />
        <input type="tel" name="phone" />
        <textarea name="notes"></textarea>
      </form>
    `
    const root = findGenericFormRoot(document)
    expect(root.id).toBe('apply_form')
  })

  it('extracts all valid fields and excludes passwords/submits/hidden', () => {
    document.body.innerHTML = `
      <form id="form">
        <label for="name">Name</label>
        <input id="name" type="text" required />

        <label for="email">Email</label>
        <input id="email" type="email" />

        <label for="pass">Password</label>
        <input id="pass" type="password" />

        <input type="hidden" name="csrf" value="123" />

        <label for="bio">Bio</label>
        <textarea id="bio" maxlength="500"></textarea>

        <label for="hear">How did you hear about us?</label>
        <select id="hear">
          <option value="">-- Select --</option>
          <option value="linkedin">LinkedIn</option>
          <option value="referral">Referral</option>
        </select>

        <fieldset>
          <legend>Sponsorship Required?</legend>
          <label><input type="radio" name="sponsor" value="yes" /> Yes</label>
          <label><input type="radio" name="sponsor" value="no" /> No</label>
        </fieldset>

        <input type="submit" value="Submit" />
      </form>
    `
    const form = document.getElementById('form') as HTMLElement
    const fields = findGenericFields(form)

    // Should include: name, email, bio, hear (select), sponsor (radio group)
    // Should exclude: pass (password), csrf (hidden), submit
    expect(fields).toHaveLength(5)

    const kinds = fields.map(f => f.kind)
    expect(kinds).toEqual(['text', 'email', 'textarea', 'select', 'radio'])

    const nameField = fields.find(f => f.label === 'Name')
    expect(nameField?.required).toBe(true)

    const bioField = fields.find(f => f.label === 'Bio')
    expect(bioField?.maxLength).toBe(500)

    const selectField = fields.find(f => f.kind === 'select')
    expect(selectField?.options).toEqual(['LinkedIn', 'Referral'])

    const radioField = fields.find(f => f.kind === 'radio')
    expect(radioField?.label).toBe('Sponsorship Required?')
    expect(radioField?.options).toEqual(['Yes', 'No'])
  })

  it('extracts generic job context', () => {
    document.body.innerHTML = `
      <meta property="og:site_name" content="Initech Corp" />
      <h1>Senior Systems Architect</h1>
      <div class="job-description">
        We are building the future of distributed storage systems.
      </div>
    `
    const job = extractGenericJobContext(document)
    expect(job.title).toBe('Senior Systems Architect')
    expect(job.company).toBe('Initech Corp')
    expect(job.description).toContain('distributed storage systems')
  })
})
