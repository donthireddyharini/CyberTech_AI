/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          900: '#050a1a',
          800: '#080f24',
          700: '#0d1633',
          600: '#121d42',
          500: '#1a2755',
        },
        'purple': {
          400: '#a855f7',
          500: '#9333ea',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        'violet': {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
        },
        'cyan': {
          400: '#22d3ee',
          500: '#06b6d4',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'cyber-grid': "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid': '30px 30px',
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(147,51,234,0.3)',
        'glow-blue': '0 0 20px rgba(99,102,241,0.3)',
        'glow-cyan': '0 0 20px rgba(6,182,212,0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      fontFamily: {
        'sans': ['"Inter"', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
