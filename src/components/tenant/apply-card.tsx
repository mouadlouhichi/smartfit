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
import { useI18n } from '@/lib/i18n-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export function ApplyCard() {
  const { t } = useI18n();
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
      toast(t('gym.apply.demo'), 'info');
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
        toast(body.error ?? t('gym.apply.error'), 'info');
        return;
      }
      setSent(true);
      toast(t('gym.apply.received'), 'success');
    } catch {
      toast(t('gym.apply.offline'), 'info');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('gym.apply.thanks.title')}</CardTitle>
          <CardDescription>{t('gym.apply.thanks.body')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="apply">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('gym.apply.title')}</CardTitle>
        <CardDescription>{t('gym.apply.body')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field id="ap-name" label={t('gym.apply.name')}>
              <Input
                id="ap-name"
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder={t('gym.apply.namePlaceholder')}
                required
              />
            </Field>
            <Field id="ap-slug" label={t('gym.apply.slug')}>
              <Input
                id="ap-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t('gym.apply.slugPlaceholder')}
              />
            </Field>
            <Field id="ap-city" label={t('gym.apply.city')}>
              <Input
                id="ap-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('gym.apply.cityPlaceholder')}
              />
            </Field>
            <Field id="ap-email" label={t('gym.apply.email')}>
              <Input
                id="ap-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('gym.apply.emailPlaceholder')}
                required
              />
            </Field>
            <Field id="ap-ig" label={t('gym.apply.instagram')}>
              <Input
                id="ap-ig"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourgym"
              />
            </Field>
          </div>
          <Field id="ap-msg" label={t('gym.apply.message')}>
            <textarea
              id="ap-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={t('gym.apply.messagePlaceholder')}
              className="bg-field text-foreground placeholder:text-muted-foreground border-input hover:border-foreground/40 focus-visible:ring-ring focus-visible:border-ring flex min-h-11 w-full min-w-0 rounded-xl border px-3 py-2 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={sending || !gymName.trim() || !email.trim()}>
              <Send className="size-4" /> {sending ? t('gym.apply.sending') : t('gym.apply.submit')}
            </Button>
            <p className="text-muted-foreground text-xs">{t('gym.apply.note')}</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
