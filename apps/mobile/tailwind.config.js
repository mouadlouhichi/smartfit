/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Volt" design system — bold near-black ground with electric-lime accent.
        volt: '#C8F135',
        'volt-soft': '#E3F88A',
        'volt-dim': '#9DBD1F',
        ink: '#0B0E09',
        'ink-2': '#12160C',
        'ink-card': '#161B10',
        paper: '#EFF3E6',
        sage: '#9BA886',
        pine: '#2B4016',

        // Semantic aliases used by existing components.
        background: '#0B0E09',
        foreground: '#EFF3E6',
        card: '#161B10',
        muted: '#1B2113',
        'muted-foreground': '#9BA886',
        primary: { DEFAULT: '#C8F135', foreground: '#0B0E09' },
        accent: { DEFAULT: '#C8F135', foreground: '#0B0E09' },
        border: '#273019',
        destructive: '#F87171',
      },
    },
  },
  plugins: [],
};
