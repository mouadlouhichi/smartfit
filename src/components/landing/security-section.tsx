import { Lock, Smartphone, EyeOff, Download } from 'lucide-react';
import { Eyebrow, Section } from './section';

const CHIPS = ['On-device storage', 'No account needed', 'No wearable pairing', 'JSON & CSV export', 'No ad profiles'];

const POINTS = [
  {
    icon: Smartphone,
    title: 'Private by default',
    body: 'Your workouts live in local storage on your device. There is no cloud account to breach and no sync unless you ask for it.',
  },
  {
    icon: EyeOff,
    title: 'No sensors, no surveillance',
    body: 'SmartFit never pairs with a watch, ring or phone sensors. You decide what counts as a session — nothing is inferred behind your back.',
  },
  {
    icon: Lock,
    title: 'No advertising profiles',
    body: 'We never use your training data to build advertising profiles or sell it to third parties. There are no trackers in the app.',
  },
  {
    icon: Download,
    title: 'Export or delete anytime',
    body: 'Export a complete JSON backup or erase every byte from Profile in one tap. Your data is yours to move or remove.',
  },
];

export function SecuritySection() {
  return (
    <Section id="privacy">
      <Eyebrow>Privacy</Eyebrow>
      <h2 className="mt-3 max-w-3xl font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
        Your training, <span className="italic text-ember">your business.</span>
      </h2>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-clay">
        Everything stays on your device. Export and deletion controls live in Profile, and there is no account that
        could ever leak.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <span key={c} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink-warm">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-black/10 bg-black/10 sm:grid-cols-2">
        {POINTS.map((p) => (
          <div key={p.title} className="bg-white p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ember/10 text-ember">
              <p.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-display text-lg font-bold text-ink-warm">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-clay">{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
