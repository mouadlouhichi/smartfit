/** Pure presentation state for landing account links. Auth remains the authority. */
export function landingAccountState({
  initializing,
  signedIn,
  returningLocal,
  memberReady,
  onboardingDone,
  resolvedHome,
}: {
  initializing: boolean;
  signedIn: boolean;
  returningLocal: boolean;
  memberReady: boolean;
  onboardingDone: boolean;
  /** undefined: role lookup pending; null: use the member home. */
  resolvedHome: string | null | undefined;
}) {
  const authenticated = signedIn || returningLocal;
  if (initializing) return { authenticated, pending: true, href: null, label: 'Loading…' };
  if (!authenticated) return { authenticated, pending: false, href: '/login', label: 'Sign in' };
  if (signedIn && resolvedHome === undefined)
    return { authenticated, pending: true, href: null, label: 'Open SmartFit' };
  const operatorHome =
    ['/admin', '/studio', '/support'].includes(resolvedHome ?? '') ||
    /^\/g\/[a-z0-9-]+\/(console|coaching)$/.test(resolvedHome ?? '')
      ? resolvedHome
      : null;
  if (!operatorHome && !memberReady)
    return { authenticated, pending: true, href: null, label: 'Open SmartFit' };
  const href = operatorHome ?? (onboardingDone ? '/dashboard' : '/onboarding');
  const label =
    href === '/admin'
      ? 'Open admin'
      : href === '/studio'
        ? 'Open content studio'
        : href === '/support'
          ? 'Open support'
          : href?.endsWith('/coaching')
            ? 'Open coaching'
            : operatorHome
              ? 'Open gym console'
              : onboardingDone
                ? 'Open dashboard'
                : 'Finish setup';
  return { authenticated, pending: false, href, label };
}
