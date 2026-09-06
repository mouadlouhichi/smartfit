'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ModalKind =
  | 'workout'
  | 'schedule'
  | 'goal'
  | 'body'
  | 'category'
  | null;

interface ModalContextValue {
  open: ModalKind;
  openModal: (m: Exclude<ModalKind, null>) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<ModalKind>(null);
  const openModal = useCallback((m: Exclude<ModalKind, null>) => setOpen(m), []);
  const closeModal = useCallback(() => setOpen(null), []);
  const value = useMemo(() => ({ open, openModal, closeModal }), [open, openModal, closeModal]);
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModals(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModals must be used within <ModalProvider>');
  return ctx;
}
