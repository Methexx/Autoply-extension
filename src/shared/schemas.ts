// Zod schemas — fully implemented in M1-T1.
// Stub exports here keep imports valid during scaffold.
import { z } from 'zod'

// Placeholder schemas — replaced with full definitions in M1-T1
export const ProfileSchema = z.record(z.unknown())
export const SettingsSchema = z.record(z.unknown())

export type Profile = z.infer<typeof ProfileSchema>
export type Settings = z.infer<typeof SettingsSchema>
