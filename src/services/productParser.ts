export interface ParsedProduct {
  originalUrl: string
  host: string
  brand: string
  name: string
  query: string
}

const SUPPORTED_HOSTS: Record<string, string> = {
  'amazon.com': 'Amazon',
  'amazon.co.uk': 'Amazon',
  'amazon.ca': 'Amazon',
  'sephora.com': 'Sephora',
  'ulta.com': 'Ulta',
  'target.com': 'Target',
}

export const SUPPORTED_RETAILER_NAMES = ['Amazon', 'Sephora', 'Ulta', 'Target']

const RETAILER_SUFFIX =
  /\s*[|–\-:]+\s*(amazon\.?com?|sephora|ulta beauty|ulta|target|walmart).*$/i

const ERROR_TITLE =
  /access.{0,10}denied|403|forbidden|blocked|captcha|just a moment|page not found|404|something went wrong|service unavailable/i

interface JinaResponse {
  data?: { title?: string }
}

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'application/json', 'X-Timeout': '7' },
      signal: controller.signal,
    })
    clearTimeout(id)
    if (!response.ok) return null
    const data = (await response.json()) as JinaResponse
    return data.data?.title?.trim() || null
  } catch {
    return null
  }
}

// Extract a human-readable product hint from the URL path when Jina is blocked.
// Amazon: /Rhode-Glazing-Milk/dp/B0CGMD4JDM → "Rhode Glazing Milk"
// Sephora: /product/rhode-glazing-milk-P12345 → "rhode glazing milk"
// Ulta:    /p/rhode-glazing-milk-pimpid → "rhode glazing milk"
// Target:  /p/rhode-glazing-milk/-/A-12345 → "rhode glazing milk"
function extractSlugFromUrl(parsed: URL, host: string): string | null {
  const segments = parsed.pathname.split('/').filter((s) => s.length > 0)

  if (host.includes('amazon.')) {
    const dpIndex = segments.findIndex((s) => s.toLowerCase() === 'dp')
    const slug = dpIndex > 0 ? segments[dpIndex - 1] : segments.find((s) => s.length > 5 && !/^[A-Z0-9]{8,}$/.test(s))
    return slug ? slug.replace(/-/g, ' ') : null
  }

  if (host === 'sephora.com') {
    const seg = segments.filter((s) => s !== 'product' && s !== 'beauty').find((s) => s.length > 5)
    return seg ? seg.replace(/-[Pp]\d+$/, '').replace(/-/g, ' ') : null
  }

  if (host === 'ulta.com') {
    const pIdx = segments.findIndex((s) => s === 'p')
    const seg = pIdx >= 0 ? segments[pIdx + 1] : segments.find((s) => s.length > 5)
    return seg ? seg.replace(/-\d+$/, '').replace(/-/g, ' ') : null
  }

  // Target and others: last meaningful path segment
  const seg = segments[segments.length - 1] ?? ''
  return seg.replace(/-/g, ' ') || null
}

async function extractProductFromHint(
  hint: string,
  apiKey: string,
): Promise<{ brand: string; name: string } | null> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Candid',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [
        {
          role: 'user',
          content: `Extract the brand name and product name from this beauty/skincare product text. Return ONLY valid JSON with keys "brand" and "name".\n\nText: "${hint}"`,
        },
      ],
      temperature: 0,
    }),
  })

  if (!response.ok) return null

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) return null

  try {
    const match = content.match(/\{[\s\S]*\}/)
    const json = JSON.parse(match?.[0] ?? content) as { brand?: unknown; name?: unknown }
    if (typeof json.brand === 'string' && typeof json.name === 'string') {
      return { brand: json.brand.trim(), name: json.name.trim() }
    }
  } catch {
    // fall through
  }
  return null
}

export async function parseProductFromUrl(urlInput: string): Promise<ParsedProduct> {
  let parsed: URL
  try {
    parsed = new URL(urlInput)
  } catch {
    throw new Error('Please paste a valid product URL.')
  }

  const host = parsed.hostname.replace(/^www\./, '')

  if (!SUPPORTED_HOSTS[host]) {
    throw new Error('Please paste a link from Amazon, Sephora, Ulta, or Target.')
  }

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
  if (!apiKey) {
    throw new Error(
      'Missing VITE_OPENROUTER_API_KEY. Add it to .env.local and restart the dev server.',
    )
  }

  // Try Jina for a clean title; fall back to the URL slug if the page is blocked.
  const rawTitle = await fetchPageTitle(urlInput)
  const hint =
    rawTitle && !ERROR_TITLE.test(rawTitle)
      ? rawTitle.replace(RETAILER_SUFFIX, '').trim()
      : extractSlugFromUrl(parsed, host)

  if (!hint || hint.length < 3) {
    throw new Error(
      "Couldn't read that product page. Make sure the link goes directly to a product and try again.",
    )
  }

  const product = await extractProductFromHint(hint, apiKey)
  if (!product) {
    throw new Error(
      "Couldn't identify the product. Try pasting the link directly from the product page.",
    )
  }

  return {
    originalUrl: urlInput,
    host,
    brand: product.brand,
    name: product.name,
    query: `${product.brand} ${product.name}`,
  }
}
