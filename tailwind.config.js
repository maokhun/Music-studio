/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          950: '#07090e',
          900: '#0c1017',
          850: '#111722',
          800: '#17202f',
          700: '#222f44',
          600: '#334460',
          accent: '#8b5cf6',
          cyan: '#06b6d4',
          glow: '#a855f7',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Kantumruy Pro', 'Battambang', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      }
    },
  },
  plugins: [],
};
