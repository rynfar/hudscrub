import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface NameListEntry {
  original: string;
  replacement?: string;
}

export interface NameList {
  id: string;
  name: string;
  entries: NameListEntry[];
  createdAt: number;
}

interface NameListsState {
  lists: NameList[];
}

interface NameListsActions {
  add: (name: string) => string;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  addEntry: (id: string, entry: NameListEntry) => void;
  removeEntry: (id: string, original: string) => void;
}

const safeStorage = () =>
  typeof window !== 'undefined'
    ? localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} };

export const useNameLists = create<NameListsState & NameListsActions>()(
  persist(
    (set) => ({
      lists: [],
      add: (name) => {
        const id = crypto.randomUUID();
        set((s) => ({
          lists: [...s.lists, { id, name, entries: [], createdAt: Date.now() }],
        }));
        return id;
      },
      remove: (id) => set((s) => ({ lists: s.lists.filter((l) => l.id !== id) })),
      rename: (id, name) =>
        set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)) })),
      addEntry: (id, entry) =>
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === id
              ? {
                  ...l,
                  entries: [...l.entries.filter((e) => e.original !== entry.original), entry],
                }
              : l,
          ),
        })),
      removeEntry: (id, original) =>
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === id ? { ...l, entries: l.entries.filter((e) => e.original !== original) } : l,
          ),
        })),
    }),
    {
      name: 'hudscrub.namelists.v1',
      storage: createJSONStorage(safeStorage),
      partialize: ({ lists }) => ({ lists }),
    },
  ),
);
