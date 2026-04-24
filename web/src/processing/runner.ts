'use client';
import { useSyncExternalStore } from 'react';
import { runProcessing, type ProcessingProgress } from './runProcessing';
import { useDocuments, type PageState } from '@/src/store/document-store';
import { type ModelId } from '@/src/store/settings-store';

export interface ProcessingState {
  isRunning: boolean;
  cancelled: boolean;
  progress: ProcessingProgress | null;
  /** docIds that have finished processing (all pages have spans). */
  completedDocIds: string[];
  /** docIds queued for processing (not yet started). */
  queuedDocIds: string[];
  error: string | null;
}

const INITIAL: ProcessingState = {
  isRunning: false,
  cancelled: false,
  progress: null,
  completedDocIds: [],
  queuedDocIds: [],
  error: null,
};

let state: ProcessingState = INITIAL;
let cancelRef = { cancelled: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<ProcessingState>) {
  state = { ...state, ...patch };
  emit();
}

/**
 * Start processing the given docs (uses the document store + selectedModel).
 * Idempotent — calling while already running is a no-op.
 */
export function startProcessing(docIds: string[], selectedModel: ModelId) {
  if (state.isRunning) return;
  const documents = useDocuments.getState().documents;
  const docs = docIds.map((id) => documents[id]).filter(Boolean);
  if (docs.length === 0) return;

  cancelRef = { cancelled: false };
  state = {
    isRunning: true,
    cancelled: false,
    progress: null,
    completedDocIds: [],
    queuedDocIds: docIds,
    error: null,
  };
  emit();

  const setPage = (docId: string, pageNum: number, page: PageState) => {
    useDocuments.getState().setPage(docId, pageNum, page);
  };
  const setStatus = (docId: string, status: 'detecting' | 'reviewing') => {
    useDocuments.getState().setStatus(docId, status);
  };

  // Track per-doc completion
  let lastDocIndex = -1;

  runProcessing(docs, selectedModel, {
    shouldCancel: () => cancelRef.cancelled,
    onPage: setPage,
    onProgress: (p) => {
      // When docIndex moves forward, the previous doc has finished
      if (p.docIndex > lastDocIndex && lastDocIndex >= 0) {
        const finishedDoc = docs[lastDocIndex];
        if (finishedDoc) {
          setStatus(finishedDoc.id, 'reviewing');
          set({
            completedDocIds: [...state.completedDocIds, finishedDoc.id],
            queuedDocIds: state.queuedDocIds.filter((id) => id !== finishedDoc.id),
          });
        }
      }
      lastDocIndex = p.docIndex;

      if (p.phase === 'done') {
        // Final doc was last; mark it
        const finished = docs[docs.length - 1];
        if (finished && !state.completedDocIds.includes(finished.id)) {
          setStatus(finished.id, 'reviewing');
          set({
            completedDocIds: [...state.completedDocIds, finished.id],
            queuedDocIds: state.queuedDocIds.filter((id) => id !== finished.id),
            isRunning: false,
            progress: p,
          });
        } else {
          set({ isRunning: false, progress: p });
        }
      } else {
        set({ progress: p });
      }
    },
  }).catch((e) => {
    console.error('[processing] fatal:', e);
    set({
      isRunning: false,
      error: e instanceof Error ? e.message : String(e),
    });
  });
}

export function cancelProcessing() {
  cancelRef.cancelled = true;
  set({ isRunning: false, cancelled: true });
}

export function resetProcessing() {
  state = INITIAL;
  cancelRef = { cancelled: false };
  emit();
}

export function getProcessingState(): ProcessingState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useProcessingStatus(): ProcessingState {
  return useSyncExternalStore(subscribe, getProcessingState, getProcessingState);
}
