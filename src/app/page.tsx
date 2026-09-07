import type { Metadata } from 'next';
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
  'Track strength, cardio and HIIT for free. Start training with SmartFit, the private workout tracker supporting 4 training styles, 5 activity types and on-device data — no wearable required.';

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
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function HomePage() {
  return (
    <main id="main-content" className="landing noise-overlay relative min-h-screen overflow-x-hidden">
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
    </main>
  );
}
