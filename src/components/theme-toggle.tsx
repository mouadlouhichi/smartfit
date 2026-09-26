'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n-context';

/**
 * Light/dark switch.
 *
 * The icon is chosen by CSS, not by `resolvedTheme`: the server and the first
 * client render both see `undefined`, so a JS-chosen icon either flashes the
 * wrong one or needs a mounted-gate that leaves the button empty on the first
 * paint. A `dark:` variant is right from the first frame. `resolvedTheme` is
 * still what the click reads, which is correct — it is the *effective* theme,
 * including the OS preference when the user has never chosen.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={t('theme.toggle')}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Moon className="h-5 w-5 dark:hidden" />
      <Sun className="hidden h-5 w-5 dark:block" />
    </Button>
  );
}
