export const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'not_sure'] as const
export const SKIN_TONES = ['fair', 'light', 'medium', 'tan', 'deep', 'rich'] as const
export const CONCERNS = [
  'acne',
  'dryness',
  'aging',
  'dark_spots',
  'redness',
  'sensitivity',
  'dullness',
] as const
export const SENSITIVITY_LEVELS = [
  'very_sensitive',
  'sometimes_reactive',
  'resilient',
] as const

export type SkinType = (typeof SKIN_TYPES)[number]
export type SkinTone = (typeof SKIN_TONES)[number]
export type Concern = (typeof CONCERNS)[number]
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number]

export interface SkinProfile {
  skinType: SkinType
  skinTone: SkinTone
  topConcern: Concern
  secondaryConcerns: Concern[]
  sensitivity: SensitivityLevel
}
