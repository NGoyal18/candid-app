import type { VercelRequest, VercelResponse } from '@vercel/node'
import { extractProductIngredients } from '../server/ingredientSearch'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { brand, name } = req.body as { brand?: string; name?: string }
  if (!name) {
    return res.status(400).json({ error: 'Missing name in request body.' })
  }

  try {
    const ingredients = await extractProductIngredients(brand ?? '', name, process.env.JINA_API_KEY)
    return res.status(200).json({ ingredients })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingredient extraction failed.'
    return res.status(500).json({ error: message })
  }
}
