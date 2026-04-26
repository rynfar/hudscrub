'use client';
import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { PageState } from '@/src/store/document-store';

export type SessionStatus = 'reviewing' | 'exported';

export interface SessionRow {
  id: string;
  createdAt: number;
  exportedAt: number | null;
  label: string;
  docIds: string[];
  status: SessionStatus;
}

export interface DocumentRow {
  id: string;
  sessionId: string;
  filename: string;
  fileBytes: ArrayBuffer;
  pages: PageState[];
  createdAt: number;
  approvedAt: number | null;
}

interface HudscrubSchema extends DBSchema {
  sessions: {
    key: string;
    value: SessionRow;
    indexes: { 'by-createdAt': number };
  };
  documents: {
    key: string;
    value: DocumentRow;
    indexes: { 'by-sessionId': string };
  };
}

const DB_NAME = 'hudscrub';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HudscrubSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<HudscrubSchema>> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }
  if (dbPromise) return dbPromise;
  dbPromise = openDB<HudscrubSchema>(DB_NAME, DB_VERSION, {
    upgrade(db: IDBPDatabase<HudscrubSchema>) {
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionsStore.createIndex('by-createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('documents')) {
        const docsStore = db.createObjectStore('documents', { keyPath: 'id' });
        docsStore.createIndex('by-sessionId', 'sessionId');
      }
    },
  });
  return dbPromise;
}
