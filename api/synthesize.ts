import type { VercelRequest, VercelResponse } from '@vercel/node'
import { callOpenRouter } from '../server/openrouter.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' })
  }

  const { prompt, temperature } = req.body as { prompt?: string; temperature?: number }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt in request body.' })
  }

  try {
    const data = await callOpenRouter(prompt, apiKey, temperature ?? 0.3)
    return res.status(200).json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synthesis request failed.'
    return res.status(500).json({ error: message })
  }
}
