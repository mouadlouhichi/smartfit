'use client';

import Link from 'next/link';
import { AccountLink } from './account-link';
import { AnimatedWave } from './animated-wave';
import { Logo } from '@/components/brand';
import { useI18n } from '@/lib/i18n-context';

/**
 * Keys, not copy — except the three links whose label is decided at runtime by
 * the session (`AccountLink`): "Open dashboard", "Get started" and "Sign in"
 * keep their English form because that is what the landing's own E2E asserts,
 * and which one renders depends on who is looking.
 */
type FooterLink = { key: string | null; name: string; href: string };
const FOOTER_LINKS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'landing.footer.product',
    links: [
      { key: 'landing.footer.featuresHub', name: 'Features hub', href: '/#features' },
      { key: 'landing.nav.howItWorks', name: 'How it works', href: '/#how-it-works' },
      { key: 'landing.footer.trainingStyles', name: 'Training styles', href: '/#integrations' },
      { key: 'landing.nav.pricing', name: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'landing.footer.training',
    links: [
      { key: 'landing.footer.library', name: 'Training library', href: '/library' },
      { key: 'landing.footer.allStyles', name: 'All styles explained', href: '/#plans' },
      { key: 'landing.footer.ppl', name: 'Push / Pull / Legs', href: '/#plans' },
      { key: 'landing.footer.upperLower', name: 'Upper / Lower', href: '/#plans' },
      { key: 'landing.footer.fullBody', name: 'Full Body 3×', href: '/#plans' },
    ],
  },
  {
    title: 'landing.nav.guides',
    links: [
      { key: 'landing.footer.trainingGuides', name: 'Training guides', href: '/#guides' },
      { key: 'landing.footer.sessionVsPlan', name: 'Session vs plan', href: '/#features' },
      { key: 'landing.nav.howItWorks', name: 'How it works', href: '/#how-it-works' },
      { key: 'landing.footer.faq', name: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'landing.footer.app',
    links: [
      { key: null, name: 'Open dashboard', href: '/dashboard' },
      { key: null, name: 'Get started', href: '/onboarding' },
      { key: null, name: 'Sign in', href: '/login' },
      { key: 'landing.footer.help', name: 'Help & support', href: '/support' },
      { key: 'landing.footer.yourData', name: 'Your data', href: '/#security' },
    ],
  },
  {
    title: 'landing.footer.legal',
    links: [
      { key: 'landing.footer.privacy', name: 'Privacy policy', href: '/privacy' },
      { key: 'landing.footer.terms', name: 'Terms of use', href: '/terms' },
      { key: 'landing.footer.exportDelete', name: 'Export & delete', href: '/dashboard/profile' },
    ],
  },
];

export function FooterSection() {
  const { t } = useI18n();
  return (
    <footer className="relative border-t border-[color:var(--foreground)]/10">
      <div className="pointer-events-none absolute inset-0 h-64 overflow-hidden opacity-20">
        <AnimatedWave />
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 gap-12 md:grid-cols-7 lg:gap-8">
            <div className="col-span-2">
              <Link href="/" className="mb-6 inline-flex items-center gap-2">
                <Logo size={32} />
                <span className="font-display text-2xl">SmartFit</span>
              </Link>
              <p className="max-w-xs leading-relaxed text-[color:var(--muted-foreground)]">
                {t('landing.footer.blurb')}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
                {t('landing.footer.disclaimer')}
              </p>
            </div>

            {FOOTER_LINKS.map(({ title, links }) => (
              <div key={title}>
                <h3 className="mb-6 text-sm font-medium">{t(title)}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={`${title}-${link.key ?? link.name}`} className="empty:hidden">
                      {['/login', '/dashboard', '/onboarding'].includes(link.href) ? (
                        <AccountLink
                          signedOutOnly={link.href !== '/dashboard'}
                          className="inline-flex items-center gap-2 text-sm text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                        >
                          {link.key ? t(link.key) : link.name}
                        </AccountLink>
                      ) : (
                        <Link
                          href={link.href}
                          className="inline-flex items-center gap-2 text-sm text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                        >
                          {link.key ? t(link.key) : link.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--foreground)]/10 py-8">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            © {new Date().getFullYear()} {t('landing.footer.copyright')}
          </p>
          <div className="flex gap-4 text-xs text-[color:var(--muted-foreground)]">
            <Link href="/#features" className="hover:text-[color:var(--foreground)]">
              {t('landing.nav.features')}
            </Link>
            <Link href="/#integrations" className="hover:text-[color:var(--foreground)]">
              {t('landing.footer.activity')}
            </Link>
            <Link href="/#guides" className="hover:text-[color:var(--foreground)]">
              {t('landing.nav.guides')}
            </Link>
            <Link href="/privacy" className="hover:text-[color:var(--foreground)]">
              {t('landing.footer.privacy')}
            </Link>
            <Link href="/terms" className="hover:text-[color:var(--foreground)]">
              {t('landing.footer.termsShort')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
