'use client';
import { getDb, type SessionRow, type SessionStatus } from './db';
import { deleteDocumentsBySession } from './documents';

export async function createSession(input: {
  id: string;
  label: string;
  docIds: string[];
}): Promise<SessionRow> {
  const db = await getDb();
  const row: SessionRow = {
    id: input.id,
    createdAt: Date.now(),
    exportedAt: null,
    label: input.label,
    docIds: input.docIds,
    status: 'reviewing',
  };
  await db.put('sessions', row);
  return row;
}

export async function getSession(id: string): Promise<SessionRow | undefined> {
  const db = await getDb();
  return db.get('sessions', id);
}

export async function listSessions(): Promise<SessionRow[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('sessions', 'by-createdAt');
  return all.reverse(); // newest first
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
  exportedAt: number | null = null,
): Promise<void> {
  const db = await getDb();
  const row = await db.get('sessions', id);
  if (!row) return;
  await db.put('sessions', { ...row, status, exportedAt: exportedAt ?? row.exportedAt });
}

export async function renameSession(id: string, label: string): Promise<void> {
  const db = await getDb();
  const row = await db.get('sessions', id);
  if (!row) return;
  await db.put('sessions', { ...row, label });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('sessions', id);
  await deleteDocumentsBySession(id);
}

/**
 * Drop sessions (and their documents) older than `maxAgeMs`. Returns the
 * count pruned.
 */
export async function pruneOldSessions(maxAgeMs: number): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const all = await listSessions();
  const stale = all.filter((s) => s.createdAt < cutoff);
  for (const s of stale) {
    await deleteSession(s.id);
  }
  return stale.length;
}
