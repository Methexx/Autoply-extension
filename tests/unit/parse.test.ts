import { describe, it, expect } from 'vitest'
import { parseDrafts, ParseError } from '../../src/background/llm/parse'

describe('parse module', () => {
  const expectedIds = ['q1', 'q2']

  it('parses valid output and returns drafts in expected order', () => {
    const json = JSON.stringify({
      drafts: [
        { id: 'q2', status: 'ok', answer: 'A2' },
        { id: 'q1', status: 'needs_input', answer: '' }
      ]
    })
    
    const drafts = parseDrafts(json, expectedIds)
    expect(drafts).toHaveLength(2)
    expect(drafts[0]!.id).toBe('q1')
    expect(drafts[0]!.status).toBe('needs_input')
    expect(drafts[1]!.id).toBe('q2')
    expect(drafts[1]!.status).toBe('ok')
  })

  it('fills missing ids with needs_input', () => {
    const json = JSON.stringify({
      drafts: [
        { id: 'q1', status: 'ok', answer: 'A1' }
      ]
    })
    
    const drafts = parseDrafts(json, expectedIds)
    expect(drafts).toHaveLength(2)
    expect(drafts[1]!.id).toBe('q2')
    expect(drafts[1]!.status).toBe('needs_input')
    expect(drafts[1]!.answer).toBe('')
  })

  it('drops extra ids returned by the model', () => {
    const json = JSON.stringify({
      drafts: [
        { id: 'q1', status: 'ok', answer: 'A1' },
        { id: 'q2', status: 'ok', answer: 'A2' },
        { id: 'q3', status: 'ok', answer: 'A3' } // unexpected
      ]
    })
    
    const drafts = parseDrafts(json, expectedIds)
    expect(drafts).toHaveLength(2)
    expect(drafts.find(d => d.id === 'q3')).toBeUndefined()
  })

  it('throws ParseError on invalid JSON', () => {
    expect(() => parseDrafts('not json', expectedIds)).toThrow(ParseError)
  })

  it('throws ParseError if schema does not match (missing drafts array)', () => {
    expect(() => parseDrafts('{"other": 123}', expectedIds)).toThrow(ParseError)
  })

  it('throws ParseError if draft item has wrong enum', () => {
    const json = JSON.stringify({
      drafts: [
        { id: 'q1', status: 'bad_status', answer: 'A1' }
      ]
    })
    expect(() => parseDrafts(json, expectedIds)).toThrow(ParseError)
  })
})
