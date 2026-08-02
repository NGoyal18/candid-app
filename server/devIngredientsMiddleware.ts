import type { Connect } from 'vite'
import { extractProductIngredients } from './ingredientSearch.js'

export function createDevIngredientsMiddleware(jinaApiKey: string | undefined): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url !== '/api/ingredients' || req.method !== 'POST') {
      next()
      return
    }

    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as {
          brand?: string
          name?: string
        }

        if (!body.name) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing name in request body.' }))
          return
        }

        const ingredients = await extractProductIngredients(body.brand ?? '', body.name, jinaApiKey)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ingredients }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Ingredient extraction failed.',
          }),
        )
      }
    })
  }
}
