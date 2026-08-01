interface IngredientsResponse {
  ingredients?: string[]
}

export async function extractProductIngredients(brand: string, name: string): Promise<string[]> {
  try {
    const response = await fetch('/api/ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, name }),
    })
    if (!response.ok) return []

    const data = (await response.json()) as IngredientsResponse
    return data.ingredients ?? []
  } catch {
    return []
  }
}
