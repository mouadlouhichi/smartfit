'use client';
import { useState, type FormEvent } from 'react';
import {
  SUPPORT_CATEGORIES,
  TICKET_STATES,
  ticketTransition,
  validateTicket,
  type SupportTicket,
  type TicketState,
} from '@smartfit/core';
import { Button } from '@/components/ui/button';
import { WorkspaceIllustration } from '@/components/ui/artwork';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFeatureData } from '@/lib/feature-client';
import { DEMO_SUPPORT } from '@/lib/feature-demo';
import { FeatureShell } from './shell';
const control = 'border-input bg-field w-full rounded-xl border p-3 text-sm';
export function SupportWorkspace() {
  const resource = useFeatureData('/api/support', DEMO_SUPPORT, 'smartfit.demo.support');
  const [demoStaff, setDemoStaff] = useState(false);
  const staff =
    ['platform-admin', 'support-agent'].includes(resource.data.role) ||
    (resource.mode === 'local' && demoStaff);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState<string>(SUPPORT_CATEGORIES[0]);
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState('');
  const ticket = resource.data.items.find((t) => t.id === selected);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidation('');
    setNotice('');
    const form = e.currentTarget;
    // `category` comes from state — the design-system Select is a button and
    // contributes nothing to a form submission.
    const input = { ...Object.fromEntries(new FormData(form)), category };
    try {
      const valid = validateTicket(input);
      const ok = await resource.request({ action: 'create', ...valid }, () => {
        const now = Date.now();
        const id = crypto.randomUUID();
        const item: SupportTicket = {
          id,
          ownerUid: resource.data.uid,
          category: valid.category,
          subject: valid.subject,
          status: 'open',
          messages: [
            {
              id: crypto.randomUUID(),
              authorUid: resource.data.uid,
              staff: false,
              body: valid.message,
              at: now,
            },
          ],
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        return { ...resource.data, items: [item, ...resource.data.items] };
      });
      if (ok) {
        form.reset();
        setNotice('Ticket created. You can follow the conversation here.');
      }
    } catch (e) {
      setValidation(e instanceof Error ? e.message : 'Check the form.');
    }
  }
  async function update(action: 'reply' | 'status', status?: TicketState) {
    if (!ticket) return;
    setNotice('');
    setValidation('');
    const ok = await resource.request(
      { action, id: ticket.id, version: ticket.version, message: reply, status },
      () => {
        const item: SupportTicket = {
          ...ticket,
          version: ticket.version + 1,
          updatedAt: Date.now(),
          ...(action === 'status'
            ? { status: status! }
            : {
                status: staff ? 'waiting-for-user' : 'open',
                messages: [
                  ...ticket.messages,
                  {
                    id: crypto.randomUUID(),
                    authorUid: staff ? 'demo-agent' : resource.data.uid,
                    staff,
                    body: reply.trim(),
                    at: Date.now(),
                  },
                ],
              }),
        };
        return {
          ...resource.data,
          items: resource.data.items.map((t) => (t.id === item.id ? item : t)),
        };
      },
    );
    if (ok) {
      setReply('');
      setNotice(action === 'reply' ? 'Reply sent.' : 'Ticket status updated.');
    }
  }
  function exportTickets() {
    const mine = resource.data.items.filter((t) => t.ownerUid === resource.data.uid);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), tickets: mine }, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartfit-support.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  const visible = resource.data.items.filter(
    (t) =>
      (staff || t.ownerUid === resource.data.uid) &&
      (filter === 'all' || t.status === filter) &&
      `${t.subject} ${t.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <FeatureShell
      title={staff ? 'Support inbox' : 'How can we help?'}
      description={
        staff
          ? 'Manage conversations without access to private fitness histories or billing credentials.'
          : 'Open a ticket and keep the conversation in one place. Never include passwords, payment details or medical records.'
      }
      {...resource}
    >
      {!resource.error && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {/* The label text is the Checkbox's own label, so the accessible
                name stays exactly "Preview support-agent persona (demo only)". */}
            {resource.mode === 'local' && (
              <Checkbox
                checked={demoStaff}
                onChange={(e) => {
                  setDemoStaff(e.target.checked);
                  setSelected(null);
                }}
                label="Preview support-agent persona (demo only)"
              />
            )}
            <Button variant="outline" onClick={exportTickets}>
              Export my loaded tickets
            </Button>
            <p className="text-muted-foreground text-xs">
              Account deletion removes your support conversations.
            </p>
          </div>
          {notice && <p role="status">{notice}</p>}
          {validation && (
            <p role="alert" className="text-destructive">
              {validation}
            </p>
          )}
          {!staff && (
            <form onSubmit={create} className="bg-card space-y-3 rounded-2xl border p-5">
              <h2 className="font-bold">Open a support ticket</h2>
              <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <Field id="ticket-subject" label="Subject">
                  <Input name="subject" required minLength={3} maxLength={120} />
                </Field>
                <Field id="ticket-category" label="Category">
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {SUPPORT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <label className="block text-sm">
                What happened?
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                  className={control}
                />
              </label>
              <Button disabled={resource.busy}>Create ticket</Button>
            </form>
          )}
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-3">
              <label className="block text-sm">
                Find a ticket
                <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <Field id="ticket-filter" label="Status filter">
                <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {TICKET_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="text-muted-foreground text-xs">
                {visible.length} shown · up to 100 loaded
              </p>
              {visible.length === 0 && (
                <p className="rounded-xl border border-dashed p-5 text-sm">
                  No tickets match this view.
                </p>
              )}
              {visible.map((t) => (
                <button
                  type="button"
                  className="bg-card hover:border-primary w-full rounded-xl border p-4 text-left"
                  key={t.id}
                  onClick={() => {
                    setSelected(t.id);
                    setReply('');
                  }}
                  aria-pressed={selected === t.id}
                >
                  <span className="block font-bold">{t.subject}</span>
                  <span className="text-muted-foreground text-xs">
                    {t.category} · {t.status} · {t.messages.length} messages
                  </span>
                </button>
              ))}
            </aside>
            <section aria-label="Conversation" className="bg-card rounded-2xl border p-5">
              {ticket ? (
                <>
                  <h2 className="text-xl font-bold">{ticket.subject}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">{ticket.status}</p>
                  <div className="my-5 space-y-3">
                    {ticket.messages.map((m) => (
                      <article
                        key={m.id}
                        className={`rounded-xl border p-4 ${m.staff ? 'bg-primary/5' : ''}`}
                      >
                        <p className="text-muted-foreground mb-2 text-xs">
                          {m.staff ? 'SmartFit support' : 'Member'} ·{' '}
                          {new Date(m.at).toLocaleString()}
                        </p>
                        <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
                      </article>
                    ))}
                  </div>
                  {ticket.status !== 'closed' && ticket.messages.length < 100 && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void update('reply');
                      }}
                      className="space-y-3"
                    >
                      <label className="block text-sm">
                        Your reply
                        <textarea
                          className={control}
                          required
                          maxLength={2000}
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                        />
                      </label>
                      <Button disabled={resource.busy || !reply.trim()}>Send reply</Button>
                    </form>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                    {TICKET_STATES.filter((s) => ticketTransition(ticket.status, s, staff)).map(
                      (s) => (
                        <Button
                          key={s}
                          variant="outline"
                          disabled={resource.busy}
                          onClick={() => void update('status', s)}
                        >
                          {s === 'open' ? 'Reopen' : `Mark ${s}`}
                        </Button>
                      ),
                    )}
                  </div>
                </>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <WorkspaceIllustration kind="support" />
                  <p className="text-muted-foreground">Select a ticket to view its conversation.</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </FeatureShell>
  );
}
