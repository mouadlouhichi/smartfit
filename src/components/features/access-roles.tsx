'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/firebase/auth-context';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
export function AccessRoles() {
  const { user, mode } = useAuth();
  const [role, setRole] = useState('content-manager');
  const [action, setAction] = useState('grant');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const form = new FormData(e.currentTarget);
    // `action` is state, not FormData: the design-system Select is a button and
    // contributes no value to a form submission.
    const grant = action === 'grant';
    try {
      if (mode === 'local') {
        setNotice('Demo only: no account claims were changed.');
        return;
      }
      if (!user) throw new Error('Sign in as a platform administrator.');
      const response = await fetch('/api/admin/claims', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await user.getIdToken()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ uid: form.get('uid'), role, grant }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Could not update role.');
      setNotice(
        body.revocationNote ??
          'Role assigned. Ask the account holder to sign out and back in to open their dedicated workspace.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update role.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black">Platform access roles</h1>
        <p className="text-muted-foreground mt-2">
          Specialist accounts get focused workspaces, not blanket administrator access. Gym owners
          manage staff and trainers from their coaching workspace.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/studio" className="rounded-xl border p-4 font-semibold">
          Content studio →
        </Link>
        <Link href="/support" className="rounded-xl border p-4 font-semibold">
          Support inbox →
        </Link>
      </div>
      <form className="bg-card space-y-4 rounded-2xl border p-5" onSubmit={submit}>
        <Field id="claims-uid" label="Firebase account UID">
          <Input name="uid" required maxLength={128} placeholder="Existing account UID" />
        </Field>
        <Field id="claims-role" label="Platform role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="content-manager">Content manager — publishing only</option>
            <option value="support-agent">Support agent — support conversations only</option>
            <option value="platform-admin">
              Platform administrator — full platform operations
            </option>
          </Select>
        </Field>
        <Field id="claims-action" label="Action">
          <Select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="grant">Assign selected role (replaces current platform role)</option>
            <option value="revoke">Remove platform role</option>
          </Select>
        </Field>
        <p className="text-muted-foreground text-sm">
          A subscription never grants an operational role. Self-demotion is blocked. Grants and
          removals are recorded in the platform audit log.
        </p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <Button disabled={busy}>{busy ? 'Updating…' : 'Update access'}</Button>
      </form>
    </section>
  );
}
