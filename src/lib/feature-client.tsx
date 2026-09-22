'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './firebase/auth-context';

/** Session-only demo storage is never read in cloud mode. */
export function useFeatureData<T>(
  endpoint: string,
  demo: T,
  demoKey: string,
  publicRead = false,
  accessKey = '',
) {
  const { user, mode, initializing } = useAuth();
  const [data, setData] = useState(demo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, reload] = useState(0);
  const identity = `${mode}:${user?.uid ?? 'guest'}:${endpoint}:${accessKey}`;
  const [resolvedIdentity, setResolvedIdentity] = useState<string | null>(null);
  useEffect(() => {
    if (initializing) return;
    let active = true;
    const abort = new AbortController();
    setError(null);
    setLoading(true);
    setData(demo);
    if (mode === 'local') {
      try {
        const saved = sessionStorage.getItem(demoKey);
        if (saved) setData(JSON.parse(saved) as T);
      } catch {
        /* defaults */
      }
      setResolvedIdentity(identity);
      setLoading(false);
      return;
    }
    if (!user && !publicRead) {
      setLoading(false);
      setResolvedIdentity(identity);
      setError('Sign in to open this workspace.');
      return;
    }
    (async () => {
      try {
        const token = user ? await user.getIdToken() : null;
        const response = await fetch(endpoint, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
          signal: abort.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to load this workspace.');
        if (active) setData(body);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load.');
      } finally {
        if (active) {
          setResolvedIdentity(identity);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      abort.abort();
    };
  }, [endpoint, mode, user, initializing, revision, demo, demoKey, publicRead, identity]);
  const request = useCallback(
    async (body: unknown, demoUpdate: () => T) => {
      setBusy(true);
      setError(null);
      try {
        if (mode === 'local') {
          const next = demoUpdate();
          setData(next);
          try {
            sessionStorage.setItem(demoKey, JSON.stringify(next));
          } catch {
            /* still usable this render */
          }
        } else {
          if (!user) throw new Error('Sign in to continue.');
          const response = await fetch(endpoint.split('?')[0], {
            method: 'POST',
            headers: {
              authorization: `Bearer ${await user.getIdToken()}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? 'Could not save.');
          reload((v) => v + 1);
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [mode, user, endpoint, demoKey],
  );
  return {
    data,
    loading: loading || resolvedIdentity !== identity,
    error,
    busy,
    request,
    reload: () => reload((v) => v + 1),
    mode,
    user,
  };
}
