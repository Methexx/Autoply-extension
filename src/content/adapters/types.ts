import { FieldKind, JobContext } from '../../shared/schemas'

export interface RawField {
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  label: string
  kind: FieldKind
  required: boolean
  maxLength?: number
  options?: string[]
}

export interface Adapter {
  name: 'greenhouse' | 'lever' | 'generic'
  matches(url: URL, doc: Document): boolean
  findFormRoot(doc: Document): HTMLElement | null
  findFields(root: HTMLElement): RawField[]
  extractJob(doc: Document): JobContext
}
