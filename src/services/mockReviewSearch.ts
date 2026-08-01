import type { Concern, SensitivityLevel, SkinType } from '../features/onboarding/types'
import type { ParsedProduct } from './productParser'

export interface ReviewSource {
  id: string
  productTags: string[]
  sourceName: string
  sourceType: 'reddit' | 'forum' | 'blog' | 'community'
  sourceUrl: string
  quote: string
  sentiment: 'positive' | 'mixed' | 'negative'
  reviewerSkin: {
    skinType?: SkinType
    concerns: Concern[]
    sensitivity?: SensitivityLevel
  }
}

interface ReviewsResponse {
  reviews?: ReviewSource[]
}

export async function searchReviews(product: ParsedProduct): Promise<ReviewSource[]> {
  try {
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: product.brand, name: product.name }),
    })
    if (!response.ok) return []

    const data = (await response.json()) as ReviewsResponse
    return data.reviews ?? []
  } catch {
    return []
  }
}
