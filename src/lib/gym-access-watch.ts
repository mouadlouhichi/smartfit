'use client';
import { useEffect, useState } from 'react';
import { useAuth } from './firebase/auth-context';
import { watchTenantAccess } from './firebase/tenant-repo';
/** Lightweight access invalidation for API-backed coaching, including dashboard embeds. */
export function useGymAccessWatch(slug: string) {
  const { user, mode } = useAuth();
  const identity = `${mode}:${user?.uid ?? ''}:${slug}`;
  const [state, setState] = useState({
    identity: '',
    key: 'waiting',
    ready: false,
    error: null as string | null,
  });
  useEffect(() => {
    if (mode === 'local' || !user) return;
    let cancelled = false,
      stop: (() => void) | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    const fail = () => {
      if (!cancelled)
        setState({
          identity,
          key: 'unavailable',
          ready: false,
          error: 'Live access could not be verified. Reconnect and reload this page.',
        });
    };
    void watchTenantAccess(
      slug,
      user.uid,
      (gym, member) => {
        if (cancelled) return;
        if (timer) clearTimeout(timer);
        const key = JSON.stringify([
          gym?.status,
          gym?.ownerUid,
          member?.role,
          member?.status,
          member?.expiresAt,
        ]);
        const publish = () => {
          if (cancelled) return;
          setState({
            identity,
            key: `${key}:${!!member?.expiresAt && member.expiresAt <= Date.now()}`,
            ready: !!gym,
            error: null,
          });
          if (member?.expiresAt && member.expiresAt > Date.now())
            timer = setTimeout(publish, Math.min(member.expiresAt - Date.now() + 1, 2147483647));
        };
        publish();
      },
      fail,
    )
      .then((unsubscribe) => {
        if (cancelled) unsubscribe();
        else stop = unsubscribe;
      })
      .catch(fail);
    return () => {
      cancelled = true;
      stop?.();
      if (timer) clearTimeout(timer);
    };
  }, [identity, mode, user, slug]);
  return mode === 'local' || !user
    ? { key: identity, ready: true, error: null }
    : state.identity === identity
      ? state
      : { key: identity, ready: false, error: null };
}
