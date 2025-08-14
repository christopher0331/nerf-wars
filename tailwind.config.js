/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'team-purple': '#8B5CF6',
        'team-green': '#10B981',
        'team-red': '#EF4444',
        'team-blue': '#3B82F6',
        'team-yellow': '#F59E0B',
        'team-pink': '#EC4899',
      },
    },
  },
  plugins: [],
}
