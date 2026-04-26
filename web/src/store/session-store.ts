'use client';
import { create } from 'zustand';
import {
  createSession as dbCreateSession,
  listSessions as dbListSessions,
  updateSessionStatus as dbUpdateSessionStatus,
  pruneOldSessions as dbPruneOldSessions,
  deleteSession as dbDeleteSession,
} from '@/src/storage/sessions';
import { getDocumentsBySession } from '@/src/storage/documents';
import type { SessionRow, SessionStatus } from '@/src/storage/db';
import type { DocumentSession } from './document-store';

interface SessionStoreState {
  sessions: SessionRow[];
  activeSessionId: string | null;
  hydrated: boolean;
}

interface SessionStoreActions {
  hydrate: () => Promise<void>;
  createNew: (label: string, docIds: string[]) => Promise<string>;
  setActive: (id: string | null) => void;
  loadSessionDocs: (id: string) => Promise<DocumentSession[]>;
  markExported: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  prune: (maxAgeMs: number) => Promise<number>;
}

const PRUNE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let hydratePromise: Promise<void> | null = null;

export const useSessions = create<SessionStoreState & SessionStoreActions>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (hydratePromise) {
      await hydratePromise;
      return;
    }
    hydratePromise = (async () => {
      try {
        await dbPruneOldSessions(PRUNE_MS);
      } catch (e) {
        console.warn('[sessions] prune failed:', e);
      }
      const sessions = await dbListSessions();
      set({ sessions, hydrated: true });
    })();
    await hydratePromise;
  },

  createNew: async (label, docIds) => {
    const id = crypto.randomUUID();
    const row = await dbCreateSession({ id, label, docIds });
    set((s) => ({ sessions: [row, ...s.sessions], activeSessionId: id }));
    return id;
  },

  setActive: (id) => set({ activeSessionId: id }),

  loadSessionDocs: async (id) => {
    const rows = await getDocumentsBySession(id);
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      filename: r.filename,
      fileBytes: r.fileBytes,
      pages: r.pages,
      status: 'reviewing' as const,
      createdAt: r.createdAt,
      approvedAt: r.approvedAt,
      detectionProgress: { currentPage: r.pages.length, totalPages: r.pages.length },
    }));
  },

  markExported: async (id) => {
    await dbUpdateSessionStatus(id, 'exported', Date.now());
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, status: 'exported' as SessionStatus, exportedAt: Date.now() } : sess,
      ),
    }));
  },

  remove: async (id) => {
    await dbDeleteSession(id);
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    }));
  },

  prune: async (maxAgeMs) => {
    const count = await dbPruneOldSessions(maxAgeMs);
    if (count > 0) {
      const sessions = await dbListSessions();
      set({ sessions });
    }
    return count;
  },
}));
