import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createDevSynthesizeMiddleware } from './server/devSynthesizeMiddleware'
import { createDevReviewsMiddleware } from './server/devReviewsMiddleware'
import { createDevIngredientsMiddleware } from './server/devIngredientsMiddleware'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dev-synthesize-api',
        configureServer(server) {
          server.middlewares.use(createDevSynthesizeMiddleware(env.OPENROUTER_API_KEY))
          server.middlewares.use(
            createDevReviewsMiddleware({
              redditClientId: env.REDDIT_CLIENT_ID,
              redditClientSecret: env.REDDIT_CLIENT_SECRET,
              jinaApiKey: env.JINA_API_KEY,
            }),
          )
          server.middlewares.use(createDevIngredientsMiddleware(env.JINA_API_KEY))
        },
      },
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },
  }
})
