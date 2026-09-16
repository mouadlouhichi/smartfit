/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Helvetica Neue', 'Helvetica', 'System'],
      },
      colors: {
        // "Volt" design system — near-black ground, electric lime accent.
        volt: '#9CFF00',
        'volt-deep': '#76B900',
        'volt-bright': '#CFFF55',
        terracotta: '#9FB41F',
        rose: '#8A8A8A',
        clay: '#6F6F6F',
        paper: '#0E0E0E',

        // Semantic aliases used by components.
        background: '#0E0E0E',
        foreground: '#F5F5F2',
        card: '#1A1A1A',
        muted: '#232323',
        'muted-foreground': '#A3A3A3',
        primary: { DEFAULT: '#9CFF00', foreground: '#101010' },
        accent: { DEFAULT: '#2E3510', foreground: '#EEFF54' },
        border: '#2B2B2B',
        secondary: { DEFAULT: '#262626', foreground: '#F5F5F2' },
        destructive: '#FF6B5E',
      },
    },
  },
  plugins: [],
};
