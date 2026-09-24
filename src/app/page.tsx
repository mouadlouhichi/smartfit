import type { Metadata } from 'next';
import { LandingSessionProvider } from '@/components/landing/account-link';
import { Navigation } from '@/components/landing/navigation';
import { HeroSection } from '@/components/landing/hero-section';
import { WhatIsSection } from '@/components/landing/what-is-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { FreeListSection } from '@/components/landing/free-list-section';
import { MetricsSection } from '@/components/landing/metrics-section';
import { PlansSection } from '@/components/landing/plans-section';
import { ActivitySection } from '@/components/landing/activity-section';
import { SecuritySection } from '@/components/landing/security-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { GuidesSection } from '@/components/landing/guides-section';
import { FaqSection } from '@/components/landing/faq-section';
import { CtaSection } from '@/components/landing/cta-section';
import { FooterSection } from '@/components/landing/footer-section';

const title = 'SmartFit — Free Private Fitness & Workout Tracker App';
const description =
  'Track strength, cardio and HIIT for free. Start training with SmartFit, the private workout tracker supporting 4 training styles, 5 activity types and local-first data — no wearable required.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    title,
    description,
    url: '/',
    siteName: 'SmartFit',
    type: 'website',
    locale: 'en_US',
    // A page-level `openGraph` replaces the root one wholesale, so the share
    // card has to be restated here or the landing page ships without one.
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'SmartFit — train with intention' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};

export default function HomePage() {
  return (
    // The marketing page follows the visitor's theme, like the product does.
    // Every section is drawn with the `--foreground`/`--muted-foreground`/
    // `--primary` tokens, so both palettes are the same components. It used to
    // force `.dark`, which made the light palette unreachable on the one page a
    // visitor sees first — and left the hard-coded near-white ink in the
    // inverted band invisible against it.
    <main id="main-content" className="landing relative min-h-screen overflow-x-hidden">
      <LandingSessionProvider>
        <Navigation />
        <HeroSection />
        <WhatIsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <FreeListSection />
        <MetricsSection />
        <PlansSection />
        <ActivitySection />
        <SecuritySection />
        <PricingSection />
        <GuidesSection />
        <FaqSection />
        <CtaSection />
        <FooterSection />
      </LandingSessionProvider>
    </main>
  );
}
