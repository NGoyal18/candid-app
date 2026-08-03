import { getRedditAccessToken, REDDIT_USER_AGENT } from './redditAuth.js'
import { isUnsafeText } from './contentSafety.js'

export interface ReviewSource {
  id: string
  productTags: string[]
  sourceName: string
  sourceType: 'reddit' | 'forum' | 'blog' | 'community'
  sourceUrl: string
  quote: string
  sentiment: 'positive' | 'mixed' | 'negative'
  reviewerSkin: {
    skinType?: string
    concerns: string[]
    sensitivity?: string
  }
}

export interface ProductQuery {
  brand: string
  name: string
}

export interface ReviewSearchCredentials {
  redditClientId?: string
  redditClientSecret?: string
  jinaApiKey?: string
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
  httpStatus?: number
  warning?: string
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

  if (positive && negative) return 'mixed'
  if (positive) return 'positive'
  if (negative) return 'negative'
  return 'mixed'
}

function inferSkinContext(text: string): ReviewSource['reviewerSkin'] {
  const normalized = text.toLowerCase()
  const concerns: string[] = []

  if (normalized.includes('acne') || normalized.includes('breakout')) concerns.push('acne')
  if (normalized.includes('dry') || normalized.includes('dehydrat')) concerns.push('dryness')
  if (normalized.includes('red')) concerns.push('redness')
  if (normalized.includes('sensitive') || normalized.includes('irritat')) concerns.push('sensitivity')
  if (normalized.includes('spot') || normalized.includes('pigment')) concerns.push('dark_spots')
  if (normalized.includes('dull')) concerns.push('dullness')
  if (normalized.includes('fine line') || normalized.includes('wrinkle')) concerns.push('aging')

  let skinType: string | undefined
  if (normalized.includes('oily')) skinType = 'oily'
  else if (normalized.includes('dry skin') || normalized.includes('very dry')) skinType = 'dry'
  else if (normalized.includes('combination')) skinType = 'combination'
  else if (normalized.includes('normal skin')) skinType = 'normal'

  let sensitivity: string | undefined
  if (normalized.includes('very sensitive')) sensitivity = 'very_sensitive'
  else if (normalized.includes('reactive') || normalized.includes('sometimes sensitive')) {
    sensitivity = 'sometimes_reactive'
  } else if (normalized.includes('resilient')) {
    sensitivity = 'resilient'
  }

  return { skinType, concerns, sensitivity }
}

function clampQuote(text: string, maxLength = 280): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
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
  if (fallback && fallback.trim().length > 0) return fallback.trim()
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Web source'
  }
}

async function searchWebResultsForQuery(query: string, jinaApiKey: string): Promise<JinaSearchResult[]> {
  const encoded = encodeURIComponent(query)
  const response = await fetch(`https://s.jina.ai/?q=${encoded}&output_format=json`, {
    headers: { Authorization: `Bearer ${jinaApiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) return []

  try {
    const data = (await response.json()) as JinaSearchResponse
    return data.data ?? []
  } catch {
    return []
  }
}

// A single search query is fragile — for less-searched products it can easily surface the
// brand's own site, Wikipedia, or retailer pages instead of reviews. Fan out to a few
// differently-worded queries and merge the results, since each phrasing tends to surface a
// different slice of what's actually out there.
async function searchWebResults(product: ProductQuery, jinaApiKey?: string): Promise<JinaSearchResult[]> {
  if (!jinaApiKey) return []

  const shortName = product.name.split(' ').slice(0, 3).join(' ')
  const queries = [
    `${product.brand} ${shortName} review reddit influenster beauty blog`,
    `${product.brand} ${shortName} reddit review`,
    `${product.brand} ${shortName} review`,
  ]

  const results = await Promise.allSettled(queries.map((query) => searchWebResultsForQuery(query, jinaApiKey)))
  const merged = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))

  const seen = new Set<string>()
  return merged.filter((result) => {
    if (!result.url || seen.has(result.url)) return false
    seen.add(result.url)
    return true
  })
}

async function fetchSourceSnippet(url: string): Promise<string | null> {
  const response = await fetch(normalizeForReader(url), { signal: AbortSignal.timeout(8000) })
  if (!response.ok) return null
  const text = await response.text()
  const snippet = clampQuote(text.slice(0, 1000))
  return snippet.length > 30 ? snippet : null
}

async function fetchRedditReviews(
  product: ProductQuery,
  clientId?: string,
  clientSecret?: string,
): Promise<ReviewSource[]> {
  if (!clientId || !clientSecret) return []

  const token = await getRedditAccessToken(clientId, clientSecret)
  const shortName = product.name.split(' ').slice(0, 3).join(' ')
  const query = encodeURIComponent(`${product.brand} ${shortName} skincare review`)
  const url = `https://oauth.reddit.com/search?q=${query}&limit=8&sort=relevance&t=all`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': REDDIT_USER_AGENT,
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) return []

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

const BRAND_DOMAINS = new Set([
  'sephora.com', 'ulta.com', 'amazon.com', 'target.com',
  'walmart.com', 'cvs.com', 'walgreens.com', 'dermstore.com',
  'laroche-posay.us', 'laroche-posay.com', 'cerave.com',
  'cetaphil.com', 'cosrx.com', 'tatcha.com', 'paulaschoice.com',
  'theordinary.com', 'skinceuticals.com', 'innisfree.com',
  'elfcosmetics.com',
])

// Login-gated / JS-rendered platforms Jina's reader can't meaningfully extract text from
// (returns CAPTCHA walls, empty shells, or requires auth) — skip them rather than burn a
// candidate slot on a page we can't actually read.
const UNREADABLE_DOMAINS = new Set([
  'instagram.com', 'facebook.com', 'tiktok.com',
  'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'pinterest.com',
])

const BLOCKED_CONTENT =
  /blocked (by|due to) (network security|a network policy)|access denied|403 forbidden|just a moment|captcha|please verify you are a human|js_challenge|skip to main content.{0,40}(reddit\.com|solution=)/i

async function fetchCommunityReviewsFromSearch(
  product: ProductQuery,
  jinaApiKey?: string,
): Promise<ReviewSource[]> {
  const searchResults = await searchWebResults(product, jinaApiKey)
  const prioritized = searchResults
    .filter((result) => Boolean(result.url))
    // Jina flags pages it couldn't actually fetch (bot-blocked, 403, etc.) via httpStatus/warning
    // rather than always leaking the block page's text into `content` — trust that signal first.
    .filter((result) => !result.warning && (!result.httpStatus || result.httpStatus < 400))
    .filter((result) => {
      try {
        const hostname = new URL(result.url as string).hostname.replace(/^www\./, '')
        return !BRAND_DOMAINS.has(hostname) && !UNREADABLE_DOMAINS.has(hostname)
      } catch {
        return false
      }
    })
    .slice(0, 20)

  const snippets = await Promise.allSettled(
    prioritized.map(async (result) => {
      const url = result.url as string
      const snippet = result.content?.trim() || (await fetchSourceSnippet(url))
      if (!snippet || BLOCKED_CONTENT.test(snippet)) return null

      return {
        id: `web-${Buffer.from(url).toString('base64').replace(/=+$/g, '').slice(0, 16)}`,
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
    if (seen.has(review.sourceUrl)) return false
    seen.add(review.sourceUrl)
    return true
  })
}

// Jina's search results are noticeably non-deterministic — the identical query can return
// anywhere from 0 to 8+ usable sources on back-to-back calls. Below this count, it's worth
// paying for a second round rather than showing "not enough data" on what was really just
// an unlucky search.
const RETRY_BELOW_COUNT = 3

async function fetchAndFilter(
  product: ProductQuery,
  credentials: ReviewSearchCredentials,
): Promise<ReviewSource[]> {
  const [reddit, web] = await Promise.allSettled([
    fetchRedditReviews(product, credentials.redditClientId, credentials.redditClientSecret),
    fetchCommunityReviewsFromSearch(product, credentials.jinaApiKey),
  ])

  const merged = dedupeSources([
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(web.status === 'fulfilled' ? web.value : []),
  ])

  // Scraped from arbitrary web pages — drop anything that looks like a prompt-injection
  // attempt or otherwise unsafe content before it ever reaches the LLM prompt or the UI.
  return merged.filter((review) => !isUnsafeText(review.quote) && !isUnsafeText(review.sourceName))
}

export async function searchReviews(
  product: ProductQuery,
  credentials: ReviewSearchCredentials,
): Promise<ReviewSource[]> {
  const first = await fetchAndFilter(product, credentials)
  if (first.length >= RETRY_BELOW_COUNT) {
    return first
  }

  const retry = await fetchAndFilter(product, credentials)
  return dedupeSources([...first, ...retry])
}
