import { describe, expect, it } from 'vitest'
import { getPageContext } from '../../src/content/ask/index'

describe('Ask Autoply page context', () => {
  it('excludes form and hidden contents and bounds page text', () => {
    document.body.innerHTML = '<main><p>Visible job context</p><form><textarea>private form contents</textarea><p>private form text</p></form><p hidden>hidden secret</p><p style="display:none">css secret</p><div contenteditable="true">private editor contents</div></main>'
    const context = getPageContext(document)
    expect(context).toContain('Visible job context')
    expect(context).not.toContain('private form')
    expect(context).not.toContain('hidden secret')
    expect(context).not.toContain('css secret')
    expect(context).not.toContain('private editor contents')
    document.body.innerHTML = `<main>${'x'.repeat(3000)}</main>`
    expect(getPageContext(document)).toHaveLength(2500)
  })
})
