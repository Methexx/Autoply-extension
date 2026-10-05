import { Adapter } from './types'
import { greenhouseAdapter } from './greenhouse'
import { leverAdapter } from './lever'
import { genericAdapter } from '../detect/generic'

export const ADAPTERS: Adapter[] = [
  greenhouseAdapter,
  leverAdapter,
  genericAdapter,
]

export function getAdapterForPage(url: URL, doc: Document): Adapter {
  for (const adapter of ADAPTERS) {
    if (adapter.matches(url, doc)) {
      return adapter
    }
  }
  return genericAdapter
}
