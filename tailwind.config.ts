import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Palatino', 'Palatino Linotype', 'Book Antiqua', 'Georgia', 'serif'],
      },
      colors: {
        // RGB triplet format so opacity modifiers like text-green-700/60 still work
        green: {
          50:  'rgb(var(--c-green-50)  / <alpha-value>)',
          100: 'rgb(var(--c-green-100) / <alpha-value>)',
          300: 'rgb(var(--c-green-300) / <alpha-value>)',
          500: 'rgb(var(--c-green-500) / <alpha-value>)',
          700: 'rgb(var(--c-green-700) / <alpha-value>)',
          900: 'rgb(var(--c-green-900) / <alpha-value>)',
        },
        beige: {
          DEFAULT: 'rgb(var(--c-beige)     / <alpha-value>)',
          100:     'rgb(var(--c-beige-100) / <alpha-value>)',
          200:     'rgb(var(--c-beige-200) / <alpha-value>)',
          300:     'rgb(var(--c-beige-300) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
export default config
