# hudscrub-web Ship — Implementation Plan

**Goal:** Take the working app (Plans 1–3) from "runs locally" to "shipped." Close the manual-span-add gap, add multi-document batch handling, prove the privacy claim with an E2E test, and deploy to Vercel.

**What's deferred:** Full WebLLM integration (Phi/Gemma in browser via `@mlc-ai/web-llm`) — the bert-NER model is functional and shipping with that as v1 is honest. WebLLM becomes a Plan 5 if the user wants the in-browser large-model option.

**Tech additions:**
- `@playwright/test` for E2E
- A `vercel.json` for the deployment

---

## Tasks

### Task 1: Manual span addition via PDF.js text layer

**Files:**
- Modify: `web/src/pdf/browser-renderer.ts` (add `renderTextLayer`)
- Modify: `web/src/review/PdfPage.tsx` (overlay text layer for selection)
- Create: `web/src/review/ManualSelect.tsx`
- Modify: `web/src/review/DocumentView.tsx` (wire the manual handler)

PDF.js exposes a `TextLayer` that overlays selectable text spans on the canvas. The user selects text in the rendered PDF, presses `R`, and the selection becomes a manual span. Bbox comes from the selection's bounding rect, mapped back to PDF coords.

Implementation outline:

1. Add to `RenderedPage`:
   ```typescript
   renderTextLayer: (container: HTMLDivElement) => Promise<void>;
   ```
   Implementation uses `pdfjsLib.TextLayer` with the same viewport.

2. Add a `<div ref={textLayerRef} className="absolute inset-0 select-text" />` to `PdfPage` between the canvas and the spans overlay.

3. `ManualSelect` component listens for `R` keydown when text is selected. When fired:
   - Read `window.getSelection()` text
   - Compute bounding `DOMRect` of the selection
   - Find the parent canvas's `getBoundingClientRect()` to compute relative coords
   - Convert from CSS pixels (rendered at scale 1.5) to PDF user-space coords (divide by 1.5)
   - Compute `start`/`end` char offsets in `pageState.text` via `text.indexOf(selectedText)`
   - Add a manual span with `decision: 'accepted'`, `source: 'manual'`, `label: 'CUSTOM'`

4. Update keyboard hint footer to include `R add`.

### Task 2: Multi-document batch queue UI

**Files:**
- Create: `web/src/review/DocumentQueue.tsx` — a left rail with all uploaded documents
- Modify: `web/app/upload/page.tsx` (after upload, route to first doc)
- Modify: `web/src/review/DocumentView.tsx` (show queue when more than one doc)

The drop zone already accepts multiple files (Plan 3 Task 4). The queue panel shows them as a vertical list on the far left of the review screen with status indicators (detecting / pending review / done). Clicking jumps to that document. A shared `ValueMapper` instance is reused across the batch so sandbox replacements stay consistent across files.

For the shared mapper: lift it from per-document to the document store as `batchMapper: ValueMapper | null` initialized when the first sandbox doc is opened.

### Task 3: Privacy assertion E2E test

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/tests/e2e/privacy.spec.ts`
- Modify: `web/package.json` (add `test:e2e` script)

The test runs a full upload → detect → review → export flow in a real browser, intercepting all network requests and asserting that none contain PDF bytes or extracted text. This is the load-bearing trust test from the spec.

```typescript
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

test('privacy: no PDF bytes or page text leave the browser', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, '../fixtures/hud1_garcia.pdf');
  const fixtureBytes = fs.readFileSync(fixturePath);
  const fixtureText = ['Maria L. Garcia', '521-44-9012', '1428 Oak Hollow']; // sample sensitive strings

  // Capture every outgoing request body
  const outgoing: Array<{ url: string; postData: string | null }> = [];
  page.on('request', (req) => {
    outgoing.push({ url: req.url(), postData: req.postData() });
  });

  await page.goto('/');
  await page.click('text=Get started');
  // Skip onboarding for the test
  await page.click('text=Skip');
  // Upload
  const [filePicker] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('text=choose a file'),
  ]);
  await filePicker.setFiles(fixturePath);

  await page.waitForURL(/\/review\//);
  await page.waitForSelector('canvas'); // PDF rendered
  // Give detection a chance to run
  await page.waitForTimeout(5000);

  // Assert no outgoing request body contains the fixture bytes or any sensitive text
  const fixtureBytesStr = fixtureBytes.toString('binary').slice(0, 200); // first chunk as fingerprint
  for (const req of outgoing) {
    const body = req.postData ?? '';
    expect(body).not.toContain(fixtureBytesStr.slice(0, 50));
    for (const sensitive of fixtureText) {
      expect(body).not.toContain(sensitive);
    }
  }
});
```

(The test is approximate — real PII could be encoded, but the spirit is: no plain-text or raw-bytes payload of the user's PDF should ever cross the network.)

### Task 4: Vercel deployment config

**Files:**
- Create: `web/vercel.json`
- Create: `vercel.json` at root pointing to `web/` as the project dir, OR the user runs `cd web && vercel` directly

Vercel auto-detects Next.js so `vercel.json` is mostly defaults. We set:
- Cache headers for the `_next/static` chunks (long max-age, immutable)
- Security headers (Content-Security-Policy that allows the WASM blob and HuggingFace model CDN)
- `noindex` for the deployment (already in `<meta name="robots">` from Plan 3)

The actual deploy is `cd web && vercel`. First-time interactive setup: link to a project, choose scope, deploy. The user does this; we just provide the config.

### Task 5: Polish + README + tag

- Update top-level README with a "Live demo" section once deployed
- Add a `web/README.md` "Deploy" section with `vercel` instructions
- Tag `ship-v1`

---

## Acceptance criteria

- [ ] User can select text in the rendered PDF and press R to add a manual span
- [ ] Dropping multiple PDFs at once shows a queue and lets the user navigate between them
- [ ] Sandbox mode preserves consistency across all documents in a batch
- [ ] `npm run test:e2e` passes the privacy assertion test in headless Chrome
- [ ] `cd web && vercel deploy` produces a working deployment URL
- [ ] All existing tests (Plans 1–3) still pass
