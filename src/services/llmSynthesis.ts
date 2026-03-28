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
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return cleaned
  }

  const fenced = cleaned.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    return fenced[1]
  }

  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first >= 0 && last > first) {
    return cleaned.slice(first, last + 1)
  }
  return null
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

  const snippets = reviews.slice(0, 8).map((review) => ({
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
    'reasoningSummary must be 2-3 well-structured paragraphs.',
    'Paragraph 1: Synthesize what reviewers with similar skin profiles experienced — be specific about what the reviews actually say.',
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
        'X-Title': 'SkinSense MVP',
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
      throw new Error('OpenRouter response was not valid JSON.')
    }

    const patch = JSON.parse(json) as LlmPatch
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
    if (error instanceof Error) {
      throw error
    }
    throw new Error('OpenRouter synthesis failed.')
  }
}
