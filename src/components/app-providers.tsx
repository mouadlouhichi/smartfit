'use client';

import { ThemeProvider } from './theme-provider';
import { StoreProvider } from '@/lib/store-context';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <StoreProvider>{children}</StoreProvider>
    </ThemeProvider>
  );
}
