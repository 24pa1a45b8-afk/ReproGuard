/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8F8F4',
        text: '#17221F',
        primary: '#245C49',
        accent: '#38A58A',
        surface: '#FFFFFF',
        muted: '#6B7280', 
        border: '#E5E7EB', 
        error: '#EF4444', 
        warning: '#F59E0B', 
        success: '#10B981', 
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
