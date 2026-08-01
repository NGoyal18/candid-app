function normalizeIngredient(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function splitIngredients(raw: string): string[] {
  return raw
    .split(/[,;]\s*/)
    .map(normalizeIngredient)
    .filter((item) => item.length > 0)
    .slice(0, 30)
}

function extractIngredientLine(pageText: string): string | null {
  const lines = pageText.split('\n').map((line) => line.trim())
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.toLowerCase() ?? ''
    if (
      line.includes('ingredient list') ||
      line === 'ingredients' ||
      line.includes('ingredients') ||
      line.includes('full ingredients') ||
      line.includes('inci list')
    ) {
      const current = lines[index + 1] ?? ''
      if (current.length > 10) {
        return current
      }
    }
  }

  const inlineMatch = pageText.match(/(?:full\s+)?ingredient(?:s|\s+list)?\s*[:-]\s*([^\n]+)/i)
  if (inlineMatch?.[1]) {
    return inlineMatch[1]
  }

  return null
}

export async function extractProductIngredients(
  brand: string,
  name: string,
  jinaApiKey?: string,
): Promise<string[]> {
  if (!jinaApiKey) return []

  try {
    const query = encodeURIComponent(`site:incidecoder.com ${brand} ${name}`)
    const searchResponse = await fetch(`https://s.jina.ai/?q=${query}`, {
      headers: { Authorization: `Bearer ${jinaApiKey}` },
      signal: AbortSignal.timeout(12000),
    })
    if (!searchResponse.ok) return []

    const searchText = await searchResponse.text()
    const urlMatch = searchText.match(/https?:\/\/incidecoder\.com\/products\/[^\s)\]"]+/)
    if (!urlMatch) return []

    const pageResponse = await fetch(`https://r.jina.ai/${urlMatch[0]}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!pageResponse.ok) return []

    const pageText = await pageResponse.text()
    const ingredientLine = extractIngredientLine(pageText)
    if (!ingredientLine) return []

    return splitIngredients(ingredientLine)
  } catch {
    return []
  }
}
