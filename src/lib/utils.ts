import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Web-only className merge helper (shadcn convention). Pure logic lives in @smartfit/core. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
