/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom colors for TalkCAD
        talkcad: {
          primary: '#3b82f6',
          accent: '#8b5cf6',
        },
      },
    },
  },
  plugins: [],
};
