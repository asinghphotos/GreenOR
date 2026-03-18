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
        green: {
          50: '#D8F3DC',
          100: '#B7E4C7',
          300: '#74C69D',
          500: '#40916C',
          700: '#2D6A4F',
          900: '#1B4332',
        },
        beige: {
          DEFAULT: '#F9F5EE',
          100: '#F4F0E8',
          200: '#EDE8DF',
          300: '#E5E0D8',
        },
      },
    },
  },
  plugins: [],
}
export default config
