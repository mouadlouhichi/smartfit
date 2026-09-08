'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the destructive style. */
  destructive?: boolean;
}

type ConfirmRequest = { options: ConfirmOptions; resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Promise-based confirmation dialogs in the product's own design language.
 *
 * Destructive actions used to go through the browser's native `confirm()`:
 * unstylable, blocking, inconsistent across platforms and impossible to test.
 * `const ok = await confirm({ … })` reads almost the same at the call sites
 * while rendering inside the same Dialog system as everything else.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // The pending request lives in a ref (not state) so `confirm()` stays a
  // stable callback and resolving never happens inside a render or updater.
  const requestRef = useRef<ConfirmRequest | null>(null);
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A second prompt supersedes the first; the superseded caller gets
        // `false` so its action is cancelled rather than left hanging.
        requestRef.current?.resolve(false);
        requestRef.current = { options, resolve };
        rerender();
      }),
    [],
  );

  const settle = useCallback((ok: boolean) => {
    requestRef.current?.resolve(ok);
    requestRef.current = null;
    rerender();
  }, []);

  const request = requestRef.current;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={request !== null}
        onOpenChange={(o) => {
          if (!o) settle(false);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{request?.options.title}</DialogTitle>
            {request?.options.body && <DialogDescription>{request.options.body}</DialogDescription>}
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => settle(false)}>
              {request?.options.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              type="button"
              variant={request?.options.destructive ? 'destructive' : 'default'}
              onClick={() => settle(true)}
            >
              {request?.options.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}
