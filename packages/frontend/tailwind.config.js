/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0F1117',
        surface: '#1A1D29',
        primary: '#6366F1',
        'primary-hover': '#818CF8',
        success: '#22C55E',
        warning: '#F59E0B',
        muted: '#9CA3AF'
      }
    }
  },
  plugins: []
};
