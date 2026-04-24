# hudscrub-web — Design Spec

**Date:** 2026-04-24
**Status:** Draft, pending user review
**Owner:** rynfar

## Purpose

Replace the current Python CLI (`hudscrub`) with a browser-based web app that performs PII redaction on HUD-1 closing documents with a **human-in-the-loop review layer** and **on-device AI detection**. The app must preserve the existing tool's hard guarantee — dollar amounts pass through byte-identical — while adding name/address detection (which the current regex-only CLI cannot reliably do) and giving the reviewer manual control to accept, reject, or add redactions.

The Python CLI is retired upon delivery of v1.

## Non-goals (v1)

- Multi-user accounts, team-shared name lists, or any backend persistence beyond the user's own browser
- Authentication (the app is publicly accessible at its Vercel URL)
- Cloud-based LLM inference (privacy requirement: no PII may be sent to any third party)
- OCR for image-only PDFs (user runs `ocrmypdf` first)
- Mobile / touch UI optimization (desktop keyboard-driven workflow only)
- Internationalization (English UI only in v1)

## Core invariants (load-bearing)

1. **PDF bytes never leave the user's browser.** Only Vercel static assets cross the network in production. Privacy-assertion E2E test enforces this on every commit.
2. **Dollar amounts pass through byte-identical** between input and output PDFs. Three-layer enforcement: detector filter, mapper rejection, pre-export verifier.
3. **Detection is swappable.** A `Detector` interface lets us swap models (regex, bert-NER, Phi-4-mini, Gemma 3 4B, Qwen 2.5 7B) without touching pipeline, UI, or output code.
4. **Sandbox consistency:** within a session, the same original value always maps to the same fake, across pages and across documents in a batch.

---

## 1. Architecture

```
Browser (everything sensitive lives here)
  ├─ PDF.js                  (render + text extraction)
  ├─ Detection pipeline      (regex → LLM passes → merge)
  │   └─ WebLLM / Transformers.js  (in-browser inference)
  ├─ Review UI               (overlays, accept/reject, manual add)
  ├─ mupdf.js                (apply redactions, write output PDF)
  └─ localStorage            (settings + custom name lists; never PII)

Vercel
  ├─ Static Next.js assets   (UI + WASM models served from CDN)
  └─ No serverless functions handling PII (none in v1)
```

**Key design choices:**

- **Hard separation:** PDF bytes, extracted text, and detected spans live only in browser memory. The server cannot read them even if compromised.
- **Static-first:** Next.js App Router with no server actions in v1. Pure SPA shape, deployed to Vercel.
- **Detector layering:** regex first (fast, deterministic, ~100% precise on structured PII), LLM passes second (names, addresses, anything contextual). Minimizes LLM workload and keeps the dollar invariant trivially intact.
- **Models cached in IndexedDB.** First visit downloads ~110MB to ~4.5GB depending on model choice; subsequent visits load instantly.
- **No auth in v1.** Anyone with the URL can use the tool. Acceptable because PDFs never leave the user's browser. Mitigation: `robots.txt` + `noindex` to keep it out of search engines.

---

## 2. Data model

No database. All state lives in browser memory (per-session) or localStorage (across sessions).

### Runtime types (per session, in memory)

```typescript
type DocumentSession = {
  id: string;
  filename: string;
  fileBytes: ArrayBuffer;        // never leaves browser
  pages: PageSession[];
  status: 'uploading' | 'detecting' | 'ready_for_review' | 'reviewing' | 'exported';
  detectionProgress: { currentPage: number; totalPages: number; currentPass: 0 | 1 | 2 | 3 };
  createdAt: number;
};

type PageSession = {
  pageNum: number;
  text: string;                  // extracted by PDF.js
  spans: DetectedSpan[];
  status: 'pending' | 'detecting' | 'ready' | 'reviewed';
};

type DetectedSpan = {
  id: string;
  source: 'regex' | 'llm-names' | 'llm-addresses' | 'llm-other' | 'manual';
  label: 'SSN' | 'EIN' | 'PHONE' | 'EMAIL' | 'DATE' | 'LOAN_NUM' | 'NAME' | 'ADDRESS' | 'OTHER';
  text: string;
  bbox: { x: number; y: number; width: number; height: number; pageNum: number };
  confidence: number;            // regex = 1.0, LLM varies
  decision: 'pending' | 'accepted' | 'rejected';
  replacement?: string;          // sandbox mode
};
```

### localStorage schema

```typescript
// localStorage["hudscrub.settings.v1"]
type Settings = {
  mode: 'redact' | 'sandbox';
  enabledRegexPatterns: string[];
  llmEnabled: boolean;
  selectedModel: 'bert-ner' | 'phi-4-mini' | 'gemma-3-4b' | 'qwen-2.5-7b' | 'regex-only';
  detectionPasses: 1 | 2 | 3;     // 2 = default (names + addresses), 3 = + catchall
  sandboxSeed?: number;
  autoAcceptRegex: boolean;       // default true
};

// localStorage["hudscrub.namelists.v1"]
type CustomNameList = {
  id: string;
  name: string;
  entries: { original: string; replacement?: string }[];
  createdAt: number;
};

// localStorage["hudscrub.history.v1"]
type ExportRecord = {
  filename: string;
  pageCount: number;
  spanCount: { accepted: number; rejected: number; manual: number };
  exportedAt: number;
};
```

### Deliberately NOT persisted

- PDF bytes
- Extracted text
- Detected span text
- Anything carrying real document content

If the user closes the tab mid-review, that document is lost. Re-upload re-detects.

### Export / import

A single `Settings → Export` button produces:

```typescript
type SettingsExport = {
  version: 1;
  exportedAt: number;
  settings: Settings;
  nameLists: NameLists;
};
```

---

## 3. Detection pipeline

### Module layout

```
src/detection/
├── index.ts                # public API: detectPage(text, opts) → Span[]
├── regex.ts                # ports existing Python patterns
├── llm/
│   ├── client.ts           # WebLLM wrapper
│   ├── prompts.ts          # few-shot prompts
│   ├── pass-names.ts
│   ├── pass-addresses.ts
│   └── pass-other.ts       # opt-in via "Deep scan" button
├── ner/
│   └── transformers-ner.ts # Transformers.js bert-base-NER detector
├── merge.ts                # dedupe, regex wins ties
└── bbox.ts                 # char-offset → PDF rect via PDF.js
```

### Detector interface

```typescript
interface Detector {
  name: string;
  detect(text: string, alreadyFound: Span[]): Promise<Span[]>;
}
```

### Default composition (Balanced model, 2-pass mode)

```typescript
const detectors = [
  new RegexDetector(),                    // SSN, EIN, phone, email, date, loan #
  new LLMDetector('names'),               // PERSON
  new LLMDetector('addresses'),           // STREET_ADDRESS + city/state/ZIP
  // Pass 3 ('other') only included when user clicks Deep Scan
];
```

### Pipeline runner

```typescript
async function detectPage(text: string, detectors: Detector[]): Promise<Span[]> {
  let spans: Span[] = [];
  for (const detector of detectors) {
    const newSpans = await detector.detect(text, spans);
    spans = mergeSpans(spans, newSpans);
  }
  return spans;
}
```

### LLM prompt strategy

Each pass gets a narrow prompt with HUD-1-specific few-shot examples. Output is JSON-constrained via WebLLM's grammar/schema feature. Example for the names pass is in §3.4 below.

### Span merge rules

1. Regex always wins over LLM
2. Larger LLM span wins over smaller (catch full name)
3. Earlier-pass label wins over later-pass for same text
4. Manually-added spans never auto-removed
5. Forbidden-span guard drops anything overlapping a dollar amount

### Bounding-box mapping

PDF.js `getTextContent()` gives text items with PDF coordinates. Build `charOffset → bbox` map at extract time, look up at detect time. Spans crossing multiple text items: union the bboxes.

### Forbidden-span guard

```typescript
function isForbiddenSpan(span: Span): boolean {
  return overlapsAnyDollarAmount(span);
}
```

### Model registry

```typescript
const MODELS: ModelOption[] = [
  { id: 'bert-ner',     name: 'Fast — works on any device',  engine: 'transformers.js',
    sizeMB: 110,  requiresWebGPU: false, speedTier: 'instant', qualityTier: 'good' },
  { id: 'phi-4-mini',   name: 'Balanced — recommended',      engine: 'webllm',
    sizeMB: 2300, requiresWebGPU: true,  speedTier: 'fast',    qualityTier: 'high' },
  { id: 'gemma-3-4b',   name: 'High quality',                engine: 'webllm',
    sizeMB: 2500, requiresWebGPU: true,  speedTier: 'fast',    qualityTier: 'high' },
  { id: 'qwen-2.5-7b',  name: 'Highest quality (slow)',      engine: 'webllm',
    sizeMB: 4500, requiresWebGPU: true,  speedTier: 'slow',    qualityTier: 'highest' },
  { id: 'regex-only',   name: 'Regex only (no AI)',          engine: 'none',
    sizeMB: 0,    requiresWebGPU: false, speedTier: 'instant', qualityTier: 'limited' },
];
```

At build time, the registry is verified against the WebLLM `prebuiltAppConfig` catalog; if a listed model is no longer in the catalog, the build fails with a clear error so we can update the registry.

### Onboarding flow (first visit only)

1. Brief intro (one screen, "Get started")
2. Model picker (the registry above)
3. Download progress for chosen model (with per-byte progress, ETA, "why this is needed" copy)
4. Quick tour (3 dismissible cards: drop a PDF, accept/reject spans, highlight to add)
5. Upload screen

After first visit, app boots straight to the upload screen. Settings → Detection Model lets users change later (re-runs picker + download flow if a new model is chosen).

### Latency expectations (M-series Mac, Phi-4-mini, 2-pass default)

| Doc size | Default 2-pass | + Deep Scan (3-pass) |
|---|---|---|
| 3-page HUD-1 | ~2 min | ~3 min |
| 10-page packet | ~5.5 min | ~8 min |
| 50-page packet | ~27 min | ~40 min |

Streaming review (pages flow into the review UI as detection finishes them, in order) makes time-to-first-reviewable-page ~30 sec, not the full document time.

---

## 4. Review UX

Single-page focus mode, keyboard-driven, designed for the reviewer flying through a packet with confidence.

### Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  hud1_garcia.pdf · Page 12 / 50 · Mode: Redact   [Settings][Export]│
├────────────────────────────────────────────────────────────────────┤
│ ┌─────┐                                              ┌────────────┐│
│ │ 1 ✓ │   ╔════════════════════════════════════╗     │ This page  ││
│ │ ... │   ║                                     ║     │            ││
│ │ 12 •│   ║   PDF page rendered with overlays   ║     │ Names (3)  ││
│ │ 13 ⏳│   ║                                     ║     │ Address(1) ││
│ │ ... │   ╚═════════════════════════════════════╝     │ Other (2)  ││
│ └─────┘                                              └────────────┘│
├────────────────────────────────────────────────────────────────────┤
│ Tab=next span · Enter=accept · Bksp=reject · R=add manual · ?=help │
└────────────────────────────────────────────────────────────────────┘
```

### Span visual states

| State | Appearance |
|---|---|
| Regex high-confidence | Green outline, auto-accepted (toggle in settings) |
| LLM pending high-conf (>0.85) | Solid amber outline |
| LLM pending low-conf (<0.85) | Dashed orange outline + warning icon |
| Accepted | Green fill, semi-transparent |
| Rejected | Gray strikethrough |
| Manually added | Purple outline |

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Cycle pending spans on current page |
| `Enter` | Accept focused span |
| `Backspace` | Reject focused span |
| `Space` | Toggle focused span |
| `A` | Accept all pending on this page |
| `Shift+A` | Accept all pending in document (with confirm) |
| `N` / `P` | Next / previous page |
| `Shift+N` | Next page with pending spans |
| `R` | Add redaction from current text selection |
| `M` | Open manual draw mode (drag rectangle) |
| `/` | Search within document |
| `?` | Show shortcuts |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / redo |

### Manual span addition

1. **Text selection**: select text → press `R` → span added at selection bbox
2. **Rectangle draw**: press `M` → crosshair cursor → drag → span added at drawn rect

For sandbox mode, an inline input asks for replacement text (or "Auto" for Faker-generated).

### Streaming review

Pages stream into the UI as detection finishes them, in order. Sidebar thumbnails show:
- `✓` reviewed
- `•` ready (pending spans)
- `⏳` still detecting
- `○` clean (no spans)

A "Page N ready" toast each time. User can review pages 1-12 while pages 13-50 are still being analyzed.

### Sandbox mode additions

Each accepted span shows its replacement inline; user can edit before export. A "Mappings" tab in the sidebar shows the full original→fake table.

### Final review screen

Shows accepted/rejected/manual counts, dollar-amount-preserved count, pending-spans warning. Blocks export if any page has unreviewed spans (with a "Jump to first unreviewed" button).

---

## 5. Output & file handling

### Pipeline

```
User clicks "Export"
  → Build redaction operations from accepted spans
  → mupdf.js: addRedactAnnot per span, applyRedactions per page
  → Save → ArrayBuffer → trigger browser download
  → Write export record to localStorage history
```

All in-browser. Output PDF appears in user's Downloads folder via standard `<a download>`.

### True redaction (not overlay)

`mupdf.js` `applyRedactions` removes text from the content stream — same guarantee as the Python version. Selecting/copying the redacted region returns nothing.

- Redact mode: `applyRedactions({ images: 'remove' })` (matches PyMuPDF `images=2`)
- Sandbox mode: `applyRedactions({ images: 'keep' })` (matches PyMuPDF `images=0`)

### Dollar verification at export time

Before writing the file, an integrity check runs:

```typescript
function verifyDollarPreservation(
  inputText: string[],   // per-page text from input
  outputText: string[],  // re-extracted text from output
): VerificationResult
```

Greps `\$\d` patterns from input and output, asserts multisets match per page. **Mismatch blocks export** with a diff display.

### Sandbox `ValueMapper` (TS port)

Direct port of the Python `mapping.py`. ~200 lines. Same invariants:
- `(original, seed)` → same fake, always (SHA-256 derived seed)
- Date offset shared across the whole session
- 555 phones, example.com emails, 900-range SSNs
- Per-category caches

Seed is exposed as an optional setting; default is "random per session, persists for the session." Same seed across sessions = same mappings.

### Exported artifacts

Always:
- `<filename>.redacted.pdf` (or `.sandboxed.pdf`)

Optionally (Settings toggle, default on):
- `<filename>.audit.json` — counts, model used, timestamp, settings hash. **No PII** unless user opts in.

Sandbox mode additionally:
- `<filename>.mappings.json` — original→fake table. Gated behind "I understand this contains the original PII" confirmation.

### Multi-document batch

- Drop multiple PDFs at once
- Detection runs in serial (one model, one document at a time)
- Queue panel: detecting / ready / reviewed / exported
- Single shared `ValueMapper` across the batch — same name → same fake across files
- "Export all reviewed" produces individual files or a single .zip

### Memory hygiene

After export: free PDF bytes, clear span arrays, revoke blob URLs. Models stay loaded. "Clear all" button nukes everything in memory and localStorage.

---

## 6. Error handling & edge cases

### Browser capability gates (at app load)

| Check | Behavior on fail |
|---|---|
| WebGPU available | Hide WebLLM models, advise Fast or Regex-only |
| WASM SIMD | Required; full-screen block if missing |
| IndexedDB | Required for caching; ephemeral mode + warning if missing |
| `navigator.deviceMemory < 4` | Default to Fast model, advisory shown |

### PDF input failures

| Case | Behavior |
|---|---|
| Corrupted PDF | "Couldn't read this PDF, it may be corrupted" |
| Password-protected | Prompt for password (in browser); cancel = reject file |
| Scanned-only (no text) | "PDF appears scanned. Run OCR first (`ocrmypdf`)." Allow opening for manual rectangle redactions only. |
| Already-redacted | Detection ignores black-fill regions automatically |
| Non-PDF dropped | Reject with message |
| >100MB | Confirm before opening |
| Form fields | Field values redacted same as static text; AcroForm metadata scrubbed by mupdf |

### Model failures

| Case | Behavior |
|---|---|
| Download interrupted | Resume on retry |
| Download fails permanently | Offer Fast fallback + report-issue link |
| WebGPU init fails | Auto-fallback to Fast, banner shown |
| LLM returns invalid JSON | One retry with stricter prompt; if still bad, log to skipped, continue |
| LLM hallucinates spans not in input | Discard span, log to debug panel |
| LLM hangs >60 sec | Abort, mark page "detection partial," allow manual review |
| Tab backgrounded | Detection throttled by browser; "paused" indicator after 5s hidden |

### Review UX edge cases

| Case | Behavior |
|---|---|
| Unsaved review on tab close | `beforeunload` warning |
| Span overlapping page boundary | Split visually, treat as one logical span |
| Two spans overlap (manual + LLM) | Merge in display, manual wins, "merged from 2 sources" badge |
| Whole-page selection + R | Confirm "redact entire page text?" |
| Text inside an image | User must use rectangle-draw mode |

### localStorage failures

| Case | Behavior |
|---|---|
| QuotaExceededError | "Browser storage full" + suggest model cache panel |
| Settings JSON corrupted | Reset to defaults, backup corrupted JSON to `*.broken` key |
| Schema version migration | Versioned keys; on-load migration |

### Privacy-respecting error reporting

Errors NEVER include file contents, page text, span text, or user file names. Errors MAY include browser/OS, app version, model ID, error type, and app-code stack traces. "Copy error report" button lets user inspect sanitized JSON before sharing.

---

## 7. Testing strategy

### Test pyramid

```
                  ┌──────────────────┐
                  │  E2E tests (~20) │   Playwright in real Chrome with WebGPU
                  ├──────────────────┤
                  │ Integration (~50)│   Vitest + jsdom + real PDF files
                  ├──────────────────┤
                  │   Unit (~200)    │   Vitest, fast, every commit
                  └──────────────────┘
```

### Unit tests

- `detection/regex.ts` — port the existing 33 Python regex tests directly
- `detection/merge.ts` — span-merge precedence rules
- `mapping/value-mapper.ts` — port the existing 15 Python mapping tests
- `output/dollar-verifier.ts` — happy path, missing dollar, added dollar
- `detection/llm/prompts.ts` — snapshot tests on prompts (catch accidental drift in PRs)

Coverage target: ≥90% on `src/detection/`, `src/mapping/`, `src/output/`.

### Integration tests

Real PDF fixtures (committed). Critical groups, ported from the existing Python integration suite:

```typescript
describe('Dollar preservation', () => {
  it('every dollar string survives redact mode byte-for-byte');
  it('every dollar string survives sandbox mode byte-for-byte');
  it('sandbox math: borrower-charge lines still sum to gross-amount-due');
});

describe('Sandbox consistency', () => {
  it('same SSN appearing N times produces N identical fake SSNs');
  it('same name across two documents in batch produces same fake');
  it('determinism: same seed + same input = byte-identical mappings.json');
});

describe('Detection invariants', () => {
  it('LLM is never given dollar amounts to consider');
  it('forbidden-span guard drops any LLM span overlapping a dollar');
  it('regex spans always survive merge over LLM spans');
});

describe('Manual review flow', () => {
  it('rejecting all spans produces unchanged PDF (mod metadata)');
  it('manually adding a span causes that text to be redacted at export');
});
```

LLM tests use a stub detector by default (returns predetermined spans). Real-LLM tests run in a slower CI lane.

### E2E tests (Playwright, real browser, real WebGPU)

Critical paths:

1. First-time onboarding (model select → download → ready)
2. Single-doc happy path (upload → detect → accept → export → verify dollars in output)
3. Multi-doc batch with sandbox consistency (same name → same fake across files)
4. Manual span addition (text selection)
5. Rectangle draw mode
6. Streaming review (review early pages while later pages detect)
7. Export blocked when pending spans remain
8. Synthetic dollar-verification failure blocks export
9. WebGPU fallback (only Fast/Regex offered)
10. **Privacy assertion**: with network panel recording, full upload→detect→review→export cycle. Assert zero requests carry PDF bytes or extracted text. **This is the load-bearing privacy claim test.**

### Slow / scheduled tests (nightly, non-blocking)

- Real-LLM detection quality benchmark on hand-labeled HUD-1 fixtures. Reports recall/precision; >5% regression posts to a tracking issue
- 200-page PDF memory pressure test
- Cross-browser smoke (Chrome, Edge, Firefox, Safari)

### CI configuration

- **PR-blocking** (every commit): unit, integration, e2e, types (tsc --noEmit), lint
- **Nightly**: quality benchmark, memory test, cross-browser matrix

### "No regression" rules

1. Every existing Python test has a TS equivalent before its corresponding feature is complete
2. Every bug fix adds a regression test
3. The dollar-preservation E2E test runs on every commit
4. The privacy-assertion E2E test runs on every commit

### Tools

| Tool | Purpose |
|---|---|
| Vitest | Unit + integration |
| Playwright | E2E in real browsers |
| @testing-library/react | Component tests |
| MSW | Mock service worker (for the few endpoints we have) |
| pdf-parse / mupdf.js | Verify exported PDFs in tests |
| GitHub Actions | CI |

---

## Tech stack summary

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, mostly static) |
| Language | TypeScript |
| PDF rendering | PDF.js (pdfjs-dist) |
| PDF output | mupdf.js (WASM build of MuPDF) |
| LLM in-browser | WebLLM (@mlc-ai/web-llm) |
| NER in-browser | Transformers.js (@xenova/transformers) |
| State | Zustand or React Context (TBD in implementation plan) |
| Storage | localStorage + IndexedDB (model cache) |
| Hosting | Vercel (Hobby for development, Pro for production if commercial use) |
| Auth (v1) | None |
| DB (v1) | None |
| CI | GitHub Actions |
| Testing | Vitest + Playwright |

## Migration plan from existing Python CLI

1. Port `hudscrub/patterns.py` → `src/detection/regex.ts` (with all 33 unit tests)
2. Port `hudscrub/mapping.py` → `src/mapping/value-mapper.ts` (with all 15 unit tests)
3. Port `hudscrub/fixtures.py` → `scripts/gen-fixtures.ts` (regenerate the 3 fake HUD-1 PDFs in TS)
4. Port `hudscrub/processor.py` logic → `src/output/redactor.ts` (mupdf.js-based)
5. Port the integration test suite → Vitest with the same fixtures
6. Build the new layers (detection LLM, review UI, file handling)
7. Once feature parity + new features verified, archive the Python codebase under `legacy/python/` for historical reference and remove from active development

## Browser support matrix

| Browser | Minimum | Notes |
|---|---|---|
| Chrome / Chromium / Edge | 113+ | Full feature set including WebGPU |
| Safari | 17+ (macOS 14+) | Full feature set; WebGPU enabled by default in 18+ |
| Firefox | 121+ | WebGPU behind flag in 121-130, default-on in 131+; users on older versions get Fast/Regex-only |
| Mobile browsers | not supported in v1 | Desktop keyboard workflow assumed |

Older browsers see a one-screen "browser not supported" message with required minimums.

## Accessibility (v1 baseline)

- WCAG 2.1 AA color contrast on all UI text and span overlays
- All keyboard shortcuts also reachable via visible buttons (no keyboard-only operations)
- Focus indicators visible on all interactive elements
- Screen reader labels on icon-only buttons
- Color-coded span states paired with shape/icon variation (don't rely on color alone)

Full accessibility audit is a v2 concern.

## Open questions deferred to implementation plan

- State management library: Zustand vs Jotai vs React Context — picked during implementation based on actual component shape
- Exact React component decomposition for the review UI
- Multi-doc batch export: individual files vs single .zip — picked based on observed UX testing
- PWA support — deferred unless a specific user need surfaces
- Audit log structure — sketched here, detailed in implementation
