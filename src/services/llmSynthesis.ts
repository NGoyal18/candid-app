import type { SkinProfile } from '../features/onboarding/types'
import type { Verdict } from './synthesisEngine'
import type { ReviewSource } from './mockReviewSearch'
import type { ParsedProduct } from './productParser'

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface LlmPatch {
  matchSummary?: string
  recommendation?: string
  reasoningSummary?: string
  beneficialIngredients?: Array<{ name?: string; rationale?: string }>
  cautionIngredients?: Array<{ name?: string; rationale?: string }>
  bottomLine?: string
}

function extractJsonObject(text: string): string | null {
  const cleaned = text.trim()

  const fenced = cleaned.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first >= 0 && last > first) {
    return cleaned.slice(first, last + 1)
  }
  return null
}

function safeJsonParse(raw: string): LlmPatch | null {
  // First attempt: parse as-is.
  try {
    return JSON.parse(raw) as LlmPatch
  } catch {
    // ignore and try sanitized version
  }

  // Second attempt: strip control characters that free models sometimes emit
  // inside string values (e.g. literal newlines, tabs).
  try {
    const sanitized = raw
      // Replace literal (unescaped) newlines / carriage returns inside string values.
      .replace(/(?<=":[\s]*"[^"\\]*)\n/g, '\\n')
      .replace(/(?<=":[\s]*"[^"\\]*)\r/g, '')
      // Replace other control characters via char code check.
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, (ch) => {
        const hex = ch.charCodeAt(0).toString(16).padStart(4, '0')
        return `\\u${hex}`
      })
    return JSON.parse(sanitized) as LlmPatch
  } catch {
    return null
  }
}

function normalizeIngredientList(
  value: Array<{ name?: string; rationale?: string }> | undefined,
): Array<{ name: string; rationale: string }> | undefined {
  if (!value || !Array.isArray(value)) {
    return undefined
  }

  const normalized = value
    .filter((item) => typeof item?.name === 'string' && item.name.trim().length > 0)
    .map((item) => ({
      name: (item.name as string).trim(),
      rationale: typeof item.rationale === 'string' && item.rationale.trim().length > 0
        ? item.rationale.trim()
        : 'Frequently referenced in matched reviews.',
    }))

  return normalized.length > 0 ? normalized.slice(0, 4) : undefined
}

export async function enhanceVerdictWithLlm(
  verdict: Verdict,
  product: ParsedProduct,
  profile: SkinProfile,
  reviews: ReviewSource[],
  productIngredients: string[],
): Promise<Verdict> {
  if (verdict.status !== 'ready') {
    return verdict
  }

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
  if (!apiKey) {
    throw new Error('Missing VITE_OPENROUTER_API_KEY. Add it in .env.local and restart the dev server.')
  }

  const productTerms = [product.brand, product.name].flatMap((s) =>
    s.toLowerCase().split(/\s+/).filter((t) => t.length > 3),
  )
  const relevantReviews = reviews.filter((review) => {
    const text = review.quote.toLowerCase()
    return productTerms.some((term) => text.includes(term))
  })
  const snippetSource = relevantReviews.length >= 3 ? relevantReviews : reviews
  const snippets = snippetSource.slice(0, 8).map((review) => ({
    source: review.sourceName,
    url: review.sourceUrl,
    quote: review.quote,
    sentiment: review.sentiment,
    skin: review.reviewerSkin,
  }))

  const prompt = [
    'You are a skincare review synthesis assistant.',
    'Return JSON only with keys: matchSummary, recommendation, reasoningSummary, beneficialIngredients, cautionIngredients, bottomLine.',
    'The recommendation must start with either: "Based on your skin profile, you should try this product" OR "Based on your skin profile, you should not try this product".',
    'The recommendation must be one complete, confident sentence.',
    'IMPORTANT: Only use evidence snippets that are actually discussing this specific product. Discard any snippet that is clearly about a different product, a general skincare topic, or only tangentially related. If a snippet does not meaningfully discuss this product, ignore it entirely — do not reference it.',
    'reasoningSummary must be 2-3 well-structured paragraphs.',
    'Paragraph 1: Synthesize what reviewers with similar skin profiles experienced — be specific about what the reviews actually say about THIS product. Do not reference unrelated threads or topics.',
    'Paragraph 2: Analyze the product ingredients list and call out by name which specific ingredients are likely beneficial for the user\'s skin concerns, and which (if any) could be problematic. Explain briefly why for each.',
    'Paragraph 3 (optional): Any other important context (e.g. texture, application, how long results take).',
    'beneficialIngredients and cautionIngredients must each be arrays of objects with {name, rationale} — used internally, not shown as separate UI sections.',
    'If ingredients are unavailable, return empty arrays.',
    'Tone: friendly, informative, and direct. Sound like a helpful skincare-savvy friend, not a legal disclaimer.',
    'Keep each sentence direct and concise. No hedging language.',
    `Synthesize reviews of ${product.brand} ${product.name} for someone with ${profile.skinType.replace('_', ' ')} skin and concerns around ${[profile.topConcern, ...profile.secondaryConcerns].join(', ').replace(/_/g, ' ')}. Some review snippets may not explicitly state the reviewer's skin type — use ingredient knowledge and general review patterns to infer how this product is likely to perform for this specific skin profile. The verdict must always be grounded in the user's skin profile, not just generic sentiment.`,
    `Product: ${product.brand} ${product.name}`,
    `User skin profile: ${JSON.stringify(profile)}`,
    `Product ingredients: ${JSON.stringify(productIngredients)}`,
    `Evidence snippets: ${JSON.stringify(snippets)}`,
  ].join('\n')

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Candid MVP',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter request failed with status ${response.status}`)
    }

    const data = (await response.json()) as OpenRouterResponse
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OpenRouter returned an empty response.')
    }

    const json = extractJsonObject(content)
    if (!json) {
      // Model returned prose instead of JSON — use deterministic verdict as-is.
      return verdict
    }

    const patch = safeJsonParse(json)
    if (!patch) {
      // Unparseable JSON — use deterministic verdict as-is.
      return verdict
    }

    return {
      ...verdict,
      matchSummary: patch.matchSummary || verdict.matchSummary,
      recommendation: patch.recommendation || verdict.recommendation,
      reasoningSummary: patch.reasoningSummary || verdict.reasoningSummary,
      beneficialIngredients:
        normalizeIngredientList(patch.beneficialIngredients) || verdict.beneficialIngredients,
      cautionIngredients:
        normalizeIngredientList(patch.cautionIngredients) || verdict.cautionIngredients,
      bottomLine: patch.bottomLine || verdict.bottomLine,
    }
  } catch (error) {
    // Only hard-throw for network/auth failures, not JSON parse issues.
    if (error instanceof Error && (
      error.message.includes('OpenRouter request failed') ||
      error.message.includes('VITE_OPENROUTER_API_KEY') ||
      error.message.includes('empty response')
    )) {
      throw error
    }
    // For all other errors (parse, format), fall back to deterministic verdict.
    return verdict
  }
}
