export interface ParsedProduct {
  query: string
  brand: string
  name: string
}

async function extractProductFromQuery(query: string): Promise<{ brand: string; name: string } | null> {
  const prompt = `Extract the brand name and product name from this beauty/skincare product search. Return ONLY valid JSON with keys "brand" and "name".\n\nText: "${query}"`

  try {
    const response = await fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, temperature: 0 }),
    })

    if (!response.ok) return null

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return null

    const match = content.match(/\{[\s\S]*\}/)
    const json = JSON.parse(match?.[0] ?? content) as { brand?: unknown; name?: unknown }
    if (typeof json.brand === 'string' && typeof json.name === 'string') {
      return { brand: json.brand.trim(), name: json.name.trim() }
    }
  } catch {
    // fall through to heuristic split
  }

  return null
}

// When the LLM is unavailable, split heuristically.
// First token = brand, remainder = product name.
function parseQueryFallback(query: string): { brand: string; name: string } {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) {
    return { brand: '', name: query.trim() }
  }
  return { brand: words[0], name: words.slice(1).join(' ') }
}

export async function parseProductFromQuery(queryInput: string): Promise<ParsedProduct> {
  const query = queryInput.trim()
  if (query.length < 3) {
    throw new Error('Please enter a product name.')
  }

  const product = (await extractProductFromQuery(query)) ?? parseQueryFallback(query)

  return {
    query,
    brand: product.brand,
    name: product.name,
  }
}
