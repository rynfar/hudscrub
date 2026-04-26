'use client';
import { useDocuments, type DocumentSession } from '@/src/store/document-store';
import { putDocument, setDocumentApproval } from './documents';
import type { DocumentRow } from './db';

const DEBOUNCE_MS = 250;
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

function toRow(doc: DocumentSession): DocumentRow {
  return {
    id: doc.id,
    sessionId: doc.sessionId,
    filename: doc.filename,
    fileBytes: doc.fileBytes,
    pages: doc.pages,
    createdAt: doc.createdAt,
    approvedAt: doc.approvedAt,
  };
}

function flushDoc(docId: string) {
  pendingWrites.delete(docId);
  const doc = useDocuments.getState().documents[docId];
  if (!doc) return;
  putDocument(toRow(doc)).catch((e) => {
    console.warn(`[persist] failed to write doc ${docId}:`, e);
  });
}

function scheduleWrite(docId: string) {
  const existing = pendingWrites.get(docId);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => flushDoc(docId), DEBOUNCE_MS);
  pendingWrites.set(docId, handle);
}

let started = false;
let prevDocs: Record<string, DocumentSession> = {};

/**
 * Start mirroring useDocuments mutations to IndexedDB. Idempotent. Safe to
 * call from any client component that mounts on app boot.
 *
 * Compares current document state to prior snapshot on each store update and
 * schedules debounced writes for any changed documents. Approval changes are
 * persisted immediately (no debounce) so the export gate reflects truth.
 */
export function startPersistBridge(): void {
  if (started) return;
  started = true;
  prevDocs = useDocuments.getState().documents;

  useDocuments.subscribe((state) => {
    const next = state.documents;
    for (const id of Object.keys(next)) {
      const prev = prevDocs[id];
      const curr = next[id];
      if (prev === curr) continue;
      // Approval state: write immediately so export gating is consistent.
      if (!prev || prev.approvedAt !== curr.approvedAt) {
        setDocumentApproval(id, curr.approvedAt).catch((e) => {
          console.warn(`[persist] approval write failed for ${id}:`, e);
        });
        // Also schedule a full write in case other fields changed too.
        scheduleWrite(id);
        continue;
      }
      // Other mutations: debounced full-doc write.
      scheduleWrite(id);
    }
    prevDocs = next;
  });
}
