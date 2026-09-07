/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['PlusJakartaSans', 'System'],
      },
      colors: {
        // "Ember" design system — warm light ground, vermilion accent.
        ember: '#D6532F',
        'ember-deep': '#B7220F',
        'ember-bright': '#E8785A',
        terracotta: '#E8A087',
        rose: '#CDACA4',
        clay: '#4E4C4C',
        paper: '#F2F0EC',

        // Semantic aliases used by components.
        background: '#F2F0EC',
        foreground: '#181615',
        card: '#FFFFFF',
        muted: '#EDE9E3',
        'muted-foreground': '#857D75',
        primary: { DEFAULT: '#D6532F', foreground: '#FDF6F2' },
        accent: { DEFAULT: '#E9D8D1', foreground: '#7A2A18' },
        border: '#E7E2DB',
        secondary: { DEFAULT: '#ECE8E2', foreground: '#3A322D' },
        destructive: '#C0392B',
      },
    },
  },
  plugins: [],
};
