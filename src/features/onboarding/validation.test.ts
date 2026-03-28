import { describe, expect, it } from 'vitest'
import type { SkinProfile } from './types'
import { validateSkinProfile } from './validation'

const validProfile: SkinProfile = {
  skinType: 'combination',
  skinTone: 'tan',
  topConcern: 'acne',
  secondaryConcerns: ['dryness'],
  sensitivity: 'sometimes_reactive',
}

describe('validateSkinProfile', () => {
  it('accepts a valid profile', () => {
    expect(validateSkinProfile(validProfile)).toEqual({ valid: true })
  })

  it('rejects more than two secondary concerns', () => {
    const result = validateSkinProfile({
      ...validProfile,
      secondaryConcerns: ['dryness', 'aging', 'redness'],
    })
    expect(result.valid).toBe(false)
  })

  it('rejects duplicate top and secondary concerns', () => {
    const result = validateSkinProfile({
      ...validProfile,
      topConcern: 'dryness',
      secondaryConcerns: ['dryness'],
    })
    expect(result.valid).toBe(false)
  })
})
