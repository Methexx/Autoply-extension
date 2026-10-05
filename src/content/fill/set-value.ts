/**
 * Safe value setting engine per docs/07-form-detection-and-filling.md §5
 * Dispatches synthetic native events so React/Vue/Angular forms register changes.
 * Hard rule: Never trigger form submission or element click actions
 */

export function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype

  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  if (descriptor?.set) {
    descriptor.set.call(el, value)
  } else {
    el.value = value
  }

  // Also support React internal value tracker if present
  interface ReactTracker {
    setValue(val: string): void
  }
  const tracker = (el as unknown as { _valueTracker?: ReactTracker })._valueTracker
  if (tracker) {
    tracker.setValue(value)
  }

  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('blur', { bubbles: true }))

  el.setAttribute('data-autoply-filled', 'true')
}

export function setSelectValue(el: HTMLSelectElement, optionTextOrValue: string): boolean {
  const target = optionTextOrValue.trim().toLowerCase()
  let matchedIndex = -1

  for (let i = 0; i < el.options.length; i++) {
    const opt = el.options[i]
    if (!opt) continue
    const text = opt.text.trim().toLowerCase()
    const val = opt.value.trim().toLowerCase()
    if (text === target || val === target) {
      matchedIndex = i
      break
    }
  }

  // Fallback: check if target is substring or includes option
  if (matchedIndex === -1) {
    for (let i = 0; i < el.options.length; i++) {
      const opt = el.options[i]
      if (!opt) continue
      const text = opt.text.trim().toLowerCase()
      if (text && (text.includes(target) || target.includes(text))) {
        matchedIndex = i
        break
      }
    }
  }

  if (matchedIndex !== -1) {
    el.selectedIndex = matchedIndex
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
    el.setAttribute('data-autoply-filled', 'true')
    return true
  }

  return false
}

export function setRadioValue(
  containerOrDoc: HTMLElement | Document,
  groupName: string,
  optionLabelOrValue: string,
): boolean {
  const target = optionLabelOrValue.trim().toLowerCase()
  const radios = Array.from(
    containerOrDoc.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${groupName.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1')}"]`,
    ),
  )

  for (const radio of radios) {
    const label = radio.closest('label')?.textContent?.trim().toLowerCase() || ''
    const val = radio.value.trim().toLowerCase()

    if (label.includes(target) || target.includes(label) || val === target) {
      // Hard rule: DO NOT call radio.click()
      radio.checked = true
      radio.dispatchEvent(new Event('input', { bubbles: true }))
      radio.dispatchEvent(new Event('change', { bubbles: true }))
      radio.setAttribute('data-autoply-filled', 'true')
      return true
    }
  }

  return false
}
