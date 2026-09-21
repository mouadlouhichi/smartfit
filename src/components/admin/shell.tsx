'use client';

/**
 * The admin shell: the gate, the nav, the banners.
 *
 * ## The gate, and what it is not
 *
 * The client-side `sfRole` check below decides what *renders*. It is UX, not
 * security: every `/api/admin/*` route re-verifies the claim from the decoded
 * token before doing anything, because the claim on a stale token is exactly
 * what an attacker would forge first. A visitor who talks straight to the API
 * without being an operator gets a 403 and no data.
 *
 * ## Claim staleness, handled visibly
 *
 * Claims are baked into ID tokens and can lag a grant by up to an hour. A
 * freshly promoted operator therefore sees "no access" until the token
 * refreshes — so the refusal card offers a *Recheck* button that forces
 * `getIdToken(true)` instead of leaving them to wonder.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ScrollText,
  Settings2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useAuth } from '@/lib/firebase/auth-context';
import { AdminProvider, useAdmin } from '@/lib/admin-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: 'pending';
}

const NAV: readonly NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/gyms', label: 'Gyms', icon: Users },
  { href: '/admin/applications', label: 'Applications', icon: ClipboardList, badge: 'pending' },
  { href: '/admin/plans', label: 'Plans', icon: Settings2 },
  { href: '/admin/revenue', label: 'Revenue', icon: Banknote },
  { href: '/admin/audit', label: 'Audit', icon: ScrollText },
];

function Nav() {
  const pathname = usePathname();
  const { data } = useAdmin();
  const pending = data.applications.filter((a) => a.status === 'pending').length;

  return (
    <nav className="flex flex-wrap gap-1" aria-label="Platform admin">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'hover:bg-secondary flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon className="size-3.5" />
            {item.label}
            {item.badge === 'pending' && pending > 0 && (
              <Badge className="bg-amber-500/15 text-amber-600" variant="secondary">
                {pending}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function TopBar() {
  const { mode, reload, loading } = useAdmin();
  return (
    <header className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-black tracking-tight">SmartFit platform</h1>
        <Badge variant="outline">admin</Badge>
      </div>
      <div className="flex items-center gap-2">
        {mode === 'demo' && (
          <span className="text-muted-foreground rounded-lg border border-dashed px-2.5 py-1 text-xs">
            Demo data — not persisted
          </span>
        )}
        <Button size="sm" variant="outline" onClick={reload} disabled={loading || mode === 'demo'}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>
    </header>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-label={label}
    >
      <Loader2 className="text-primary size-7 animate-spin" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

function NoAccess({ onRecheck, busy }: { onRecheck: () => void; busy: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
        <ShieldAlert className="size-6" />
      </span>
      <p className="text-lg font-bold">This area is for platform operators</p>
      <p className="text-muted-foreground text-sm">
        Your account does not carry the platform-admin role. If you were just granted it, the token
        may be a few minutes stale — recheck below, or sign out and back in.
      </p>
      <Button onClick={onRecheck} disabled={busy} className="mt-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Recheck my access
      </Button>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const cloud = isFirebaseConfigured;
  const [platformAdmin, setPlatformAdmin] = useState<boolean | null>(null);
  const [rechecking, setRechecking] = useState(false);

  const readClaim = useCallback(
    async (force: boolean) => {
      if (!user) return false;
      try {
        // `force` refreshes the ID token first — that is the whole point of
        // the recheck path, because a stale token carries the old claims.
        const result = await user.getIdTokenResult(force);
        return result.claims?.sfRole === 'platform-admin';
      } catch {
        return false;
      }
    },
    [user],
  );

  useEffect(() => {
    if (!cloud) return; // demo mode: no accounts, no gate
    if (initializing) return;
    if (!user) {
      setPlatformAdmin(false);
      return;
    }
    readClaim(false).then(setPlatformAdmin);
  }, [cloud, initializing, user, readClaim]);

  const onRecheck = useCallback(async () => {
    setRechecking(true);
    setPlatformAdmin(await readClaim(true));
    setRechecking(false);
  }, [readClaim]);

  const state = useMemo(() => {
    if (!cloud) return 'demo' as const;
    if (initializing) return 'resolving' as const;
    if (!user) return 'signed-out' as const;
    if (platformAdmin === null) return 'resolving' as const;
    if (!platformAdmin) return 'denied' as const;
    return 'admin' as const;
  }, [cloud, initializing, user, platformAdmin]);

  if (state === 'demo') {
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 py-8 sm:p-6">
        {/* TopBar calls useAdmin(), so the provider wraps it too — a shell
            component above the provider is the classic 500-by-construction.
            Toasts come from the root AppProviders. */}
        <AdminProvider>
          <TopBar />
          <Nav />
          {children}
        </AdminProvider>
      </div>
    );
  }

  if (state === 'resolving') return <Spinner label="Checking your access…" />;

  if (state === 'signed-out' || state === 'denied') {
    return <NoAccess onRecheck={onRecheck} busy={rechecking} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 py-8 sm:p-6">
      <AdminProvider>
        <TopBar />
        <Nav />
        {children}
      </AdminProvider>
    </div>
  );
}
