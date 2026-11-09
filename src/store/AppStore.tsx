import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppNotification, CustomProductRequest, Product, Quotation, QuotationItemData, UserProfile } from '../types';
import type { DiscountRule } from '../utils/quotationEngine';
import type { WhatsAppSendResult } from '../utils/whatsapp';
import { buildQuotationPdf, getDirector } from '../utils/quotationPdf';
import { can } from '../auth/permissions';
import {
  backend,
  type CustomRequestPricing,
  type NewCustomRequestInput,
  type NewQuotationInput,
  type NewUserInput,
  type Result,
  type Snapshot,
  type UserPatch,
} from '../backend';

export type { NewQuotationInput } from '../backend';

/**
 * App state. Data comes from `backend` (Supabase when configured, otherwise the localStorage demo).
 * Every mutation calls the backend, then reloads the snapshot so the UI shows server truth.
 * Mutations throw Errors with user-readable messages — callers show them with `errorMessage()`.
 */

export const errorMessage = (e: unknown) =>
  e instanceof Error && e.message ? e.message : 'Terjadi kesalahan. Coba lagi beberapa saat.';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'error';
}

export interface ApproveOutcome {
  quotation: Quotation;
  /** PDF issuing + WhatsApp happen automatically after approval; this reports how that went. */
  delivery: { ok: true; whatsapp: WhatsAppSendResult } | { ok: false; error: string };
}

interface Store {
  mode: 'local' | 'supabase';
  /** False until the saved session has been checked. */
  ready: boolean;
  currentUser: UserProfile | null;
  users: UserProfile[];
  quotations: Quotation[];
  products: Product[];
  customRequests: CustomProductRequest[];
  discountRules: DiscountRule[];
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationsRead: (ids?: string[]) => Promise<void>;
  toasts: Toast[];

  login: (email: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;

  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;

  createQuotation: (input: NewQuotationInput, existingId?: string) => Promise<Quotation>;
  updateQuotationPricing: (id: string, items: QuotationItemData[], supportNotes?: string) => Promise<void>;
  approveQuotation: (id: string, items: QuotationItemData[], supportNotes?: string) => Promise<ApproveOutcome>;
  rejectQuotation: (id: string, reason: string) => Promise<void>;
  sendWhatsApp: (id: string) => Promise<WhatsAppSendResult>;

  submitCustomRequest: (req: NewCustomRequestInput) => Promise<void>;
  priceCustomRequest: (id: string, patch: CustomRequestPricing) => Promise<void>;

  setDiscountRules: (rules: DiscountRule[]) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Pick<Product, 'cogs' | 'basePrice' | 'stock'>>) => Promise<void>;

  addUser: (user: NewUserInput) => Promise<Result>;
  updateUser: (id: string, patch: UserPatch) => Promise<Result>;

  /** Local demo mode only. */
  resetDemoData?: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

const EMPTY: Snapshot = { users: [], quotations: [], products: [], customRequests: [], discountRules: [], notifications: [] };

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const currentUser = useMemo(() => {
    const u = snap.users.find(x => x.id === userId);
    return u && u.status === 'ACTIVE' ? u : null;
  }, [snap.users, userId]);
  const userRef = useRef(currentUser);
  userRef.current = currentUser;

  const refresh = useCallback(async (): Promise<Snapshot> => {
    const s = await backend.load(userIdRef.current ?? '');
    setSnap(s);
    return s;
  }, []);

  // Restore the saved session once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const id = await backend.restoreSession();
        if (id || backend.mode === 'local') {
          const s = await backend.load(id ?? '');
          if (!alive) return;
          setSnap(s);
          setUserId(id);
        }
      } catch {
        await backend.logout().catch(() => undefined);
      } finally {
        if (alive) setReady(true);
      }
    })();
    const off = backend.onSessionChange(id => {
      if (!id) {
        setUserId(null);
        if (backend.mode === 'supabase') setSnap(EMPTY);
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Live updates from other users (Supabase realtime).
  useEffect(() => {
    if (!userId) return;
    return backend.subscribe(() => {
      refresh().catch(() => undefined);
    });
  }, [userId, refresh]);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  const actor = (): UserProfile => {
    const u = userRef.current;
    if (!u) throw new Error('Sesi berakhir. Silakan masuk kembali.');
    return u;
  };

  const findQuotation = (s: Snapshot, id: string) => {
    const q = s.quotations.find(x => x.id === id);
    if (!q) throw new Error('Penawaran tidak ditemukan.');
    return q;
  };

  /** Issue the PDF to storage (if needed) and notify the sales rep on WhatsApp. */
  const deliver = async (q: Quotation, users: UserProfile[], forcePdf: boolean): Promise<WhatsAppSendResult> => {
    const me = actor();
    if (backend.mode === 'supabase' && (forcePdf || !q.pdfPath)) {
      const pdf = await buildQuotationPdf(q, getDirector(users));
      await backend.attachQuotationPdf(me, q, pdf);
    }
    return backend.sendWhatsApp(me, q.id);
  };

  const login: Store['login'] = async (email, password) => {
    const res = await backend.login(email, password);
    if (!res.ok) return res;
    try {
      userIdRef.current = res.userId;
      const s = await backend.load(res.userId);
      setSnap(s);
      setUserId(res.userId);
      return { ok: true };
    } catch (e) {
      await backend.logout().catch(() => undefined);
      return { ok: false, error: errorMessage(e) };
    }
  };

  const logout: Store['logout'] = async () => {
    await backend.logout();
    setUserId(null);
    if (backend.mode === 'supabase') setSnap(EMPTY);
  };

  const createQuotation: Store['createQuotation'] = async (input, existingId) => {
    const id = await backend.createQuotation(actor(), input, existingId);
    return findQuotation(await refresh(), id);
  };

  const updateQuotationPricing: Store['updateQuotationPricing'] = async (id, items, supportNotes) => {
    await backend.saveQuotationPricing(actor(), id, items, supportNotes);
    await refresh();
  };

  const approveQuotation: Store['approveQuotation'] = async (id, items, supportNotes) => {
    await backend.approveQuotation(actor(), id, items, supportNotes);
    const s = await refresh();
    const approved = findQuotation(s, id);
    let delivery: ApproveOutcome['delivery'];
    try {
      delivery = { ok: true, whatsapp: await deliver(approved, s.users, true) };
    } catch (e) {
      delivery = { ok: false, error: errorMessage(e) };
    }
    const after = await refresh().catch(() => s);
    return { quotation: after.quotations.find(q => q.id === id) ?? approved, delivery };
  };

  const rejectQuotation: Store['rejectQuotation'] = async (id, reason) => {
    await backend.rejectQuotation(actor(), id, reason);
    await refresh();
  };

  const sendWhatsApp: Store['sendWhatsApp'] = async id => {
    const s = snapRef.current;
    const result = await deliver(findQuotation(s, id), s.users, false);
    await refresh();
    return result;
  };

  const submitCustomRequest: Store['submitCustomRequest'] = async req => {
    await backend.submitCustomRequest(actor(), req);
    await refresh();
  };

  const priceCustomRequest: Store['priceCustomRequest'] = async (id, patch) => {
    await backend.priceCustomRequest(actor(), id, patch);
    await refresh();
  };

  const setDiscountRules: Store['setDiscountRules'] = async rules => {
    await backend.setDiscountRules(actor(), rules);
    await refresh();
  };

  const updateProduct: Store['updateProduct'] = async (id, patch) => {
    await backend.updateProduct(actor(), id, patch);
    await refresh();
  };

  const addUser: Store['addUser'] = async input => {
    const res = await backend.addUser(actor(), input);
    if (res.ok) await refresh();
    return res;
  };

  const updateUser: Store['updateUser'] = async (id, patch) => {
    const res = await backend.updateUser(actor(), id, patch);
    if (res.ok) await refresh();
    return res;
  };

  const markNotificationsRead: Store['markNotificationsRead'] = async ids => {
    // Optimistic: the badge clears immediately.
    setSnap(s => ({ ...s, notifications: s.notifications.map(n => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)) }));
    await backend.markNotificationsRead(actor(), ids).catch(() => undefined);
    await refresh().catch(() => undefined);
  };

  const resetDemoData = backend.resetDemoData
    ? async () => {
        await backend.resetDemoData!();
        setUserId(null);
        userIdRef.current = null;
        await refresh();
      }
    : undefined;

  const value: Store = {
    mode: backend.mode,
    ready,
    currentUser,
    ...snap,
    unreadCount: snap.notifications.filter(n => !n.read).length,
    markNotificationsRead,
    toasts,
    login,
    logout,
    notify,
    dismissToast,
    createQuotation,
    updateQuotationPricing,
    approveQuotation,
    rejectQuotation,
    sendWhatsApp,
    submitCustomRequest,
    priceCustomRequest,
    setDiscountRules,
    updateProduct,
    addUser,
    updateUser,
    resetDemoData,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside AppStoreProvider');
  return s;
}

/** Products as the current user is allowed to see them: COGS removed for roles without cogs:view. */
export function useVisibleProducts(): Product[] {
  const { products, currentUser } = useStore();
  return useMemo(
    () => (can(currentUser, 'cogs:view') ? products : products.map(p => ({ ...p, cogs: 0 }))),
    [products, currentUser]
  );
}
