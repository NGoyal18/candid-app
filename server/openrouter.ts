interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export async function callOpenRouter(
  prompt: string,
  apiKey: string,
  temperature = 0.3,
): Promise<OpenRouterResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://candid-app.vercel.app',
      'X-Title': 'Candid MVP',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [{ role: 'user', content: prompt }],
      temperature,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenRouter request failed (${response.status}): ${text}`)
  }

  return (await response.json()) as OpenRouterResponse
}
