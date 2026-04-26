'use client';
import { getDb, type DocumentRow } from './db';
import type { PageState } from '@/src/store/document-store';

export async function putDocument(row: DocumentRow): Promise<void> {
  const db = await getDb();
  await db.put('documents', row);
}

export async function getDocument(id: string): Promise<DocumentRow | undefined> {
  const db = await getDb();
  return db.get('documents', id);
}

export async function getDocumentsBySession(sessionId: string): Promise<DocumentRow[]> {
  const db = await getDb();
  return db.getAllFromIndex('documents', 'by-sessionId', sessionId);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('documents', id);
}

export async function deleteDocumentsBySession(sessionId: string): Promise<void> {
  const db = await getDb();
  const docs = await getDocumentsBySession(sessionId);
  const tx = db.transaction('documents', 'readwrite');
  await Promise.all([...docs.map((d) => tx.store.delete(d.id)), tx.done]);
}

export async function patchDocumentPages(
  id: string,
  pages: PageState[],
): Promise<void> {
  const db = await getDb();
  const row = await db.get('documents', id);
  if (!row) return;
  await db.put('documents', { ...row, pages });
}

export async function setDocumentApproval(
  id: string,
  approvedAt: number | null,
): Promise<void> {
  const db = await getDb();
  const row = await db.get('documents', id);
  if (!row) return;
  await db.put('documents', { ...row, approvedAt });
}
