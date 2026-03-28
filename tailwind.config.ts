import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        plum: {
          50: '#faf5ff',
          100: '#f3e8ff',
          500: '#a855f7',
          700: '#7e22ce',
        },
      },
    },
  },
  plugins: [],
}

export default config
