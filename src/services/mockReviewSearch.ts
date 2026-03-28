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

interface RedditListingResponse {
  data?: {
    children?: Array<{
      data?: {
        id?: string
        title?: string
        selftext?: string
        permalink?: string
        subreddit_name_prefixed?: string
      }
    }>
  }
}
interface JinaSearchResult {
  title?: string
  url?: string
  description?: string
  content?: string
}
interface JinaSearchResponse {
  data?: JinaSearchResult[]
}

function inferSentiment(text: string): ReviewSource['sentiment'] {
  const normalized = text.toLowerCase()
  const positiveSignals = ['love', 'great', 'amazing', 'calm', 'hydrat', 'helped', 'works']
  const negativeSignals = ['breakout', 'broke me out', 'irritat', 'pilled', 'sticky', 'did nothing']

  const positive = positiveSignals.some((signal) => normalized.includes(signal))
  const negative = negativeSignals.some((signal) => normalized.includes(signal))

  if (positive && negative) {
    return 'mixed'
  }
  if (positive) {
    return 'positive'
  }
  if (negative) {
    return 'negative'
  }
  return 'mixed'
}

function inferSkinContext(text: string): ReviewSource['reviewerSkin'] {
  const normalized = text.toLowerCase()
  const concerns: Concern[] = []

  if (normalized.includes('acne') || normalized.includes('breakout')) concerns.push('acne')
  if (normalized.includes('dry') || normalized.includes('dehydrat')) concerns.push('dryness')
  if (normalized.includes('red')) concerns.push('redness')
  if (normalized.includes('sensitive') || normalized.includes('irritat')) concerns.push('sensitivity')
  if (normalized.includes('spot') || normalized.includes('pigment')) concerns.push('dark_spots')
  if (normalized.includes('dull')) concerns.push('dullness')
  if (normalized.includes('fine line') || normalized.includes('wrinkle')) concerns.push('aging')

  let skinType: SkinType | undefined
  if (normalized.includes('oily')) skinType = 'oily'
  else if (normalized.includes('dry skin') || normalized.includes('very dry')) skinType = 'dry'
  else if (normalized.includes('combination')) skinType = 'combination'
  else if (normalized.includes('normal skin')) skinType = 'normal'

  let sensitivity: SensitivityLevel | undefined
  if (normalized.includes('very sensitive')) sensitivity = 'very_sensitive'
  else if (normalized.includes('reactive') || normalized.includes('sometimes sensitive')) {
    sensitivity = 'sometimes_reactive'
  } else if (normalized.includes('resilient')) {
    sensitivity = 'resilient'
  }

  return {
    skinType,
    concerns,
    sensitivity,
  }
}

function clampQuote(text: string, maxLength = 280): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) {
    return cleaned
  }
  return `${cleaned.slice(0, maxLength - 1)}...`
}

function normalizeForReader(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
  }
  return `https://r.jina.ai/http://${url}`
}

function classifySourceType(url: string): ReviewSource['sourceType'] {
  const value = url.toLowerCase()
  if (value.includes('reddit.com')) return 'reddit'
  if (value.includes('influenster.com')) return 'community'
  if (value.includes('forum')) return 'forum'
  return 'blog'
}

function classifySourceName(url: string, fallback?: string): string {
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim()
  }
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return hostname
  } catch {
    return 'Web source'
  }
}

async function searchWebResults(product: ParsedProduct): Promise<JinaSearchResult[]> {
  const shortName = product.name.split(' ').slice(0, 3).join(' ')
  const query = encodeURIComponent(
    `${product.brand} ${shortName} review reddit influenster beauty blog`,
  )
  const response = await fetch(`https://s.jina.ai/?q=${query}&output_format=json`)
  if (!response.ok) {
    return []
  }

  try {
    const data = (await response.json()) as JinaSearchResponse
    return data.data ?? []
  } catch {
    return []
  }
}

async function fetchSourceSnippet(url: string): Promise<string | null> {
  const response = await fetch(normalizeForReader(url))
  if (!response.ok) {
    return null
  }
  const text = await response.text()
  const snippet = clampQuote(text.slice(0, 1000))
  return snippet.length > 30 ? snippet : null
}

async function fetchRedditReviews(product: ParsedProduct): Promise<ReviewSource[]> {
  // Use first 3 name words max to keep Reddit query focused.
  const shortName = product.name.split(' ').slice(0, 3).join(' ')
  const query = encodeURIComponent(`${product.brand} ${shortName} skincare review`)
  const url = `https://www.reddit.com/search.json?q=${query}&limit=8&sort=relevance&t=all`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    return []
  }

  const listing = (await response.json()) as RedditListingResponse
  const children = listing.data?.children ?? []

  return children
    .map((child) => child.data)
    .filter((post): post is NonNullable<typeof post> => Boolean(post?.id && post?.title))
    .map((post) => {
      const snippet = clampQuote(`${post.title ?? ''} ${post.selftext ?? ''}`.trim())
      return {
        id: `reddit-${post.id}`,
        productTags: [product.brand.toLowerCase(), product.name.toLowerCase()],
        sourceName: post.subreddit_name_prefixed || 'Reddit',
        sourceType: 'reddit' as const,
        sourceUrl: post.permalink ? `https://www.reddit.com${post.permalink}` : 'https://www.reddit.com',
        quote: snippet || post.title || 'User discussion about this product.',
        sentiment: inferSentiment(snippet || post.title || ''),
        reviewerSkin: inferSkinContext(snippet || post.title || ''),
      }
    })
    .filter((item) => item.quote.length > 20)
}

// Domains that are the product's own brand site or a retailer — skip them as review sources.
const BRAND_DOMAINS = new Set([
  'sephora.com', 'ulta.com', 'amazon.com', 'target.com',
  'walmart.com', 'cvs.com', 'walgreens.com', 'dermstore.com',
  'laroche-posay.us', 'laroche-posay.com', 'cerave.com',
  'cetaphil.com', 'cosrx.com', 'tatcha.com', 'paulaschoice.com',
  'theordinary.com', 'skinceuticals.com', 'innisfree.com',
])

async function fetchCommunityReviewsFromSearch(product: ParsedProduct): Promise<ReviewSource[]> {
  const searchResults = await searchWebResults(product)
  const prioritized = searchResults
    .filter((result) => Boolean(result.url))
    .filter((result) => {
      try {
        const hostname = new URL(result.url as string).hostname.replace(/^www\./, '')
        return !BRAND_DOMAINS.has(hostname)
      } catch {
        return false
      }
    })
    .slice(0, 10)

  const snippets = await Promise.allSettled(
    prioritized.map(async (result) => {
      const url = result.url as string
      const snippet = result.content?.trim() || (await fetchSourceSnippet(url))
      if (!snippet) {
        return null
      }

      return {
        id: `web-${btoa(url).replace(/=+$/g, '').slice(0, 16)}`,
        productTags: [product.brand.toLowerCase(), product.name.toLowerCase()],
        sourceName: classifySourceName(url, result.title),
        sourceType: classifySourceType(url),
        sourceUrl: url,
        quote: clampQuote(snippet),
        sentiment: inferSentiment(snippet),
        reviewerSkin: inferSkinContext(snippet),
      } satisfies ReviewSource
    }),
  )

  return snippets
    .filter((result): result is PromiseFulfilledResult<ReviewSource | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((value): value is ReviewSource => Boolean(value))
}

function dedupeSources(reviews: ReviewSource[]): ReviewSource[] {
  const seen = new Set<string>()
  return reviews.filter((review) => {
    if (seen.has(review.sourceUrl)) {
      return false
    }
    seen.add(review.sourceUrl)
    return true
  })
}

export async function searchReviews(product: ParsedProduct): Promise<ReviewSource[]> {
  const [reddit, web] = await Promise.allSettled([
    fetchRedditReviews(product),
    fetchCommunityReviewsFromSearch(product),
  ])

  const reviews = dedupeSources([
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(web.status === 'fulfilled' ? web.value : []),
  ])

  await new Promise((resolve) => setTimeout(resolve, 350))
  return reviews
}
