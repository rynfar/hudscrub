import { create } from 'zustand';
import type { Span } from '../types';

export type DocStatus = 'uploading' | 'detecting' | 'ready' | 'reviewing' | 'exported';

export interface PageState {
  pageNum: number;
  text: string;
  width: number;
  height: number;
  spans: Span[];
  status: 'pending' | 'detecting' | 'ready' | 'reviewed';
}

export interface DocumentSession {
  id: string;
  filename: string;
  fileBytes: ArrayBuffer;
  pages: PageState[];
  status: DocStatus;
  createdAt: number;
  detectionProgress: { currentPage: number; totalPages: number };
}

interface DocumentStoreState {
  documents: Record<string, DocumentSession>;
  activeId: string | null;
}

interface DocumentStoreActions {
  add: (doc: Omit<DocumentSession, 'id' | 'createdAt'>) => string;
  setActive: (id: string | null) => void;
  setStatus: (id: string, status: DocStatus) => void;
  setProgress: (id: string, currentPage: number, totalPages: number) => void;
  setPage: (id: string, pageNum: number, page: PageState) => void;
  updateSpan: (id: string, pageNum: number, spanId: string, patch: Partial<Span>) => void;
  addSpan: (id: string, pageNum: number, span: Span) => void;
  removeSpan: (id: string, pageNum: number, spanId: string) => void;
  clearAll: () => void;
}

export const useDocuments = create<DocumentStoreState & DocumentStoreActions>((set) => ({
  documents: {},
  activeId: null,
  add: (doc) => {
    const id = crypto.randomUUID();
    const full: DocumentSession = { ...doc, id, createdAt: Date.now() };
    set((s) => ({ documents: { ...s.documents, [id]: full }, activeId: s.activeId ?? id }));
    return id;
  },
  setActive: (id) => set({ activeId: id }),
  setStatus: (id, status) =>
    set((s) => ({
      documents: s.documents[id]
        ? { ...s.documents, [id]: { ...s.documents[id], status } }
        : s.documents,
    })),
  setProgress: (id, currentPage, totalPages) =>
    set((s) => {
      const d = s.documents[id];
      if (!d) return s;
      return {
        documents: {
          ...s.documents,
          [id]: { ...d, detectionProgress: { currentPage, totalPages } },
        },
      };
    }),
  setPage: (id, pageNum, page) =>
    set((s) => {
      const d = s.documents[id];
      if (!d) return s;
      const pages = [...d.pages];
      pages[pageNum] = page;
      return { documents: { ...s.documents, [id]: { ...d, pages } } };
    }),
  updateSpan: (id, pageNum, spanId, patch) =>
    set((s) => {
      const d = s.documents[id];
      if (!d) return s;
      const page = d.pages[pageNum];
      if (!page) return s;
      const spans = page.spans.map((sp) => (sp.id === spanId ? { ...sp, ...patch } : sp));
      const pages = [...d.pages];
      pages[pageNum] = { ...page, spans };
      return { documents: { ...s.documents, [id]: { ...d, pages } } };
    }),
  addSpan: (id, pageNum, span) =>
    set((s) => {
      const d = s.documents[id];
      if (!d) return s;
      const page = d.pages[pageNum];
      if (!page) return s;
      const pages = [...d.pages];
      pages[pageNum] = { ...page, spans: [...page.spans, span] };
      return { documents: { ...s.documents, [id]: { ...d, pages } } };
    }),
  removeSpan: (id, pageNum, spanId) =>
    set((s) => {
      const d = s.documents[id];
      if (!d) return s;
      const page = d.pages[pageNum];
      if (!page) return s;
      const pages = [...d.pages];
      pages[pageNum] = { ...page, spans: page.spans.filter((sp) => sp.id !== spanId) };
      return { documents: { ...s.documents, [id]: { ...d, pages } } };
    }),
  clearAll: () => set({ documents: {}, activeId: null }),
}));
