import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setNativeValue, setSelectValue, setRadioValue } from '../../src/content/fill/set-value'
import { fillStandardFields, extractProfileStandardValue } from '../../src/content/fill/fill-standard'
import { Profile } from '../../src/shared/schemas'
import { RawField } from '../../src/content/adapters/types'

describe('Safe fill engine (M4-T6)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('sets native value and dispatches input, change, blur events', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    const events: string[] = []
    input.addEventListener('input', () => events.push('input'))
    input.addEventListener('change', () => events.push('change'))
    input.addEventListener('blur', () => events.push('blur'))

    setNativeValue(input, 'Hello World')

    expect(input.value).toBe('Hello World')
    expect(events).toEqual(['input', 'change', 'blur'])
    expect(input.getAttribute('data-autoply-filled')).toBe('true')
  })

  it('updates React value tracker when present', () => {
    const input = document.createElement('input')
    let trackerValue = ''
    const tracker = {
      setValue(val: string) {
        trackerValue = val
      },
    }
    Object.assign(input, { _valueTracker: tracker })
    document.body.appendChild(input)

    setNativeValue(input, 'React Controlled Value')
    expect(input.value).toBe('React Controlled Value')
    expect(trackerValue).toBe('React Controlled Value')
  })

  it('selects option by text or value and dispatches change', () => {
    const select = document.createElement('select')
    select.innerHTML = `
      <option value="">-- select --</option>
      <option value="ca">Canada</option>
      <option value="us">United States</option>
    `
    document.body.appendChild(select)

    const changeSpy = vi.fn()
    select.addEventListener('change', changeSpy)

    const success = setSelectValue(select, 'United States')
    expect(success).toBe(true)
    expect(select.value).toBe('us')
    expect(changeSpy).toHaveBeenCalled()
    expect(select.getAttribute('data-autoply-filled')).toBe('true')
  })

  it('selects radio button without calling click()', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <label><input type="radio" name="opt" value="A" /> Option A</label>
      <label><input type="radio" name="opt" value="B" /> Option B</label>
    `
    document.body.appendChild(container)

    const radioB = container.querySelector('input[value="B"]') as HTMLInputElement
    const clickSpy = vi.spyOn(radioB, 'click')
    const changeSpy = vi.fn()
    radioB.addEventListener('change', changeSpy)

    const success = setRadioValue(container, 'opt', 'Option B')
    expect(success).toBe(true)
    expect(radioB.checked).toBe(true)
    expect(clickSpy).not.toHaveBeenCalled() // Hard rule verified: never call .click()
    expect(changeSpy).toHaveBeenCalled()
  })

  describe('fillStandardFields', () => {
    const mockProfile: Profile = {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+1 555 0199',
      location: 'London, UK',
      links: {
        linkedin: 'https://linkedin.com/in/ada-lovelace',
        github: 'https://github.com/ada',
        website: 'https://adalovelace.org',
      },
      summary: 'Pioneer of computer science.',
      skills: ['Mathematics', 'Computing'],
      education: [],
      experience: [],
      projects: [],
    }

    it('splits first and last names correctly', () => {
      expect(extractProfileStandardValue('firstName', mockProfile)).toBe('Ada')
      expect(extractProfileStandardValue('lastName', mockProfile)).toBe('Lovelace')
      expect(extractProfileStandardValue('fullName', mockProfile)).toBe('Ada Lovelace')
    })

    it('fills empty standard fields from candidate profile', () => {
      document.body.innerHTML = `
        <form>
          <label for="first">First Name</label>
          <input id="first" name="first_name" />

          <label for="last">Last Name</label>
          <input id="last" name="last_name" />

          <label for="email">Email</label>
          <input id="email" type="email" />

          <label for="phone">Phone</label>
          <input id="phone" type="tel" />

          <label for="li">LinkedIn</label>
          <input id="li" type="url" />

          <label for="salary">Desired Salary</label>
          <input id="salary" name="salary" />
        </form>
      `

      const firstInput = document.getElementById('first') as HTMLInputElement
      const lastInput = document.getElementById('last') as HTMLInputElement
      const emailInput = document.getElementById('email') as HTMLInputElement
      const phoneInput = document.getElementById('phone') as HTMLInputElement
      const liInput = document.getElementById('li') as HTMLInputElement
      const salaryInput = document.getElementById('salary') as HTMLInputElement

      const rawFields: RawField[] = [
        { el: firstInput, label: 'First Name', kind: 'text', required: true },
        { el: lastInput, label: 'Last Name', kind: 'text', required: true },
        { el: emailInput, label: 'Email', kind: 'email', required: true },
        { el: phoneInput, label: 'Phone', kind: 'tel', required: false },
        { el: liInput, label: 'LinkedIn', kind: 'url', required: false },
        { el: salaryInput, label: 'Desired Salary', kind: 'text', required: false },
      ]

      const filled = fillStandardFields(rawFields, mockProfile)

      expect(filled).toHaveLength(5)
      expect(firstInput.value).toBe('Ada')
      expect(lastInput.value).toBe('Lovelace')
      expect(emailInput.value).toBe('ada@example.com')
      expect(phoneInput.value).toBe('+1 555 0199')
      expect(liInput.value).toBe('https://linkedin.com/in/ada-lovelace')

      // Sensitive / ignored field remains untouched
      expect(salaryInput.value).toBe('')
    })

    it('does not overwrite already filled fields unless overwrite is true', () => {
      const emailInput = document.createElement('input')
      emailInput.type = 'email'
      emailInput.value = 'existing@domain.com'

      const rawFields: RawField[] = [
        { el: emailInput, label: 'Email Address', kind: 'email', required: true },
      ]

      // Default: overwrite = false
      fillStandardFields(rawFields, mockProfile, false)
      expect(emailInput.value).toBe('existing@domain.com')

      // With overwrite = true
      fillStandardFields(rawFields, mockProfile, true)
      expect(emailInput.value).toBe('ada@example.com')
    })
  })
})
