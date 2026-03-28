# SkinSense MVP

SkinSense helps shoppers decide whether a skincare product is likely to work for their skin profile by pulling real web/community discussion and synthesizing it into a verdict.

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
VITE_OPENROUTER_API_KEY=your_openrouter_key_here
```

- `VITE_OPENROUTER_API_KEY` is required for verdict generation in the current testing setup.

## Current Pipeline (Hybrid, No Mock Reviews)

1. User pastes product URL.
2. App parses product name + brand.
3. Search/retrieval layer gathers real sources:
   - Reddit search results
   - broader web/community sources (Reddit, Influenster, MakeupAlley, blog pages)
4. Verdict engine filters and weights results against skin profile.
5. If total sources `< 5`, app shows `Not enough data yet`.
6. If source count is enough, app shows full verdict card.
7. OpenRouter LLM synthesis generates the final personalized wording.

## Tests

```bash
npm run test
```
