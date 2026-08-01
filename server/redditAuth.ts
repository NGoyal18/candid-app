let cachedToken: { value: string; expiresAt: number } | null = null

const USER_AGENT = 'web:candid-app:1.0 (by /u/candid_app)'

export async function getRedditAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`Reddit auth failed (${response.status})`)
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) {
    throw new Error('Reddit auth response missing access_token')
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 30_000,
  }
  return cachedToken.value
}

export { USER_AGENT as REDDIT_USER_AGENT }
