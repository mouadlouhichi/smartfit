'use client';

import { ThemeProvider } from './theme-provider';
import { AuthProvider } from '@/lib/firebase/auth-context';
import { StoreProvider } from '@/lib/store-context';
import { ToastProvider } from '@/components/ui/toast';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/*
        Toasts mount here — once, at the root — because the toast stack is
        viewport-fixed, so its position is identical wherever it renders, and
        mounting it per subtree (DashboardShell, then tenant, then admin) meant
        every new route tree 500'd on its first `useToast()`. The per-shell
        mounts were removed in favour of this one.
      */}
      <ToastProvider>
        <AuthProvider>
          <StoreProvider>{children}</StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
