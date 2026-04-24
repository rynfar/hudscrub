# hudscrub-web LLM Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a name/address detector to the engine using Transformers.js (bert-base-NER), runnable in both Node (CLI) and the browser (future Plan 3 UI). Establish the multi-pass detection pattern so Plan 3 can add WebLLM-based detectors (Phi/Gemma) as pure additions.

**Architecture:** New `NerDetector` class implements the existing `Detector` interface from Plan 1. Loads `Xenova/bert-base-NER` via `@huggingface/transformers`. Cached on disk locally (Node) and in IndexedDB (browser). Exposes a `loadModel(progress)` method for the future UI's progress bar. The CLI gains a `--detector` flag.

**Why NER, not WebLLM, in Plan 2:** WebLLM requires a browser (WebGPU). We don't have a browser environment until Plan 3. Transformers.js bert-base-NER works in Node, gives us real LLM-style detection now, and ships unchanged into the browser when Plan 3 lands. WebLLM-based Phi/Gemma detectors are added in Plan 3 as the "Balanced" and "High quality" tiers.

**Tech stack additions:** `@huggingface/transformers` (Hugging Face's official fork of @xenova/transformers).

**Reference files:**
- `web/src/types.ts` — Detector interface, SpanLabel
- `web/src/detection/index.ts` — pipeline runner
- `web/src/detection/detectors/regex-detector.ts` — pattern to follow
- `docs/superpowers/specs/2026-04-24-hudscrub-web-design.md` — §3 detection pipeline

---

## File structure (created by this plan)

```
web/
├── src/
│   └── detection/
│       ├── ner/
│       │   ├── ner-detector.ts       # main detector
│       │   ├── label-map.ts          # NER tag → SpanLabel mapping
│       │   ├── alignment.ts          # token-offset → char-offset alignment
│       │   └── progress.ts           # ModelLoadProgress type
│       └── detectors/
│           └── (regex-detector.ts is unchanged)
├── tests/
│   ├── unit/
│   │   ├── ner-label-map.test.ts
│   │   ├── ner-alignment.test.ts
│   │   └── ner-detector.test.ts      # stub-based
│   └── integration/
│       └── ner-real-model.test.ts    # real model, slow lane
└── scripts/
    └── redact-cli.ts                 # modified to support --detector flag
```

---

## Task 1: Install dependency and verify import works

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install @huggingface/transformers**

```bash
cd /Users/rynfar/Downloads/hudscrub-project/web
npm install @huggingface/transformers --legacy-peer-deps
```

Expected: installs successfully. Several hundred MB of dependencies (onnxruntime, sharp).

- [ ] **Step 2: Verify import**

```bash
node --input-type=module -e "
import { pipeline, env } from '@huggingface/transformers';
console.log('pipeline:', typeof pipeline);
console.log('env.cacheDir:', env.cacheDir);
console.log('env.allowRemoteModels:', env.allowRemoteModels);
"
```

Expected: `pipeline: function`, cacheDir is a path string, allowRemoteModels: true.

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore: add @huggingface/transformers dependency"
```

---

## Task 2: NER label mapping

**Files:**
- Create: `web/src/detection/ner/label-map.ts`
- Create: `web/tests/unit/ner-label-map.test.ts`

bert-base-NER (CoNLL-2003) emits 4 entity classes: `PER` (person), `LOC` (location), `ORG` (organization), `MISC` (miscellaneous). With BIO tagging, each token gets `B-PER`, `I-PER`, `B-LOC`, etc.

Mapping to our `SpanLabel`:
- `PER` → `NAME`
- `LOC` → `ADDRESS` (most LOC entities in HUD-1 are addresses; if not, the user can reject in review)
- `ORG` → `OTHER` (banks, title companies — useful to flag, low confidence)
- `MISC` → `OTHER`
- `O` (outside) → no span

- [ ] **Step 1: Write failing test**

Create `web/tests/unit/ner-label-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapNerTag } from '../../src/detection/ner/label-map.js';

describe('mapNerTag', () => {
  it('maps person tags to NAME', () => {
    expect(mapNerTag('B-PER')).toBe('NAME');
    expect(mapNerTag('I-PER')).toBe('NAME');
  });
  it('maps location tags to ADDRESS', () => {
    expect(mapNerTag('B-LOC')).toBe('ADDRESS');
    expect(mapNerTag('I-LOC')).toBe('ADDRESS');
  });
  it('maps organization tags to OTHER', () => {
    expect(mapNerTag('B-ORG')).toBe('OTHER');
  });
  it('maps misc tags to OTHER', () => {
    expect(mapNerTag('B-MISC')).toBe('OTHER');
  });
  it('returns null for outside tag', () => {
    expect(mapNerTag('O')).toBeNull();
  });
  it('returns null for unknown tags', () => {
    expect(mapNerTag('B-WHAT')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd web && npm run test:unit -- ner-label-map
```

- [ ] **Step 3: Implement**

Create `web/src/detection/ner/label-map.ts`:

```typescript
import type { SpanLabel } from '../../types.js';

const MAPPING: Record<string, SpanLabel> = {
  PER: 'NAME',
  LOC: 'ADDRESS',
  ORG: 'OTHER',
  MISC: 'OTHER',
};

export function mapNerTag(tag: string): SpanLabel | null {
  if (tag === 'O') return null;
  // Strip BIO prefix: "B-PER" -> "PER", "I-LOC" -> "LOC"
  const stripped = tag.replace(/^[BI]-/, '');
  return MAPPING[stripped] ?? null;
}
```

- [ ] **Step 4: Run test (expect PASS)**

- [ ] **Step 5: Commit**

```bash
git add web/src/detection/ner/label-map.ts web/tests/unit/ner-label-map.test.ts
git commit -m "feat: NER tag → SpanLabel mapping"
```

---

## Task 3: Adjacent-token entity merging (BIO grouping)

NER pipelines output one entity per token. "Maria L. Garcia" comes back as three adjacent tokens with `B-PER`, `I-PER`, `I-PER`. We need to merge consecutive tokens with the same entity type into a single span.

**Files:**
- Create: `web/src/detection/ner/alignment.ts`
- Create: `web/tests/unit/ner-alignment.test.ts`

- [ ] **Step 1: Write failing test**

Create `web/tests/unit/ner-alignment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { groupBioTokens } from '../../src/detection/ner/alignment.js';
import type { TokenEntity } from '../../src/detection/ner/alignment.js';

describe('groupBioTokens', () => {
  it('groups consecutive same-type tokens into a single entity', () => {
    const tokens: TokenEntity[] = [
      { word: 'Maria', entity: 'B-PER', start: 0, end: 5, score: 0.99 },
      { word: 'L.', entity: 'I-PER', start: 6, end: 8, score: 0.95 },
      { word: 'Garcia', entity: 'I-PER', start: 9, end: 15, score: 0.98 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups).toHaveLength(1);
    expect(groups[0].text).toBe('Maria L. Garcia');
    expect(groups[0].label).toBe('NAME');
    expect(groups[0].start).toBe(0);
    expect(groups[0].end).toBe(15);
  });

  it('starts a new entity on B- tag even if same type follows', () => {
    const tokens: TokenEntity[] = [
      { word: 'Alice', entity: 'B-PER', start: 0, end: 5, score: 0.99 },
      { word: 'Bob', entity: 'B-PER', start: 6, end: 9, score: 0.99 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups).toHaveLength(2);
  });

  it('starts a new entity when the entity type changes', () => {
    const tokens: TokenEntity[] = [
      { word: 'John', entity: 'B-PER', start: 0, end: 4, score: 0.99 },
      { word: 'Boston', entity: 'B-LOC', start: 5, end: 11, score: 0.99 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('NAME');
    expect(groups[1].label).toBe('ADDRESS');
  });

  it('skips O tokens', () => {
    const tokens: TokenEntity[] = [
      { word: 'the', entity: 'O', start: 0, end: 3, score: 0.99 },
      { word: 'Maria', entity: 'B-PER', start: 4, end: 9, score: 0.99 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups).toHaveLength(1);
    expect(groups[0].text).toBe('Maria');
  });

  it('returns the average score for a group', () => {
    const tokens: TokenEntity[] = [
      { word: 'Alex', entity: 'B-PER', start: 0, end: 4, score: 0.9 },
      { word: 'Doe', entity: 'I-PER', start: 5, end: 8, score: 0.7 },
    ];
    const groups = groupBioTokens(tokens);
    expect(groups[0].score).toBeCloseTo(0.8, 5);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd web && npm run test:unit -- ner-alignment
```

- [ ] **Step 3: Implement**

Create `web/src/detection/ner/alignment.ts`:

```typescript
import type { SpanLabel } from '../../types.js';
import { mapNerTag } from './label-map.js';

export interface TokenEntity {
  word: string;
  entity: string;
  start: number;
  end: number;
  score: number;
}

export interface GroupedEntity {
  text: string;
  label: SpanLabel;
  start: number;
  end: number;
  score: number;
}

export function groupBioTokens(tokens: TokenEntity[]): GroupedEntity[] {
  const groups: GroupedEntity[] = [];
  let cur: { tokens: TokenEntity[]; label: SpanLabel } | null = null;

  const flush = () => {
    if (!cur || cur.tokens.length === 0) return;
    const start = cur.tokens[0].start;
    const end = cur.tokens[cur.tokens.length - 1].end;
    const totalScore = cur.tokens.reduce((s, t) => s + t.score, 0);
    groups.push({
      text: cur.tokens.map((t) => t.word).join(' '),
      label: cur.label,
      start,
      end,
      score: totalScore / cur.tokens.length,
    });
    cur = null;
  };

  for (const t of tokens) {
    const label = mapNerTag(t.entity);
    if (!label) {
      flush();
      continue;
    }
    const isBegin = t.entity.startsWith('B-');
    if (isBegin || !cur || cur.label !== label) {
      flush();
      cur = { tokens: [t], label };
    } else {
      cur.tokens.push(t);
    }
  }
  flush();
  return groups;
}
```

- [ ] **Step 4: Run test (expect PASS)**

- [ ] **Step 5: Commit**

```bash
git add web/src/detection/ner/alignment.ts web/tests/unit/ner-alignment.test.ts
git commit -m "feat: BIO token grouping for NER entity merging"
```

---

## Task 4: NER detector with stubbed pipeline (unit test)

**Files:**
- Create: `web/src/detection/ner/ner-detector.ts`
- Create: `web/src/detection/ner/progress.ts`
- Create: `web/tests/unit/ner-detector.test.ts`

We pass the pipeline function in via constructor injection so we can stub it in unit tests. The default factory loads the real model.

- [ ] **Step 1: Write failing test**

Create `web/tests/unit/ner-detector.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NerDetector } from '../../src/detection/ner/ner-detector.js';
import type { TokenEntity } from '../../src/detection/ner/alignment.js';

const makePipeline = (output: TokenEntity[]) =>
  vi.fn(async (_text: string) => output);

describe('NerDetector', () => {
  it('returns Spans built from grouped NER output', async () => {
    const stub = makePipeline([
      { word: 'Maria', entity: 'B-PER', start: 0, end: 5, score: 0.99 },
      { word: 'Garcia', entity: 'I-PER', start: 6, end: 12, score: 0.97 },
    ]);
    const d = new NerDetector({ loader: async () => stub });
    await d.ensureLoaded();
    const spans = await d.detect('Maria Garcia signed', []);
    expect(spans).toHaveLength(1);
    expect(spans[0].label).toBe('NAME');
    expect(spans[0].text).toBe('Maria Garcia');
    expect(spans[0].source).toBe('llm-names');
    expect(spans[0].confidence).toBeGreaterThan(0.9);
  });

  it('skips spans below the score threshold', async () => {
    const stub = makePipeline([
      { word: 'Bob', entity: 'B-PER', start: 0, end: 3, score: 0.3 },
    ]);
    const d = new NerDetector({ loader: async () => stub, minScore: 0.5 });
    await d.ensureLoaded();
    const spans = await d.detect('Bob', []);
    expect(spans).toHaveLength(0);
  });

  it('emits llm-addresses source for LOC entities', async () => {
    const stub = makePipeline([
      { word: 'Boston', entity: 'B-LOC', start: 0, end: 6, score: 0.95 },
    ]);
    const d = new NerDetector({ loader: async () => stub });
    await d.ensureLoaded();
    const spans = await d.detect('Boston is a city', []);
    expect(spans[0].source).toBe('llm-addresses');
    expect(spans[0].label).toBe('ADDRESS');
  });

  it('emits llm-other source for ORG entities', async () => {
    const stub = makePipeline([
      { word: 'Acme', entity: 'B-ORG', start: 0, end: 4, score: 0.95 },
    ]);
    const d = new NerDetector({ loader: async () => stub });
    await d.ensureLoaded();
    const spans = await d.detect('Acme Corp', []);
    expect(spans[0].source).toBe('llm-other');
    expect(spans[0].label).toBe('OTHER');
  });

  it('returns [] for empty text', async () => {
    const stub = makePipeline([]);
    const d = new NerDetector({ loader: async () => stub });
    await d.ensureLoaded();
    const spans = await d.detect('', []);
    expect(spans).toEqual([]);
  });

  it('reports load progress to the callback', async () => {
    const stub = makePipeline([]);
    const progressLog: number[] = [];
    const d = new NerDetector({
      loader: async (onProgress) => {
        onProgress?.({ status: 'downloading', progress: 0.5, downloaded: 50, total: 100 });
        onProgress?.({ status: 'ready', progress: 1.0, downloaded: 100, total: 100 });
        return stub;
      },
    });
    await d.ensureLoaded((p) => progressLog.push(p.progress));
    expect(progressLog).toContain(0.5);
    expect(progressLog).toContain(1.0);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd web && npm run test:unit -- ner-detector
```

- [ ] **Step 3: Implement progress type**

Create `web/src/detection/ner/progress.ts`:

```typescript
export interface ModelLoadProgress {
  status: 'downloading' | 'unpacking' | 'initializing' | 'ready' | 'error';
  progress: number;       // 0.0 - 1.0
  downloaded?: number;    // bytes
  total?: number;         // bytes
  message?: string;
}

export type ProgressCallback = (p: ModelLoadProgress) => void;
```

- [ ] **Step 4: Implement detector**

Create `web/src/detection/ner/ner-detector.ts`:

```typescript
import type { Detector, Span, SpanLabel, SpanSource } from '../../types.js';
import { groupBioTokens, type TokenEntity } from './alignment.js';
import type { ProgressCallback } from './progress.js';
import { randomUUID } from 'node:crypto';

export type NerPipelineFn = (text: string) => Promise<TokenEntity[]>;

export interface NerDetectorOptions {
  loader: (onProgress?: ProgressCallback) => Promise<NerPipelineFn>;
  minScore?: number;       // default 0.5
}

const SOURCE_BY_LABEL: Record<SpanLabel, SpanSource> = {
  NAME: 'llm-names',
  ADDRESS: 'llm-addresses',
  OTHER: 'llm-other',
  // The rest aren't emitted by NER but need defaults to satisfy the type
  SSN: 'llm-other',
  EIN: 'llm-other',
  PHONE: 'llm-other',
  EMAIL: 'llm-other',
  DATE: 'llm-other',
  LOAN_NUM: 'llm-other',
  ZIP: 'llm-other',
  DOLLAR: 'llm-other',
  CUSTOM: 'manual',
};

export class NerDetector implements Detector {
  readonly name = 'ner';
  private opts: Required<NerDetectorOptions>;
  private pipeline: NerPipelineFn | null = null;

  constructor(opts: NerDetectorOptions) {
    this.opts = {
      minScore: 0.5,
      ...opts,
    };
  }

  async ensureLoaded(onProgress?: ProgressCallback): Promise<void> {
    if (this.pipeline) return;
    this.pipeline = await this.opts.loader(onProgress);
  }

  async detect(text: string, _alreadyFound: Span[]): Promise<Span[]> {
    if (!text) return [];
    if (!this.pipeline) await this.ensureLoaded();
    const tokens = await this.pipeline!(text);
    const grouped = groupBioTokens(tokens);
    const out: Span[] = [];
    for (const g of grouped) {
      if (g.score < this.opts.minScore) continue;
      out.push({
        id: randomUUID(),
        source: SOURCE_BY_LABEL[g.label],
        label: g.label,
        text: g.text,
        start: g.start,
        end: g.end,
        bbox: { x: 0, y: 0, width: 0, height: 0, pageNum: -1 },
        confidence: g.score,
        decision: 'pending',
      });
    }
    return out;
  }
}
```

- [ ] **Step 5: Run test (expect PASS)**

```bash
cd web && npm run test:unit -- ner-detector
```

- [ ] **Step 6: Commit**

```bash
git add web/src/detection/ner/ner-detector.ts web/src/detection/ner/progress.ts web/tests/unit/ner-detector.test.ts
git commit -m "feat: NerDetector with injected pipeline for testability"
```

---

## Task 5: Real model loader

Wire up the actual `@huggingface/transformers` pipeline. This is a thin adapter — the heavy lifting is the library's; we provide a `NerPipelineFn` that conforms to our interface.

**Files:**
- Create: `web/src/detection/ner/transformers-loader.ts`

- [ ] **Step 1: Implement the loader (no test here — tested via integration test in Task 6)**

Create `web/src/detection/ner/transformers-loader.ts`:

```typescript
import type { NerPipelineFn } from './ner-detector.js';
import type { ProgressCallback } from './progress.js';
import type { TokenEntity } from './alignment.js';

const MODEL_ID = 'Xenova/bert-base-NER';

export async function loadTransformersNer(
  onProgress?: ProgressCallback,
): Promise<NerPipelineFn> {
  // Dynamic import keeps the heavy dep lazy — only loaded when the user opts into NER.
  const { pipeline } = await import('@huggingface/transformers');

  const progressCallback = (data: {
    status: string;
    progress?: number;
    loaded?: number;
    total?: number;
    file?: string;
  }) => {
    if (!onProgress) return;
    if (data.status === 'progress' && data.loaded !== undefined && data.total) {
      onProgress({
        status: 'downloading',
        progress: data.loaded / data.total,
        downloaded: data.loaded,
        total: data.total,
        message: data.file,
      });
    } else if (data.status === 'ready') {
      onProgress({ status: 'ready', progress: 1.0 });
    } else if (data.status === 'initiate') {
      onProgress({ status: 'initializing', progress: 0, message: data.file });
    }
  };

  // The library's `pipeline()` constructor accepts `progress_callback`.
  const ner = await pipeline('token-classification', MODEL_ID, {
    progress_callback: progressCallback,
  } as Parameters<typeof pipeline>[2]);

  return async (text: string): Promise<TokenEntity[]> => {
    if (!text || text.trim().length === 0) return [];
    const result = (await ner(text)) as Array<{
      word: string;
      entity: string;
      start?: number;
      end?: number;
      score: number;
      index?: number;
    }>;
    return result
      .filter((r) => r.start !== undefined && r.end !== undefined)
      .map((r) => ({
        word: r.word,
        entity: r.entity,
        start: r.start as number,
        end: r.end as number,
        score: r.score,
      }));
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/detection/ner/transformers-loader.ts
git commit -m "feat: Transformers.js loader for bert-base-NER"
```

---

## Task 6: Integration test with real model

This downloads ~110MB on first run and is slower (~5-15 sec per page) — runs as a separate "slow" test. We verify the model finds the borrower name and address in our HUD-1 fixture.

**Files:**
- Create: `web/tests/integration/ner-real-model.test.ts`
- Modify: `web/vitest.config.ts` (extend testTimeout for this file)

- [ ] **Step 1: Update vitest config to allow longer timeouts**

Replace `web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
    testTimeout: 30000,
    // Real-model tests can take 1-2 minutes on first run (model download)
    hookTimeout: 180000,
  },
});
```

- [ ] **Step 2: Write the integration test**

Create `web/tests/integration/ner-real-model.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPdf } from '../../src/pdf/load.js';
import { extractPage } from '../../src/pdf/extract.js';
import { NerDetector } from '../../src/detection/ner/ner-detector.js';
import { loadTransformersNer } from '../../src/detection/ner/transformers-loader.js';

const FIXTURE = path.resolve('tests/fixtures/hud1_garcia.pdf');

// Skip this entire file in CI by default; gate behind RUN_NER_TESTS=1
const SHOULD_RUN = process.env.RUN_NER_TESTS === '1';

describe.skipIf(!SHOULD_RUN)('NerDetector with real model', () => {
  let detector: NerDetector;

  beforeAll(async () => {
    detector = new NerDetector({ loader: loadTransformersNer });
    await detector.ensureLoaded((p) => {
      if (p.status === 'downloading' && p.progress > 0) {
        process.stdout.write(`\r  loading: ${Math.round(p.progress * 100)}% `);
      }
    });
    process.stdout.write('\n');
  }, 180000);

  it('finds the borrower name in the fixture', async () => {
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const ext = extractPage(doc.getPage(0));
    const spans = await detector.detect(ext.text, []);
    doc.close();

    const names = spans.filter((s) => s.label === 'NAME').map((s) => s.text);
    // bert-base-NER is imperfect — accept partial match (any token containing "Garcia" qualifies)
    expect(names.some((n) => n.toLowerCase().includes('garcia'))).toBe(true);
  });

  it('finds at least one location/address span', async () => {
    const buf = fs.readFileSync(FIXTURE);
    const doc = await loadPdf(buf);
    const ext = extractPage(doc.getPage(0));
    const spans = await detector.detect(ext.text, []);
    doc.close();
    const addrs = spans.filter((s) => s.label === 'ADDRESS');
    expect(addrs.length).toBeGreaterThan(0);
  });
}, 60000);
```

- [ ] **Step 3: Run the integration test (slow — first run downloads model)**

```bash
cd web && RUN_NER_TESTS=1 npm run test:integration -- ner-real-model
```

Expected: model downloads (~110MB, 30-90 sec), then both tests pass. If a name like "Maria L. Garcia" isn't fully captured but "Garcia" is, that's expected behavior for bert-base-NER — partial matches are acceptable since the human reviewer extends spans manually.

- [ ] **Step 4: Run again to confirm cached model is fast**

```bash
RUN_NER_TESTS=1 npm run test:integration -- ner-real-model
```

Expected: ~5-10 sec total (no download).

- [ ] **Step 5: Commit**

```bash
git add web/vitest.config.ts web/tests/integration/ner-real-model.test.ts
git commit -m "test: integration test for NerDetector with real bert-base-NER model"
```

---

## Task 7: CLI integration — add --detector flag

**Files:**
- Modify: `web/scripts/redact-cli.ts`

- [ ] **Step 1: Update the CLI**

Replace `web/scripts/redact-cli.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPdf } from '../src/pdf/load.js';
import { extractPage } from '../src/pdf/extract.js';
import { detectPage } from '../src/detection/index.js';
import { RegexDetector } from '../src/detection/detectors/regex-detector.js';
import { NerDetector } from '../src/detection/ner/ner-detector.js';
import { loadTransformersNer } from '../src/detection/ner/transformers-loader.js';
import { redactDocument } from '../src/output/redactor.js';
import { verifyDollarPreservation } from '../src/output/dollar-verifier.js';
import { ValueMapper } from '../src/mapping/value-mapper.js';
import type { Detector, Mode, Span } from '../src/types.js';

interface Args {
  mode: Mode;
  input: string;
  output: string;
  seed?: number;
  detector: 'regex' | 'ner' | 'both';
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { mode: 'redact', detector: 'regex' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i] as Mode;
    else if (a === '--in') args.input = argv[++i];
    else if (a === '--out') args.output = argv[++i];
    else if (a === '--seed') args.seed = parseInt(argv[++i], 10);
    else if (a === '--detector') args.detector = argv[++i] as Args['detector'];
  }
  if (!args.input || !args.output) {
    console.error(
      'Usage: tsx scripts/redact-cli.ts --mode {redact|sandbox} --in <pdf> --out <pdf> [--seed N] [--detector {regex|ner|both}]',
    );
    process.exit(1);
  }
  return args as Args;
}

async function buildDetectors(choice: Args['detector']): Promise<Detector[]> {
  const out: Detector[] = [];
  if (choice === 'regex' || choice === 'both') {
    out.push(new RegexDetector());
  }
  if (choice === 'ner' || choice === 'both') {
    const ner = new NerDetector({ loader: loadTransformersNer });
    process.stderr.write('Loading NER model... ');
    await ner.ensureLoaded((p) => {
      if (p.status === 'downloading' && p.progress > 0) {
        process.stderr.write(`\rLoading NER model: ${Math.round(p.progress * 100)}% `);
      }
    });
    process.stderr.write('\rNER model ready.                  \n');
    out.push(ner);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputBytes = fs.readFileSync(path.resolve(args.input));
  const detectors = await buildDetectors(args.detector);
  const inputDoc = await loadPdf(inputBytes);

  const mapper = args.mode === 'sandbox' ? new ValueMapper(args.seed) : null;
  const inputPages: string[] = [];
  const allSpans: Span[] = [];

  for (let i = 0; i < inputDoc.pageCount; i++) {
    const ext = extractPage(inputDoc.getPage(i), i);
    inputPages.push(ext.text);
    const detected = await detectPage(ext.text, detectors);
    for (const s of detected) {
      const bbox = ext.bboxRange(s.start, s.end);
      if (!bbox) continue;
      const span: Span = {
        ...s,
        bbox: { ...bbox, pageNum: i },
        decision: 'accepted',
      };
      if (mapper) span.replacement = mapper.mapValue(s.label, s.text);
      allSpans.push(span);
    }
  }
  inputDoc.close();

  const outputBytes = await redactDocument(inputBytes, allSpans, { mode: args.mode });

  const outputDoc = await loadPdf(outputBytes);
  const outputPages: string[] = [];
  for (let i = 0; i < outputDoc.pageCount; i++) {
    outputPages.push(extractPage(outputDoc.getPage(i), i).text);
  }
  outputDoc.close();

  const verification = verifyDollarPreservation(inputPages, outputPages);
  if (!verification.ok) {
    console.error('DOLLAR VERIFICATION FAILED — refusing to write output.');
    console.error(JSON.stringify(verification.diffs, null, 2));
    process.exit(2);
  }

  fs.writeFileSync(path.resolve(args.output), outputBytes);
  console.log(`Wrote ${args.output}`);
  console.log(`Detectors used: ${detectors.map((d) => d.name).join(', ')}`);
  console.log(`Spans applied: ${allSpans.length}`);
  if (mapper) {
    const reportPath = args.output.replace(/\.pdf$/, '.mappings.json');
    fs.writeFileSync(reportPath, JSON.stringify(mapper.getMappingReport(), null, 2));
    console.log(`Mappings: ${reportPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the CLI with NER on a fixture**

```bash
cd web
npm run redact -- --mode redact --in tests/fixtures/hud1_garcia.pdf --out /tmp/garcia.ner.pdf --detector both
```

Expected: model loads (cached after first run), runs detection, applies > 8 spans (the regex 8 plus several NER additions for names/addresses), writes the output.

```bash
open /tmp/garcia.ner.pdf
```

Verify visually: not just SSN/phone/etc. blacked out, but also names like "Maria L. Garcia" and addresses.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/redact-cli.ts
git commit -m "feat: CLI --detector flag for regex|ner|both"
```

---

## Task 8: Update README with NER usage

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1: Update**

Replace `web/README.md` with:

```markdown
# hudscrub-web

Browser-based HUD-1 redaction tool with human review and on-device AI detection.

This is the engine library for the upcoming web app. See `../docs/superpowers/specs/2026-04-24-hudscrub-web-design.md` for the full design.

## Develop

```bash
npm install --legacy-peer-deps
npm run gen-fixtures   # generates test PDFs (one-time)
npm test
```

## Sanity-check the engine

Regex-only (fast, deterministic):
```bash
npm run redact -- --mode redact --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf
```

With NER (catches names and addresses):
```bash
npm run redact -- --mode redact --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf --detector both
```

The first NER run downloads ~110MB (Xenova/bert-base-NER); cached on disk afterwards.

Sandbox mode (deterministic fake replacements):
```bash
npm run redact -- --mode sandbox --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf --seed 42
```

## Test commands

```bash
npm test                                 # all unit + fast integration
RUN_NER_TESTS=1 npm test                 # also runs slow NER integration tests
```
```

- [ ] **Step 2: Commit**

```bash
git add web/README.md
git commit -m "docs: README usage for NER detector"
```

---

## Task 9: Final acceptance

- [ ] **Step 1: Full local CI pass**

```bash
cd web
npm run typecheck
npm run lint
npm test
```

Expected: all green; new tests counted (≥ 95 passing total).

- [ ] **Step 2: Slow path: real-model integration**

```bash
RUN_NER_TESTS=1 npm test -- ner-real-model
```

Expected: 2 NER integration tests pass (with model downloaded if not cached).

- [ ] **Step 3: Tag**

```bash
cd /Users/rynfar/Downloads/hudscrub-project
git tag -a llm-detection-v1 -m "Plan 2 (LLM Detection) complete: NER detector via Transformers.js"
```

---

## Acceptance criteria for Plan 2

- [ ] `NerDetector` implements the `Detector` interface
- [ ] BIO token grouping is correct (consecutive same-type tokens merged into one span)
- [ ] NER label mapping is correct (PER→NAME, LOC→ADDRESS, ORG/MISC→OTHER)
- [ ] Score threshold filtering works (default 0.5)
- [ ] Real model loads via `@huggingface/transformers` and finds entities in fixtures
- [ ] CLI `--detector both` runs regex + NER
- [ ] Detection invariants from Plan 1 still hold (regex beats NER in merge; dollar amounts never touched)
- [ ] Plan 1's 82 tests still pass
- [ ] PR-blocking CI doesn't run real-model tests (slow + flaky); they're gated by `RUN_NER_TESTS=1`

---

## Follow-on plans (NOT in this plan)

| Plan | Scope |
|---|---|
| **3 — Review UI** | Next.js scaffold, upload, PDF render, span overlays, keyboard review, manual add, streaming, export. **Adds:** WebLLM-based detectors (Phi-4-mini, Gemma) since browser environment is now present. |
| **4 — Polish + deploy** | Onboarding, settings, multi-doc batch, privacy E2E, CI extensions, Vercel deploy. |
