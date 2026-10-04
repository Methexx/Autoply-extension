import { Profile } from './schemas'

export type LlmProfile = Omit<Profile, 'email' | 'phone' | 'location' | 'links'>

/**
 * Strips out personally identifiable and contact information that the LLM
 * does not need to see in order to draft answers.
 * (e.g. email, phone, location, links)
 */
export function toLlmProfile(profile: Profile): LlmProfile {
  // We explicitly destructure and omit the fields we don't want sent to the LLM
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { email, phone, location, links, ...rest } = profile
  
  return rest
}
