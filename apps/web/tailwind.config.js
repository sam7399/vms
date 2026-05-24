const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [join(__dirname, 'src/**/*.{js,ts,jsx,tsx}')],
  theme: {
    extend: {
      colors: {
        // TheStudioInfinito brand palette
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // primary (indigo-500)
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee', // accent (cyan-400)
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        surface: {
          DEFAULT: '#0b0d1f',
          50: '#f8fafc',
          900: '#0f1226',
          950: '#070818',
        },
      },
      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
        'brand-radial':
          'radial-gradient(ellipse at top, rgba(99,102,241,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(6,182,212,0.10), transparent 60%)',
      },
      boxShadow: {
        brand: '0 10px 40px -10px rgba(99, 102, 241, 0.4)',
        'brand-glow': '0 0 0 1px rgba(99,102,241,0.4), 0 8px 30px rgba(99,102,241,0.25)',
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
