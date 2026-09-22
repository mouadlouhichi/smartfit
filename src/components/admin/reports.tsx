'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, ArrowRight, Clock, MapPin, Phone } from 'lucide-react';
import { useAdmin } from '@/lib/admin-context';
import {
  invoicesByMethod,
  monthBuckets,
  relativeTime,
  type PlatformInvoice,
} from '@/lib/admin-model';
import { formatMoney } from '@/lib/tenant-metrics';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { BarChart, HBars } from './charts';

export function RevenueAnalytics() {
  const { data } = useAdmin();
  const [days, setDays] = useState('180');
  const [method, setMethod] = useState('all');
  const [currency, setCurrency] = useState('MAD');
  const [query, setQuery] = useState('');
  const now = Date.now();
  const rows = data.invoices
    .filter(
      (i) =>
        (days === 'all' || i.paidAt >= now - Number(days) * 86400000) &&
        i.paidAt <= now &&
        i.currency === currency &&
        (method === 'all' || i.method === method) &&
        `${i.slug} ${data.gyms.find((g) => g.slug === i.slug)?.name ?? ''} ${i.note ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.paidAt - a.paidAt);
  const buckets = monthBuckets(
    rows,
    6,
    (i) => i.paidAt,
    (i) => i.amountMinor,
  );
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Collections explorer</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Filter the latest 100 recorded payments. Currencies are never combined.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(
              'smartfit-payments.csv',
              toCsv(rows, [
                { header: 'Invoice ID', value: (i) => i.id },
                { header: 'Gym', value: (i) => i.slug },
                { header: 'Paid at (UTC)', value: (i) => new Date(i.paidAt).toISOString() },
                { header: 'Amount', value: (i) => (i.amountMinor / 100).toFixed(2) },
                { header: 'Currency', value: (i) => i.currency },
                { header: 'Method', value: (i) => i.method },
                { header: 'Note', value: (i) => i.note },
              ]),
            )
          }
        >
          <Download /> Export payments
        </Button>
      </header>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-44 flex-1"
          aria-label="Search payments"
          placeholder="Gym or payment note…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          aria-label="Payment period"
          className="w-auto"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 180 days</option>
          <option value="all">All loaded dates</option>
        </Select>
        <Select
          aria-label="Payment currency"
          className="w-auto"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {[...new Set(['MAD', ...data.invoices.map((i) => i.currency)])].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Payment method"
          className="w-auto"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="all">All methods</option>
          {['cash', 'transfer', 'card', 'cmi', 'other'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>
              {formatMoney(
                rows.reduce((s, i) => s + i.amountMinor, 0),
                currency,
              )}
            </CardTitle>
            <CardDescription>
              {rows.length} matching payments · chart shows the last six calendar months only
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={buckets.map((b) => ({ label: b.label, value: b.total }))}
              formatValue={(v) => formatMoney(v, currency)}
              ariaLabel={`Monthly collections in ${currency}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment mix</CardTitle>
            <CardDescription>Matching collections by method</CardDescription>
          </CardHeader>
          <CardContent>
            <HBars
              data={invoicesByMethod(rows).map((m) => ({ label: m.method, value: m.totalMinor }))}
              formatValue={(v) => formatMoney(v, currency)}
            />
          </CardContent>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                {['Gym', 'Paid', 'Method', 'Amount', 'Note'].map((h) => (
                  <th className="px-4 py-3" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link className="font-medium hover:underline" href={`/admin/gyms/${i.slug}`}>
                      {data.gyms.find((g) => g.slug === i.slug)?.name ?? i.slug}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(i.paidAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{i.method}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap tabular-nums">
                    {formatMoney(i.amountMinor, i.currency)}
                  </td>
                  <td className="max-w-64 px-4 py-3 text-xs break-words">{i.note || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground p-8 text-center">
                    No payments match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function GymOperations({ slug }: { slug: string }) {
  const admin = useAdmin();
  const toast = useToast();
  const [method, setMethod] = useState<PlatformInvoice['method']>('transfer');
  const [note, setNote] = useState('');
  const gym = admin.data.gyms.find((g) => g.slug === slug);
  if (!gym) return null;
  const plan = admin.data.plans.find((p) => p.id === gym.tenantPlanId);
  const entries = admin.data.audit
    .filter((e) => e.target === slug || e.meta?.slug === slug)
    .slice(0, 8);
  async function pay() {
    if (await admin.recordPayment(slug, { method, note })) {
      toast('Payment recorded', 'success');
      setNote('');
    } else toast('Could not record payment. Check the error above.', 'info');
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Public profile</CardTitle>
          <CardDescription>What this gym has published to its storefront</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div
            className="bg-muted/40 rounded-xl border-l-4 p-4"
            style={{ borderColor: gym.accentColor || '#8ad200' }}
          >
            <p className="font-bold">{gym.name}</p>
            <p className="text-muted-foreground mt-1">{gym.tagline || 'No tagline set yet'}</p>
          </div>
          <p className="flex gap-2">
            <MapPin className="size-4 shrink-0" />
            {[gym.address, gym.city].filter(Boolean).join(', ') || 'No address published'}
          </p>
          <p className="flex gap-2">
            <Phone className="size-4 shrink-0" />
            {gym.phone || gym.email || 'No public contact set'}
          </p>
          <p className="flex gap-2">
            <Clock className="size-4 shrink-0" />
            {gym.openDays ?? 0} days with published opening hours
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/g/${slug}`}>
              Open storefront <ArrowRight />
            </Link>
          </Button>
          <p className="text-muted-foreground text-xs">
            Owners can customize their storefront in Gym console → Settings.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Record subscription payment</CardTitle>
          <CardDescription>
            {plan
              ? `${formatMoney(plan.monthlyPriceMinor, plan.currency)} · ${plan.name} · one plan payment`
              : 'Assign a known platform plan first.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-xs font-medium" htmlFor="detail-method">
            Payment method
          </label>
          <Select
            id="detail-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PlatformInvoice['method'])}
          >
            {['transfer', 'cash', 'card', 'cmi', 'other'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <label className="block text-xs font-medium" htmlFor="detail-note">
            Reference / note
          </label>
          <Input
            id="detail-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. bank transfer reference"
          />
          <Button disabled={admin.mutating !== null || !plan} onClick={pay}>
            Record received payment
          </Button>
          <p className="text-muted-foreground text-xs">
            Records money already received; does not charge a card or send an invoice.
          </p>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Gym activity</CardTitle>
          <CardDescription>
            Matching events from the latest 50 platform audit entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No recent events in the loaded audit window.
            </p>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm last:border-0"
            >
              <span>
                <Badge variant="secondary">{e.action}</Badge>
                <span className="text-muted-foreground ml-3 text-xs">{e.actorUid}</span>
              </span>
              <span
                className="text-muted-foreground text-xs"
                title={new Date(e.at).toLocaleString()}
              >
                {relativeTime(e.at)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
