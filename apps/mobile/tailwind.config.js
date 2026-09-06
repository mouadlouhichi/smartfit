/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mirrors the web "Motion" design tokens (apps/web/src/app/globals.css).
        background: '#F7FAF7',
        foreground: '#131A17',
        card: '#FFFFFF',
        muted: '#EEF2EE',
        'muted-foreground': '#5B675F',
        primary: { DEFAULT: '#15803D', foreground: '#F3FDF5' },
        accent: { DEFAULT: '#D9F99D', foreground: '#1A2E05' },
        border: '#E2E8E3',
        destructive: '#DC2626',
      },
    },
  },
  plugins: [],
};
