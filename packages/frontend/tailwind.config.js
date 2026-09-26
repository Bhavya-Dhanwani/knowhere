/** @type {import('tailwindcss').Config} */

// Single brand hue for the whole product. `blue` and `indigo` are aliased to it so
// older screens that were written against Tailwind's blue pick up the brand too.
const brand = {
  50: '#f4f3ff',
  100: '#ebe9fe',
  200: '#d9d5fe',
  300: '#bcb4fd',
  400: '#9b8cfa',
  500: '#7d66f5',
  600: '#6a48ea',
  700: '#5a37d0',
  800: '#4a2fa9',
  900: '#3e2a86',
  950: '#251855'
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      xs: '380px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif']
      },
      colors: {
        brand,
        blue: brand,
        indigo: brand,
        canvas: '#fafafa',
        ink: '#0a0a0f',
        night: '#08080c',
        // legacy tokens kept for older screens
        background: '#fafafa',
        surface: '#18181b',
        primary: brand[600],
        'primary-hover': brand[500],
        success: '#16a34a',
        warning: '#d97706',
        muted: '#71717a'
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        card: '0 1px 2px rgb(16 16 24 / 0.04), 0 0 0 1px rgb(16 16 24 / 0.06)',
        lift: '0 12px 32px -12px rgb(16 16 24 / 0.18), 0 0 0 1px rgb(16 16 24 / 0.06)',
        glow: '0 0 0 1px rgb(125 102 245 / 0.35), 0 8px 40px -8px rgb(125 102 245 / 0.55)'
      },
      borderRadius: {
        '4xl': '2rem'
      },
      keyframes: {
        shine: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' }
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' }
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        shine: 'shine 5s linear infinite',
        marquee: 'marquee var(--marquee-duration, 40s) linear infinite',
        'gradient-pan': 'gradient-pan 8s ease infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        shimmer: 'shimmer 1.6s infinite'
      }
    }
  },
  plugins: []
};
