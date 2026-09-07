import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/brand';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The terms that apply when you use SmartFit.',
  alternates: { canonical: '/terms' },
};

const UPDATED = '7 September 2026';

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 lg:py-24">
      <Link href="/" className="inline-block">
        <Wordmark />
      </Link>

      <h1 className="font-display mt-10 text-4xl font-bold tracking-tight">Terms of use</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated {UPDATED}</p>

      <div className="text-foreground/90 mt-10 space-y-8 text-[15px] leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">1. The service</h2>
          <p>
            SmartFit is a personal training log. It is provided free of charge, with no subscription
            tier, no trial and no payment of any kind.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">2. Your account and your data</h2>
          <p>
            You own everything you put into SmartFit. If you create an account, you are responsible
            for keeping your credentials secure. You can export your data or delete it — including
            your account — at any time from the Profile screen.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">3. Health disclaimer</h2>
          <p>
            SmartFit is a tracker, not a medical device, and it does not provide medical advice. The
            calorie figures it shows are estimates derived from duration, intensity and body mass.
            Consult a qualified professional before starting a new training programme, and stop if
            something hurts.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">4. Acceptable use</h2>
          <p>
            Don&apos;t use SmartFit to break the law, to attack the service or its infrastructure,
            or to store data you have no right to hold.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">5. Availability and warranty</h2>
          <p>
            The service is provided &quot;as is&quot;, without warranty of any kind. We do not
            guarantee uninterrupted availability, and we may change or discontinue features. Because
            SmartFit is free and stores your data on your own device or in your own cloud account,
            our liability is limited to the maximum extent permitted by law.
          </p>
          <p>Keep your own backups. Profile → Export JSON exists for exactly this reason.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">6. Changes</h2>
          <p>
            If these terms change materially, the &quot;last updated&quot; date above changes with
            them. Continuing to use SmartFit means accepting the current version.
          </p>
        </section>
      </div>

      <div className="border-border mt-14 flex gap-4 border-t pt-6 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          Home
        </Link>
        <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
          Privacy
        </Link>
      </div>
    </main>
  );
}
