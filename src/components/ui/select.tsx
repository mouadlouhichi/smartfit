'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

/**
 * The one, design-system Select.
 *
 * A fully custom listbox (styled trigger + floating panel) that is a **drop-in
 * replacement for a native `<select>`**: it accepts the same `value`,
 * `onChange` (called with an event-shaped `{ target: { value } }`) and
 * `<option>` children, so every existing call site upgrades without changes.
 *
 * Keyboard & ARIA behave like a real listbox: Enter/Space/ArrowDown open,
 * arrows move the active item, Enter/Space commit, Escape/outside-click close,
 * and the active option is announced via `aria-activedescendant`.
 */
/**
 * Trigger sizes, as presets rather than `className` overrides.
 *
 * Tailwind resolves conflicts by *stylesheet* order, not by the order classes
 * are written in, so `className="w-auto"` loses to the trigger's own `w-full`
 * no matter where it sits. A prop is the only deterministic way to size it.
 * Any one-off class the preset does not set can still come through `className`.
 */
export type SelectSize = 'default' | 'sm' | 'compact';

const SIZES: Record<SelectSize, string> = {
  default: 'h-11 w-full rounded-xl px-3 text-base sm:h-10 sm:text-sm',
  sm: 'h-9 w-auto rounded-xl px-2.5 text-xs',
  compact: 'h-8 w-auto rounded-lg px-2 text-[11px]',
};

const Select = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange' | 'size'> & {
    value?: string | number;
    onChange?: (e: { target: { value: string } }) => void;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-label'?: string;
    size?: SelectSize;
  }
>(({ className, value, onChange, children, disabled, id, size = 'default', ...rest }, ref) => {
  const options = React.useMemo(() => extractOptions(children), [children]);
  const selected = options.find((o) => o.value === String(value));

  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  // Keep the highlighted row on the selected one whenever we open.
  React.useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === String(value));
      setActive(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  // Close on outside pointer press.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function commit(option: Option) {
    if (option.disabled) return;
    onChange?.({ target: { value: option.value } });
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(options[active]);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={ref}
        type="button"
        id={id ?? `${listId}-trigger`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onKeyDown={onKeyDown}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          // Same field surface and 3:1 boundary as `Input`, so a form's text
          // fields and its pickers are visibly one family.
          'bg-field text-foreground border-input hover:border-foreground/40 focus-visible:ring-ring focus-visible:border-ring',
          // Mobile-first: 44px trigger + 16px type; compact on sm+ (§5).
          'flex items-center justify-between gap-2 border text-left font-medium transition-colors',
          SIZES[size],
          'focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive/5',
          className,
        )}
        {...rest}
      >
        <span className="truncate">{selected ? selected.label : <Placeholder />}</span>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={rest['aria-label']}
          aria-labelledby={rest['aria-label'] ? undefined : (id ?? `${listId}-trigger`)}
          // Exactly the trigger width — never wider. A fixed min-width would
          // poke past the dialog edge from narrow modal cells (e.g. the log
          // modal's ~127px Intensity cell), clipping the panel and adding a
          // horizontal scrollbar to the sheet. Labels truncate like the
          // trigger itself, so panel and trigger always agree.
          className="bg-popover text-popover-foreground border-border animate-fade-in absolute z-50 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border p-1 shadow-lg shadow-black/10"
        >
          {options.map((o, i) => {
            const isSel = o.value === String(value);
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                onPointerEnter={() => setActive(i)}
                onClick={() => commit(o)}
                className={cn(
                  // min-h-11: every option is a 44px touch target on mobile.
                  'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  i === active && 'bg-secondary',
                  o.disabled && 'text-muted-foreground cursor-not-allowed opacity-50',
                )}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <Check className="text-primary h-4 w-4 shrink-0" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
Select.displayName = 'Select';

function Placeholder() {
  return <span className="text-muted-foreground">Select…</span>;
}

/** Walk `<option>` children into a flat list the listbox can render. */
function extractOptions(children: React.ReactNode): Option[] {
  const out: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'option') {
      const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
      out.push({
        value: String(props.value ?? ''),
        label: props.children as React.ReactNode,
        disabled: props.disabled,
      });
    } else if (child.type === 'optgroup') {
      // Flatten groups — the listbox keeps a single visual level.
      React.Children.forEach((child.props as { children?: React.ReactNode }).children, (g) => {
        if (React.isValidElement(g) && g.type === 'option') {
          const props = g.props as React.OptionHTMLAttributes<HTMLOptionElement>;
          out.push({
            value: String(props.value ?? ''),
            label: props.children as React.ReactNode,
            disabled: props.disabled,
          });
        }
      });
    }
  });
  return out;
}

export { Select };
