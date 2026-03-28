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
    if (line.includes('ingredient list') || line === 'ingredients' || line.includes('ingredients')) {
      const current = lines[index + 1] ?? ''
      if (current.length > 10) {
        return current
      }
    }
  }

  const inlineMatch = pageText.match(/ingredient list\s*[:-]\s*([^\n]+)/i)
  if (inlineMatch?.[1]) {
    return inlineMatch[1]
  }

  return null
}

export async function extractProductIngredients(productUrl: string): Promise<string[]> {
  try {
    const readerUrl = `https://r.jina.ai/http://${productUrl.replace(/^https?:\/\//, '')}`
    const response = await fetch(readerUrl)
    if (!response.ok) {
      return []
    }

    const text = await response.text()
    const ingredientLine = extractIngredientLine(text)
    if (!ingredientLine) {
      return []
    }

    return splitIngredients(ingredientLine)
  } catch {
    return []
  }
}
