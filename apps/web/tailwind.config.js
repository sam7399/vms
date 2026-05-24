const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [join(__dirname, 'src/**/*.{js,ts,jsx,tsx}')],
  theme: {
    extend: {
      colors: {
        // The Studio Infinito brand — pulled from the logo
        // Deep violet "S" → magenta swirl → warm orange tail
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed', // primary (matches their AMS theme-color)
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c', // warm orange tail of the logo
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        magenta: {
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3', // mid-tone in the logo gradient
          700: '#a21caf',
        },
        surface: {
          DEFAULT: '#0e0a1f',
          50: '#f8fafc',
          900: '#15102a',
          950: '#0a071a',
        },
      },
      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #fb923c 100%)',
        'brand-radial':
          'radial-gradient(ellipse at top, rgba(124,58,237,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(251,146,60,0.10), transparent 60%)',
      },
      boxShadow: {
        brand: '0 10px 40px -10px rgba(124, 58, 237, 0.45)',
        'brand-glow': '0 0 0 1px rgba(124,58,237,0.4), 0 8px 30px rgba(192,38,211,0.25)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
