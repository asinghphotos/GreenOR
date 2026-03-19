/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        beige: {
          50: '#FDFBF7',
          100: '#F9F5EE',
          200: '#F0E8D8',
          300: '#E5E0D8',
        },
        green: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          700: '#15803D',
          800: '#166534',
          900: '#1B4332',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
