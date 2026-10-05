import { Adapter, RawField } from './types'
import { JobContext } from '../../shared/schemas'
import { findGenericFields } from '../detect/generic'

export const greenhouseAdapter: Adapter = {
  name: 'greenhouse',

  matches(url: URL): boolean {
    const host = url.hostname.toLowerCase()
    return (
      host === 'boards.greenhouse.io' ||
      host.endsWith('.greenhouse.io') ||
      host.includes('greenhouse')
    )
  },

  findFormRoot(doc: Document): HTMLElement | null {
    return (
      doc.querySelector<HTMLElement>('#application_form') ||
      doc.querySelector<HTMLElement>('form[action*="applications"]') ||
      doc.querySelector<HTMLElement>('form#apply_form') ||
      doc.querySelector<HTMLElement>('form')
    )
  },

  findFields(root: HTMLElement): RawField[] {
    return findGenericFields(root)
  },

  extractJob(doc: Document): JobContext {
    // 1. Title
    const titleEl =
      doc.querySelector('#header .app-title') ||
      doc.querySelector('h1.app-title') ||
      doc.querySelector('.job-title') ||
      doc.querySelector('h1')

    const title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || doc.title.trim()

    // 2. Company
    let company = ''
    const companyEl =
      doc.querySelector('#header .company-name') ||
      doc.querySelector('.company-name') ||
      doc.querySelector('span.company-name')

    if (companyEl?.textContent) {
      // Often in the form "at Acme Corp"
      company = companyEl.textContent.replace(/^\s*at\s+/i, '').replace(/\s+/g, ' ').trim()
    }

    if (!company) {
      const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')
      if (ogSiteName) {
        company = ogSiteName.trim()
      }
    }

    // 3. Description
    const descEl =
      doc.querySelector('#job_description') ||
      doc.querySelector('#content #job_description') ||
      doc.querySelector('.job-description') ||
      doc.querySelector('#content')

    const description = descEl?.textContent?.replace(/\s+/g, ' ').trim() || ''

    return {
      title,
      company,
      description,
      url: doc.location?.href || '',
    }
  },
}
