'use client';

/**
 * The admin shell: the gate, the sidebar, the banners.
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
 *
 * ## Layout
 *
 * A fixed sidebar on `lg+`, a slide-over sheet on phones — the console reads
 * like the operations tool it is, not like a tab bar with cards bolted on.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  Loader2,
  Menu,
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
import { ThemeToggle } from '@/components/theme-toggle';
import { SectionError } from './sections';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  { href: '/studio', label: 'Content studio', icon: ClipboardList },
  { href: '/support', label: 'Support', icon: Users },
  { href: '/admin/access', label: 'Access roles', icon: ShieldAlert },
  { href: '/admin/audit', label: 'Audit', icon: ScrollText },
];

function pageTitle(pathname: string): string {
  const match = [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)));
  if (!match) return 'Platform';
  if (match.href === '/admin/gyms' && pathname.startsWith('/admin/gyms/')) return 'Gym detail';
  return match.label;
}

function usePendingApplications(): number {
  const { data } = useAdmin();
  return data.applications.filter((a) => a.status === 'pending').length;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const pending = usePendingApplications();

  return (
    <nav className="flex flex-col gap-1" aria-label="Platform admin">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-foreground font-semibold'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span
              aria-hidden
              className={cn(
                'bg-primary absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full transition-opacity',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
            <item.icon className={cn('size-4', active && 'text-primary')} />
            {item.label}
            {item.badge === 'pending' && pending > 0 && (
              <Badge className="ml-auto bg-amber-500/15 text-amber-600" variant="secondary">
                {pending}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandMark() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 px-1 py-1">
      <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
        <Dumbbell className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-black tracking-tight">SmartFit</span>
        <span className="text-muted-foreground block text-[11px] font-medium">
          Platform console
        </span>
      </span>
    </Link>
  );
}

function ModeChip() {
  const { mode } = useAdmin();
  if (mode === 'demo') {
    return (
      <span className="text-muted-foreground rounded-lg border border-dashed px-2.5 py-1.5 text-xs">
        Demo data — not persisted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600">
      <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
      Cloud data
    </span>
  );
}

function RefreshButton({ className }: { className?: string }) {
  const { mode, reload, loading } = useAdmin();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={reload}
      disabled={loading || mode === 'demo'}
      className={className}
    >
      <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} /> Refresh
    </Button>
  );
}

function Sidebar() {
  const { user } = useAuth();
  const initial = (user?.displayName ?? user?.email ?? '?').charAt(0).toUpperCase();
  return (
    <aside className="bg-background fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-5 border-r p-4 lg:flex">
      <BrandMark />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavList />
      </div>
      <div className="space-y-3 border-t pt-4">
        <ModeChip />
        {user && (
          <p className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
            <span className="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full font-bold">
              {initial}
            </span>
            <span className="truncate">{user.email ?? user.displayName}</span>
          </p>
        )}
      </div>
    </aside>
  );
}

/** Phone-width slide-over. One at a time — `open` state lives in TopBar's parent. */
function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>Platform navigation</DialogTitle>
        <DialogDescription>Manage your SmartFit network.</DialogDescription>
        <NavList onNavigate={onClose} />
        <ModeChip />
        <RefreshButton />
      </DialogContent>
    </Dialog>
  );
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  return (
    <header className="bg-background/85 sticky top-0 z-30 -mx-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="lg:hidden"
          onClick={onOpenMenu}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
        <h1 className="truncate text-lg font-black tracking-tight">{pageTitle(pathname)}</h1>
        <Badge variant="outline" className="hidden sm:inline-flex">
          admin
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <span className="lg:hidden">
          <ModeChip />
        </span>
        <span className="hidden lg:inline-flex">
          <RefreshButton />
        </span>
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

/**
 * Signed-out visitors get a door, not a verdict. "Your account does not
 * carry the role" is a non-answer to someone who never signed in — it reads
 * as a verdict on an account the app cannot possibly have inspected.
 */
function SignInGate() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
        <ShieldAlert className="size-6" />
      </span>
      <p className="text-lg font-bold">Platform operators sign in</p>
      <p className="text-muted-foreground text-sm">
        This area needs an account carrying the platform-admin role. Sign in and you will land right
        back here.
      </p>
      <Button asChild className="mt-2">
        <Link href="/login?next=/admin">Sign in</Link>
      </Button>
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

/** The working area — sidebar plus content column. Must sit inside AdminProvider. */
function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { loading, error } = useAdmin();
  return (
    <div className="min-h-dvh lg:pl-64">
      <Sidebar />
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        {/* TopBar calls useAdmin(), so the provider wraps it too — a shell
            component above the provider is the classic 500-by-construction.
            Toasts come from the root AppProviders. */}
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        {error ? <SectionError /> : loading ? <Spinner label="Loading your platform…" /> : children}
      </div>
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

  if (state === 'demo' || state === 'admin') {
    return (
      <AdminProvider>
        <ConsoleLayout>{children}</ConsoleLayout>
      </AdminProvider>
    );
  }

  if (state === 'resolving') return <Spinner label="Checking your access…" />;

  if (state === 'signed-out') return <SignInGate />;

  return <NoAccess onRecheck={onRecheck} busy={rechecking} />;
}
