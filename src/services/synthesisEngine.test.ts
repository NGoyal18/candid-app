import { describe, expect, it } from 'vitest'
import type { SkinProfile } from '../features/onboarding/types'
import { synthesizeVerdict } from './synthesisEngine'
import type { ReviewSource } from './mockReviewSearch'
import type { ParsedProduct } from './productParser'

const profile: SkinProfile = {
  skinType: 'oily',
  skinTone: 'medium',
  topConcern: 'acne',
  secondaryConcerns: ['sensitivity'],
  sensitivity: 'sometimes_reactive',
}

const product: ParsedProduct = {
  originalUrl: 'https://example.com/products/test-cleanser',
  host: 'example.com',
  brand: 'Example',
  name: 'Test Cleanser',
  query: 'Example Test Cleanser',
}

const baseReview: ReviewSource = {
  id: '1',
  productTags: ['example', 'test cleanser'],
  sourceName: 'Reddit',
  sourceType: 'reddit',
  sourceUrl: 'https://reddit.com/r/test/1',
  quote: 'Worked well.',
  sentiment: 'positive',
  reviewerSkin: {
    skinType: 'oily',
    concerns: ['acne'],
    sensitivity: 'sometimes_reactive',
  },
}

describe('synthesizeVerdict', () => {
  it('returns insufficient when sources are below threshold', () => {
    const verdict = synthesizeVerdict(product, profile, [baseReview, { ...baseReview, id: '2' }])
    expect(verdict.status).toBe('insufficient')
    expect(verdict.totalSources).toBe(2)
  })

  it('returns a ready verdict with match metadata when enough sources exist', () => {
    const reviews = Array.from({ length: 5 }).map((_, index) => ({
      ...baseReview,
      id: `review-${index}`,
      sourceUrl: `https://reddit.com/r/test/${index}`,
      quote: `Review ${index}`,
      sentiment: index === 4 ? ('negative' as const) : ('positive' as const),
    }))

    const verdict = synthesizeVerdict(product, profile, reviews)
    expect(verdict.status).toBe('ready')
    expect(verdict.matchScore).toBeGreaterThanOrEqual(0)
    expect(verdict.matchScore).toBeLessThanOrEqual(100)
    expect(verdict.highlights?.length).toBeGreaterThan(0)
    expect(verdict.bottomLine).toContain('Test Cleanser')
  })
})
