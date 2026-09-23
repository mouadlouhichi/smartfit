'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Monitor, Smartphone, Save, RotateCcw, Palette } from 'lucide-react';
import type { GymTenant } from '@smartfit/core';
import { useTenant } from '@/lib/tenant-context';
import { profileFromGym, validateGymProfile, WEEKDAYS, type GymProfile } from '@/lib/gym-profile';
import { BrandControls } from './brand-controls';
import { GymGallery } from './brand-media';
import { StorefrontHero } from './storefront-hero';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const PALETTES = [
  ['Volt', '#8ad200'],
  ['Ocean', '#0284c7'],
  ['Ember', '#ea580c'],
  ['Orchid', '#9333ea'],
  ['Rose', '#be123c'],
  ['Midnight', '#172554'],
];

export function ProfileStudio() {
  const t = useTenant();
  if (!t.gym) return null;
  return <ProfileEditor key={t.slug} gym={t.gym} />;
}

function ProfileEditor({ gym }: { gym: GymTenant }) {
  const t = useTenant();
  const toast = useToast();
  const [baseline, setBaseline] = useState(() => profileFromGym(gym));
  const [draft, setDraft] = useState<GymProfile>(baseline);
  const [device, setDevice] = useState('desktop');
  const [processingLogo, setProcessingLogo] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const readonly = t.viewAs || !t.can('branding:edit');
  const busy = t.mutating !== null;
  // Refresh from a server reload only when there is no unsaved work to lose.
  useEffect(() => {
    if (!dirty) {
      const next = profileFromGym(gym);
      setDraft(next);
      setBaseline(next);
    }
  }, [gym, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function field(group: 'branding' | 'contact' | 'location', key: string, value: string) {
    setDraft((d) => ({ ...d, [group]: { ...d[group], [key]: value } }));
  }
  async function save() {
    const next = { ...draft, name: draft.name.trim() };
    const invalid = validateGymProfile(next);
    setErrors(invalid);
    if (invalid.length || readonly || processingLogo) return;
    const ok = await t.updateGym(next);
    if (ok) {
      setBaseline(next);
      setDraft(next);
      toast(
        t.mode === 'demo' ? 'Preview updated for this demo session' : 'Storefront published',
        'success',
      );
    } else setErrors(['Could not publish. Your draft is kept; check the error above and retry.']);
  }
  const textField = (
    group: 'branding' | 'contact' | 'location',
    key: string,
    label: string,
    value: string | undefined,
    max = 200,
    type = 'text',
  ) => (
    <Field id={`studio-${key}`} label={label}>
      <Input
        id={`studio-${key}`}
        type={type}
        value={value ?? ''}
        maxLength={max}
        onChange={(e) => field(group, key, e.target.value)}
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            Your brand, your space
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">Storefront studio</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Design your gym’s public profile. Preview first, publish when ready.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={`/g/${t.slug}`} target="_blank" rel="noreferrer">
            Open storefront <ExternalLink />
          </a>
        </Button>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <Tabs defaultValue="brand">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="brand">Brand</TabsTrigger>
                <TabsTrigger value="contact">Contact & location</TabsTrigger>
                <TabsTrigger value="hours">Hours</TabsTrigger>
              </TabsList>
              <fieldset disabled={readonly || busy || processingLogo}>
                <TabsContent value="brand" className="mt-5 space-y-4">
                  <Field id="studio-name" label="Gym name">
                    <Input
                      id="studio-name"
                      maxLength={100}
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </Field>
                  {textField('branding', 'tagline', 'Tagline', draft.branding?.tagline, 160)}
                  <Field
                    id="studio-description"
                    label="About your gym"
                    hint={`${draft.branding?.description?.length ?? 0} / 2000 characters`}
                  >
                    <textarea
                      id="studio-description"
                      rows={5}
                      maxLength={2000}
                      className="border-input bg-field w-full rounded-xl border p-3 text-sm"
                      value={draft.branding?.description ?? ''}
                      onChange={(e) => field('branding', 'description', e.target.value)}
                    />
                  </Field>
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Palette className="size-4" /> Brand palette
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PALETTES.map(([label, color]) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`${label} palette`}
                          aria-pressed={draft.branding?.accentColor === color}
                          onClick={() => field('branding', 'accentColor', color)}
                          className={cn(
                            'rounded-xl border p-2 text-xs',
                            draft.branding?.accentColor === color && 'ring-primary ring-2',
                          )}
                        >
                          <span
                            className="mb-1 block h-7 w-12 rounded-lg"
                            style={{ backgroundColor: color }}
                          />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <Input
                      aria-label="Pick brand color"
                      type="color"
                      className="w-16 p-1"
                      value={
                        /^#[0-9a-f]{6}$/i.test(draft.branding?.accentColor ?? '')
                          ? draft.branding!.accentColor
                          : '#8ad200'
                      }
                      onChange={(e) => field('branding', 'accentColor', e.target.value)}
                    />
                    <Field id="studio-accent" label="Custom accent" className="flex-1">
                      <Input
                        id="studio-accent"
                        maxLength={7}
                        value={draft.branding?.accentColor ?? ''}
                        onChange={(e) => field('branding', 'accentColor', e.target.value)}
                      />
                    </Field>
                  </div>
                  {textField(
                    'branding',
                    'logoUrl',
                    'Logo image URL (HTTPS)',
                    draft.branding?.logoUrl,
                    2048,
                    'url',
                  )}
                  {textField(
                    'branding',
                    'coverUrl',
                    'Cover image URL (HTTPS)',
                    draft.branding?.coverUrl,
                    2048,
                    'url',
                  )}
                  <p className="text-muted-foreground text-xs">
                    Use publicly accessible images you own or have permission to use. Square logos
                    and wide cover photos work best. Clear a URL to remove it. Text contrast adjusts
                    automatically.
                  </p>
                  <BrandControls
                    name={draft.name}
                    value={draft.branding ?? {}}
                    onChange={(branding) => setDraft((d) => ({ ...d, branding }))}
                    onProcessingChange={setProcessingLogo}
                  />
                </TabsContent>
                <TabsContent value="contact" className="mt-5 space-y-4">
                  <p className="text-muted-foreground text-xs">
                    These details are public. Never add a private staff contact.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {textField('contact', 'phone', 'Phone', draft.contact?.phone, 80, 'tel')}
                    {textField(
                      'contact',
                      'email',
                      'Public email',
                      draft.contact?.email,
                      254,
                      'email',
                    )}
                    {textField(
                      'contact',
                      'instagram',
                      'Instagram handle',
                      draft.contact?.instagram,
                      80,
                    )}
                    {textField(
                      'contact',
                      'whatsapp',
                      'WhatsApp number',
                      draft.contact?.whatsapp,
                      80,
                      'tel',
                    )}
                  </div>
                  {textField('location', 'address', 'Street address', draft.location?.address)}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {textField('location', 'city', 'City', draft.location?.city)}
                    {textField('location', 'country', 'Country', draft.location?.country)}
                  </div>
                </TabsContent>
                <TabsContent value="hours" className="mt-5 space-y-4">
                  <div>
                    <h3 className="font-semibold">Weekly opening hours</h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Uncheck a day to mark it closed. Times are local to the gym; overnight hours
                      are not supported yet.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        hours: {
                          ...d.hours,
                          ...Object.fromEntries(
                            [2, 3, 4, 5].map((day) => [
                              day,
                              d.hours?.[1] ? { ...d.hours[1] } : null,
                            ]),
                          ),
                        },
                      }))
                    }
                  >
                    Copy Monday to weekdays
                  </Button>
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                    const h = draft.hours?.[day];
                    return (
                      <div
                        key={day}
                        className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
                      >
                        <label className="flex w-28 items-center gap-2 text-sm">
                          <Checkbox
                            checked={!!h}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                hours: {
                                  ...d.hours,
                                  [day]: e.target.checked
                                    ? { open: '09:00', close: '21:00' }
                                    : null,
                                },
                              }))
                            }
                          />
                          {WEEKDAYS[day]}
                        </label>
                        {h ? (
                          <div className="flex items-center gap-1">
                            <Input
                              className="w-28"
                              type="time"
                              aria-label={`${WEEKDAYS[day]} opens`}
                              value={h.open}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  hours: { ...d.hours, [day]: { ...h, open: e.target.value } },
                                }))
                              }
                            />
                            <span className="text-muted-foreground">–</span>
                            <Input
                              className="w-28"
                              type="time"
                              aria-label={`${WEEKDAYS[day]} closes`}
                              value={h.close}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  hours: { ...d.hours, [day]: { ...h, close: e.target.value } },
                                }))
                              }
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </TabsContent>
              </fieldset>
            </Tabs>
          </CardContent>
        </Card>
        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              Live preview · unpublished
            </p>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant={device === 'desktop' ? 'secondary' : 'ghost'}
                onClick={() => setDevice('desktop')}
                aria-label="Wide preview"
                aria-pressed={device === 'desktop'}
              >
                <Monitor />
              </Button>
              <Button
                size="icon"
                variant={device === 'mobile' ? 'secondary' : 'ghost'}
                onClick={() => setDevice('mobile')}
                aria-label="Mobile preview"
                aria-pressed={device === 'mobile'}
              >
                <Smartphone />
              </Button>
            </div>
          </div>
          <div
            className={cn(
              'bg-card mx-auto space-y-4 rounded-3xl border p-3 transition-all',
              device === 'mobile' && 'max-w-[360px]',
            )}
          >
            <StorefrontHero preview gym={{ ...gym, ...draft }} />
            <GymGallery gym={{ ...gym, ...draft }} />
            {draft.branding?.description && (
              <p className="text-muted-foreground px-3 text-sm break-words whitespace-pre-wrap">
                {draft.branding.description}
              </p>
            )}
            <div className="space-y-1 px-3 text-sm">
              {[
                draft.location?.address,
                [draft.location?.city, draft.location?.country].filter(Boolean).join(', '),
                draft.contact?.phone,
                draft.contact?.email,
                draft.contact?.instagram,
                draft.contact?.whatsapp ? `WhatsApp: ${draft.contact.whatsapp}` : '',
              ]
                .filter(Boolean)
                .map((line, i) => (
                  <p key={i} className="break-words">
                    {line}
                  </p>
                ))}
            </div>
            <div className="px-3 pb-3 text-xs">
              <p className="mb-2 font-semibold">Opening hours</p>
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <p key={day} className="text-muted-foreground flex justify-between py-1">
                  <span>{WEEKDAYS[day]}</span>
                  <span>
                    {draft.hours?.[day]
                      ? `${draft.hours[day]!.open} – ${draft.hours[day]!.close}`
                      : 'Closed'}
                  </span>
                </p>
              ))}
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tenant identity</CardTitle>
              <CardDescription>
                /{gym.slug} · {gym.status} · {gym.tenantPlanId}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              Slug, owner, lifecycle and platform subscription remain platform-managed. This editor
              only updates your public profile.
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="bg-card/95 sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur">
        <div>
          <p className="text-sm font-semibold">
            {readonly
              ? 'Read-only preview'
              : dirty
                ? 'You have unpublished changes'
                : 'Your storefront is up to date'}
          </p>
          <p className="text-muted-foreground text-xs">
            {t.mode === 'demo'
              ? 'Demo changes last for this session only.'
              : 'Publishing updates your public gym page.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!dirty || busy || processingLogo}
            onClick={() => {
              setDraft(baseline);
              setErrors([]);
            }}
          >
            <RotateCcw /> Discard
          </Button>
          <Button disabled={!dirty || busy || readonly || processingLogo} onClick={save}>
            <Save />
            {busy ? 'Publishing…' : 'Publish changes'}
          </Button>
        </div>
        {errors.length > 0 && (
          <ul role="alert" className="w-full space-y-1 text-sm text-red-600">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
