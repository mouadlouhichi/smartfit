'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The one, design-system Checkbox.
 *
 * A real `<input type="checkbox">` with the native control visually replaced —
 * the same principle as `Select` being a real button. That keeps form
 * semantics, keyboard behaviour, `indeterminate`, label association and
 * `:focus-visible` for free, instead of re-implementing them on a
 * `<div role="checkbox">`.
 *
 * The box is the `--field` surface with the same 3:1 `--input` boundary as a
 * text field, so a form's controls read as one family; checked is the primary
 * surface with `--primary-foreground` ink on top (10:1 or better in both
 * themes). Use it bare with an `aria-label`, or with `label`/`hint` — either
 * way the tick is driven by the input's own `:checked` state, so it needs no
 * JavaScript.
 */
export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  /** Text rendered next to the box, inside the same label. */
  label?: React.ReactNode;
  /** Draw a dash instead of a tick — "some of the children are checked". */
  indeterminate?: boolean;
  /** Secondary line under the label (a hint, not a description). */
  hint?: React.ReactNode;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, indeterminate, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    // `indeterminate` is a DOM property, not an attribute — React cannot set it
    // from JSX, so it has to be pushed onto the node.
    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = !!indeterminate;
    }, [indeterminate]);

    const input = (
      <span className="relative inline-flex shrink-0 items-center justify-center">
        <input
          ref={innerRef}
          type="checkbox"
          className={cn(
            // `appearance-none` removes the native box; the tick below is drawn
            // on top of this element and switched by its own state.
            'peer border-input bg-field checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary',
            'h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[7px] border transition-colors',
            'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            'aria-[invalid=true]:border-destructive',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <Check
          className="text-primary-foreground pointer-events-none absolute h-3.5 w-3.5 opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
          strokeWidth={3.5}
          aria-hidden
        />
        <span
          className="bg-primary-foreground pointer-events-none absolute h-0.5 w-2.5 rounded-full opacity-0 peer-indeterminate:opacity-100"
          aria-hidden
        />
      </span>
    );

    if (!label && !hint) return input;

    return (
      <label
        className={cn(
          // min-h-11 keeps the row a 44px touch target even though the box is
          // 20px. `items-start` so a two-line hint hangs from the first line.
          'flex min-h-11 cursor-pointer items-start gap-2.5 text-sm select-none',
          'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
        )}
      >
        <span className="flex h-6 items-center">{input}</span>
        <span className="min-w-0">
          <span className="block leading-snug font-medium">{label}</span>
          {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
        </span>
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
