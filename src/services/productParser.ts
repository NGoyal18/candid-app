export interface ParsedProduct {
  originalUrl: string
  host: string
  brand: string
  name: string
  query: string
}

// Retailer name fragments to strip from page titles
const RETAILER_TITLE_SUFFIXES =
  /\s*[|–\-:]+\s*(sephora|ulta|ulta beauty|amazon|amazon\.com|amazon\.co\.uk|target|walmart|lookfantastic|look fantastic|cult beauty|boots|superdrug|net-a-porter|revolve|dermstore|skinstore|iherb|space nk|spacenk|feel unique|feelunique|beauty bay|beautybay|currentbody).*/i

// Known brand display names for matching at the start of a page title (longest first so
// "La Roche-Posay" matches before "La" or "Roche")
const KNOWN_BRANDS: string[] = [
  'La Roche-Posay',
  'Drunk Elephant',
  'Beauty of Joseon',
  'First Aid Beauty',
  "Paula's Choice",
  'Sunday Riley',
  'Some By Mi',
  'Round Lab',
  'Haruharu Wonder',
  'Krave Beauty',
  'The Ordinary',
  'Dr. Jart+',
  'Dr. Jart',
  'SKIN1004',
  'SkinCeuticals',
  'Neutrogena',
  'CeraVe',
  'Cetaphil',
  'Innisfree',
  'Torriden',
  'Laneige',
  'COSRX',
  'Tatcha',
  'Clinique',
  'Origins',
  'Bioderma',
  'Eucerin',
  'Aveeno',
  'Vichy',
  'Isntree',
  'Anua',
  'Missha',
  'Olay',
  'Nuxe',
  'belif',
  'Goodal',
  'Klairs',
  'Benton',
  'Medicube',
  'Sulwhasoo',
  'Rhode',
  'Glow Recipe',
  'Tower 28',
  'Versed',
  'Youth to the People',
  'Herbivore',
  'Biossance',
  'Supergoop',
  'Glossier',
  'Fenty Skin',
  'Kiehl\'s',
  'Origins',
  'Fresh',
  'Ole Henriksen',
  'Peter Thomas Roth',
  'Murad',
  'Perricone MD',
  'RoC',
  'Olay',
  'Neutrogena',
  'Differin',
  'Stridex',
].sort((a, b) => b.length - a.length)

interface JinaJsonResponse {
  data?: { title?: string }
}

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const jinaUrl = `https://r.jina.ai/${url}`
    const response = await fetch(jinaUrl, {
      headers: { Accept: 'application/json', 'X-Timeout': '5' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) return null
    const data = (await response.json()) as JinaJsonResponse
    return data.data?.title?.trim() || null
  } catch {
    return null
  }
}

const ERROR_TITLE_PATTERNS =
  /access[\s\S]{0,10}denied|denied[\s\S]{0,10}access|403|forbidden|blocked|robot check|captcha|just a moment|attention required|page not found|404|something went wrong|service unavailable|loading\.\.\./i

function isErrorTitle(title: string): boolean {
  if (ERROR_TITLE_PATTERNS.test(title)) return true
  // Suspiciously short or generic titles are also bad signals
  const cleaned = title.replace(/[^\w\s]/g, '').trim()
  if (cleaned.split(/\s+/).length <= 2 && /denied|error|blocked|sorry/i.test(cleaned)) return true
  return false
}

function cleanTitle(title: string): string {
  return title
    .replace(RETAILER_TITLE_SUFFIXES, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function splitBrandAndName(cleaned: string): { brand: string; name: string } {
  const lower = cleaned.toLowerCase()

  for (const brand of KNOWN_BRANDS) {
    const brandLower = brand.toLowerCase()
    if (lower === brandLower) {
      return { brand, name: brand }
    }
    if (lower.startsWith(`${brandLower} `)) {
      return { brand, name: cleaned.slice(brand.length).trim() }
    }
  }

  // Unknown brand: treat the first word as brand, the rest as product name.
  // This handles single-word brands like "Rhode", "Tatcha" (if not in list above), etc.
  const spaceIndex = cleaned.indexOf(' ')
  if (spaceIndex === -1) {
    return { brand: cleaned, name: cleaned }
  }
  return {
    brand: cleaned.slice(0, spaceIndex),
    name: cleaned.slice(spaceIndex + 1),
  }
}

// ─── URL-based fallback ───────────────────────────────────────────────────────

const BRAND_DOMAIN_MAP: Record<string, string> = {
  'laroche-posay': 'La Roche-Posay',
  'lrp': 'La Roche-Posay',
  'cetaphil': 'Cetaphil',
  'cerave': 'CeraVe',
  'paulaschoice': "Paula's Choice",
  'theordinary': 'The Ordinary',
  'ordinary': 'The Ordinary',
  'skinceuticals': 'SkinCeuticals',
  'tatcha': 'Tatcha',
  'innisfree': 'Innisfree',
  'cosrx': 'COSRX',
  'isntree': 'Isntree',
  'anua': 'Anua',
  'goodal': 'Goodal',
  'somebymi': 'Some By Mi',
  'krave': 'Krave Beauty',
  'drjart': 'Dr. Jart+',
  'drunkelephant': 'Drunk Elephant',
  'sundayriley': 'Sunday Riley',
  'belif': 'belif',
  'neutrogena': 'Neutrogena',
  'eucerin': 'Eucerin',
  'aveeno': 'Aveeno',
  'bioderma': 'Bioderma',
  'vichy': 'Vichy',
  'laneige': 'Laneige',
  'missha': 'Missha',
  'torriden': 'Torriden',
  'skin1004': 'SKIN1004',
  'rhode': 'Rhode',
  'glowrecipe': 'Glow Recipe',
  'tower28beauty': 'Tower 28',
  'versed': 'Versed',
  'youthtothepeople': 'Youth to the People',
  'herbivore': 'Herbivore',
  'biossance': 'Biossance',
  'supergoop': 'Supergoop',
  'glossier': 'Glossier',
  'fentybeauty': 'Fenty Skin',
  'kiehls': "Kiehl's",
  'fresh': 'Fresh',
  'olehenriksen': 'Ole Henriksen',
  'murad': 'Murad',
}

const URL_STOP_WORDS = new Set([
  'product', 'products', 'shop', 'item', 'items', 'detail', 'details',
  'catalog', 'category', 'collection', 'collections', 'browse',
  'the', 'for', 'with', 'and', 'by', 'in', 'of', 'our', 'new', 'sale',
  'skincare', 'beauty', 'face', 'body', 'hair', 'eye', 'lip',
  'pdp', 'dp', 'p',
])

const RETAILER_NAV_WORDS = new Set(['productid', 'product-detail', 'skuid', 'sku'])

const RETAILER_HOSTS = new Set([
  'sephora.com', 'ulta.com',
  'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr',
  'target.com', 'walmart.com',
  'lookfantastic.com', 'cultbeauty.co.uk',
  'skinstore.com', 'dermstore.com',
  'yesstyle.com', 'stylevana.com',
  'revolve.com', 'beautybay.com',
  'iherb.com', 'vitacost.com',
  'feelunique.com', 'currentbody.com',
  'boots.com', 'superdrug.com',
  'spacenk.com', 'net-a-porter.com',
])

function looksLikeId(segment: string): boolean {
  if (/^\d{5,}$/.test(segment)) return true
  if (/^[Pp]\d{4,}$/.test(segment)) return true
  if (/^[A-Z][0-9][A-Z0-9]{8}$/.test(segment)) return true
  if (/^[A-Z]-\d+$/.test(segment)) return true
  if (/^[A-Z0-9]{6,}$/.test(segment) && !/[AEIOU]/.test(segment)) return true
  return false
}

function sanitizeSlug(raw: string): string {
  return raw.replace(/[-_]+/g, ' ').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function slugToTokens(slug: string): string[] {
  return sanitizeSlug(slug)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !URL_STOP_WORDS.has(t.toLowerCase()) && !looksLikeId(t))
}

function extractBrandFromDomain(host: string): string {
  const parts = host.split('.')
  const tld = parts.slice(0, -1).join('.')
  return BRAND_DOMAIN_MAP[tld.toLowerCase()] ?? capitalize(parts[0] ?? 'Unknown')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function titleize(tokens: string[]): string {
  return tokens.map((w) => capitalize(w)).join(' ')
}

const BRAND_SLUG_ENTRIES: Array<[string, string]> = ([
  ['la-roche-posay', 'La Roche-Posay'],
  ['drunk-elephant', 'Drunk Elephant'],
  ['beauty-of-joseon', 'Beauty of Joseon'],
  ['first-aid-beauty', 'First Aid Beauty'],
  ['glow-recipe', 'Glow Recipe'],
  ['youth-to-the-people', 'Youth to the People'],
  ['sunday-riley', 'Sunday Riley'],
  ['peter-thomas-roth', 'Peter Thomas Roth'],
  ['ole-henriksen', 'Ole Henriksen'],
  ['paulas-choice', "Paula's Choice"],
  ['paula-s-choice', "Paula's Choice"],
  ['some-by-mi', 'Some By Mi'],
  ['round-lab', 'Round Lab'],
  ['haruharu-wonder', 'Haruharu Wonder'],
  ['krave-beauty', 'Krave Beauty'],
  ['tower-28', 'Tower 28'],
  ['the-ordinary', 'The Ordinary'],
  ['dr-jart-plus', 'Dr. Jart+'],
  ['dr-jart', 'Dr. Jart+'],
  ['fenty-skin', 'Fenty Skin'],
  ['skin1004', 'SKIN1004'],
  ['skinceuticals', 'SkinCeuticals'],
  ['neutrogena', 'Neutrogena'],
  ['cerave', 'CeraVe'],
  ['cetaphil', 'Cetaphil'],
  ['innisfree', 'Innisfree'],
  ['torriden', 'Torriden'],
  ['laneige', 'Laneige'],
  ['cosrx', 'COSRX'],
  ['tatcha', 'Tatcha'],
  ['clinique', 'Clinique'],
  ['glossier', 'Glossier'],
  ['supergoop', 'Supergoop'],
  ['biossance', 'Biossance'],
  ['herbivore', 'Herbivore'],
  ['differin', 'Differin'],
  ['origins', 'Origins'],
  ['bioderma', 'Bioderma'],
  ['eucerin', 'Eucerin'],
  ['aveeno', 'Aveeno'],
  ['kiehls', "Kiehl's"],
  ['vichy', 'Vichy'],
  ['isntree', 'Isntree'],
  ['versed', 'Versed'],
  ['murad', 'Murad'],
  ['fresh', 'Fresh'],
  ['anua', 'Anua'],
  ['missha', 'Missha'],
  ['rhode', 'Rhode'],
  ['olay', 'Olay'],
  ['nuxe', 'Nuxe'],
  ['belif', 'belif'],
  ['goodal', 'Goodal'],
  ['klairs', 'Klairs'],
  ['benton', 'Benton'],
] as Array<[string, string]>).sort((a, b) => b[0].length - a[0].length)

function matchBrandInSlug(slug: string): { brand: string; nameSlug: string } | null {
  const lower = slug.toLowerCase()
  for (const [brandSlug, brandName] of BRAND_SLUG_ENTRIES) {
    if (lower === brandSlug || lower.startsWith(`${brandSlug}-`)) {
      return { brand: brandName, nameSlug: slug.slice(brandSlug.length).replace(/^-+/, '') }
    }
  }
  return null
}

function findAmazonSlug(segments: string[]): string {
  const dpIndex = segments.findIndex((s) => s.toLowerCase() === 'dp')
  if (dpIndex > 0) return segments[dpIndex - 1]
  return segments.find((s) => s.length > 8 && !looksLikeId(s)) ?? segments[0] ?? ''
}

function findDescriptiveSegment(segments: string[]): string {
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const lower = seg.toLowerCase()
    if (
      seg.length >= 5 &&
      !looksLikeId(seg) &&
      !URL_STOP_WORDS.has(lower) &&
      !RETAILER_NAV_WORDS.has(lower)
    ) {
      return seg
    }
  }
  return segments[segments.length - 1] ?? ''
}

function parseFromUrlStructure(parsed: URL, host: string, originalUrl: string): ParsedProduct {
  const rawPathname = parsed.pathname.replace(/\.[a-z]{2,5}$/i, '')
  const pathSegments = rawPathname.split('/').map((s) => s.trim()).filter((s) => s.length > 0)

  let brand: string
  let name: string

  if (RETAILER_HOSTS.has(host)) {
    const rawSlug = host.includes('amazon.')
      ? findAmazonSlug(pathSegments)
      : findDescriptiveSegment(pathSegments)
    const cleanedSlug = rawSlug.replace(/-[Pp]\d{4,}$/, '').replace(/-\d{5,}$/, '')
    const brandMatch = matchBrandInSlug(cleanedSlug)
    if (brandMatch) {
      brand = brandMatch.brand
      name = titleize(slugToTokens(brandMatch.nameSlug)) || titleize(slugToTokens(cleanedSlug))
    } else {
      brand = extractBrandFromDomain(host)
      name = titleize(slugToTokens(cleanedSlug))
    }
  } else {
    brand = extractBrandFromDomain(host)
    const productSlug = pathSegments[pathSegments.length - 1] ?? ''
    name = titleize(slugToTokens(productSlug))
  }

  return {
    originalUrl,
    host,
    brand,
    name: name || 'Unknown Product',
    query: `${brand} ${name}`.trim(),
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function parseProductFromUrl(urlInput: string): Promise<ParsedProduct> {
  let parsed: URL
  try {
    parsed = new URL(urlInput)
  } catch {
    throw new Error('Please paste a valid product URL.')
  }

  const host = parsed.hostname.replace(/^www\./, '')

  // Fetch the real page title — much more reliable than URL parsing
  const rawTitle = await fetchPageTitle(urlInput)
  if (rawTitle && !isErrorTitle(rawTitle)) {
    const cleaned = cleanTitle(rawTitle)
    if (cleaned.length > 2) {
      const { brand, name } = splitBrandAndName(cleaned)
      return {
        originalUrl: urlInput,
        host,
        brand,
        name,
        query: cleaned, // full title = best search query
      }
    }
  }

  // Jina timed out or failed — fall back to URL structure parsing
  const fallback = parseFromUrlStructure(parsed, host, urlInput)

  // If we still ended up with a nonsense name (e.g. a bare product ID or error word),
  // surface a clear message rather than running a broken analysis.
  const suspicious = /^(unknown product|denied|error|forbidden|blocked|\d+)$/i
  if (suspicious.test(fallback.name.trim())) {
    throw new Error(
      "Couldn't read that product page. Try pasting the link directly from the brand's site or a retailer like Sephora, Ulta, or Amazon.",
    )
  }

  return fallback
}
