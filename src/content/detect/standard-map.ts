export type StandardFieldType =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'website'

export interface StandardFieldMatcher {
  type: StandardFieldType
  autocomplete: string[]
  inputTypes?: string[]
  labelKeywords: string[]
}

export const STANDARD_FIELD_MATCHERS: StandardFieldMatcher[] = [
  {
    type: 'firstName',
    autocomplete: ['given-name'],
    labelKeywords: ['first name', 'given name', 'forename'],
  },
  {
    type: 'lastName',
    autocomplete: ['family-name'],
    labelKeywords: ['last name', 'family name', 'surname'],
  },
  {
    type: 'fullName',
    autocomplete: ['name'],
    labelKeywords: ['full name', 'your name', 'candidate name', 'applicant name'],
  },
  {
    type: 'email',
    autocomplete: ['email'],
    inputTypes: ['email'],
    labelKeywords: ['email', 'email address', 'e-mail'],
  },
  {
    type: 'phone',
    autocomplete: ['tel', 'tel-national'],
    inputTypes: ['tel'],
    labelKeywords: ['phone', 'telephone', 'mobile', 'cell', 'phone number'],
  },
  {
    type: 'linkedin',
    autocomplete: [],
    labelKeywords: ['linkedin', 'linkedin profile', 'linkedin url'],
  },
  {
    type: 'github',
    autocomplete: [],
    labelKeywords: ['github', 'github profile', 'github url'],
  },
  {
    type: 'website',
    autocomplete: ['url'],
    labelKeywords: ['website', 'portfolio', 'personal website', 'blog', 'site'],
  },
  {
    type: 'location',
    autocomplete: ['address-level2', 'postal-code', 'country-name'],
    labelKeywords: ['location', 'city', 'where are you based', 'current city', 'address'],
  },
]
