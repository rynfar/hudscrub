import { describe, it, expect, beforeEach } from 'vitest';
import { useSettings } from '../../src/store/settings-store.js';
import { useDocuments } from '../../src/store/document-store.js';
import { useNameLists } from '../../src/store/name-lists-store.js';

beforeEach(() => {
  useSettings.getState().reset();
  useDocuments.getState().clearAll();
  useNameLists.setState({ lists: [] });
});

describe('settings store', () => {
  it('has sensible defaults', () => {
    const s = useSettings.getState();
    expect(s.mode).toBe('redact');
    expect(s.selectedModel).toBe('bert-ner');
    expect(s.hasCompletedOnboarding).toBe(false);
  });
  it('partial updates work', () => {
    useSettings.getState().set({ mode: 'sandbox', sandboxSeed: 42 });
    expect(useSettings.getState().mode).toBe('sandbox');
    expect(useSettings.getState().sandboxSeed).toBe(42);
  });
});

describe('document store', () => {
  it('add returns an id and sets active', () => {
    const id = useDocuments.getState().add({
      filename: 'x.pdf',
      fileBytes: new ArrayBuffer(0),
      pages: [],
      status: 'uploading',
      detectionProgress: { currentPage: 0, totalPages: 0 },
    });
    expect(useDocuments.getState().documents[id].filename).toBe('x.pdf');
    expect(useDocuments.getState().activeId).toBe(id);
  });
  it('updateSpan patches a single span', () => {
    const id = useDocuments.getState().add({
      filename: 'x.pdf',
      fileBytes: new ArrayBuffer(0),
      pages: [
        {
          pageNum: 0,
          text: '',
          width: 100,
          height: 100,
          spans: [
            {
              id: 's1',
              source: 'regex',
              label: 'SSN',
              text: '111-11-1111',
              start: 0,
              end: 11,
              bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: 0 },
              confidence: 1,
              decision: 'pending',
            },
          ],
          status: 'ready',
        },
      ],
      status: 'reviewing',
      detectionProgress: { currentPage: 1, totalPages: 1 },
    });
    useDocuments.getState().updateSpan(id, 0, 's1', { decision: 'accepted' });
    expect(useDocuments.getState().documents[id].pages[0].spans[0].decision).toBe('accepted');
  });
});

describe('name lists store', () => {
  it('add creates a new list with a unique id', () => {
    const id = useNameLists.getState().add('Smith closing');
    expect(useNameLists.getState().lists.find((l) => l.id === id)?.name).toBe('Smith closing');
  });
  it('addEntry appends and dedupes by original', () => {
    const id = useNameLists.getState().add('test');
    useNameLists.getState().addEntry(id, { original: 'A', replacement: 'X' });
    useNameLists.getState().addEntry(id, { original: 'A', replacement: 'Y' });
    const list = useNameLists.getState().lists.find((l) => l.id === id);
    expect(list?.entries).toHaveLength(1);
    expect(list?.entries[0].replacement).toBe('Y');
  });
});
