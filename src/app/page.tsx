import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/navigation';
import { HeroSection } from '@/components/landing/hero-section';
import { WhatIsSection } from '@/components/landing/what-is-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { MetricsSection } from '@/components/landing/metrics-section';
import { PlansSection } from '@/components/landing/plans-section';
import { SecuritySection } from '@/components/landing/security-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { FaqSection } from '@/components/landing/faq-section';
import { CtaSection } from '@/components/landing/cta-section';
import { FooterSection } from '@/components/landing/footer-section';

const title = 'SmartFit — Free Private Fitness & Workout Tracker';
const description =
  'Plan your training week, log strength, cardio and HIIT sessions, and track streaks, goals and body trends for free. A private, wearable-free fitness tracker with 4 proven training styles — fully on-device.';

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
    <main className="dark relative min-h-screen overflow-x-hidden bg-ink text-paper">
      <LandingNav />
      <HeroSection />
      <WhatIsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <MetricsSection />
      <PlansSection />
      <SecuritySection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
