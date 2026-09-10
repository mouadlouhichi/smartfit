import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/brand';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'How SmartFit handles your training data: what is stored, where it lives, who can see it, and how to export or delete it.',
  alternates: { canonical: '/privacy' },
};

const UPDATED = '7 September 2026';

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 lg:py-24">
      <Link href="/" className="inline-block">
        <Wordmark />
      </Link>

      <h1 className="font-display mt-10 text-4xl font-bold tracking-tight">Privacy policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated {UPDATED}</p>

      <div className="prose-smartfit text-foreground/90 mt-10 space-y-8 text-[15px] leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">The short version</h2>
          <p>
            SmartFit is a training log. It stores what you type into it and nothing else. There are
            no advertising trackers, no analytics SDKs, no third-party profiling, and your training
            data is never sold or shared.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Two modes, two answers</h2>
          <p>
            <strong>On-device mode.</strong> If the deployment you are using has no cloud backend
            configured, everything — your profile, sessions, schedule, goals and measurements —
            lives in your browser&apos;s <code>localStorage</code> under a single key. It never
            leaves your device, and clearing your browser data deletes it permanently.
          </p>
          <p>
            <strong>Account mode.</strong> If you sign in, your data is stored in Google Cloud
            Firestore under your user id and is readable only by you. Security rules deny every
            request that is not from your own signed-in account. A cached copy is also kept on your
            device so the app works offline; signing out removes that copy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">What we store</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Profile: your display name, units, rest days, week start and chosen plan.</li>
            <li>Training: logged sessions, your recurring schedule, goals and activity types.</li>
            <li>Body: any measurements you choose to record.</li>
            <li>
              Account mode only: the email address (or Google account) you signed in with, handled
              by Firebase Authentication.
            </li>
          </ul>
          <p>
            We do not collect location, contacts, health-kit data, device identifiers or behavioural
            analytics.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Crash reports (optional)</h2>
          <p>
            A deployment&apos;s operator may enable a self-hosted, cookie-free error collector. When
            — and only when — one is configured, the app may send technical crash reports and
            page-performance measurements (an error message, the page path, timing figures) as plain
            JSON to that collector. No cookies, no advertising SDKs, no user identity and no
            training content are included, and a default deployment sends nothing at all.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">AI coach answers</h2>
          <p>
            The coach always answers from your own data, and everything it needs is computed on your
            device. When a deployment&apos;s operator has configured an AI provider for it, the
            provider composes the wording of the answer: your question plus a compact summary of
            your training (weekly totals, streak, goal progress, the last few session titles and
            your latest weight — never your full export, email or credentials) is sent to that
            provider. Any AI failure falls back to the on-device coach, and AI-written answers are
            labelled as such.
          </p>
          <p>
            Prefer that nothing leaves the device? Use the mobile app, self-host the web app with no
            AI provider configured, or ask the operator of this deployment which provider it uses —
            the coach names it above the chat.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Maps (optional, network)</h2>
          <p>
            The live run view and the Ember/Paper share cards draw map tiles served by CARTO from
            OpenStreetMap data, credited on the map and the card. A tile request carries only the
            coordinates of the area being displayed — never your route as a whole, your account or
            your identity — and it is made by your browser, not by us. The transparent share style
            and the route sticker fetch no tiles at all, and everything still works offline: a
            blocked tile request degrades to the plain route drawing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Processors</h2>
          <p>
            In account mode, Google (Firebase Authentication and Cloud Firestore) processes your
            data as our infrastructure provider. In on-device mode there is no processor at all,
            because there is no transmission.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Your controls</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Export.</strong> Profile → Export JSON gives you every record we hold, in a
              portable format, at any time.
            </li>
            <li>
              <strong>Erase.</strong> Profile → Erase everything deletes all your training data
              immediately, on the device and in the cloud.
            </li>
            <li>
              <strong>Delete account.</strong> Profile → Delete account removes your data and your
              sign-in credentials permanently. This cannot be undone.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Retention</h2>
          <p>
            Data is kept until you delete it. There is no backup archive that survives an account
            deletion beyond the short window Google&apos;s infrastructure needs to propagate the
            removal.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Not a medical device</h2>
          <p>
            SmartFit estimates calories from duration, intensity and body mass. These are
            approximations for tracking trends, not clinical measurements. Train within your limits
            and seek professional advice for medical questions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Contact</h2>
          <p>
            Questions about this policy, or a data request? Open an issue on the{' '}
            <a
              className="text-primary font-medium underline-offset-4 hover:underline"
              href="https://github.com/mouadlouhichi/smartfit"
              target="_blank"
              rel="noreferrer noopener"
            >
              project repository
            </a>
            .
          </p>
        </section>
      </div>

      <div className="border-border mt-14 flex gap-4 border-t pt-6 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          Home
        </Link>
        <Link href="/terms" className="text-muted-foreground hover:text-foreground">
          Terms
        </Link>
      </div>
    </main>
  );
}
