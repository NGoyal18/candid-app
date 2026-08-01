# candid MVP

candid helps shoppers decide whether a skincare product is likely to work for their skin profile by pulling real web/community discussion and synthesizing it into a verdict.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- React Router
- Vitest

## Run Locally

```bash
npm install
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

## Environment Variables

Create `.env.local` in the project root:

```bash
OPENROUTER_API_KEY=your_openrouter_key_here
REDDIT_CLIENT_ID=your_reddit_app_client_id
REDDIT_CLIENT_SECRET=your_reddit_app_client_secret
JINA_API_KEY=your_jina_api_key
```

- All keys are used server-side only (never exposed to the browser) — see `server/reviewSearch.ts`, `server/redditAuth.ts`, and `server/ingredientSearch.ts`.
- `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`: create a "script" app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) (any redirect URI works, e.g. `http://localhost:5173`). The client ID is the string under the app name; the secret is labeled "secret". Used for read-only application-only OAuth against Reddit's search API, which now blocks unauthenticated requests.
- `JINA_API_KEY`: get a free key at [jina.ai](https://jina.ai) (their `s.jina.ai` search endpoint now requires auth; the `r.jina.ai` reader endpoint stays keyless).
- On Vercel: add all four vars under Project → Settings → Environment Variables, then redeploy.
- After changing `.env.local`, restart the dev server (`npm run dev`).
- Without Reddit/Jina keys, product search and the LLM verdict still work, but review search returns 0 sources and every product shows "Not enough data yet."

## Current Pipeline (Hybrid, No Mock Reviews)

1. User types a product name (brand + product works best, e.g. "CeraVe Moisturizing Cream").
2. App parses the query into brand + product name (LLM-assisted, with a heuristic fallback).
3. Search/retrieval layer gathers real sources:
   - Reddit search results
   - broader web/community sources (Reddit, Influenster, MakeupAlley, blog pages)
4. Verdict engine filters and weights results against skin profile.
5. If total sources are below `MINIMUM_SOURCES` (currently 3, see `src/services/synthesisEngine.ts`), app shows `Not enough data yet`.
6. If source count is enough, app shows full verdict card.
7. OpenRouter LLM synthesis generates the final personalized wording.

## Tests

```bash
npm run test
```
