import { describe, expect, it } from 'vitest'
import { hasQualityIssues } from './textQuality'

describe('hasQualityIssues', () => {
  it('allows a clean, complete sentence', () => {
    expect(hasQualityIssues('This moisturizer works well for dry, sensitive skin.')).toBe(false)
  })

  it('flags missing terminal punctuation', () => {
    expect(hasQualityIssues('This moisturizer works well for dry skin')).toBe(true)
  })

  it('flags doubled words', () => {
    expect(hasQualityIssues('This is is a good moisturizer.')).toBe(true)
  })

  it('flags leftover placeholder artifacts', () => {
    expect(hasQualityIssues('The product contains undefined and helps with acne.')).toBe(true)
  })

  it('flags unbalanced quotes', () => {
    expect(hasQualityIssues('Reviewers said "it worked great for my skin.')).toBe(true)
  })

  it('flags empty or missing text', () => {
    expect(hasQualityIssues('')).toBe(true)
    expect(hasQualityIssues(undefined)).toBe(true)
  })
})
