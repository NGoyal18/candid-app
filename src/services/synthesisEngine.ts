import type { Concern, SkinProfile } from '../features/onboarding/types'
import type { ReviewSource } from './mockReviewSearch'
import type { ParsedProduct } from './productParser'

const SENTIMENT_VALUE = {
  positive: 1,
  mixed: 0.2,
  negative: -1,
} as const

const MINIMUM_SOURCES = 3

export interface VerdictHighlight {
  sourceName: string
  sourceUrl: string
  quote: string
}

export interface IngredientSignal {
  name: string
  rationale: string
}

export interface Verdict {
  status: 'ready' | 'insufficient'
  totalSources: number
  matchScore?: number
  matchSummary?: string
  recommendation?: string
  reasoningSummary?: string
  beneficialIngredients?: IngredientSignal[]
  cautionIngredients?: IngredientSignal[]
  confidence?: 'low' | 'medium' | 'high'
  highlights?: VerdictHighlight[]
  complaints?: VerdictHighlight[]
  topSources?: VerdictHighlight[]
  bottomLine?: string
}

function concernOverlap(primary: Concern[], secondary: Concern[]): number {
  return secondary.filter((value) => primary.includes(value)).length
}

function reviewMatchesProfile(profile: SkinProfile, review: ReviewSource): boolean {
  const concernMatchCount = concernOverlap(
    [profile.topConcern, ...profile.secondaryConcerns],
    review.reviewerSkin.concerns,
  )

  const skinTypeMatch =
    Boolean(review.reviewerSkin.skinType) && review.reviewerSkin.skinType === profile.skinType
  const sensitivityMatch =
    Boolean(review.reviewerSkin.sensitivity) &&
    review.reviewerSkin.sensitivity === profile.sensitivity

  return skinTypeMatch || sensitivityMatch || concernMatchCount > 0
}

export function filterReviewsForProfile(profile: SkinProfile, reviews: ReviewSource[]): ReviewSource[] {
  return reviews.filter((review) => reviewMatchesProfile(profile, review))
}

function similarity(profile: SkinProfile, review: ReviewSource): number {
  let score = 1

  if (review.reviewerSkin.skinType && review.reviewerSkin.skinType === profile.skinType) {
    score += 2
  }

  if (review.reviewerSkin.sensitivity && review.reviewerSkin.sensitivity === profile.sensitivity) {
    score += 1
  }

  const overlap = concernOverlap(
    [profile.topConcern, ...profile.secondaryConcerns],
    review.reviewerSkin.concerns,
  )

  return score + overlap
}

function getConfidence(totalSources: number): 'low' | 'medium' | 'high' {
  if (totalSources >= 10) {
    return 'high'
  }
  if (totalSources >= 7) {
    return 'medium'
  }
  return 'low'
}

function getMatchSummary(score: number, profile: SkinProfile): string {
  const skinType = profile.skinType === 'not_sure'
    ? 'your skin type'
    : `${profile.skinType.replace(/_/g, ' ')} skin`
  const concern = profile.topConcern.replace(/_/g, ' ')
  if (score >= 75) {
    return `Strong match for ${skinType} with ${concern} concerns`
  }
  if (score >= 55) {
    return `Moderate match for ${skinType}`
  }
  return `Potential mismatch for ${skinType}`
}

function buildBottomLine(score: number, product: ParsedProduct): string {
  if (score >= 75) {
    return `${product.name} looks promising for your profile, with consistent positive feedback from similar skin types.`
  }
  if (score >= 55) {
    return `${product.name} could work, but similar users report trade-offs worth patch-testing first.`
  }
  return `${product.name} shows notable risk signals for your profile; consider an alternative before buying.`
}

function buildRecommendation(score: number, product: ParsedProduct): string {
  if (score >= 65) {
    return `Based on your skin profile, you should try this product (${product.name}).`
  }
  return `Based on your skin profile, you should not try this product (${product.name}).`
}

function buildReasoningSummary(
  profile: SkinProfile,
  score: number,
  highlights: VerdictHighlight[],
  complaints: VerdictHighlight[],
): string {
  const profileText = `${profile.skinType === 'not_sure' ? 'your skin type' : `${profile.skinType.replace(/_/g, ' ')} skin`} with ${profile.topConcern.replace(/_/g, ' ')} as the top concern`
  const sentimentTake =
    score >= 75
      ? 'Most comparable reviewers described steady, positive results with consistent use'
      : score >= 55
        ? 'Comparable reviewers reported mixed results, where benefits were often offset by trade-offs'
        : 'Comparable reviewers frequently mentioned warning signs that suggest higher risk for your profile'

  const supportiveClaims = highlights
    .slice(0, 2)
    .map((item) => item.quote.replace(/\s+/g, ' ').trim())
    .join(' | ')
  const cautionClaims = complaints
    .slice(0, 2)
    .map((item) => item.quote.replace(/\s+/g, ' ').trim())
    .join(' | ')

  const claimsLine =
    score >= 65
      ? `The strongest claims mention outcomes like: "${supportiveClaims || 'improved hydration and calmer skin'}".`
      : `The strongest caution claims mention issues like: "${cautionClaims || 'breakouts, irritation, or poor wear'}".`

  return `This verdict prioritizes reviewers who match your profile (${profileText}), giving extra weight to sensitivity and concern alignment. ${sentimentTake}. ${claimsLine} Top sources are linked so you can verify the evidence directly.`
}

export function synthesizeVerdict(
  product: ParsedProduct,
  profile: SkinProfile,
  reviews: ReviewSource[],
): Verdict {
  if (reviews.length < MINIMUM_SOURCES) {
    return { status: 'insufficient', totalSources: reviews.length }
  }

  const weighted = reviews.map((review) => {
    const fit = similarity(profile, review)
    const sentiment = SENTIMENT_VALUE[review.sentiment]
    return {
      review,
      fit,
      score: sentiment * fit,
    }
  })

  const totalFit = weighted.reduce((sum, value) => sum + value.fit, 0)
  const totalScore = weighted.reduce((sum, value) => sum + value.score, 0)
  const normalized = totalFit === 0 ? 0 : totalScore / totalFit
  const matchScore = Math.round(((normalized + 1) / 2) * 100)

  const sortedByFit = [...weighted].sort((a, b) => b.fit - a.fit)
  const highlights = sortedByFit
    .filter((item) => item.review.sentiment !== 'negative')
    .slice(0, 5)
    .map((item) => ({
      sourceName: item.review.sourceName,
      sourceUrl: item.review.sourceUrl,
      quote: item.review.quote,
    }))

  const complaints = sortedByFit
    .filter((item) => item.review.sentiment !== 'positive')
    .slice(0, 5)
    .map((item) => ({
      sourceName: item.review.sourceName,
      sourceUrl: item.review.sourceUrl,
      quote: item.review.quote,
    }))

  const topSources = sortedByFit.slice(0, 3).map((item) => ({
    sourceName: item.review.sourceName,
    sourceUrl: item.review.sourceUrl,
    quote: item.review.quote,
  }))

  return {
    status: 'ready',
    totalSources: reviews.length,
    matchScore,
    matchSummary: getMatchSummary(matchScore, profile),
    recommendation: buildRecommendation(matchScore, product),
    reasoningSummary: buildReasoningSummary(profile, matchScore, highlights, complaints),
    beneficialIngredients: [],
    cautionIngredients: [],
    confidence: getConfidence(reviews.length),
    highlights,
    complaints,
    topSources,
    bottomLine: buildBottomLine(matchScore, product),
  }
}

export { MINIMUM_SOURCES }
