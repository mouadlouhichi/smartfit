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
        volt: '#F3FF47',
        'volt-deep': '#CBE02C',
        'volt-bright': '#F7FF85',
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
        primary: { DEFAULT: '#F3FF47', foreground: '#101010' },
        accent: { DEFAULT: '#2E3510', foreground: '#EEFF54' },
        border: '#2B2B2B',
        secondary: { DEFAULT: '#262626', foreground: '#F5F5F2' },
        destructive: '#FF6B5E',
      },
    },
  },
  plugins: [],
};
