import type { VercelRequest, VercelResponse } from '@vercel/node'
import { searchReviews } from '../server/reviewSearch'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { brand, name } = req.body as { brand?: string; name?: string }
  if (!name) {
    return res.status(400).json({ error: 'Missing name in request body.' })
  }

  try {
    const reviews = await searchReviews(
      { brand: brand ?? '', name },
      {
        redditClientId: process.env.REDDIT_CLIENT_ID,
        redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
        jinaApiKey: process.env.JINA_API_KEY,
      },
    )
    return res.status(200).json({ reviews })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review search failed.'
    return res.status(500).json({ error: message })
  }
}
