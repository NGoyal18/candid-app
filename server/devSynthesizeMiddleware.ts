import type { Connect } from 'vite'
import { callOpenRouter } from './openrouter'

export function createDevSynthesizeMiddleware(apiKey: string | undefined): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url !== '/api/synthesize' || req.method !== 'POST') {
      next()
      return
    }

    if (!apiKey) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY is not set in .env.local' }))
      return
    }

    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as {
          prompt?: string
          temperature?: number
        }

        if (!body.prompt || typeof body.prompt !== 'string') {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing prompt in request body.' }))
          return
        }

        const data = await callOpenRouter(body.prompt, apiKey, body.temperature ?? 0.3)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Synthesis request failed.',
          }),
        )
      }
    })
  }
}
