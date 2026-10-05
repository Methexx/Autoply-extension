import { Adapter, RawField } from './types'
import { JobContext } from '../../shared/schemas'
import { findGenericFields } from '../detect/generic'

export const leverAdapter: Adapter = {
  name: 'lever',

  matches(url: URL): boolean {
    const host = url.hostname.toLowerCase()
    return host === 'jobs.lever.co' || host.endsWith('.lever.co') || host.includes('lever')
  },

  findFormRoot(doc: Document): HTMLElement | null {
    return (
      doc.querySelector<HTMLElement>('#application-form') ||
      doc.querySelector<HTMLElement>('form.application-form') ||
      doc.querySelector<HTMLElement>('form[action*="/apply"]') ||
      doc.querySelector<HTMLElement>('form')
    )
  },

  findFields(root: HTMLElement): RawField[] {
    return findGenericFields(root)
  },

  extractJob(doc: Document): JobContext {
    // 1. Title
    const titleEl =
      doc.querySelector('.posting-headline h2') ||
      doc.querySelector('.posting-header h2') ||
      doc.querySelector('h2') ||
      doc.querySelector('h1')

    let title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || ''

    if (!title && doc.title) {
      // Often "Company - Job Title" or "Job Title - Company"
      const parts = doc.title.split(/\s*[-–|]\s*/)
      title = parts.length > 1 ? parts[1]!.trim() : doc.title.trim()
    }

    // 2. Company
    let company = ''
    if (doc.location) {
      // Path format: jobs.lever.co/company-name/posting-id
      const match = /\/([a-zA-Z0-9_-]+)\//.exec(doc.location.pathname)
      if (match && match[1]) {
        company = match[1].replace(/[-_]+/g, ' ')
        company = company.charAt(0).toUpperCase() + company.slice(1)
      }
    }

    if (!company && doc.title) {
      const parts = doc.title.split(/\s*[-–|]\s*/)
      if (parts.length > 1) {
        company = parts[0]!.trim()
      }
    }

    if (!company) {
      const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')
      if (ogSiteName) {
        company = ogSiteName.trim()
      }
    }

    // 3. Description
    const descEl =
      doc.querySelector('.posting-description .content') ||
      doc.querySelector('.posting-description') ||
      doc.querySelector('.section-wrapper .content') ||
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
