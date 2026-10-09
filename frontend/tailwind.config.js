/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F6F7F8',
        text: '#1D1F23',
        primary: '#1D6FE0',
        accent: '#23915A',
        surface: '#FFFFFF',
        muted: '#6E737B',
        border: '#E4E6E9',
        error: '#D93F3F',
        warning: '#B7791F',
        success: '#23915A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
