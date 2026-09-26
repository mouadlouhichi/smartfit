'use client';

import { ThemeProvider } from './theme-provider';
import { AuthProvider } from '@/lib/firebase/auth-context';
import { StoreProvider } from '@/lib/store-context';
import { I18nProvider } from '@/lib/i18n-context';
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
          <StoreProvider>
            {/* Inside the store: the chosen language is a profile field, so it
                syncs across devices like every other preference. */}
            <I18nProvider>{children}</I18nProvider>
          </StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
