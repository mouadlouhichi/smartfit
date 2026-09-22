'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  canReadCoaching,
  canWriteCoaching,
  roleLabel,
  type CoachingAssignment,
  type Role,
} from '@smartfit/core';
import { demoFixture, demoPersonaUid } from '@/lib/tenant-demo';
import { useGymAccessWatch } from '@/lib/gym-access-watch';
import { useFeatureData } from '@/lib/feature-client';
import { Button } from '@/components/ui/button';
import { WorkspaceIllustration } from '@/components/ui/artwork';
import { Input } from '@/components/ui/input';
import { ConfirmProvider, useConfirm } from '@/components/dashboard/confirm-context';
import { useModals } from '@/components/dashboard/modal-context';
import { FeatureShell } from './shell';
interface CoachingData {
  role: Role;
  uid: string;
  items: CoachingAssignment[];
  roster: { uid: string; role: string; displayName: string; active: boolean }[];
}
const control = 'bg-background w-full rounded-xl border p-3 text-sm';
export function MemberCoaching({ slug }: { slug: string }) {
  const { openWith } = useModals();
  return (
    <CoachingWorkspace
      slug={slug}
      onStart={(item) =>
        openWith({
          kind: 'runner',
          title: item.title,
          categoryId: 'cat-strength',
          intensity: 'moderate',
          exercises: structuredClone(item.exercises),
        })
      }
    />
  );
}
type CoachingProps = { slug: string; onStart?: (item: CoachingAssignment) => void };
export function CoachingWorkspace(props: CoachingProps) {
  return (
    <ConfirmProvider>
      <CoachingContent {...props} />
    </ConfirmProvider>
  );
}
function CoachingContent({
  slug,
  onStart,
}: {
  slug: string;
  onStart?: (item: CoachingAssignment) => void;
}) {
  const confirm = useConfirm();
  const demo = useMemo<CoachingData>(() => {
    const fixture = demoFixture(slug);
    return {
      role: 'gym-owner',
      uid: fixture?.gym.ownerUid ?? 'demo-owner',
      items: [],
      roster:
        fixture?.roster.map((m) => ({
          uid: m.uid,
          role: m.role,
          displayName: m.displayName ?? 'Member',
          active:
            ['active', 'trial'].includes(m.status) && (!m.expiresAt || m.expiresAt > Date.now()),
        })) ?? [],
    };
  }, [slug]);
  const access = useGymAccessWatch(slug);
  const resource = useFeatureData(
    `/api/coaching?gym=${encodeURIComponent(slug)}`,
    demo,
    `smartfit.demo.coaching.${slug}`,
    false,
    access.key,
  );
  const [demoRole, setDemoRole] = useState<Role>(onStart ? 'member' : 'gym-owner');
  const role = resource.mode === 'local' ? demoRole : resource.data.role;
  const uid =
    resource.mode === 'local'
      ? demoRole === 'gym-owner'
        ? demo.uid
        : demoRole === 'member'
          ? (demoPersonaUid(slug, 'member') ?? 'demo-member')
          : (resource.data.roster.find(
              (m) => m.role === (demoRole === 'gym-trainer' ? 'trainer' : 'staff'),
            )?.uid ?? 'demo-no-membership')
      : resource.data.uid;
  const owner = role === 'gym-owner' || role === 'platform-admin';
  const [memberUid, setMemberUid] = useState('');
  const [trainerUid, setTrainerUid] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [routineTitle, setRoutineTitle] = useState('');
  const [exercise, setExercise] = useState('');
  const [reps, setReps] = useState(8);
  const [sets, setSets] = useState(2);
  const items = resource.data.items.filter((i) => canReadCoaching(uid, role, i));
  const current = items.find((i) => i.id === selected);
  async function act(
    body: Record<string, unknown>,
    demoUpdate: (data: CoachingData) => CoachingData,
  ) {
    setNotice('');
    const ok = await resource.request({ ...body, gym: slug }, () => demoUpdate(resource.data));
    if (ok) {
      setNotice('Saved.');
      setMessage('');
    }
    return ok;
  }
  async function assign() {
    const previous = resource.data.items.find((i) => i.memberUid === memberUid);
    if (
      previous &&
      !(await confirm({
        title: 'Replace this coaching assignment?',
        body: 'The previous routine and conversation will be deleted. The member must accept the new assignment.',
        confirmLabel: 'Replace assignment',
        destructive: true,
      }))
    )
      return;
    await act({ action: 'assign', memberUid, trainerUid, version: previous?.version }, (data) => {
      const now = Date.now();
      const item: CoachingAssignment = {
        id: memberUid,
        gymId: slug,
        memberUid,
        trainerUid,
        memberName: data.roster.find((m) => m.uid === memberUid)?.displayName ?? 'Member',
        trainerName: data.roster.find((m) => m.uid === trainerUid)?.displayName ?? 'Trainer',
        consent: 'pending',
        title: '',
        exercises: [],
        messages: [],
        version: (previous?.version ?? 0) + 1,
        createdAt: now,
        updatedAt: now,
      };
      return { ...data, items: [item, ...data.items.filter((i) => i.memberUid !== memberUid)] };
    });
  }
  async function change(
    action: string,
    patch: Record<string, unknown>,
    update: (item: CoachingAssignment) => CoachingAssignment,
  ) {
    if (!current) return;
    return act(
      { action, memberUid: current.memberUid, version: current.version, ...patch },
      (data) => ({
        ...data,
        items:
          action === 'remove'
            ? data.items.filter((i) => i.id !== current.id)
            : data.items.map((i) =>
                i.id === current.id
                  ? { ...update(i), version: i.version + 1, updatedAt: Date.now() }
                  : i,
              ),
      }),
    );
  }
  return (
    <FeatureShell
      title="Coaching workspace"
      description="Assign a trainer, invite member consent and keep routines and feedback within this gym. Private fitness history is never shared here."
      {...resource}
      loading={resource.loading || !access.ready}
      error={resource.error ?? access.error}
    >
      {!resource.error && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" asChild>
              <Link href={`/g/${slug}`}>Back to gym</Link>
            </Button>
            <span className="text-sm font-bold">{roleLabel(role)}</span>
            {resource.mode === 'local' && (
              <label className="text-sm">
                Demo coaching persona
                <select
                  aria-label="Demo coaching persona"
                  className={control}
                  value={demoRole}
                  onChange={(e) => {
                    setDemoRole(e.target.value as Role);
                    setSelected('');
                  }}
                >
                  {(['gym-owner', 'gym-staff', 'gym-trainer', 'member'] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {notice && <p role="status">{notice}</p>}
          {owner && (
            <>
              <section className="bg-card space-y-3 rounded-2xl border p-5">
                <h2 className="font-bold">Assign a trainer</h2>
                <p className="text-muted-foreground text-sm">
                  Reassignment resets consent and removes the previous routine and conversation. The
                  member must accept before coaching begins.
                </p>
                <div className="grid items-end gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    Member
                    <select
                      aria-label="Member"
                      className={control}
                      value={memberUid}
                      onChange={(e) => setMemberUid(e.target.value)}
                    >
                      <option value="">Choose a member</option>
                      {resource.data.roster
                        .filter((m) => m.role === 'member' && m.active)
                        .map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.displayName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Trainer
                    <select
                      aria-label="Trainer"
                      className={control}
                      value={trainerUid}
                      onChange={(e) => setTrainerUid(e.target.value)}
                    >
                      <option value="">Choose a trainer</option>
                      {resource.data.roster
                        .filter((m) => m.role === 'trainer' && m.active)
                        .map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.displayName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    disabled={!memberUid || !trainerUid || resource.busy}
                    onClick={() => void assign()}
                  >
                    Assign trainer
                  </Button>
                </div>
              </section>
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold">Manage team access</h3>
                <p className="text-muted-foreground my-3 text-sm">
                  Grant or remove trainer and staff access in the gym console. Changes require
                  confirmation and are recorded in the gym audit trail.
                </p>
                <Button asChild variant="outline">
                  <a href={`/g/${slug}/console?tab=staff`}>Open team manager</a>
                </Button>
              </div>
            </>
          )}
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-3">
              <h2 className="font-bold">Assignments</h2>
              {items.length === 0 && (
                <p className="text-muted-foreground rounded-xl border border-dashed p-5">
                  No assignments yet. Your gym owner can assign a trainer.
                </p>
              )}
              {items.map((i) => (
                <button
                  type="button"
                  aria-pressed={selected === i.id}
                  key={i.id}
                  onClick={() => {
                    setSelected(i.id);
                    setRoutineTitle(i.title);
                    setExercise('');
                  }}
                  className="bg-card hover:border-primary w-full rounded-xl border p-4 text-left"
                >
                  <span className="block font-bold">{i.memberName}</span>
                  <span className="text-muted-foreground text-xs">
                    {i.trainerName} · {i.consent}
                  </span>
                </button>
              ))}
            </aside>
            <section className="bg-card space-y-4 rounded-2xl border p-5">
              {current ? (
                <>
                  <h2 className="text-xl font-bold">
                    {current.memberName} & {current.trainerName}
                  </h2>
                  {current.memberUid === uid && (
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-sm">
                        Accept to exchange routines and messages with this trainer. The gym owner
                        and staff can read this conversation. No personal logs or body measurements
                        are shared. You can remove the assignment and its conversation at any time.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {current.consent !== 'accepted' && (
                          <Button
                            disabled={resource.busy}
                            onClick={() =>
                              void change('consent', { consent: 'accepted' }, (i) => ({
                                ...i,
                                consent: 'accepted',
                              }))
                            }
                          >
                            Accept coaching
                          </Button>
                        )}
                        {current.consent !== 'declined' && (
                          <Button
                            variant="outline"
                            disabled={resource.busy}
                            onClick={() =>
                              void change('consent', { consent: 'declined' }, (i) => ({
                                ...i,
                                consent: 'declined',
                              }))
                            }
                          >
                            Decline / pause coaching
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {(owner || current.memberUid === uid) && (
                    <Button
                      variant="outline"
                      disabled={resource.busy}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: 'Remove coaching assignment?',
                            body: 'This deletes the assignment, routine and conversation.',
                            confirmLabel: 'Remove assignment',
                            destructive: true,
                          })
                        )
                          void change('remove', {}, (i) => i);
                      }}
                    >
                      Remove assignment
                    </Button>
                  )}
                  {current.title && (
                    <div className="rounded-xl border p-4">
                      <h3 className="font-bold">{current.title}</h3>
                      <ul className="my-3 text-sm">
                        {current.exercises.map((x, i) => (
                          <li key={i}>
                            {x.name} · {x.sets.length} × {x.sets[0]?.reps}
                          </li>
                        ))}
                      </ul>
                      {current.memberUid === uid &&
                        current.consent === 'accepted' &&
                        (onStart ? (
                          <Button onClick={() => onStart(current)}>Start assigned routine</Button>
                        ) : (
                          <Button asChild>
                            <Link href={`/dashboard/coaching?gym=${slug}`}>
                              Open in my training workspace
                            </Link>
                          </Button>
                        ))}
                    </div>
                  )}
                  {canWriteCoaching(uid, role, current) && current.memberUid !== uid && (
                    <form
                      className="space-y-3 rounded-xl border p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const routine = {
                          title: routineTitle,
                          exercises: [
                            ...current.exercises,
                            {
                              name: exercise,
                              sets: Array.from({ length: sets }, () => ({ reps })),
                            },
                          ],
                        };
                        void change('routine', { routine }, (i) => ({ ...i, ...routine }));
                      }}
                    >
                      <h3 className="font-bold">Build assigned routine</h3>
                      <label className="block text-sm">
                        Routine title
                        <Input
                          required
                          minLength={2}
                          maxLength={100}
                          value={routineTitle}
                          onChange={(e) => setRoutineTitle(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        Exercise to add
                        <Input
                          required
                          minLength={2}
                          maxLength={100}
                          value={exercise}
                          onChange={(e) => setExercise(e.target.value)}
                        />
                      </label>
                      <div className="flex gap-3">
                        <label className="text-sm">
                          Sets
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            required
                            value={sets}
                            onChange={(e) =>
                              setSets(Math.min(10, Math.max(1, Number(e.target.value))))
                            }
                          />
                        </label>
                        <label className="text-sm">
                          Repetitions
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            required
                            value={reps}
                            onChange={(e) => setReps(Number(e.target.value))}
                          />
                        </label>
                      </div>
                      <Button disabled={resource.busy || current.exercises.length >= 30}>
                        Add exercise & save routine
                      </Button>
                    </form>
                  )}
                  <div className="space-y-3">
                    {current.messages.map((m) => (
                      <article key={m.id} className="rounded-xl border p-4">
                        <p className="text-muted-foreground mb-2 text-xs">
                          {m.authorUid === current.memberUid ? current.memberName : 'Coaching team'}{' '}
                          · {new Date(m.at).toLocaleString()}
                        </p>
                        <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
                      </article>
                    ))}
                  </div>
                  {canWriteCoaching(uid, role, current) && current.messages.length < 100 && (
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void change('feedback', { message }, (i) => ({
                          ...i,
                          messages: [
                            ...i.messages,
                            {
                              id: crypto.randomUUID(),
                              authorUid: uid,
                              body: message.trim(),
                              at: Date.now(),
                            },
                          ],
                        }));
                      }}
                    >
                      <label className="block text-sm">
                        Feedback
                        <textarea
                          className={control}
                          required
                          maxLength={2000}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                      </label>
                      <Button disabled={resource.busy || !message.trim()}>Send feedback</Button>
                    </form>
                  )}
                </>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <WorkspaceIllustration kind="coaching" />
                  <p className="text-muted-foreground">
                    Choose an assignment to see consent, routines and feedback.
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </FeatureShell>
  );
}
