export interface ParsedProduct {
  originalUrl: string
  host: string
  brand: string
  name: string
  query: string
}

function titleize(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function sanitizeToken(token: string): string {
  return token
    .replace(/[-_]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseProductFromUrl(urlInput: string): ParsedProduct {
  let parsed: URL
  try {
    parsed = new URL(urlInput)
  } catch {
    throw new Error('Please paste a valid product URL.')
  }

  const host = parsed.hostname.replace(/^www\./, '')
  const slugTokens = parsed.pathname
    .split('/')
    .map(sanitizeToken)
    .filter((token) => token.length > 0)
  const rawSlug = slugTokens[slugTokens.length - 1] ?? ''
  const stopWords = new Set([
    'product',
    'products',
    'shop',
    'beauty',
    'skincare',
    'item',
    'p',
  ])

  const nameToken = rawSlug
    .split(/\s+/)
    .filter((token) => !stopWords.has(token.toLowerCase()))
    .slice(0, 6)
    .join(' ')

  const name = titleize(nameToken || 'Unknown Product')
  const firstDomainPart = host.split('.')[0] || 'Unknown'
  const brand = titleize(sanitizeToken(firstDomainPart))

  return {
    originalUrl: parsed.toString(),
    host,
    brand,
    name,
    query: `${brand} ${name}`.trim(),
  }
}
