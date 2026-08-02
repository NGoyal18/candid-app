import type { Connect } from 'vite'
import { searchReviews, type ReviewSearchCredentials } from './reviewSearch.js'

export function createDevReviewsMiddleware(credentials: ReviewSearchCredentials): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url !== '/api/reviews' || req.method !== 'POST') {
      next()
      return
    }

    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as { brand?: string; name?: string }

        if (!body.name) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing name in request body.' }))
          return
        }

        const reviews = await searchReviews({ brand: body.brand ?? '', name: body.name }, credentials)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ reviews }))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Review search failed.',
          }),
        )
      }
    })
  }
}
