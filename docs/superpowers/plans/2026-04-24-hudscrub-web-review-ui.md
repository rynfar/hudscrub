# hudscrub-web Review UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the actual web app — Next.js SPA on Vercel with: upload, PDF rendering, span overlays, keyboard-driven review, manual highlight-to-add, streaming detection (regex + NER + WebLLM), settings, onboarding, and export. Visually deliberate; resists the "generic AI UI" look.

**Architecture:** Next.js 15 App Router, mostly static. State in Zustand with localStorage middleware. PDF rendering with PDF.js. Output via mupdf.js (browser WASM build, same engine as Plan 1's CLI). Detection via the existing `Detector` interface with new browser-runnable detectors (Transformers.js NER works as-is in browser; new WebLLM detector for Phi/Gemma).

**Design language (load-bearing — do not deviate without raising the question):**

- **Background:** `#FAFAF7` (warm off-white). Pure white feels generic.
- **Foreground:** `#1A1A1A` (deep ink). Pure black is harsh.
- **Accent:** `#B7791F` (warm amber). Used sparingly for active states, decisions, attention.
- **Borders:** `rgba(26, 26, 26, 0.08)` — barely there.
- **Type:** Geist Sans for UI; IBM Plex Mono for filenames, IDs, code.
- **Motion:** Framer Motion springs, never linear easing. Page transitions ~200ms, micro-interactions ~120ms.
- **No:** gradients, glassmorphism, blur effects, purple/violet, emoji, decorative shadows, hero sections, kitchen-sink dashboards.

**Tech stack additions:**
- `next` (15.x), `react` (19.x)
- `tailwindcss` (4.x), `@tailwindcss/postcss`
- `@radix-ui/react-*` (dropdown, dialog, toast, tooltip)
- `framer-motion` (12.x)
- `zustand` (5.x)
- `geist` (font), `lucide-react` (icons — clean line style)
- `@mlc-ai/web-llm` (WebLLM)
- `pdfjs-dist` (already installed Plan 1)
- `mupdf` (already installed)
- `@huggingface/transformers` (already installed)

**Reference files:**
- `web/src/types.ts` — Span, Detector
- `web/src/detection/index.ts` — detectPage
- `web/src/detection/detectors/regex-detector.ts`
- `web/src/detection/ner/*` — NER detector + loader
- `web/src/output/redactor.ts` — apply spans → output PDF
- `web/src/mapping/value-mapper.ts` — sandbox mapper
- `docs/superpowers/specs/2026-04-24-hudscrub-web-design.md` — full spec

---

## File structure (created by this plan)

```
web/
├── app/
│   ├── layout.tsx              # root layout, fonts, theme
│   ├── globals.css             # Tailwind + design tokens
│   ├── page.tsx                # landing / upload screen
│   ├── onboarding/
│   │   └── page.tsx            # first-run model picker
│   ├── settings/
│   │   └── page.tsx
│   └── review/
│       └── [docId]/
│           └── page.tsx        # main review view
├── src/
│   ├── ui/
│   │   ├── design-tokens.ts    # color, spacing, motion constants
│   │   ├── Button.tsx
│   │   ├── PillBadge.tsx       # the small status pills
│   │   ├── Kbd.tsx             # keyboard-key visual
│   │   ├── Surface.tsx         # the layered background card
│   │   ├── ProgressLine.tsx    # thin progress indicator
│   │   ├── Toast.tsx
│   │   └── ...                 # other primitives as needed
│   ├── store/
│   │   ├── settings-store.ts   # Settings (mode, model, etc.)
│   │   ├── document-store.ts   # active DocumentSession(s)
│   │   └── name-lists-store.ts
│   ├── detection/
│   │   └── browser-runner.ts   # runs detectPage in browser w/ progress
│   ├── llm/
│   │   ├── webllm-client.ts    # WebLLM wrapper
│   │   └── webllm-detector.ts  # (Plan 3 deferred — see Phase D)
│   ├── pdf/
│   │   └── browser-renderer.ts # PDF.js wrapper for browser
│   ├── review/
│   │   ├── DocumentView.tsx    # the page+sidebar layout
│   │   ├── PdfPage.tsx         # one rendered PDF page with overlays
│   │   ├── SpanOverlay.tsx     # the rectangle for one span
│   │   ├── SpanSidebar.tsx     # right column: span list grouped by label
│   │   ├── KeyboardLayer.tsx   # global keyboard shortcuts
│   │   └── ManualSelect.tsx    # text-select-to-redact handler
│   └── upload/
│       └── DropZone.tsx
└── tests/
    └── e2e/                    # Playwright (added in Plan 4)
```

---

## Phase A — Foundation (Tasks 1-3)

Goal: a runnable Next.js dev server you can open in a browser, with the design language committed to and the store wired up. Should feel polished even before any feature exists.

---

## Task 1: Scaffold Next.js + Tailwind + design tokens

**Files:**
- Modify: `web/package.json`
- Create: `web/next.config.mjs`
- Create: `web/postcss.config.mjs`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Create: `web/app/globals.css`
- Create: `web/src/ui/design-tokens.ts`
- Modify: `web/tsconfig.json` (add JSX, paths)

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/rynfar/Downloads/hudscrub-project/web
npm install next@latest react@latest react-dom@latest --legacy-peer-deps
npm install --save-dev @types/react@latest @types/react-dom@latest --legacy-peer-deps
npm install tailwindcss @tailwindcss/postcss postcss autoprefixer --legacy-peer-deps
npm install geist framer-motion zustand lucide-react --legacy-peer-deps
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-toast --legacy-peer-deps
```

- [ ] **Step 2: Update tsconfig.json**

Replace `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "outDir": "dist",
    "rootDir": ".",
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["src/**/*", "tests/**/*", "scripts/**/*", "app/**/*", "next-env.d.ts"],
  "exclude": ["node_modules", "dist", ".next"]
}
```

Note: `verbatimModuleSyntax: false` because Next.js JSX transform doesn't need it; existing TS code from Plans 1+2 uses ES module syntax that survives.

- [ ] **Step 3: Update package.json scripts**

Add to `scripts`:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start"
}
```

- [ ] **Step 4: Create next.config.mjs**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // mupdf and pdfjs ship WASM/worker assets — let webpack handle them as URLs
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['mupdf', '@huggingface/transformers'],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Create postcss.config.mjs**

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 6: Create design tokens**

Create `web/src/ui/design-tokens.ts`:

```typescript
export const colors = {
  // Surfaces
  bg: '#FAFAF7',           // warm off-white background
  surface: '#FFFFFF',      // raised panels (subtle)
  surfaceMuted: '#F4F3EE', // input bg, secondary surfaces

  // Text
  ink: '#1A1A1A',          // primary text
  inkMuted: '#5C5C5A',     // secondary text
  inkSubtle: '#9A9A95',    // tertiary text, captions

  // Accent (warm amber — singular accent across the app)
  accent: '#B7791F',
  accentSoft: 'rgba(183, 121, 31, 0.12)',
  accentBorder: 'rgba(183, 121, 31, 0.4)',

  // Span states (each pairs color with shape — not color alone)
  spanRegex: '#16744D',         // green: high-confidence, auto-acceptable
  spanRegexSoft: 'rgba(22, 116, 77, 0.1)',
  spanLlmHigh: '#B7791F',       // amber: needs review, model confident
  spanLlmHighSoft: 'rgba(183, 121, 31, 0.12)',
  spanLlmLow: '#C25E1A',        // burnt orange: needs review, low confidence
  spanLlmLowSoft: 'rgba(194, 94, 26, 0.12)',
  spanManual: '#6B4FA3',        // muted plum: user-added
  spanManualSoft: 'rgba(107, 79, 163, 0.12)',
  spanRejected: '#9A9A95',      // gray: explicitly rejected

  // Status
  danger: '#A8341B',
  border: 'rgba(26, 26, 26, 0.08)',
  borderStrong: 'rgba(26, 26, 26, 0.16)',
} as const;

export const spacing = {
  // Use tailwind's spacing scale; this is for explicit constants in motion / layout calcs
  pageMargin: 24,
  surfacePadding: 20,
  contentMaxWidth: 1280,
} as const;

export const motion = {
  spring: { type: 'spring' as const, stiffness: 380, damping: 32 },
  springSoft: { type: 'spring' as const, stiffness: 220, damping: 28 },
  snap: { type: 'spring' as const, stiffness: 600, damping: 36 },
  duration: {
    micro: 0.12,
    small: 0.18,
    medium: 0.24,
  },
} as const;

export const typography = {
  fontSans: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif',
  fontMono: 'var(--font-geist-mono), "IBM Plex Mono", SFMono-Regular, Menlo, monospace',
} as const;
```

- [ ] **Step 7: Create globals.css**

Create `web/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-bg: #FAFAF7;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F4F3EE;
  --color-ink: #1A1A1A;
  --color-ink-muted: #5C5C5A;
  --color-ink-subtle: #9A9A95;
  --color-accent: #B7791F;
  --color-accent-soft: rgba(183, 121, 31, 0.12);
  --color-border: rgba(26, 26, 26, 0.08);
  --color-border-strong: rgba(26, 26, 26, 0.16);
  --font-sans: var(--font-geist-sans), -apple-system, sans-serif;
  --font-mono: var(--font-geist-mono), "IBM Plex Mono", monospace;
}

html, body {
  background-color: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  border-color: var(--color-border);
}

/* Subtle, characterful selection color (amber tint, not browser blue) */
::selection {
  background-color: var(--color-accent-soft);
  color: var(--color-ink);
}

/* Focus ring: visible but not loud */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 2px;
}

button {
  cursor: pointer;
}
```

- [ ] **Step 8: Create root layout**

Create `web/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'hudscrub',
  description: 'Review and redact HUD-1 closing documents on your device',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create the landing page (deliberately minimal but designed)**

Create `web/app/page.tsx`:

```typescript
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-10">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]">
            hudscrub
          </p>
          <h1 className="text-4xl md:text-5xl tracking-tight text-[color:var(--color-ink)] font-medium">
            Redact and review HUD-1 closing documents.
          </h1>
          <p className="text-base text-[color:var(--color-ink-muted)] leading-relaxed">
            Detection runs on your device. PDFs never leave your browser.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm
                     bg-[color:var(--color-ink)] text-[color:var(--color-bg)]
                     hover:bg-[#2a2a2a] transition-colors"
        >
          Get started
        </button>

        <p className="text-xs font-mono text-[color:var(--color-ink-subtle)]">
          v0.1 · foundation
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Run dev server and verify**

```bash
cd web
npm run dev
```

Open `http://localhost:3000`. Expected: a quiet, deliberate landing page. Off-white background, dark heading, single dark button. No gradients, no decoration, plenty of breathing room. Looks intentional.

- [ ] **Step 11: Commit**

```bash
git add web/package.json web/package-lock.json web/tsconfig.json \
        web/next.config.mjs web/postcss.config.mjs \
        web/app/layout.tsx web/app/page.tsx web/app/globals.css \
        web/src/ui/design-tokens.ts
git commit -m "feat(ui): scaffold Next.js with design tokens and landing page"
```

---

## Task 2: Zustand state stores with localStorage persistence

**Files:**
- Create: `web/src/store/settings-store.ts`
- Create: `web/src/store/document-store.ts`
- Create: `web/src/store/name-lists-store.ts`
- Create: `web/tests/unit/store.test.ts`

These are the in-memory + persisted state per the spec's data model section. Three stores, each with a single responsibility.

- [ ] **Step 1: Create the settings store**

Create `web/src/store/settings-store.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Mode, SpanLabel } from '../types.js';

export type ModelId = 'bert-ner' | 'phi-4-mini' | 'gemma-3-4b' | 'qwen-2.5-7b' | 'regex-only';

export interface Settings {
  mode: Mode;
  enabledRegexPatterns: SpanLabel[];
  llmEnabled: boolean;
  selectedModel: ModelId;
  detectionPasses: 1 | 2 | 3;
  sandboxSeed?: number;
  autoAcceptRegex: boolean;
  hasCompletedOnboarding: boolean;
}

const DEFAULTS: Settings = {
  mode: 'redact',
  enabledRegexPatterns: ['SSN', 'EIN', 'PHONE', 'EMAIL', 'DATE', 'LOAN_NUM'],
  llmEnabled: true,
  selectedModel: 'bert-ner',
  detectionPasses: 2,
  autoAcceptRegex: true,
  hasCompletedOnboarding: false,
};

interface SettingsActions {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set((s) => ({ ...s, ...patch })),
      reset: () => set(() => ({ ...DEFAULTS })),
    }),
    {
      name: 'hudscrub.settings.v1',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : undefinedStorage())),
      partialize: ({ set: _set, reset: _reset, ...state }) => state,
    },
  ),
);

// Server-side rendering safe stub
function undefinedStorage() {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}
```

- [ ] **Step 2: Create the name-lists store**

Create `web/src/store/name-lists-store.ts`:

```typescript
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
  add: (name: string) => string; // returns new id
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
              ? { ...l, entries: [...l.entries.filter((e) => e.original !== entry.original), entry] }
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
```

- [ ] **Step 3: Create the document store (in-memory only — no localStorage)**

Create `web/src/store/document-store.ts`:

```typescript
import { create } from 'zustand';
import type { Span } from '../types.js';

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
  fileBytes: ArrayBuffer; // never persisted
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
      documents: s.documents[id] ? { ...s.documents, [id]: { ...s.documents[id], status } } : s.documents,
    })),
  setProgress: (id, currentPage, totalPages) =>
    set((s) => {
      const d = s.documents[id];
      if (!d) return s;
      return {
        documents: { ...s.documents, [id]: { ...d, detectionProgress: { currentPage, totalPages } } },
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
```

- [ ] **Step 4: Test stores**

Create `web/tests/unit/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettings } from '../../src/store/settings-store.js';
import { useDocuments } from '../../src/store/document-store.js';
import { useNameLists } from '../../src/store/name-lists-store.js';

beforeEach(() => {
  useSettings.getState().reset();
  useDocuments.getState().clearAll();
  // name lists: clear via direct setState since there's no reset
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
      pages: [{
        pageNum: 0,
        text: '',
        width: 100,
        height: 100,
        spans: [{
          id: 's1', source: 'regex', label: 'SSN', text: '111-11-1111', start: 0, end: 11,
          bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: 0 }, confidence: 1, decision: 'pending',
        }],
        status: 'ready',
      }],
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
```

- [ ] **Step 5: Run tests**

```bash
cd web && npm run test:unit -- store
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add web/src/store/ web/tests/unit/store.test.ts
git commit -m "feat(state): Zustand stores for settings, documents, name lists"
```

---

## Task 3: App shell + visual primitives

**Files:**
- Create: `web/src/ui/Button.tsx`
- Create: `web/src/ui/PillBadge.tsx`
- Create: `web/src/ui/Kbd.tsx`
- Create: `web/src/ui/Surface.tsx`
- Create: `web/src/ui/AppHeader.tsx`
- Modify: `web/app/layout.tsx` (add header)
- Modify: `web/app/page.tsx` (use new Button)

These are the small visual primitives that establish the language. Each is intentionally restrained.

- [ ] **Step 1: Button**

Create `web/src/ui/Button.tsx`:

```typescript
'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[color:var(--color-ink)] text-[color:var(--color-bg)] hover:bg-[#2a2a2a]',
  secondary: 'bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink)] hover:bg-[#ECEAE3] border border-[color:var(--color-border)]',
  ghost: 'bg-transparent text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)]',
  danger: 'bg-transparent text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)]',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
```

- [ ] **Step 2: PillBadge — for span types, status indicators**

Create `web/src/ui/PillBadge.tsx`:

```typescript
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'regex' | 'llm-high' | 'llm-low' | 'manual' | 'rejected' | 'accent';

interface Props {
  tone?: Tone;
  children: ReactNode;
  monospace?: boolean;
}

const toneClasses: Record<Tone, string> = {
  neutral:    'text-[color:var(--color-ink-muted)] bg-[color:var(--color-surface-muted)]',
  regex:      'text-[#0F5F3D] bg-[rgba(22,116,77,0.1)]',
  'llm-high': 'text-[#8B5A14] bg-[rgba(183,121,31,0.12)]',
  'llm-low':  'text-[#9E4815] bg-[rgba(194,94,26,0.12)]',
  manual:     'text-[#5B4192] bg-[rgba(107,79,163,0.12)]',
  rejected:   'text-[color:var(--color-ink-subtle)] bg-[color:var(--color-surface-muted)] line-through',
  accent:     'text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]',
};

export function PillBadge({ tone = 'neutral', children, monospace = false }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] tracking-wide ${toneClasses[tone]} ${monospace ? 'font-mono' : 'font-medium'}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Kbd — keyboard key visual**

Create `web/src/ui/Kbd.tsx`:

```typescript
import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-[1.5rem] px-1.5 rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[10px] font-mono text-[color:var(--color-ink-muted)] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      {children}
    </kbd>
  );
}
```

- [ ] **Step 4: Surface — the layered card**

Create `web/src/ui/Surface.tsx`:

```typescript
import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  inset?: boolean;
}

export function Surface({ children, inset = false, className = '', ...rest }: Props) {
  return (
    <div
      className={`bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg ${inset ? 'p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: AppHeader**

Create `web/src/ui/AppHeader.tsx`:

```typescript
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
      <div className="max-w-[1280px] mx-auto h-12 px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-sm font-medium tracking-tight text-[color:var(--color-ink)]">
            hudscrub
          </span>
          <span className="text-[10px] font-mono text-[color:var(--color-ink-subtle)] hidden sm:inline">
            v0.1
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/settings"
            className={`px-3 py-1.5 rounded text-xs ${
              pathname === '/settings'
                ? 'text-[color:var(--color-ink)] bg-[color:var(--color-surface-muted)]'
                : 'text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)]'
            }`}
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Update the landing page to use new Button**

Replace `web/app/page.tsx`:

```typescript
import Link from 'next/link';
import { AppHeader } from '@/src/ui/AppHeader';
import { Button } from '@/src/ui/Button';

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center px-6">
        <div className="max-w-xl text-center space-y-10">
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
              On-device PII redaction
            </p>
            <h1 className="text-4xl md:text-5xl tracking-tight text-[color:var(--color-ink)] font-medium leading-[1.1]">
              Review and redact HUD-1 closing documents
              <span className="text-[color:var(--color-ink-subtle)]"> without uploading them.</span>
            </h1>
            <p className="text-base text-[color:var(--color-ink-muted)] leading-relaxed max-w-md mx-auto">
              Detection runs on your device. Your PDFs never leave your browser.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Link href="/onboarding">
              <Button variant="primary" size="lg">
                Get started
              </Button>
            </Link>
            <p className="text-xs text-[color:var(--color-ink-subtle)]">
              Setup takes about two minutes
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 7: Run dev server, screenshot mentally**

```bash
npm run dev
```

Open browser. Expected:
- Header: thin, low-contrast, hudscrub wordmark + version stamp + Settings link
- Centered hero: small caps eyebrow, large medium-weight headline (with subtle ink-subtle continuation), one-line tagline, primary CTA
- No hero image, no feature grid, no logos, no anything else
- Restrained. Considered. Specifically *not* generic.

- [ ] **Step 8: Commit**

```bash
git add web/src/ui/ web/app/page.tsx
git commit -m "feat(ui): app header + Button/Pill/Kbd/Surface primitives"
```

---

## Phase B — Document workflow (Tasks 4-10)

The meat of the app: upload → render → review → export.

---

## Task 4: Upload screen with drop zone

**Files:**
- Create: `web/src/upload/DropZone.tsx`
- Create: `web/app/upload/page.tsx`

- [ ] **Step 1: DropZone component**

Create `web/src/upload/DropZone.tsx`:

```typescript
'use client';
import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onFiles: (files: File[]) => void;
}

export function DropZone({ onFiles }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf');
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files).filter((f) => f.type === 'application/pdf') : [];
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <motion.div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      animate={{
        borderColor: isDragging ? 'rgba(183, 121, 31, 0.6)' : 'rgba(26, 26, 26, 0.16)',
        backgroundColor: isDragging ? 'rgba(183, 121, 31, 0.04)' : 'rgba(255, 255, 255, 0)',
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="border-2 border-dashed rounded-lg p-16 flex flex-col items-center gap-4 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-[color:var(--color-surface-muted)] flex items-center justify-center">
        {/* Simple geometric icon, no Lucide here for variety — just a thin outlined square */}
        <div className="w-5 h-6 border-[1.5px] border-[color:var(--color-ink-muted)] rounded-sm" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[color:var(--color-ink)]">
          Drop a HUD-1 PDF here
        </p>
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          Or
          <label className="ml-1 underline underline-offset-2 cursor-pointer hover:text-[color:var(--color-accent)] transition-colors">
            choose a file
            <input type="file" accept="application/pdf" multiple className="sr-only" onChange={handleSelect} />
          </label>
        </p>
        <p className="text-[11px] font-mono text-[color:var(--color-ink-subtle)] pt-2">
          Files stay on your device. Nothing is uploaded.
        </p>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Upload page**

Create `web/app/upload/page.tsx`:

```typescript
'use client';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/src/ui/AppHeader';
import { DropZone } from '@/src/upload/DropZone';
import { useDocuments } from '@/src/store/document-store';

export default function UploadPage() {
  const router = useRouter();
  const addDoc = useDocuments((s) => s.add);

  const handleFiles = async (files: File[]) => {
    // Read first file, navigate to its review page; multi-doc batches are added to the queue
    let firstId: string | null = null;
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const id = addDoc({
        filename: file.name,
        fileBytes: bytes,
        pages: [],
        status: 'uploading',
        detectionProgress: { currentPage: 0, totalPages: 0 },
      });
      if (!firstId) firstId = id;
    }
    if (firstId) router.push(`/review/${firstId}`);
  };

  return (
    <>
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
              Step 1 of 2
            </p>
            <h2 className="text-2xl tracking-tight font-medium">Upload a document</h2>
          </div>
          <DropZone onFiles={handleFiles} />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Update landing CTA to link to /upload (skipping onboarding for now)**

In `web/app/page.tsx`, change `<Link href="/onboarding">` to `<Link href="/upload">`. Onboarding becomes a Plan-3-Phase-C task.

- [ ] **Step 4: Run, drag a fixture in, observe**

```bash
npm run dev
# Open http://localhost:3000 → click Get started → drop tests/fixtures/hud1_garcia.pdf
```

Expected: smooth drop hover state (amber tint subtle); navigate to /review/<uuid> (which 404s for now — fixed in Task 5).

- [ ] **Step 5: Commit**

```bash
git add web/src/upload/ web/app/upload/ web/app/page.tsx
git commit -m "feat(ui): upload page with drop zone and spring-animated hover state"
```

---

## Task 5: PDF.js renderer in browser

**Files:**
- Create: `web/src/pdf/browser-renderer.ts`
- Create: `web/src/review/PdfPage.tsx`
- Create: `web/app/review/[docId]/page.tsx`

- [ ] **Step 1: PDF.js wrapper**

Create `web/src/pdf/browser-renderer.ts`:

```typescript
'use client';
// Browser-only PDF.js wrapper. Loads the worker as a URL via the new dist API.
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc as unknown as string;
}

export interface RenderedPage {
  pageNum: number;
  width: number;       // in CSS pixels at scale=1.5
  height: number;
  text: string;        // extracted text content
  textItems: Array<{ str: string; transform: number[]; width: number; height: number }>;
  render: (canvas: HTMLCanvasElement) => Promise<void>;
}

export interface LoadedBrowserPdf {
  numPages: number;
  getPage(pageIndex: number): Promise<RenderedPage>;
}

export async function loadPdfInBrowser(bytes: ArrayBuffer): Promise<LoadedBrowserPdf> {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  return {
    numPages: doc.numPages,
    async getPage(pageIndex: number) {
      const page = await doc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 1.5 });
      const textContent = await page.getTextContent();
      const text = textContent.items.map((it: any) => it.str).join(' ');
      return {
        pageNum: pageIndex,
        width: viewport.width,
        height: viewport.height,
        text,
        textItems: textContent.items.map((it: any) => ({
          str: it.str,
          transform: it.transform,
          width: it.width,
          height: it.height,
        })),
        async render(canvas: HTMLCanvasElement) {
          const ctx = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
        },
      };
    },
  };
}
```

- [ ] **Step 2: PdfPage component**

Create `web/src/review/PdfPage.tsx`:

```typescript
'use client';
import { useEffect, useRef } from 'react';
import type { RenderedPage } from '@/src/pdf/browser-renderer';

interface Props {
  page: RenderedPage;
}

export function PdfPage({ page }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    page.render(canvasRef.current).catch((e) => console.error('render failed', e));
  }, [page]);

  return (
    <div
      className="relative bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] mx-auto"
      style={{ width: page.width, height: page.height }}
    >
      <canvas ref={canvasRef} className="block" />
      {/* Span overlays go here in Task 6 */}
    </div>
  );
}
```

- [ ] **Step 3: Review page (minimal, just shows the PDF)**

Create `web/app/review/[docId]/page.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppHeader } from '@/src/ui/AppHeader';
import { useDocuments } from '@/src/store/document-store';
import { loadPdfInBrowser, type RenderedPage } from '@/src/pdf/browser-renderer';
import { PdfPage } from '@/src/review/PdfPage';

export default function ReviewPage() {
  const { docId } = useParams<{ docId: string }>();
  const doc = useDocuments((s) => s.documents[docId as string]);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      const pdf = await loadPdfInBrowser(doc.fileBytes);
      const out: RenderedPage[] = [];
      for (let i = 0; i < pdf.numPages; i++) {
        out.push(await pdf.getPage(i));
      }
      if (!cancelled) {
        setPages(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  if (!doc) {
    return (
      <>
        <AppHeader />
        <main className="max-w-2xl mx-auto px-6 py-16 text-center text-[color:var(--color-ink-muted)]">
          Document not found. <a href="/upload" className="text-[color:var(--color-accent)] underline">Upload one.</a>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="max-w-[1280px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-mono text-[color:var(--color-ink-muted)]">{doc.filename}</h2>
        </div>
        {loading && (
          <p className="text-sm text-[color:var(--color-ink-muted)]">Loading…</p>
        )}
        <div className="space-y-8">
          {pages.map((p) => (
            <PdfPage key={p.pageNum} page={p} />
          ))}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Run, upload, see PDF**

```bash
npm run dev
```

Drop a fixture, watch the PDF render.

If pdfjs-dist worker loading fails: check next.config.mjs `experimental.serverComponentsExternalPackages` includes `pdfjs-dist`, or move the worker src import to a dynamic block. Iterate until the PDF renders.

- [ ] **Step 5: Commit**

```bash
git add web/src/pdf/browser-renderer.ts web/src/review/PdfPage.tsx web/app/review/
git commit -m "feat(ui): PDF.js render in browser; review page shows uploaded PDF"
```

---

## Task 6: Span overlay rendering on PDF pages

**Files:**
- Create: `web/src/review/SpanOverlay.tsx`
- Modify: `web/src/review/PdfPage.tsx` (add overlay layer)

- [ ] **Step 1: SpanOverlay component**

Create `web/src/review/SpanOverlay.tsx`:

```typescript
'use client';
import type { Span } from '@/src/types';
import { motion } from 'framer-motion';

interface Props {
  span: Span;
  pageWidth: number;
  pageHeight: number;
  pdfWidth: number;
  pdfHeight: number;
  focused: boolean;
  onClick?: () => void;
}

const styleByState = (s: Span, focused: boolean): { className: string; layer: 'outline' | 'fill' | 'strike' } => {
  if (s.decision === 'accepted') {
    return { className: 'bg-[rgba(22,116,77,0.18)] border-[1.5px] border-[#16744D]', layer: 'fill' };
  }
  if (s.decision === 'rejected') {
    return { className: 'bg-transparent border border-dashed border-[color:var(--color-ink-subtle)]', layer: 'strike' };
  }
  // pending
  if (s.source === 'manual') {
    return { className: 'bg-[rgba(107,79,163,0.06)] border-[1.5px] border-[#6B4FA3]', layer: 'outline' };
  }
  if (s.source === 'regex') {
    return { className: 'bg-[rgba(22,116,77,0.06)] border-[1.5px] border-[#16744D]', layer: 'outline' };
  }
  if (s.confidence < 0.85) {
    return { className: 'bg-[rgba(194,94,26,0.06)] border-[1.5px] border-dashed border-[#C25E1A]', layer: 'outline' };
  }
  return { className: 'bg-[rgba(183,121,31,0.06)] border-[1.5px] border-[#B7791F]', layer: 'outline' };
};

export function SpanOverlay({ span, pageWidth, pageHeight, pdfWidth, pdfHeight, focused, onClick }: Props) {
  // PDF coords: bbox.x, bbox.y in PDF user space (origin top-left after PDF.js viewport).
  // Scale to canvas pixel space.
  const sx = pageWidth / pdfWidth;
  const sy = pageHeight / pdfHeight;
  const left = span.bbox.x * sx;
  const top = span.bbox.y * sy;
  const width = span.bbox.width * sx;
  const height = span.bbox.height * sy;
  const { className } = styleByState(span, focused);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        scale: focused ? 1.02 : 1,
        boxShadow: focused ? '0 0 0 3px rgba(183, 121, 31, 0.25)' : '0 0 0 0 rgba(0,0,0,0)',
      }}
      transition={{ type: 'spring', stiffness: 600, damping: 36 }}
      className={`absolute rounded-[2px] ${className}`}
      style={{ left, top, width, height }}
      aria-label={`${span.label}: ${span.text}`}
    />
  );
}
```

- [ ] **Step 2: Update PdfPage to render overlays**

Replace `web/src/review/PdfPage.tsx`:

```typescript
'use client';
import { useEffect, useRef } from 'react';
import type { RenderedPage } from '@/src/pdf/browser-renderer';
import type { Span } from '@/src/types';
import { SpanOverlay } from './SpanOverlay';

interface Props {
  page: RenderedPage;
  spans: Span[];
  focusedSpanId?: string | null;
  onSpanClick?: (spanId: string) => void;
}

export function PdfPage({ page, spans, focusedSpanId, onSpanClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    page.render(canvasRef.current).catch((e) => console.error('render failed', e));
  }, [page]);

  return (
    <div
      className="relative bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] mx-auto"
      style={{ width: page.width, height: page.height }}
    >
      <canvas ref={canvasRef} className="block" />
      <div className="absolute inset-0">
        {spans.map((s) => (
          <SpanOverlay
            key={s.id}
            span={s}
            pageWidth={page.width}
            pageHeight={page.height}
            pdfWidth={page.width / 1.5}   // scale 1.5 inverse, gives PDF user-space dim
            pdfHeight={page.height / 1.5}
            focused={focusedSpanId === s.id}
            onClick={() => onSpanClick?.(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modify the review page to pass spans**

Replace `web/app/review/[docId]/page.tsx` (just the JSX of `<PdfPage>` call):

```typescript
{pages.map((p) => (
  <PdfPage
    key={p.pageNum}
    page={p}
    spans={doc.pages[p.pageNum]?.spans ?? []}
  />
))}
```

(spans will be empty until detection runs in Task 9 — that's fine, the overlay layer is in place)

- [ ] **Step 4: Commit**

```bash
git add web/src/review/SpanOverlay.tsx web/src/review/PdfPage.tsx web/app/review/[docId]/page.tsx
git commit -m "feat(ui): span overlay layer with state-aware visual treatment"
```

---

## Task 7: Detection runner in browser + sidebar with span list

**Files:**
- Create: `web/src/detection/browser-runner.ts`
- Create: `web/src/review/SpanSidebar.tsx`
- Create: `web/src/review/DocumentView.tsx`
- Modify: `web/app/review/[docId]/page.tsx`

- [ ] **Step 1: Browser runner — kicks off regex+NER detection per page**

Create `web/src/detection/browser-runner.ts`:

```typescript
'use client';
import { detectPage } from '@/src/detection/index';
import { RegexDetector } from '@/src/detection/detectors/regex-detector';
import { NerDetector } from '@/src/detection/ner/ner-detector';
import { loadTransformersNer } from '@/src/detection/ner/transformers-loader';
import type { Span, Detector } from '@/src/types';
import type { RenderedPage } from '@/src/pdf/browser-renderer';

let nerSingleton: NerDetector | null = null;

export async function getDetectors(opts: { useNer: boolean; onLoadProgress?: (p: number) => void }): Promise<Detector[]> {
  const out: Detector[] = [new RegexDetector()];
  if (opts.useNer) {
    if (!nerSingleton) {
      nerSingleton = new NerDetector({ loader: loadTransformersNer });
    }
    await nerSingleton.ensureLoaded((p) => {
      if (p.status === 'downloading' && opts.onLoadProgress) opts.onLoadProgress(p.progress);
    });
    out.push(nerSingleton);
  }
  return out;
}

/**
 * Compute char-offset → bbox for a PDF.js page, similar to the Node-side extract.ts.
 * PDF.js textItems carry their own transform matrices. We approximate per-line by walking items.
 */
function pageToBboxLookup(page: RenderedPage) {
  // Build [textOffset, item, charStart] table
  interface Entry {
    item: RenderedPage['textItems'][number];
    start: number;
    end: number;
  }
  const entries: Entry[] = [];
  let cursor = 0;
  for (const it of page.textItems) {
    entries.push({ item: it, start: cursor, end: cursor + it.str.length });
    cursor += it.str.length + 1; // +1 for the space we joined with
  }
  return (start: number, end: number) => {
    // Find items spanning [start, end]
    const overlapping = entries.filter((e) => e.start < end && start < e.end);
    if (overlapping.length === 0) return null;
    // PDF.js transform: [a, b, c, d, e, f] — we want e (x) and f (y). Height roughly d.
    // Convert from PDF coords to viewport coords. RenderedPage was rendered at scale 1.5,
    // but transform values are in PDF user space. The PdfPage component scales by pageWidth/pdfWidth.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const o of overlapping) {
      const t = o.item.transform;
      const itemX = t[4];
      const itemY = t[5];
      const itemW = o.item.width;
      const itemH = o.item.height || 12;
      // PDF y is bottom-up; convert: viewport y = pageHeight - itemY - itemH.
      // We let SpanOverlay handle the final scale; here output in PDF user-space coords (origin top).
      // Easiest: return bbox in unscaled PDF coords; SpanOverlay's pdfWidth/pdfHeight do the conversion.
      const yTop = itemY; // assumes PDF.js viewport already flipped — inspect output
      minX = Math.min(minX, itemX);
      minY = Math.min(minY, yTop);
      maxX = Math.max(maxX, itemX + itemW);
      maxY = Math.max(maxY, yTop + itemH);
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };
}

export async function detectDocument(
  pages: RenderedPage[],
  detectors: Detector[],
  onPageDone: (pageNum: number, spans: Span[]) => void,
): Promise<void> {
  for (const page of pages) {
    const detected = await detectPage(page.text, detectors);
    const lookup = pageToBboxLookup(page);
    const spansWithBoxes: Span[] = [];
    for (const s of detected) {
      const bb = lookup(s.start, s.end);
      if (!bb) continue;
      spansWithBoxes.push({ ...s, bbox: { ...bb, pageNum: page.pageNum } });
    }
    onPageDone(page.pageNum, spansWithBoxes);
  }
}
```

> **Note for implementer:** PDF.js coordinate handling is genuinely tricky. The first iteration may have spans drawn in slightly wrong positions. Verify visually after Step 5 of this task. If overlays are y-flipped or off, adjust the `yTop` calculation in `pageToBboxLookup` (try `pageHeight - itemY - itemH` to flip). PDF.js viewport orientation is the usual gotcha.

- [ ] **Step 2: SpanSidebar component**

Create `web/src/review/SpanSidebar.tsx`:

```typescript
'use client';
import { motion } from 'framer-motion';
import type { Span } from '@/src/types';
import { PillBadge } from '@/src/ui/PillBadge';

interface Props {
  spans: Span[];
  focusedSpanId?: string | null;
  onSelect: (spanId: string) => void;
  onAccept: (spanId: string) => void;
  onReject: (spanId: string) => void;
}

const labelOrder = ['SSN', 'EIN', 'PHONE', 'EMAIL', 'DATE', 'LOAN_NUM', 'NAME', 'ADDRESS', 'OTHER', 'CUSTOM'];

const toneForSpan = (s: Span): 'regex' | 'llm-high' | 'llm-low' | 'manual' | 'rejected' => {
  if (s.decision === 'rejected') return 'rejected';
  if (s.source === 'manual') return 'manual';
  if (s.source === 'regex') return 'regex';
  return s.confidence >= 0.85 ? 'llm-high' : 'llm-low';
};

export function SpanSidebar({ spans, focusedSpanId, onSelect, onAccept, onReject }: Props) {
  if (spans.length === 0) {
    return (
      <aside className="w-80 shrink-0 border-l border-[color:var(--color-border)] p-6 text-sm text-[color:var(--color-ink-muted)]">
        No spans detected on this page.
      </aside>
    );
  }

  // Group by label
  const byLabel = new Map<string, Span[]>();
  for (const s of spans) {
    const arr = byLabel.get(s.label) ?? [];
    arr.push(s);
    byLabel.set(s.label, arr);
  }
  const orderedLabels = labelOrder.filter((l) => byLabel.has(l));

  return (
    <aside className="w-80 shrink-0 border-l border-[color:var(--color-border)] overflow-y-auto">
      <div className="px-5 py-4 border-b border-[color:var(--color-border)]">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono">
          Detections
        </p>
        <p className="text-sm text-[color:var(--color-ink)] mt-0.5">{spans.length} on this page</p>
      </div>
      <div className="divide-y divide-[color:var(--color-border)]">
        {orderedLabels.map((label) => (
          <div key={label} className="py-3">
            <p className="px-5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono mb-2">
              {label}
            </p>
            <ul>
              {byLabel.get(label)!.map((s) => (
                <li key={s.id}>
                  <motion.button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    whileHover={{ backgroundColor: 'rgba(26, 26, 26, 0.03)' }}
                    transition={{ duration: 0.12 }}
                    className={`w-full text-left px-5 py-2 flex items-center gap-3 ${
                      focusedSpanId === s.id ? 'bg-[color:var(--color-surface-muted)]' : ''
                    }`}
                  >
                    <PillBadge tone={toneForSpan(s)}>·</PillBadge>
                    <span className="font-mono text-xs truncate flex-1">{s.text}</span>
                    {s.decision === 'accepted' && <span className="text-[10px] text-[#16744D]">✓</span>}
                    {s.decision === 'rejected' && <span className="text-[10px] text-[color:var(--color-ink-subtle)]">×</span>}
                    {s.decision === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAccept(s.id);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#16744D] text-white hover:bg-[#0F5F3D]"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReject(s.id);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-surface-muted)] text-[color:var(--color-ink-muted)] hover:bg-[#ECEAE3]"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </motion.button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: DocumentView shell — composes PdfPage + SpanSidebar**

Create `web/src/review/DocumentView.tsx`:

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useDocuments, type DocumentSession } from '@/src/store/document-store';
import { useSettings } from '@/src/store/settings-store';
import { loadPdfInBrowser, type RenderedPage } from '@/src/pdf/browser-renderer';
import { detectDocument, getDetectors } from '@/src/detection/browser-runner';
import { PdfPage } from './PdfPage';
import { SpanSidebar } from './SpanSidebar';

interface Props {
  doc: DocumentSession;
}

export function DocumentView({ doc }: Props) {
  const settings = useSettings();
  const setStatus = useDocuments((s) => s.setStatus);
  const setPage = useDocuments((s) => s.setPage);
  const updateSpan = useDocuments((s) => s.updateSpan);

  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [focusedSpanId, setFocusedSpanId] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdf = await loadPdfInBrowser(doc.fileBytes);
      const out: RenderedPage[] = [];
      for (let i = 0; i < pdf.numPages; i++) out.push(await pdf.getPage(i));
      if (cancelled) return;
      setPages(out);

      // Initialize empty pages in the store
      out.forEach((p, idx) => {
        setPage(doc.id, idx, {
          pageNum: idx,
          text: p.text,
          width: p.width,
          height: p.height,
          spans: [],
          status: 'pending',
        });
      });

      setStatus(doc.id, 'detecting');
      const detectors = await getDetectors({
        useNer: settings.llmEnabled,
        onLoadProgress: (p) => setLoadProgress(p),
      });

      await detectDocument(out, detectors, (pageNum, spans) => {
        if (cancelled) return;
        setPage(doc.id, pageNum, {
          pageNum,
          text: out[pageNum].text,
          width: out[pageNum].width,
          height: out[pageNum].height,
          spans,
          status: 'ready',
        });
      });
      setStatus(doc.id, 'reviewing');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  const pageState = doc.pages[currentPage];
  const spans = pageState?.spans ?? [];
  const renderedPage = pages[currentPage];

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <div className="flex-1 overflow-auto py-8 px-6">
        {pages.length === 0 && (
          <p className="text-center text-sm text-[color:var(--color-ink-muted)]">
            {loadProgress > 0 ? `Loading model… ${Math.round(loadProgress * 100)}%` : 'Loading PDF…'}
          </p>
        )}
        {renderedPage && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-[color:var(--color-ink-muted)]">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-2 py-1 rounded hover:bg-[color:var(--color-surface-muted)] disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ← prev
              </button>
              <span>page {currentPage + 1} / {pages.length}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                disabled={currentPage >= pages.length - 1}
                className="px-2 py-1 rounded hover:bg-[color:var(--color-surface-muted)] disabled:opacity-30 disabled:hover:bg-transparent"
              >
                next →
              </button>
            </div>
            <PdfPage
              page={renderedPage}
              spans={spans}
              focusedSpanId={focusedSpanId}
              onSpanClick={setFocusedSpanId}
            />
          </div>
        )}
      </div>
      <SpanSidebar
        spans={spans}
        focusedSpanId={focusedSpanId}
        onSelect={setFocusedSpanId}
        onAccept={(spanId) => updateSpan(doc.id, currentPage, spanId, { decision: 'accepted' })}
        onReject={(spanId) => updateSpan(doc.id, currentPage, spanId, { decision: 'rejected' })}
      />
    </div>
  );
}
```

- [ ] **Step 4: Replace the review page to use DocumentView**

Replace `web/app/review/[docId]/page.tsx`:

```typescript
'use client';
import { useParams } from 'next/navigation';
import { AppHeader } from '@/src/ui/AppHeader';
import { useDocuments } from '@/src/store/document-store';
import { DocumentView } from '@/src/review/DocumentView';

export default function ReviewPage() {
  const { docId } = useParams<{ docId: string }>();
  const doc = useDocuments((s) => s.documents[docId as string]);

  if (!doc) {
    return (
      <>
        <AppHeader />
        <main className="max-w-2xl mx-auto px-6 py-16 text-center text-[color:var(--color-ink-muted)]">
          Document not found. <a href="/upload" className="text-[color:var(--color-accent)] underline">Upload one.</a>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <DocumentView doc={doc} />
    </>
  );
}
```

- [ ] **Step 5: Run, drop a fixture, observe**

```bash
npm run dev
```

Expected:
- Drop fixture → /review/<id>
- "Loading PDF…" briefly
- "Loading model… 42%" while NER downloads (first time only)
- PDF renders centered with subtle paper-shadow
- Span overlays appear progressively (regex first, NER after)
- Sidebar lists detected spans grouped by label

If overlays are misaligned, iterate on `pageToBboxLookup` in `browser-runner.ts`. The PDF.js viewport orientation is the usual gotcha.

- [ ] **Step 6: Commit**

```bash
git add web/src/detection/browser-runner.ts web/src/review/SpanSidebar.tsx web/src/review/DocumentView.tsx web/app/review/[docId]/page.tsx
git commit -m "feat(ui): in-browser detection (regex + NER) with sidebar review"
```

---

## Task 8: Keyboard shortcuts

**Files:**
- Create: `web/src/review/KeyboardLayer.tsx`
- Modify: `web/src/review/DocumentView.tsx`

- [ ] **Step 1: KeyboardLayer**

Create `web/src/review/KeyboardLayer.tsx`:

```typescript
'use client';
import { useEffect } from 'react';
import type { Span } from '@/src/types';

interface Props {
  spans: Span[];
  focusedSpanId: string | null;
  onSetFocus: (id: string | null) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export function KeyboardLayer({
  spans, focusedSpanId, onSetFocus, onAccept, onReject, onNextPage, onPrevPage,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const pendingSpans = spans.filter((s) => s.decision === 'pending');
      const idx = focusedSpanId ? pendingSpans.findIndex((s) => s.id === focusedSpanId) : -1;

      if (e.key === 'Tab') {
        e.preventDefault();
        const next = e.shiftKey
          ? (idx <= 0 ? pendingSpans.length - 1 : idx - 1)
          : (idx + 1) % Math.max(pendingSpans.length, 1);
        if (pendingSpans[next]) onSetFocus(pendingSpans[next].id);
      } else if (e.key === 'Enter' && focusedSpanId) {
        e.preventDefault();
        onAccept(focusedSpanId);
        // auto-advance
        if (pendingSpans[idx + 1]) onSetFocus(pendingSpans[idx + 1].id);
      } else if (e.key === 'Backspace' && focusedSpanId) {
        e.preventDefault();
        onReject(focusedSpanId);
        if (pendingSpans[idx + 1]) onSetFocus(pendingSpans[idx + 1].id);
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        onNextPage();
      } else if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey) {
        onPrevPage();
      } else if (e.key.toLowerCase() === 'a' && !e.metaKey && !e.ctrlKey) {
        for (const s of pendingSpans) onAccept(s.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [spans, focusedSpanId, onSetFocus, onAccept, onReject, onNextPage, onPrevPage]);

  return null;
}
```

- [ ] **Step 2: Wire into DocumentView**

In `web/src/review/DocumentView.tsx`, just before the closing `</div>` of the outer flex container, add:

```typescript
<KeyboardLayer
  spans={spans}
  focusedSpanId={focusedSpanId}
  onSetFocus={setFocusedSpanId}
  onAccept={(spanId) => updateSpan(doc.id, currentPage, spanId, { decision: 'accepted' })}
  onReject={(spanId) => updateSpan(doc.id, currentPage, spanId, { decision: 'rejected' })}
  onNextPage={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
  onPrevPage={() => setCurrentPage((p) => Math.max(0, p - 1))}
/>
```

And add the import:

```typescript
import { KeyboardLayer } from './KeyboardLayer';
```

- [ ] **Step 3: Add keyboard hint footer**

In `DocumentView.tsx`, just below the page content, add:

```typescript
<div className="border-t border-[color:var(--color-border)] py-2 px-6 flex items-center gap-4 text-[11px] text-[color:var(--color-ink-subtle)]">
  <span className="flex items-center gap-1.5"><Kbd>Tab</Kbd> next</span>
  <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> accept</span>
  <span className="flex items-center gap-1.5"><Kbd>⌫</Kbd> reject</span>
  <span className="flex items-center gap-1.5"><Kbd>A</Kbd> accept all</span>
  <span className="flex items-center gap-1.5"><Kbd>N</Kbd>/<Kbd>P</Kbd> next/prev page</span>
</div>
```

Add `import { Kbd } from '@/src/ui/Kbd';`. The footer goes inside the outer flex but below — restructure if needed (use `flex-col`).

- [ ] **Step 4: Commit**

```bash
git add web/src/review/KeyboardLayer.tsx web/src/review/DocumentView.tsx
git commit -m "feat(ui): keyboard shortcuts and visible hint footer"
```

---

## Task 9: Manual span addition (text selection → R)

**Files:**
- Create: `web/src/review/ManualSelect.tsx`
- Modify: `web/src/review/DocumentView.tsx`

This is harder than it looks because PDF.js renders to canvas — there's no browser text selection on a canvas. We need to overlay a transparent text layer (PDF.js provides this via `TextLayer`).

- [ ] **Step 1: Render PDF.js text layer for selection**

Update `web/src/pdf/browser-renderer.ts`'s `RenderedPage.render` to also produce a text layer. This is non-trivial — PDF.js exposes `TextLayer` for this purpose. Add a second method `renderTextLayer(div: HTMLDivElement)`:

Add to `RenderedPage`:
```typescript
renderTextLayer: (container: HTMLDivElement) => Promise<void>;
```

Implement in the loader:

```typescript
async renderTextLayer(container: HTMLDivElement) {
  // PDF.js provides TextLayer in pdfjs-dist. Approach:
  //   import { TextLayer } from 'pdfjs-dist';
  //   const tl = new TextLayer({ textContentSource: textContent, container, viewport });
  //   await tl.render();
  // The TextLayer creates absolutely positioned spans matching the canvas.
  const { TextLayer } = await import('pdfjs-dist');
  container.innerHTML = '';
  const tl = new TextLayer({ textContentSource: textContent, container, viewport });
  await tl.render();
},
```

> If `TextLayer` import path or constructor shape differs in the installed pdfjs-dist version, check the .d.ts and adapt. The behavior we want: the container ends up filled with absolutely positioned `<span>` elements matching each text item, allowing native browser text selection.

- [ ] **Step 2: Add text layer to PdfPage**

In `web/src/review/PdfPage.tsx`, add a `<div ref={textLayerRef} className="absolute inset-0 select-text" />` between the canvas and the spans overlay div, and call `page.renderTextLayer(textLayerRef.current!)` in the same useEffect.

- [ ] **Step 3: ManualSelect handler**

Create `web/src/review/ManualSelect.tsx`:

```typescript
'use client';
import { useEffect } from 'react';

interface Props {
  enabled: boolean;
  onAddManual: (selectedText: string) => void;
}

export function ManualSelect({ enabled, onAddManual }: Props) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.metaKey || e.ctrlKey) return;
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 1) {
        e.preventDefault();
        onAddManual(text);
        selection?.removeAllRanges();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onAddManual]);
  return null;
}
```

- [ ] **Step 4: Wire into DocumentView**

```typescript
import { ManualSelect } from './ManualSelect';
import { randomUUID } from '@/src/util/uuid'; // simple wrapper around crypto.randomUUID

// inside JSX:
<ManualSelect
  enabled={true}
  onAddManual={(text) => {
    // Find text in current page text, compute char range
    const offset = pageState?.text.indexOf(text) ?? -1;
    if (offset < 0 || !renderedPage) return;
    // Approximate bbox: use first textItem containing the substring
    // (more robust impl is a follow-up — Plan 4 polish)
    addSpan(doc.id, currentPage, {
      id: crypto.randomUUID(),
      source: 'manual',
      label: 'CUSTOM',
      text,
      start: offset,
      end: offset + text.length,
      bbox: { x: 100, y: 100, width: 200, height: 14, pageNum: currentPage }, // placeholder
      confidence: 1.0,
      decision: 'accepted',
    });
  }}
/>
```

(import `addSpan = useDocuments((s) => s.addSpan)`)

> **Honest note:** computing the bbox from a free-text selection on PDF.js text layer is its own subtask. For Plan 3, the placeholder above is acceptable — a follow-up in Plan 4 (polish) computes the actual bbox from the DOM range. Mark as a known incomplete in Task 17 (final acceptance).

- [ ] **Step 5: Commit**

```bash
git add web/src/review/ManualSelect.tsx web/src/pdf/browser-renderer.ts web/src/review/PdfPage.tsx web/src/review/DocumentView.tsx
git commit -m "feat(ui): manual span addition via text-select + R (placeholder bbox)"
```

---

## Phase C — Polish (Tasks 10-17)

---

## Task 10: Streaming detection — review pages as they finish

The detection runner already calls `onPageDone` per page. The DocumentView's `setPage` already updates the store per page. Streaming is *already working* — verify with a multi-page PDF and the user can review page 1 while page 5 is still detecting.

- [ ] **Step 1: Verify by uploading a fixture and watching the sidebar populate page-by-page**

If the spans only appear after all pages are done, debug: the issue is likely React batching all updates together. Wrap each `setPage` in `flushSync` from `react-dom`, or split by `await new Promise(setTimeout)` between pages, OR use Zustand's transient subscriptions to render mid-detection.

- [ ] **Step 2: Add a small "detecting…" indicator in the sidebar header**

In `SpanSidebar.tsx`, accept a `detecting?: boolean` prop and render a subtle animated dot if true.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ui): per-page streaming detection (verified)"
```

---

## Task 11: Export — apply approved spans, download

**Files:**
- Create: `web/src/export/exporter.ts`
- Create: `web/src/review/ExportButton.tsx`
- Modify: `web/src/review/DocumentView.tsx`

- [ ] **Step 1: Browser export — bridges to Plan 1's redactDocument**

Create `web/src/export/exporter.ts`:

```typescript
'use client';
import { redactDocument } from '@/src/output/redactor';
import { ValueMapper } from '@/src/mapping/value-mapper';
import { verifyDollarPreservation } from '@/src/output/dollar-verifier';
import { loadPdfInBrowser } from '@/src/pdf/browser-renderer';
import type { DocumentSession } from '@/src/store/document-store';
import type { Mode, Span } from '@/src/types';

export interface ExportResult {
  bytes: Uint8Array;
  mappings?: Record<string, Record<string, string>>;
  spanCount: number;
  warning?: string;
}

export async function exportDocument(
  doc: DocumentSession,
  mode: Mode,
  seed?: number,
): Promise<ExportResult> {
  const acceptedSpans: Span[] = [];
  const mapper = mode === 'sandbox' ? new ValueMapper(seed) : null;
  for (const page of doc.pages) {
    for (const s of page.spans) {
      if (s.decision !== 'accepted') continue;
      const span = { ...s };
      if (mapper) span.replacement = mapper.mapValue(s.label, s.text);
      acceptedSpans.push(span);
    }
  }

  const out = await redactDocument(doc.fileBytes, acceptedSpans, { mode });

  // Re-extract via PDF.js for the dollar verifier
  const inputPdf = await loadPdfInBrowser(doc.fileBytes);
  const inputPages: string[] = [];
  for (let i = 0; i < inputPdf.numPages; i++) {
    inputPages.push((await inputPdf.getPage(i)).text);
  }
  const outputPdf = await loadPdfInBrowser(out.buffer.slice(0) as ArrayBuffer);
  const outputPages: string[] = [];
  for (let i = 0; i < outputPdf.numPages; i++) {
    outputPages.push((await outputPdf.getPage(i)).text);
  }
  const verification = verifyDollarPreservation(inputPages, outputPages);
  return {
    bytes: out,
    mappings: mapper ? mapper.getMappingReport() : undefined,
    spanCount: acceptedSpans.length,
    warning: verification.ok ? undefined : 'Dollar verification failed — check the output before using.',
  };
}

export function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

> **Important caveat:** Plan 1's `redactDocument` runs mupdf.js in Node. mupdf ships a browser WASM build too (`mupdf/dist/mupdf.js` is ESM and works in browsers). This *should* work in browser but verify — the import shape may be different. If it fails, the redactor may need a thin browser-side wrapper. Iterate.

- [ ] **Step 2: ExportButton and download flow**

Create `web/src/review/ExportButton.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { Button } from '@/src/ui/Button';
import { useSettings } from '@/src/store/settings-store';
import { exportDocument, triggerDownload } from '@/src/export/exporter';
import type { DocumentSession } from '@/src/store/document-store';

export function ExportButton({ doc }: { doc: DocumentSession }) {
  const settings = useSettings();
  const [exporting, setExporting] = useState(false);

  const allDecided = doc.pages.every((p) => p.spans.every((s) => s.decision !== 'pending'));

  return (
    <Button
      variant="primary"
      size="sm"
      disabled={exporting || !allDecided}
      onClick={async () => {
        setExporting(true);
        try {
          const result = await exportDocument(doc, settings.mode, settings.sandboxSeed);
          if (result.warning) console.warn(result.warning);
          const suffix = settings.mode === 'redact' ? '.redacted.pdf' : '.sandboxed.pdf';
          const baseName = doc.filename.replace(/\.pdf$/, '');
          triggerDownload(result.bytes, `${baseName}${suffix}`);
          if (result.mappings) {
            const mapBlob = new Blob([JSON.stringify(result.mappings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(mapBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${baseName}.mappings.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        } finally {
          setExporting(false);
        }
      }}
    >
      {exporting ? 'Exporting…' : allDecided ? 'Export PDF' : 'Review remaining spans first'}
    </Button>
  );
}
```

- [ ] **Step 3: Add Export button to DocumentView header area**

In `DocumentView.tsx`, add a top bar above the PDF viewer with the Export button on the right. Keep the design quiet.

- [ ] **Step 4: Commit**

```bash
git add web/src/export/ web/src/review/ExportButton.tsx web/src/review/DocumentView.tsx
git commit -m "feat(ui): export with mupdf.js in browser, download trigger"
```

---

## Task 12: Onboarding flow + model picker

**Files:**
- Create: `web/app/onboarding/page.tsx`
- Create: `web/src/onboarding/ModelPicker.tsx`
- Modify: `web/app/page.tsx` (link to /onboarding when not yet onboarded)

- [ ] **Step 1: Model registry**

Add to `web/src/store/settings-store.ts`:

```typescript
export interface ModelOption {
  id: ModelId;
  name: string;
  sizeLabel: string;
  speedLabel: string;
  qualityLabel: string;
  description: string;
  requiresWebGPU: boolean;
}

export const MODELS: ModelOption[] = [
  { id: 'bert-ner', name: 'Fast — works on any device', sizeLabel: '110 MB', speedLabel: 'Instant', qualityLabel: 'Good', description: 'Good for older machines or quick trials.', requiresWebGPU: false },
  { id: 'phi-4-mini', name: 'Balanced — recommended', sizeLabel: '2.3 GB', speedLabel: '~5s/page', qualityLabel: 'High', description: 'Best for most users. ~3 minutes for a 10-page document.', requiresWebGPU: true },
  { id: 'gemma-3-4b', name: 'High quality (Gemma 3 4B)', sizeLabel: '2.5 GB', speedLabel: '~5s/page', qualityLabel: 'High', description: 'Different strengths than Balanced.', requiresWebGPU: true },
  { id: 'qwen-2.5-7b', name: 'Highest quality (slow)', sizeLabel: '4.5 GB', speedLabel: '~12s/page', qualityLabel: 'Highest', description: 'M-series Mac or RTX 3060+ recommended.', requiresWebGPU: true },
  { id: 'regex-only', name: 'Regex only (no AI)', sizeLabel: '0 MB', speedLabel: 'Instant', qualityLabel: 'Limited', description: 'Names and addresses must be added manually.', requiresWebGPU: false },
];
```

- [ ] **Step 2: ModelPicker component**

Create `web/src/onboarding/ModelPicker.tsx`:

```typescript
'use client';
import { motion } from 'framer-motion';
import { MODELS, type ModelId } from '@/src/store/settings-store';
import { PillBadge } from '@/src/ui/PillBadge';

interface Props {
  selected: ModelId;
  onSelect: (id: ModelId) => void;
  webGpuAvailable: boolean;
}

export function ModelPicker({ selected, onSelect, webGpuAvailable }: Props) {
  return (
    <div className="space-y-2">
      {MODELS.map((m) => {
        const disabled = m.requiresWebGPU && !webGpuAvailable;
        const isSelected = selected === m.id;
        return (
          <motion.button
            type="button"
            key={m.id}
            disabled={disabled}
            onClick={() => onSelect(m.id)}
            whileHover={{ borderColor: 'rgba(183, 121, 31, 0.4)' }}
            transition={{ duration: 0.12 }}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              isSelected
                ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[color:var(--color-ink)]">{m.name}</p>
                <p className="text-xs text-[color:var(--color-ink-muted)]">{m.description}</p>
                {disabled && (
                  <p className="text-[11px] text-[color:var(--color-ink-subtle)] mt-1">
                    Requires WebGPU (not available in this browser)
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <PillBadge tone="neutral" monospace>{m.sizeLabel}</PillBadge>
                <PillBadge tone="neutral" monospace>{m.speedLabel}</PillBadge>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Onboarding page**

Create `web/app/onboarding/page.tsx`:

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/src/ui/AppHeader';
import { Button } from '@/src/ui/Button';
import { ModelPicker } from '@/src/onboarding/ModelPicker';
import { useSettings, type ModelId } from '@/src/store/settings-store';

export default function OnboardingPage() {
  const router = useRouter();
  const settings = useSettings();
  const [selected, setSelected] = useState<ModelId>(settings.selectedModel);
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);

  useEffect(() => {
    setWebGpuAvailable(typeof navigator !== 'undefined' && 'gpu' in navigator);
  }, []);

  return (
    <>
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
            Setup
          </p>
          <h2 className="text-2xl tracking-tight font-medium">Pick a detection model</h2>
          <p className="text-sm text-[color:var(--color-ink-muted)] leading-relaxed">
            The model runs entirely on your device. You can change this later in Settings.
          </p>
        </div>

        <ModelPicker selected={selected} onSelect={setSelected} webGpuAvailable={webGpuAvailable} />

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/upload')}
          >
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              settings.set({ selectedModel: selected, hasCompletedOnboarding: true });
              router.push('/upload');
            }}
          >
            Continue
          </Button>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Landing page redirect logic**

In `web/app/page.tsx`, change the CTA button to:

```typescript
<Link href={settings.hasCompletedOnboarding ? '/upload' : '/onboarding'}>
```

(Make the page a client component or use a server-side check via cookies — for v1, client-side is fine.)

- [ ] **Step 5: Commit**

```bash
git add web/app/onboarding/ web/src/onboarding/ web/app/page.tsx web/src/store/settings-store.ts
git commit -m "feat(ui): onboarding model picker"
```

---

## Task 13: Settings page

**Files:**
- Create: `web/app/settings/page.tsx`

- [ ] **Step 1: Implement**

Create `web/app/settings/page.tsx`:

```typescript
'use client';
import { AppHeader } from '@/src/ui/AppHeader';
import { ModelPicker } from '@/src/onboarding/ModelPicker';
import { Surface } from '@/src/ui/Surface';
import { useSettings } from '@/src/store/settings-store';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const settings = useSettings();
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);
  useEffect(() => setWebGpuAvailable(typeof navigator !== 'undefined' && 'gpu' in navigator), []);

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <h2 className="text-2xl tracking-tight font-medium">Settings</h2>

        <Surface inset>
          <div className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-[color:var(--color-ink-subtle)] font-mono">
              Mode
            </h3>
            <div className="flex gap-3">
              {(['redact', 'sandbox'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => settings.set({ mode: m })}
                  className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                    settings.mode === m
                      ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-ink)]'
                      : 'border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)]'
                  }`}
                >
                  {m === 'redact' ? 'Redact (black box)' : 'Sandbox (fake replacements)'}
                </button>
              ))}
            </div>
          </div>
        </Surface>

        <Surface inset>
          <div className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wider text-[color:var(--color-ink-subtle)] font-mono">
              Detection model
            </h3>
            <ModelPicker
              selected={settings.selectedModel}
              onSelect={(id) => settings.set({ selectedModel: id })}
              webGpuAvailable={webGpuAvailable}
            />
          </div>
        </Surface>

        <Surface inset>
          <div className="space-y-3">
            <h3 className="text-sm font-medium uppercase tracking-wider text-[color:var(--color-ink-subtle)] font-mono">
              Reset
            </h3>
            <p className="text-sm text-[color:var(--color-ink-muted)]">
              Wipe all locally stored settings and name lists. Documents in memory are not affected.
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset all settings to defaults?')) settings.reset();
              }}
              className="text-sm text-[#A8341B] hover:underline"
            >
              Reset to defaults
            </button>
          </div>
        </Surface>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/settings/
git commit -m "feat(ui): settings page (mode, model, reset)"
```

---

## Task 14: WebLLM detector (deferred until basic flow works — minimal stub)

For Plan 3 v1, WebLLM detector is a placeholder. The model picker shows the options, but selecting `phi-4-mini` etc. just falls back to NER with a console warning. Real WebLLM integration is a Plan-3-late or Plan-4 task.

**Files:**
- Create: `web/src/llm/webllm-detector.ts` (stub)

- [ ] **Step 1: Stub implementation**

```typescript
'use client';
import type { Detector, Span } from '@/src/types';

export class WebLlmDetector implements Detector {
  readonly name: string;
  constructor(public readonly modelId: string) {
    this.name = `webllm:${modelId}`;
  }
  async detect(_text: string, _alreadyFound: Span[]): Promise<Span[]> {
    console.warn(`WebLLM detector for ${this.modelId} not yet implemented — returning no spans`);
    return [];
  }
}
```

- [ ] **Step 2: Update browser-runner to skip WebLLM gracefully**

In `getDetectors`, only return NER for `bert-ner`. For other model IDs, log a warning and return the NER detector as fallback (with a note).

- [ ] **Step 3: Commit**

```bash
git add web/src/llm/webllm-detector.ts web/src/detection/browser-runner.ts
git commit -m "feat(ui): WebLLM detector stub (real impl deferred to Plan 4)"
```

---

## Task 15: Final polish pass

- [ ] **Step 1: Add a quiet "no PII detected on this page" empty state to PdfPage area**
- [ ] **Step 2: Add Framer Motion AnimatePresence for span overlays appearing as detection completes**
- [ ] **Step 3: Add a Toast for "Exported to Downloads" feedback**
- [ ] **Step 4: Test on Chrome + Safari + Firefox; capture issues in a punch list**
- [ ] **Step 5: Commit polish improvements (one commit per discrete change)**

---

## Task 16: Acceptance + tag

- [ ] **Step 1: Run dev server, drop a fixture, walk through the full flow**

  - Landing → onboarding (or skip) → upload → review → keyboard accept/reject → export
  - Verify: PDF renders, spans overlay correctly, sidebar groups by label, keyboard works, export downloads a redacted PDF

- [ ] **Step 2: Run all tests still pass**

```bash
cd web && npm test
RUN_NER_TESTS=1 npm test
```

- [ ] **Step 3: Tag**

```bash
cd /Users/rynfar/Downloads/hudscrub-project
git tag -a review-ui-v1 -m "Plan 3 (Review UI) complete: Next.js app with detection + review + export"
```

---

## Acceptance criteria for Plan 3

- [ ] App runs locally via `npm run dev`
- [ ] Landing page has a deliberate, non-generic visual identity
- [ ] Upload → review flow works end-to-end on a fixture
- [ ] Spans render as overlays on the PDF page
- [ ] Sidebar lists spans grouped by label, with accept/reject actions
- [ ] Keyboard shortcuts work (Tab/Enter/Backspace/N/P/A)
- [ ] Manual span addition via text-select + R works (placeholder bbox OK)
- [ ] Export produces a downloadable redacted PDF
- [ ] Plan 1 + Plan 2 tests still pass
- [ ] Onboarding model picker exists; settings page exists
- [ ] WebLLM models are listed but fall back to NER (real WebLLM integration is Plan 4)

---

## Follow-on (Plan 4)

| Plan 4 — Polish + deploy |
|---|
| Real WebLLM integration (Phi-4-mini and Gemma 3 4B in browser) |
| Multi-document batch UI (queue, shared mapper) |
| Real bbox computation for manual spans |
| Privacy-assertion E2E test (no PDF bytes leave browser) |
| Cross-browser Playwright matrix |
| PWA manifest + service worker for offline-first |
| Vercel deployment + custom domain |
