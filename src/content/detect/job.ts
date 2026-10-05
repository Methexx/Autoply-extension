import { JobContext } from '../../shared/schemas'
import { getAdapterForPage } from '../adapters/index'

/**
 * Extracts job context (title, company, description, url) for the current page
 * using the best matching ATS adapter.
 */
export function extractJobContext(url: URL, doc: Document): JobContext {
  const adapter = getAdapterForPage(url, doc)
  const job = adapter.extractJob(doc)

  return {
    title: job.title.trim(),
    company: job.company.trim(),
    description: job.description.trim(),
    url: url.href,
  }
}
