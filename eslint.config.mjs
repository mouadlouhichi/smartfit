import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Flat ESLint config for the whole monorepo.
 *
 * `next/core-web-vitals` carries the React, hooks and a11y rules that matter
 * for this app; TypeScript itself is checked by `tsc` in the `typecheck`
 * script, so we deliberately don't duplicate type-aware linting here.
 */
const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      'public/sw.js',
      'next-env.d.ts',
      'enhanced/**',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Unused code is a smell, but an underscore prefix is an explicit
      // "yes, I know" for signature-driven parameters.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // We use plain <img> nowhere; if that changes, revisit.
      '@next/next/no-img-element': 'warn',
    },
  },
  {
    // The Expo app has its own router/runtime conventions.
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
];

export default config;
