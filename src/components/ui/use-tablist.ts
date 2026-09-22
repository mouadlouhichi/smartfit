import { useCallback, useRef, type KeyboardEvent } from 'react';

/**
 * Keyboard support for hand-rolled `role="tablist"` groups — the WAI-ARIA
 * tabs pattern Radix `Tabs` provides for free:
 *
 * - roving tabindex — only the selected tab is tabbable; Tab leaves the group
 * - ArrowLeft/ArrowRight (and Up/Down for vertical rails) move focus, wrapping
 * - Home/End jump to the first/last tab
 * - automatic activation — the focused tab is clicked, so the app's own
 *   onClick handler selects it
 *
 * `noActivate` marks tabs that may take focus without activating — the
 * progress ranges, where arrowing onto a Pro-locked range must focus it but
 * must not pop the paywall modal.
 */

/** Pure navigation math — exported for unit tests. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  const delta: Record<string, number> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
  };
  if (key in delta) return (index + delta[key] + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export function useTablist(count: number, noActivate?: (index: number) => boolean) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const skip = useRef(noActivate);
  skip.current = noActivate;

  const setRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      refs.current[index] = el;
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent, index: number) => {
      const next = nextTabIndex(event.key, index, count);
      if (next === null) return;
      event.preventDefault();
      const el = refs.current[next];
      if (!el) return;
      el.focus();
      if (!skip.current?.(next)) el.click();
    },
    [count],
  );

  return { setRef, onKeyDown };
}
