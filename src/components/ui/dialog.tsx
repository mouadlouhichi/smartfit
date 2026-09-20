'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/* ------------------------------------------------------------------ */
/* Bottom-sheet drag plumbing (mobile only)                            */
/*                                                                     */
/* DialogContent owns the drag state; SheetHandle (the grabber pill)   */
/* talks to it through this context so bespoke sheets such as the Pro  */
/* paywall can place the grabber inside their own chrome.              */
/* ------------------------------------------------------------------ */

interface SheetDragApi {
  handleProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

const SheetDragContext = React.createContext<SheetDragApi | null>(null);

/** Grabber pill for bottom sheets. Rendered by default at the top of
 *  DialogContent on mobile; bespoke sheets (Pro paywall) render it
 *  themselves and pass `hideHandle` to DialogContent. */
function SheetHandle({ className, pillClassName }: { className?: string; pillClassName?: string }) {
  const drag = React.useContext(SheetDragContext);
  return (
    <div
      aria-hidden="true"
      {...(drag?.handleProps ?? {})}
      className={cn('flex touch-none justify-center sm:hidden', className)}
    >
      <div className={cn('bg-foreground/15 h-1.5 w-10 rounded-full', pillClassName)} />
    </div>
  );
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideHandle?: boolean;
    hideClose?: boolean;
  }
>(({ className, children, hideHandle = false, hideClose = false, ...props }, ref) => {
  const programmaticCloseRef = React.useRef<HTMLButtonElement>(null);
  // Drag offset in px (null = resting). Applied through the CSS `translate`
  // property so it composes with the enter animation's `transform`.
  const [dragY, setDragY] = React.useState<number | null>(null);
  const gesture = React.useRef<{ startY: number } | null>(null);
  const liveY = React.useRef(0);
  const [reduceMotion] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const resetGesture = () => {
    gesture.current = null;
    liveY.current = 0;
    setDragY(null);
  };

  const dragApi = React.useMemo<SheetDragApi>(
    () => ({
      handleProps: {
        onTouchStart: (e) => {
          if (reduceMotion) return;
          gesture.current = { startY: e.touches[0].clientY };
        },
        onTouchMove: (e) => {
          if (!gesture.current || reduceMotion) return;
          liveY.current = Math.max(0, e.touches[0].clientY - gesture.current.startY);
          setDragY(liveY.current);
        },
        onTouchEnd: () => {
          if (!gesture.current) return;
          const shouldDismiss = liveY.current > 110;
          resetGesture();
          if (shouldDismiss) programmaticCloseRef.current?.click();
        },
        onTouchCancel: () => {
          if (gesture.current) resetGesture();
        },
      },
    }),
    [reduceMotion],
  );

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        style={{
          translate: dragY ? `0px ${dragY}px` : undefined,
          transition: reduceMotion
            ? undefined
            : dragY == null
              ? 'translate 0.22s ease-out'
              : 'none',
        }}
        className={cn(
          // Mobile-first: a bottom sheet sliding up over 92dvh, with a
          // grabber + swipe-to-dismiss + a sticky action footer (see §3).
          // sm and up: the classic centered dialog. §7.4: scrolling stays
          // inside the sheet/dialog on every viewport — and only ever
          // vertically: `overflow-x-clip` makes sideways panning impossible,
          // so a width bug clips instead of adding a horizontal scrollbar.
          // (Vertical `sticky` footers/headers are unaffected.)
          'border-border bg-card sheet-in fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col gap-4 overflow-x-clip overflow-y-auto overscroll-contain rounded-t-[1.75rem] border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl',
          'dialog-in sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:pb-6',
          className,
        )}
        {...props}
      >
        <SheetDragContext.Provider value={dragApi}>
          {!hideHandle && (
            <SheetHandle className="bg-card/90 sticky top-0 -mx-4 -mt-4 shrink-0 px-4 pt-3 pb-2 backdrop-blur-sm" />
          )}
          {children}
        </SheetDragContext.Provider>
        {/* Fires on a completed swipe-down; never in the tab order. */}
        <DialogPrimitive.Close
          ref={programmaticCloseRef}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-foreground hover:bg-secondary absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Mobile: a sticky action bar pinned above the sheet's bottom edge so
      // primary actions stay visible while the form scrolls (§3 sheets).
      // The negative bottom offset cancels the sheet's own padding-bottom:
      // sticky insets resolve against the content box, so `bottom-0` left a
      // padding-sized slit under the bar where scrolled content peeked
      // through. sm and up: the classic right-aligned static row.
      'border-border bg-card/95 sticky bottom-[calc(max(1rem,env(safe-area-inset-bottom))*-1)] -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm',
      'sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:border-t-0 sm:bg-transparent sm:p-0',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg leading-6 font-semibold tracking-tight text-balance', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm text-pretty', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  SheetHandle,
};
