'use client';

import { ThemeProvider } from './theme-provider';
import { AuthProvider } from '@/lib/firebase/auth-context';
import { StoreProvider } from '@/lib/store-context';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StoreProvider>{children}</StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
