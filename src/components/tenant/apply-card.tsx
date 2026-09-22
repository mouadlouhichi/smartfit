'use client';

/**
 * The public "list your gym" form on the directory page.
 *
 * This is the top of the platform's funnel: a gym owner with no account, no
 * relationship, typing their name into a stranger's website. Everything about
 * it is deliberately low-friction — five fields, two required — and honest:
 * in demo mode it says plainly that nothing was sent, rather than pretending
 * an application landed.
 *
 * What the applicant is told, because it is true: a human reviews it, and the
 * next thing that happens is their gym getting its own address.
 */
import { useState } from 'react';
import { Send } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export function ApplyCard() {
  const toast = useToast();
  const cloud = isFirebaseConfigured;
  const [gymName, setGymName] = useState('');
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!gymName.trim() || !email.trim()) return;

    if (!cloud) {
      // Demo mode has no backend to receive this — say so instead of faking
      // a queue entry that will never be reviewed.
      setSent(true);
      toast('Captured — but this preview has no backend, so nothing was sent', 'info');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gymName, slug, city, email, instagram, message }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(body.error ?? 'The application could not be sent. Try again.', 'info');
        return;
      }
      setSent(true);
      toast('Application received — we will be in touch', 'success');
    } catch {
      toast('The application could not be sent. Check the connection and try again.', 'info');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Thank you — application received</CardTitle>
          <CardDescription>
            A person reviews every application, usually within a day or two. When yours is approved,
            your gym gets its own SmartFit address and a console to run it from.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="apply">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">List your gym</CardTitle>
        <CardDescription>
          Your timetable, bookings and memberships on your own SmartFit address — reviewed by a
          person, usually within a day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field id="ap-name" label="Gym name *">
              <Input
                id="ap-name"
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="Casablanca Boxing Club"
                required
              />
            </Field>
            <Field id="ap-slug" label="Preferred address">
              <Input
                id="ap-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="casa-boxing"
              />
            </Field>
            <Field id="ap-city" label="City">
              <Input
                id="ap-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Casablanca"
              />
            </Field>
            <Field id="ap-email" label="Contact email *">
              <Input
                id="ap-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourgym.ma"
                required
              />
            </Field>
            <Field id="ap-ig" label="Instagram">
              <Input
                id="ap-ig"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourgym"
              />
            </Field>
          </div>
          <Field id="ap-msg" label="Anything else">
            <textarea
              id="ap-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Number of coaches, classes per week, what you want online booking for…"
              className="bg-secondary text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:bg-background flex min-h-11 w-full min-w-0 rounded-xl border border-transparent px-3 py-2 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={sending || !gymName.trim() || !email.trim()}>
              <Send className="size-4" /> {sending ? 'Sending…' : 'Apply to list'}
            </Button>
            <p className="text-muted-foreground text-xs">
              No account needed. We only use the email to reply about your application.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
