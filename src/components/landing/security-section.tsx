import { Download, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { SectionHeading } from './section';

const POINTS = [
  { icon: WifiOff, title: 'No account, no wearable', body: 'Nothing is sent to a server or matched to a device on your wrist. You decide what counts as a session.' },
  { icon: ShieldCheck, title: 'Local-first storage', body: 'Your workouts live in your browser or phone. There is no ad network, no data broker, no analytics on your habits.' },
  { icon: Download, title: 'Export or erase anytime', body: 'Download a complete JSON backup, or wipe everything on-device in one tap. Your training is always yours.' },
];

export function SecuritySection() {
  return (
    <section className="border-y border-white/10 bg-ink-2">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-2 h-7 w-7 shrink-0 text-volt" />
          <SectionHeading eyebrow="Privacy">
            Your training, <span className="text-volt">your business.</span>
          </SectionHeading>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-3xl border border-white/10 bg-ink p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-volt/15 text-volt">
                <p.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/60">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {['On-device data', 'No trackers', 'No bank/health sync', 'Offline-friendly', 'Open format export'].map((t) => (
            <span key={t} className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold text-paper/70">
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
