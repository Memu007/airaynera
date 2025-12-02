/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aira: {
          primary: '#4a9d95',
          secondary: '#6b73a9',
          success: '#51d88a',
          danger: '#ef5753',
          warning: '#fcd04b',
          info: '#2196f3',
          light: '#f8f9fa',
          dark: '#32325d',
          muted: '#8898aa',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}