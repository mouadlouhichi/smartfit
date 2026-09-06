import Link from 'next/link';
import { Wordmark } from '@/components/brand';

export function FooterSection() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A private, calm fitness companion. Plan your training, log your sessions, and watch real progress — no
            wearables, no subscriptions, no data sold.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="/#features" className="hover:text-foreground">Features</a></li>
            <li><a href="/#plans" className="hover:text-foreground">Training plans</a></li>
            <li><Link href="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Get started</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/onboarding" className="hover:text-foreground">Onboarding</Link></li>
            <li><Link href="/dashboard" className="hover:text-foreground">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SmartFit · Train with intention.
      </div>
    </footer>
  );
}
