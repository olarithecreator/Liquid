export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        purple: '#6700af',
        'purple-light': '#8B2FE0',
        'purple-ll': '#A855F7',
        'purple-lll': '#C084FC',
        ink: '#080808',
        'ink-2': '#0E0E0E',
        'ink-3': '#141414',
        'ink-4': '#1A1A1A',
        green: '#1DB954',
        red: '#E05252',
        blue: '#3B82F6',
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
