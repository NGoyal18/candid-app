import type { SkinProfile } from './types'

export interface ValidationResult {
  valid: boolean
  message?: string
}

export function validateSkinProfile(profile: SkinProfile): ValidationResult {
  if (!profile.skinType || !profile.skinTone || !profile.topConcern || !profile.sensitivity) {
    return { valid: false, message: 'Please complete every required field.' }
  }

  if (profile.secondaryConcerns.length > 2) {
    return { valid: false, message: 'Choose up to 2 secondary concerns.' }
  }

  if (profile.secondaryConcerns.includes(profile.topConcern)) {
    return {
      valid: false,
      message: 'Top concern should not be repeated as a secondary concern.',
    }
  }

  return { valid: true }
}
