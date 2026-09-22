import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        // Dark theme primary = the signature volt CTA (the same gradient +
        // glow the session runner's .btn-volt ships): lighter volt top-left,
        // deeper volt bottom-right, ink text, soft volt glow. Light theme
        // stays the flat ink pill — the accent only ever carries near-black.
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 dark:bg-gradient-to-br dark:from-volt-soft dark:via-volt dark:to-volt-dim dark:hover:brightness-[0.97] dark:shadow-[0_10px_24px_-14px_rgba(138,210,0,0.65),inset_0_1px_0_rgba(255,255,255,0.28)]',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-border bg-card shadow-sm hover:bg-secondary',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'hover:bg-secondary',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Mobile-first touch targets: 44px base, compacted on sm and up.
        default: 'h-11 px-5 py-2 sm:h-10',
        sm: 'h-9 px-3.5 text-xs sm:h-8 sm:px-3',
        lg: 'h-12 px-7 text-base',
        icon: 'h-11 w-11 sm:h-10 sm:w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
